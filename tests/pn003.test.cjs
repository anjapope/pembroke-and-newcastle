const assert = require("node:assert/strict");
const { test } = require("node:test");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  window: {
    PN_APP: { getSession: () => null },
    PN_ACQUISITIONS: { getCatalogCount: () => 0 },
    addEventListener() {}
  },
  document: {
    getElementById: () => ({
      addEventListener() {}, append() {}, replaceChildren() {}, dataset: {}
    }),
    createElement: () => ({ append() {} })
  },
  Intl
});
for (const file of ["institutions.js", "technical-services.js"]) {
  vm.runInContext(readFileSync(path.join(root, "js", file), "utf8"), context);
}
const api = context.window.PN_TECHNICAL_SERVICES;
const institutions = context.window.PN_INSTITUTIONS;
const catalog = JSON.parse(readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
const now = "2026-01-02T10:00:00.000Z";
const clone = value => JSON.parse(JSON.stringify(value));

function fixture(categoryId = "public-library", itemId = "PN002", code = "ANF") {
  const item = catalog.find(record => record.id === itemId);
  return {
    requisitionId: "PN-TEST-0001",
    clientId: "test",
    submittedAt: now,
    institutionSnapshot: { institutionName: "Test Institution", categoryId, department: "Collections" },
    lines: [{
      catalogId: item.id, title: item.title, quantity: 1,
      unitPriceCents: item.unitPriceCents, extendedPriceCents: item.unitPriceCents,
      collectionCode: code, fundCode: "GENERAL", selectorNote: ""
    }],
    totalCents: item.unitPriceCents,
    justification: "",
    financialAcknowledgment: null
  };
}

function validate(snapshot, overrides = {}) {
  return api.validateSnapshot(snapshot, {
    catalog, institutions, clientId: "test", committedCents: 0, ...overrides
  });
}

function hasError(outcome, code, procedure) {
  const error = outcome.errors.find(entry => entry.code === code);
  assert.ok(error, `Expected ${code}; got ${JSON.stringify(outcome.errors)}`);
  assert.ok(error.message && error.correctiveAction);
  if (procedure) assert.ok(error.procedure.includes(`Procedure ${procedure}:`));
  return error;
}

function acknowledgment(allocation, committed, proposed) {
  return {
    acknowledged: true, acknowledgedAt: now,
    annualAllocationCents: allocation, previouslyCommittedCents: committed,
    proposedCents: proposed, projectedRemainingCents: allocation - committed - proposed,
    committedPercentage: Number(((committed + proposed) / allocation * 100).toFixed(2)),
    monthsRemaining: 11
  };
}

test("valid snapshot is accepted without mutation and validation is deterministic", () => {
  const snapshot = fixture();
  const original = JSON.stringify(snapshot);
  const result = validate(snapshot);
  assert.equal(result.valid, true);
  assert.equal(result.computedTotalCents, 2495);
  assert.equal(JSON.stringify(snapshot), original);
  assert.equal(JSON.stringify(validate(snapshot)), JSON.stringify(result));
});

for (const [field, value, code] of [
  ["requisitionId", "", "invalid_requisition_id"],
  ["clientId", "another-client", "invalid_client_id"],
  ["submittedAt", "invalid", "missing_submission_timestamp"],
  ["lines", [], "missing_line_items"],
  ["institutionSnapshot", null, "invalid_institution"]
]) {
  test(`mandatory field: ${code}`, () => {
    const snapshot = fixture();
    snapshot[field] = value;
    hasError(validate(snapshot), code, "3-F");
  });
}

test("malformed snapshots and lines produce structured errors rather than throwing", () => {
  for (const snapshot of [null, [], 42]) hasError(validate(snapshot), "invalid_snapshot", "3-F");
  const snapshot = fixture();
  snapshot.lines = [null];
  hasError(validate(snapshot), "invalid_line", "3-F");
});

for (const institution of institutions) {
  test(`department rules: ${institution.id}`, () => {
    const snapshot = fixture(institution.id);
    snapshot.institutionSnapshot.department = "";
    const result = validate(snapshot);
    assert.equal(result.errors.some(error => error.code === "missing_department"), institution.requiresDepartment);
  });
}

for (const [value, code] of [["", "missing_collection_code"], ["SPEC", "invalid_collection_code"]]) {
  test(`collection field: ${code}`, () => {
    const snapshot = fixture();
    snapshot.lines[0].collectionCode = value;
    const error = hasError(validate(snapshot), code, "14-C");
    assert.equal(error.lineNumber, 1);
    assert.equal(error.catalogId, "PN002");
  });
}

test("clearly incompatible collection cannot be overridden by a note", () => {
  const snapshot = fixture();
  snapshot.lines[0].collectionCode = "JF";
  snapshot.lines[0].selectorNote = "This is an explanation.";
  hasError(validate(snapshot), "incompatible_collection", "14-C");
});

test("reviewable collection requires only a nonempty explanation", () => {
  const snapshot = fixture();
  snapshot.lines[0].collectionCode = "REF";
  hasError(validate(snapshot), "collection_explanation_required", "14-C");
  snapshot.lines[0].selectorNote = "For the research desk.";
  assert.equal(validate(snapshot).valid, true);
});

test("contextual photograph, academic manuscript, and museum exhibition assignments", () => {
  assert.equal(api.classifyCollection(catalog.find(item => item.id === "PN081"), "LOCAL", institutions[0]), "valid");
  assert.equal(api.classifyCollection(catalog.find(item => item.id === "PN082"), "SPEC", institutions[1]), "valid");
  assert.equal(api.classifyCollection(catalog.find(item => item.id === "PN082"), "EXHIBIT", institutions[3]), "reviewable");
  assert.equal(api.classifyCollection(catalog.find(item => item.id === "PN082"), "RARE", institutions[2]), "valid");
});

test("general fund accepted; foreign fund rejected; unusual fund requires explanation", () => {
  const snapshot = fixture();
  assert.equal(validate(snapshot).valid, true);
  snapshot.lines[0].fundCode = "RESEARCH";
  hasError(validate(snapshot), "invalid_fund_code", "8-B");
  snapshot.lines[0].fundCode = "YOUTH";
  hasError(validate(snapshot), "fund_explanation_required", "8-B");
  snapshot.lines[0].selectorNote = "Used for intergenerational programming.";
  assert.equal(validate(snapshot).valid, true);
});

for (const quantity of [0, -1, 1.5, "2", "invalid", null, 100, Number.MAX_SAFE_INTEGER]) {
  test(`invalid quantity: ${JSON.stringify(quantity)}`, () => {
    const snapshot = fixture();
    snapshot.lines[0].quantity = quantity;
    hasError(validate(snapshot), "invalid_quantity", "11-A");
  });
}

test("unique catalog items are limited to one and duplicate lines cannot bypass the limit", () => {
  const snapshot = fixture("public-library", "PN081", "LOCAL");
  snapshot.lines[0].quantity = 2;
  hasError(validate(snapshot), "invalid_quantity", "11-A");
  snapshot.lines[0].quantity = 1;
  snapshot.lines.push(clone(snapshot.lines[0]));
  snapshot.totalCents *= 2;
  hasError(validate(snapshot), "duplicate_catalog_line", "11-A");
});

test("catalog references, prices, extended prices and total are independently checked", () => {
  const snapshot = fixture();
  snapshot.lines[0].catalogId = "NOT-A-CATALOG-ITEM";
  hasError(validate(snapshot), "invalid_catalog_reference", "3-F");
  snapshot.lines[0].catalogId = "PN002";
  snapshot.lines[0].unitPriceCents = 1;
  snapshot.lines[0].extendedPriceCents = 1;
  snapshot.totalCents = 1;
  const result = validate(snapshot);
  hasError(result, "catalog_price_mismatch", "11-A");
  hasError(result, "line_total_mismatch", "11-A");
  hasError(result, "requisition_total_mismatch", "11-A");
  assert.equal(result.computedTotalCents, 2495);
});

test("budget shortfall is exact and exact-balance processing is permitted", () => {
  const snapshot = fixture();
  const committed = 500000 - snapshot.totalCents + 1;
  const result = validate(snapshot, { committedCents: committed });
  assert.equal(result.shortfallCents, 1);
  assert.ok(hasError(result, "budget_overage", "22-D").message.includes("$0.01"));
  const exact = committed - 1;
  snapshot.financialAcknowledgment = acknowledgment(500000, exact, snapshot.totalCents);
  assert.equal(validate(snapshot, { committedCents: exact }).valid, true);
});

test("80 percent is cumulative, exact, and acknowledgment is tied to current financial facts", () => {
  const snapshot = fixture();
  const committed = 400000 - snapshot.totalCents;
  assert.equal(validate(snapshot, { committedCents: committed - 1 }).valid, true);
  hasError(validate(snapshot, { committedCents: committed }), "missing_financial_acknowledgment", "22-D");
  snapshot.financialAcknowledgment = acknowledgment(500000, committed, snapshot.totalCents);
  assert.equal(validate(snapshot, { committedCents: committed }).valid, true);
  hasError(validate(snapshot, { committedCents: committed + 1 }), "missing_financial_acknowledgment", "22-D");
  snapshot.financialAcknowledgment.acknowledged = false;
  hasError(validate(snapshot, { committedCents: committed }), "missing_financial_acknowledgment", "22-D");
});

for (const institution of institutions) {
  test(`one-time justification policy: ${institution.id}`, () => {
    const snapshot = fixture(institution.id);
    const allocation = institution.annualBudget * 100;
    const item = { ...catalog[1], unitPriceCents: allocation * 0.8 };
    snapshot.lines[0].unitPriceCents = item.unitPriceCents;
    snapshot.lines[0].extendedPriceCents = item.unitPriceCents;
    snapshot.lines[0].collectionCode = institution.id === "public-library" ? "ANF" : institution.collectionLines[0].code;
    snapshot.lines[0].selectorNote = "For institutional use.";
    snapshot.totalCents = item.unitPriceCents;
    snapshot.financialAcknowledgment = acknowledgment(allocation, 0, snapshot.totalCents);
    const options = { catalog: [item] };
    const result = validate(snapshot, options);
    assert.equal(result.errors.some(error => error.code === "missing_expenditure_justification"),
      !["public-library", "academic-library"].includes(institution.id));
    snapshot.justification = "Required institutional acquisition.";
    assert.equal(validate(snapshot, options).valid, true);
  });
}

test("invalid committed values cannot silently become an unspent budget", () => {
  for (const committedCents of [-1, NaN, Infinity, "0", Number.MAX_SAFE_INTEGER + 1]) {
    hasError(validate(fixture(), { committedCents }), "invalid_committed_total", "22-D");
  }
});

test("prior processing records prevent acceptance", () => {
  hasError(validate(fixture(), { hasPriorProcessingRecord: true }), "already_processed", "3-F");
});

test("review cannot use another institution's larger budget or another requisition's identity", () => {
  hasError(validate(fixture(), { categoryId: "school-library-media-center" }), "invalid_institution", "3-F");
  hasError(validate(fixture(), { requisitionId: "PN-TEST-0002" }), "invalid_requisition_id", "3-F");
});

test("unique restriction is independent of an inconsistent catalog maximum", () => {
  const snapshot = fixture("public-library", "PN081", "LOCAL");
  snapshot.lines[0].quantity = 2;
  const item = { ...catalog.find(entry => entry.id === "PN081"), maxQuantity: 99 };
  hasError(validate(snapshot, { catalog: [item] }), "invalid_quantity", "11-A");
});

test("quantity correspondence does not claim zero exceeds supplier inventory", () => {
  const snapshot = fixture();
  snapshot.lines[0].quantity = 0;
  const response = api.composeCorrespondence(validate(snapshot), snapshot.requisitionId, now);
  assert.ok(!response.message.includes("inventory cannot be increased"));
  assert.ok(response.message.includes("positive whole number"));
});

test("correspondence records the actual error, affected line and correct procedure", () => {
  const snapshot = fixture();
  snapshot.lines[0].collectionCode = "";
  const result = validate(snapshot);
  const response = api.composeCorrespondence(result, snapshot.requisitionId, now);
  assert.equal(response.status, "returned");
  assert.equal(response.errors.length, 1);
  assert.equal(response.errors[0].code, "missing_collection_code");
  assert.equal(response.errors[0].lineNumber, 1);
  assert.ok(response.message.includes("not an optional administrative convenience"));
  assert.ok(response.message.includes("Procedure 14-C"));
  assert.ok(!response.message.includes("!"));
  assert.equal(JSON.stringify(response), JSON.stringify(api.composeCorrespondence(result, snapshot.requisitionId, now)));
});

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const { generateCatalog, targets, seedDigest } = require("../scripts/generate-catalog.cjs");
const catalog = require("../data/catalog.json");
const root = path.join(__dirname, "..");
const context = vm.createContext({
  window: { PN_APP: { getSession: () => null }, PN_ACQUISITIONS: { getCatalogCount: () => 0 }, addEventListener() {} },
  document: {
    getElementById: () => ({ addEventListener() {}, replaceChildren() {}, dataset: {} }),
    createElement: () => ({ append() {} })
  },
  Intl
});
for (const name of ["institutions", "technical-services"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "js", `${name}.js`), "utf8"), context);
}
const policy = context.window.PN_TECHNICAL_SERVICES;
const institutions = context.window.PN_INSTITUTIONS;

test("exactly 1,500 unique stable catalog IDs and the six required distributions", () => {
  assert.equal(catalog.length, 1500);
  assert.equal(new Set(catalog.map(item => item.id)).size, 1500);
  const counts = {};
  for (const item of catalog) counts[item.catalogGroup] = (counts[item.catalogGroup] || 0) + 1;
  assert.deepEqual(counts, targets);
});

test("all original record fields and prices remain unchanged", () => {
  const seed = catalog.slice(0, 100).map(({ catalogGroup, ...item }) => item);
  assert.equal(createHash("sha256").update(JSON.stringify(seed)).digest("hex"), seedDigest);
});

test("generation is byte-reproducible, idempotent and rejects a modified seed", () => {
  assert.equal(JSON.stringify(generateCatalog(catalog), null, 2) + "\n",
    fs.readFileSync(path.join(root, "data", "catalog.json"), "utf8"));
  const changed = structuredClone(catalog);
  changed[0].unitPriceCents++;
  assert.throws(() => generateCatalog(changed), /original 100 records changed/);
});

test("all required metadata, prices, quantities and simulation disclaimers are valid", () => {
  for (const item of catalog) {
    for (const key of ["id", "title", "creator", "catalogGroup", "materialCategory", "format",
      "creationDate", "publisherDescription", "description", "availability"]) {
      assert.equal(typeof item[key], "string", `${item.id}: ${key}`);
      assert.ok(item[key].trim(), `${item.id}: ${key}`);
    }
    assert.ok(Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents > 0, item.id);
    assert.ok(Number.isSafeInteger(item.maxQuantity) && item.maxQuantity > 0, item.id);
    assert.equal(typeof item.unique, "boolean");
    if (item.unique) assert.equal(item.maxQuantity, 1, item.id);
    assert.ok(item.metadata.fictionalRecord === true || item.metadata.source === "fictional simulation", item.id);
    assert.match(item.metadata.identifierStatus, /no verified|No verified/);
    assert.match(item.publisherDescription + item.description, /fictional|simulat/i);
    assert.ok(!/\b97[89]\d{10}\b|\bISBN\s*[:\d]/i.test(JSON.stringify(item)), item.id);
  }
});

test("inventory has varied titles, affordable circulating books and legitimately expensive unique offerings", () => {
  assert.equal(new Set(catalog.map(item => item.title)).size, 1500);
  const ordinary = catalog.filter(item => item.format === "Print book");
  assert.ok(ordinary.filter(item => item.unitPriceCents <= 5000).length > 700);
  assert.ok(catalog.some(item => item.unique && item.unitPriceCents > 1000000));
  assert.ok(new Set(catalog.map(item => item.creator)).size >= 30);
});

function snapshot(item, institution, code) {
  return {
    requisitionId: "PN-TEST-0001", clientId: "test", submittedAt: "2026-10-30T12:00:00Z",
    institutionSnapshot: { institutionName: "Test", categoryId: institution.id, department: "Collections" },
    lines: [{
      catalogId: item.id, title: item.title, quantity: 1, unitPriceCents: item.unitPriceCents,
      extendedPriceCents: item.unitPriceCents, collectionCode: code, fundCode: "GENERAL",
      selectorNote: "Selected for the institution's research and interpretation programme."
    }],
    totalCents: item.unitPriceCents, justification: "One-time acquisition for institutional study."
  };
}

for (const institution of institutions) {
  test(`every catalog category/format has a defined defensible assignment: ${institution.id}`, () => {
    const pairs = new Map(catalog.map(item => [`${item.materialCategory}|${item.format}`, item]));
    for (const item of pairs.values()) {
      const code = institution.collectionLines.find(line =>
        ["valid", "reviewable"].includes(policy.classifyCollection(item, line.code, institution)))?.code;
      assert.ok(code, `${institution.id}: ${item.materialCategory} / ${item.format}`);
      const record = snapshot(item, institution, code);
      const result = policy.validateSnapshot(record, {
        catalog, institutions, clientId: "test", committedCents: 0
      });
      assert.ok(!result.errors.some(error => /collection|catalog_policy|fund/.test(error.code)),
        `${item.id}: ${JSON.stringify(result.errors)}`);
      assert.ok(result.errors.every(error =>
        ["budget_overage", "missing_financial_acknowledgment"].includes(error.code)));
    }
  });
}

test("every inventory item is recognized by the compatibility policy", () => {
  for (const item of catalog) {
    assert.notEqual(policy.classifyCollection(item, "REF", institutions[0]), "unsupported", item.id);
  }
});

test("picture books have a conventional school E designation", () => {
  const item = catalog.find(item => item.format === "Picture book");
  assert.ok(item);
  assert.equal(policy.classifyCollection(item, "E", institutions[4]), "valid");
});

test("all unique offerings reject quantity two, including new expensive objects", () => {
  for (const item of catalog.filter(item => item.unique)) {
    const record = snapshot(item, institutions[0], "LOCAL");
    record.lines[0].quantity = 2;
    record.lines[0].extendedPriceCents *= 2;
    record.totalCents *= 2;
    const result = policy.validateSnapshot(record, { catalog, institutions, clientId: "test", committedCents: 0 });
    assert.ok(result.errors.some(error => error.code === "invalid_quantity"), item.id);
  }
});

test("new adult nonfiction rejects juvenile fiction and accepts explained reference use", () => {
  const item = catalog.slice(100).find(item => item.materialCategory === "Adult nonfiction");
  assert.equal(policy.classifyCollection(item, "JF", institutions[0]), "invalid");
  assert.equal(policy.classifyCollection(item, "REF", institutions[0]), "reviewable");
  const result = policy.validateSnapshot(snapshot(item, institutions[0], "REF"),
    { catalog, institutions, clientId: "test", committedCents: 0 });
  assert.equal(result.valid, true);
});

test("unknown categories report a configuration problem, not blanket acceptance or arbitrary rejection", () => {
  const item = { ...catalog[0], materialCategory: "Unconfigured category" };
  assert.equal(policy.classifyCollection(item, "AF", institutions[0]), "unsupported");
  const result = policy.validateSnapshot(snapshot(item, institutions[0], "AF"),
    { catalog: [item], institutions, clientId: "test", committedCents: 0 });
  assert.ok(result.errors.some(error => error.code === "unsupported_catalog_policy"));
});

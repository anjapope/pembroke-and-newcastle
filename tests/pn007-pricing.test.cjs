const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const pricing = require("../js/pricing.js");
const catalog = require("../data/catalog.json");

const printBook = catalog.find(item => item.format === "Print book");
const nonPrint = catalog.find(item => item.format !== "Print book");

test("adult print books offer trade, mass-market, and hardcover simulation pricing", () => {
  const formats = pricing.getFormatOptions(printBook);
  assert.deepEqual(formats.map(({ id, unitPriceCents }) => [id, unitPriceCents]), [
    ["trade-paperback", printBook.unitPriceCents],
    ["mass-market-paperback", Math.round(printBook.unitPriceCents * 0.75)],
    ["hardcover", Math.round(printBook.unitPriceCents * 1.35)]
  ]);
});

test("large print is excluded unless catalog metadata explicitly supports it", () => {
  const formats = pricing.getFormatOptions(printBook);
  assert.ok(!formats.some(format => format.id.startsWith("large-print-")));
  const supported = {
    ...printBook,
    metadata: { ...printBook.metadata, largePrintFormats: ["large-print-paperback"] }
  };
  assert.deepEqual(pricing.getFormatOptions(supported).map(format => format.id), [
    "trade-paperback", "mass-market-paperback", "hardcover", "large-print-paperback"
  ]);
  assert.equal(pricing.getFormat(supported, "large-print-paperback").unitPriceCents,
    Math.round(printBook.unitPriceCents * 1.4));
  const youngAdult = catalog.find(item =>
    item.materialCategory === "Young adult materials" && item.format === "Print book"
  );
  const supportedYoungAdult = {
    ...youngAdult,
    metadata: { ...youngAdult.metadata, eligibleFormats: ["large-print-hardcover"] }
  };
  assert.ok(pricing.getFormatOptions(supportedYoungAdult)
    .some(format => format.id === "large-print-hardcover"));
});

test("juvenile picture books offer picture editions and not adult formats", () => {
  const pictureBook = catalog.find(item => item.format === "Picture book");
  assert.ok(pictureBook);
  assert.deepEqual(pricing.getFormatOptions(pictureBook).map(format => [
    format.id, format.unitPriceCents
  ]), [
    ["picture-book-paperback", pictureBook.unitPriceCents],
    ["picture-book-hardcover", Math.round(pictureBook.unitPriceCents * 1.35)]
  ]);
});

test("juvenile book editions require specific catalog evidence", () => {
  const genericJuvenile = catalog.find(item =>
    item.materialCategory === "Juvenile fiction" && item.format === "Print book" &&
    !/chapter book|picture book|early reader|board book/i.test(item.description)
  );
  assert.deepEqual(pricing.getFormatOptions(genericJuvenile).map(format => format.id), [
    "paperback", "hardcover"
  ]);

  const chapterBook = catalog.find(item => /chapter book/i.test(item.description));
  assert.ok(chapterBook);
  assert.deepEqual(pricing.getFormatOptions(chapterBook).map(format => format.id), [
    "chapter-book-paperback", "chapter-book-hardcover"
  ]);

  const boardBook = {
    ...genericJuvenile,
    metadata: { ...genericJuvenile.metadata, bookType: "board-book" }
  };
  assert.deepEqual(pricing.getFormatOptions(boardBook).map(format => format.id), ["board-book"]);
  assert.equal(pricing.getFormatOptions(boardBook)[0].unitPriceCents,
    Math.round(genericJuvenile.unitPriceCents * 0.85));
  const earlyReader = {
    ...genericJuvenile,
    metadata: { ...genericJuvenile.metadata, bookType: "early-reader" }
  };
  assert.deepEqual(pricing.getFormatOptions(earlyReader).map(format => format.id), [
    "early-reader-paperback", "early-reader-hardcover"
  ]);
  assert.equal(pricing.getFormat(printBook, "paperback").id, "trade-paperback");
});

test("juvenile nonfiction and young adult titles receive category-appropriate editions", () => {
  const juvenileNonfiction = catalog.find(item =>
    item.materialCategory === "Juvenile nonfiction" && item.format === "Print book"
  );
  assert.deepEqual(pricing.getFormatOptions(juvenileNonfiction).map(format => format.id), [
    "juvenile-nonfiction-paperback", "juvenile-nonfiction-hardcover"
  ]);
  const youngAdult = catalog.find(item =>
    item.materialCategory === "Young adult materials" && item.format === "Print book"
  );
  assert.deepEqual(pricing.getFormatOptions(youngAdult).map(format => format.id), [
    "paperback", "hardcover"
  ]);
});

test("other material types expose only their existing catalog format and price", () => {
  const [format] = pricing.getFormatOptions(nonPrint);
  assert.equal(pricing.getFormatOptions(nonPrint).length, 1);
  assert.equal(format.unitPriceCents, nonPrint.unitPriceCents);
  assert.equal(format.name, nonPrint.format);
});

test("extended prices require positive whole-number quantities and safe prices", () => {
  assert.equal(pricing.extendedPrice(1299, 3), 3897);
  assert.throws(() => pricing.extendedPrice(1299, 0), /whole-number/);
  assert.throws(() => pricing.extendedPrice(1299, 1.5), /whole-number/);
});

test("matching item and format additions merge while other formats remain separate", () => {
  const paperback = pricing.mergeLine([], printBook, "trade-paperback", 2);
  const merged = pricing.mergeLine(paperback, printBook, "trade-paperback", 3);
  const separate = pricing.mergeLine(merged, printBook, "hardcover", 1);
  assert.equal(separate.length, 2);
  assert.deepEqual(separate.map(line => [line.formatId, line.quantity, line.extendedPriceCents]), [
    ["trade-paperback", 5, printBook.unitPriceCents * 5],
    ["hardcover", 1, Math.round(printBook.unitPriceCents * 1.35)]
  ]);
});

test("cart merge enforces catalog quantity and unique-item limits", () => {
  const maximum = printBook.maxQuantity;
  assert.throws(() => pricing.mergeLine([], printBook, "paperback", maximum + 1), /limited/);
  const maximumPaperback = pricing.mergeLine([], printBook, "paperback", maximum);
  assert.throws(() => pricing.mergeLine(maximumPaperback, printBook, "hardcover", 1), /limited/);
  const unique = catalog.find(item => item.unique);
  assert.throws(() => pricing.mergeLine([], unique, pricing.getFormatOptions(unique)[0].id, 2), /limited/);
});

test("budget projections are derived from allocation, commitments, and pending lines", () => {
  const lines = pricing.mergeLine([], printBook, "paperback", 3);
  const total = lines.reduce((sum, line) => sum + line.extendedPriceCents, 0);
  assert.equal(pricing.projectedRemainingBudget(500000, 12500, total),
    500000 - 12500 - printBook.unitPriceCents * 3);
  assert.equal(pricing.projectedRemainingBudget(1000, 0, 1500), -500);
  assert.throws(() => pricing.projectedRemainingBudget(1000, -1, 0), /nonnegative/);
});

test("requisition validation accepts separate priced formats and rejects tampered format prices", () => {
  const context = vm.createContext({
    window: {
      PN_APP: { getSession: () => null },
      PN_ACQUISITIONS: {
        getCatalogCount: () => catalog.length,
        getCatalogRecords: () => catalog
      },
      PN_PRICING: pricing,
      addEventListener() {}
    },
    document: {
      getElementById: () => ({ addEventListener() {}, replaceChildren() {}, dataset: {} }),
      createElement: () => ({ append() {} })
    },
    Intl
  });
  const root = path.resolve(__dirname, "..");
  for (const file of ["institutions.js", "technical-services.js"]) {
    vm.runInContext(readFileSync(path.join(root, "js", file), "utf8"), context);
  }
  const api = context.window.PN_TECHNICAL_SERVICES;
  const formats = pricing.getFormatOptions(printBook);
  const lines = formats.map(format => ({
    catalogId: printBook.id,
    title: printBook.title,
    formatId: format.id,
    format: format.name,
    quantity: 1,
    unitPriceCents: format.unitPriceCents,
    extendedPriceCents: format.unitPriceCents,
    collectionCode: "AF",
    fundCode: "GENERAL",
    selectorNote: ""
  }));
  const snapshot = {
    requisitionId: "PN-TEST-0001",
    clientId: "ANONYMOUS",
    submittedAt: "2026-01-02T10:00:00.000Z",
    institutionSnapshot: {
      institutionName: "Independent Acquisitions Account",
      categoryId: "public-library",
      department: "Collections"
    },
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.extendedPriceCents, 0),
    justification: ""
  };
  const input = {
    catalog,
    institutions: context.window.PN_INSTITUTIONS,
    clientId: "ANONYMOUS",
    committedCents: 0
  };
  assert.equal(api.validateSnapshot(snapshot, input).valid, true);
  snapshot.lines[1].unitPriceCents++;
  assert.ok(api.validateSnapshot(snapshot, input).errors.some(error => error.code === "catalog_price_mismatch"));
  const overQuantity = structuredClone(snapshot);
  overQuantity.lines[0].quantity = printBook.maxQuantity;
  overQuantity.lines[0].extendedPriceCents = formats[0].unitPriceCents * printBook.maxQuantity;
  overQuantity.lines[1].quantity = 1;
  overQuantity.lines[1].unitPriceCents = formats[1].unitPriceCents;
  overQuantity.lines[1].extendedPriceCents = formats[1].unitPriceCents;
  overQuantity.totalCents = overQuantity.lines.reduce((sum, line) => sum + line.extendedPriceCents, 0);
  assert.ok(api.validateSnapshot(overQuantity, input).errors.some(error => error.code === "invalid_quantity"));
});

const assert = require("node:assert/strict");
const { test } = require("node:test");
const baseCatalog = require("../data/catalog.json");
const specialCatalog = require("../data/special-collections.json");
const pricing = require("../js/pricing.js");
const { generateRecords } = require("../scripts/generate-special-collections.cjs");

const expectedCategories = [
  "Rare Books",
  "Manuscripts",
  "Historical Maps",
  "Rare Audio",
  "Ethnographic Collections",
  "Ephemera & Photographs"
];

test("PN-009 adds 150 records with 25 in each requested subcategory", () => {
  assert.equal(specialCatalog.length, 150);
  assert.deepEqual([...new Set(specialCatalog.map(item => item.materialCategory))].sort(),
    [...expectedCategories].sort());
  for (const category of expectedCategories) {
    assert.equal(specialCatalog.filter(item => item.materialCategory === category).length, 25);
  }
  assert.ok(specialCatalog.every(item => item.catalogGroup === "Special Collections & Archives"));
});

test("special records use unique IDs and titles without changing the existing catalog", () => {
  const allIds = [...baseCatalog, ...specialCatalog].map(item => item.id);
  const allTitles = [...baseCatalog, ...specialCatalog].map(item => item.title);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allTitles).size, allTitles.length);
  assert.equal(baseCatalog.length, 1500);
});

test("all offerings are explicitly simulated and include acquisition decision metadata", () => {
  const required = [
    "physicalExtent", "condition", "provenanceSummary", "acquisitionPriceCents",
    "accessRightsRestrictions", "preservationConsiderations", "specialHandlingNotes",
    "acquisitionNote", "reviewConsiderations", "transferAndEthicsNotice"
  ];
  for (const item of specialCatalog) {
    assert.ok(item.unique ? item.maxQuantity === 1 : item.maxQuantity > 1, item.id);
    assert.equal(item.metadata.source, "fictional simulation");
    assert.match(item.description, /Simulated classroom offering/);
    assert.equal(item.specialCollections.classroomSimulation, true);
    for (const field of required) {
      const value = item.specialCollections[field];
      assert.ok(Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "", `${item.id}: ${field}`);
    }
    assert.equal(item.specialCollections.acquisitionPriceCents, item.unitPriceCents);
  }
});

test("unique special materials use one listed-price format and cannot be ordered twice", () => {
  const item = specialCatalog.find(record => record.unique);
  const formats = pricing.getFormatOptions(item);
  assert.equal(formats.length, 1);
  assert.equal(formats[0].unitPriceCents, item.unitPriceCents);
  assert.throws(() => pricing.mergeLine([], item, formats[0].id, 2), /limited/);
  assert.equal(pricing.projectedRemainingBudget(500000, 0, item.unitPriceCents),
    500000 - item.unitPriceCents);
});

test("reproducible facsimiles retain the listed price and accept permitted quantities", () => {
  const item = specialCatalog.find(record => !record.unique);
  const [format] = pricing.getFormatOptions(item);
  assert.equal(format.unitPriceCents, item.unitPriceCents);
  const lines = pricing.mergeLine([], item, format.id, 2);
  assert.equal(lines[0].quantity, 2);
  assert.equal(lines[0].extendedPriceCents, item.unitPriceCents * 2);
});

test("special collections dataset generation is deterministic", () => {
  assert.deepEqual(generateRecords(), specialCatalog);
});

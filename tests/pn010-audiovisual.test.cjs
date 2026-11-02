const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const baseCatalog = require("../data/catalog.json");
const specialCatalog = require("../data/special-collections.json");
const audiovisualCatalog = require("../data/audiovisual.json");
const pricing = require("../js/pricing.js");
const { generateRecords } = require("../scripts/generate-audiovisual.cjs");

const expectedCategories = {
  "Movies & Television": 50,
  Music: 35,
  Audiobooks: 25,
  "Video Games": 40
};

test("PN-010 adds the requested 150 simulated offerings by category", () => {
  assert.equal(audiovisualCatalog.length, 150);
  assert.deepEqual(Object.fromEntries(
    Object.entries(expectedCategories).map(([category]) => [
      category,
      audiovisualCatalog.filter(item => item.materialCategory === category).length
    ])
  ), expectedCategories);
  assert.ok(audiovisualCatalog.every(item =>
    item.catalogGroup === "Audiovisual & Gaming" &&
    item.metadata.source === "fictional simulation" &&
    item.audiovisualMetadata["Simulation notice"] &&
    item.description.startsWith("Simulated ")
  ));
});

test("media records preserve existing IDs and use distinct stable catalog identifiers", () => {
  const allIds = [...baseCatalog, ...specialCatalog, ...audiovisualCatalog].map(item => item.id);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(baseCatalog.length, 1500);
  assert.equal(specialCatalog.length, 150);
  assert.deepEqual(generateRecords(), audiovisualCatalog);
});

test("media editions have eligible identifiers and authoritative deterministic prices", () => {
  for (const item of audiovisualCatalog) {
    assert.ok(Array.isArray(item.simulatedEditions) && item.simulatedEditions.length > 0, item.id);
    assert.equal(new Set(item.simulatedEditions.map(edition => edition.id)).size,
      item.simulatedEditions.length, item.id);
    const options = pricing.getFormatOptions(item);
    assert.deepEqual(options.map(option => option.id),
      item.simulatedEditions.map(edition => edition.id), item.id);
    for (const edition of options) {
      assert.ok(Number.isSafeInteger(edition.unitPriceCents) && edition.unitPriceCents > 0,
        `${item.id}: ${edition.id}`);
    }
    assert.ok(item.audiovisualMetadata["Collection note"], item.id);
  }
});

test("game platforms use listed prices and never receive book-format multipliers", () => {
  const game = audiovisualCatalog.find(item => item.materialCategory === "Video Games");
  assert.ok(game);
  const formats = pricing.getFormatOptions(game);
  assert.deepEqual(formats.map(format => format.id),
    game.simulatedEditions.map(edition => edition.id));
  assert.ok(formats.every(format => game.simulatedEditions.some(edition =>
    edition.id === format.id && edition.unitPriceCents === format.unitPriceCents
  )));
  assert.ok(!formats.some(format => /paperback|hardcover|large.print/i.test(format.name)));
});

test("media cart additions merge matching editions and separate other editions", () => {
  const movie = audiovisualCatalog.find(item => item.simulatedEditions.length > 1);
  assert.ok(movie);
  const [first, second] = pricing.getFormatOptions(movie);
  const twoCopies = pricing.mergeLine([], movie, first.id, 2);
  const merged = pricing.mergeLine(twoCopies, movie, first.id, 3);
  const separate = pricing.mergeLine(merged, movie, second.id, 1);
  assert.equal(separate.length, 2);
  assert.deepEqual(separate.map(line => [
    line.formatId, line.quantity, line.unitPriceCents, line.extendedPriceCents
  ]), [
    [first.id, 5, first.unitPriceCents, first.unitPriceCents * 5],
    [second.id, 1, second.unitPriceCents, second.unitPriceCents]
  ]);
  const total = separate.reduce((sum, line) => sum + line.extendedPriceCents, 0);
  assert.equal(pricing.projectedRemainingBudget(500000, 2500, total),
    500000 - 2500 - total);
});

test("audiovisual requisitions validate with the correct catalog prices and AV collection code", () => {
  const allCatalog = [...baseCatalog, ...specialCatalog, ...audiovisualCatalog];
  const context = vm.createContext({
    window: {
      PN_APP: { getSession: () => null },
      PN_ACQUISITIONS: {
        getCatalogCount: () => allCatalog.length,
        getCatalogRecords: () => allCatalog
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
  const selected = ["Movies & Television", "Music", "Audiobooks", "Video Games"].map(category =>
    audiovisualCatalog.find(item => item.materialCategory === category)
  );
  const lines = selected.map(item => {
    const edition = pricing.getFormatOptions(item)[0];
    return {
      catalogId: item.id,
      title: item.title,
      formatId: edition.id,
      format: edition.name,
      quantity: 1,
      unitPriceCents: edition.unitPriceCents,
      extendedPriceCents: edition.unitPriceCents,
      collectionCode: "AV",
      fundCode: "GENERAL",
      selectorNote: ""
    };
  });
  const snapshot = {
    requisitionId: "PN-TEST-0010",
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
  const result = context.window.PN_TECHNICAL_SERVICES.validateSnapshot(snapshot, {
    catalog: allCatalog,
    institutions: context.window.PN_INSTITUTIONS,
    clientId: "ANONYMOUS",
    committedCents: 0
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

const test = require("node:test");
const assert = require("node:assert/strict");
const pricing = require("../js/pricing.js");
const catalog = require("../data/catalog.json");

test("annual digital service enrollment contributes one committed fee", () => {
  const consortium = { modelId: "consortium", annualFeeCents: 250000 };
  const direct = { modelId: "direct", annualFeeCents: 75000 };
  assert.equal(pricing.digitalServiceFeeCents(consortium), 250000);
  assert.equal(pricing.totalCommittedCents(1200, consortium), 251200);
  assert.equal(pricing.totalCommittedCents(1200, consortium), 251200);
  assert.equal(pricing.totalCommittedCents(1200, direct), 76200);
  assert.throws(() => pricing.digitalServiceFeeCents({
    modelId: "consortium",
    annualFeeCents: 500000
  }), /invalid annual fee/);
});

test("pay-per-circulation estimates are separate from committed spending", () => {
  assert.equal(pricing.payPerCirculationEstimate(0), 0);
  assert.equal(pricing.payPerCirculationEstimate(1200), 360000);
  assert.equal(pricing.totalCommittedCents(1200, null), 1200);
  assert.throws(() => pricing.payPerCirculationEstimate(-1), /whole numbers from 0/);
  assert.throws(() => pricing.payPerCirculationEstimate(1.5), /whole numbers from 0/);
  assert.throws(() => pricing.payPerCirculationEstimate(1000001), /whole numbers from 0/);
});

test("ebook license terms preserve the catalog's simulated title price", () => {
  const ebook = catalog.find(item => item.format === "Ebook");
  assert.ok(ebook);
  const terms = pricing.getDigitalLicenseTerms(ebook, "ebook");
  assert.deepEqual(terms, {
    users: 1,
    termYears: 2,
    checkoutLimit: 26,
    priceCents: ebook.unitPriceCents
  });
  assert.equal(pricing.getFormatOptions(ebook)[0].unitPriceCents, ebook.unitPriceCents);
  assert.equal(pricing.getDigitalLicenseTerms(
    catalog.find(item => item.format === "Print book"),
    "trade-paperback"
  ), null);
});

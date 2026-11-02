const assert = require("node:assert/strict");
const { test } = require("node:test");
const baseCatalog = require("../data/catalog.json");
const specialCatalog = require("../data/special-collections.json");
const audiovisualCatalog = require("../data/audiovisual.json");
const assessments = require("../data/collection-assessments.json");
const { generateAssessments } = require("../scripts/generate-collection-assessments.cjs");

const catalog = [...baseCatalog, ...specialCatalog, ...audiovisualCatalog];
const audienceFits = new Set([
  "Adult",
  "Young adult",
  "Juvenile",
  "Early childhood",
  "Academic / research",
  "Specialized",
  "Unknown",
  "Not assessed"
]);
const interestValues = new Set(["Low", "Moderate", "High", "Not assessed"]);
const demandValues = new Set(["Low", "Moderate", "High", "Not applicable / uncertain", "Not assessed"]);
const significanceValues = new Set([
  "General interest",
  "Local or regional relevance",
  "Educational relevance",
  "Research significance",
  "Historical or cultural significance"
]);

test("PN-011 provides exactly one assessment for each of the 1,800 catalog records", () => {
  assert.equal(catalog.length, 1800);
  assert.equal(Object.keys(assessments).length, catalog.length);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  assert.ok(catalog.every(item => Object.hasOwn(assessments, item.id)));
});

test("assessment fields and values are complete, qualitative, and non-prescriptive", () => {
  const expectedFields = [
    "audienceFit",
    "communityInterest",
    "existingCollectionCoverage",
    "expectedDemand",
    "collectionSignificance",
    "explanation",
    "assessmentNotice"
  ].sort();
  for (const [id, assessment] of Object.entries(assessments)) {
    assert.deepEqual(Object.keys(assessment).sort(), expectedFields, id);
    assert.ok(audienceFits.has(assessment.audienceFit), id);
    assert.ok(interestValues.has(assessment.communityInterest), id);
    assert.equal(assessment.existingCollectionCoverage, "Not assessed", id);
    assert.ok(demandValues.has(assessment.expectedDemand), id);
    assert.ok(Array.isArray(assessment.collectionSignificance), id);
    assert.ok(assessment.collectionSignificance.length > 0, id);
    assert.ok(assessment.collectionSignificance.every(tag => significanceValues.has(tag)), id);
    assert.ok(assessment.explanation.length > 0, id);
    assert.match(assessment.assessmentNotice, /fictional classroom assessment/i, id);
    assert.doesNotMatch(assessment.expectedDemand, /\d|%|copies|visits|loans/i, id);
  }
});

test("circulating books, juvenile materials, and media receive type-appropriate indicators", () => {
  const adultBook = baseCatalog.find(item => item.materialCategory === "Adult fiction");
  const juvenileBook = baseCatalog.find(item => item.materialCategory === "Juvenile fiction");
  const pictureBook = baseCatalog.find(item => item.format === "Picture book");
  const film = audiovisualCatalog.find(item => item.materialCategory === "Movies & Television");
  const music = audiovisualCatalog.find(item => item.materialCategory === "Music");
  const audiobook = audiovisualCatalog.find(item => item.materialCategory === "Audiobooks");
  const game = audiovisualCatalog.find(item => item.materialCategory === "Video Games");
  assert.equal(assessments[adultBook.id].audienceFit, "Adult");
  assert.equal(assessments[juvenileBook.id].audienceFit, "Juvenile");
  assert.equal(assessments[pictureBook.id].audienceFit, "Early childhood");
  for (const item of [adultBook, juvenileBook, pictureBook, film, music, audiobook, game]) {
    assert.equal(assessments[item.id].expectedDemand, "Moderate", item.id);
    assert.match(assessments[item.id].explanation, /not a local circulation forecast/i, item.id);
  }
  const gameAudience = game.audiovisualMetadata["Audience rating"];
  assert.equal(assessments[game.id].audienceFit,
    gameAudience === "E" || gameAudience === "E10+" ? "Juvenile" :
      gameAudience === "T" ? "Young adult" : "Adult");
});

test("unique archival offerings emphasize research and historical context without demand forecasts", () => {
  const item = specialCatalog.find(record => record.materialCategory === "Historical Maps");
  const assessment = assessments[item.id];
  assert.equal(assessment.audienceFit, "Specialized");
  assert.equal(assessment.expectedDemand, "Not applicable / uncertain");
  assert.ok(assessment.collectionSignificance.includes("Research significance"));
  assert.ok(assessment.collectionSignificance.includes("Historical or cultural significance"));
  assert.match(assessment.explanation, /not circulation popularity/i);
  assert.match(assessment.explanation, /provenance, preservation, access/i);
  assert.ok(assessment.explanation.includes(item.creationDate));
});

test("coverage remains unassessed without holdings data and local cues remain qualified", () => {
  assert.ok(Object.values(assessments).every(item =>
    item.existingCollectionCoverage === "Not assessed"
  ));
  const localSubject = catalog.find(item =>
    /\blocal\b|\bregional\b/i.test(item.metadata?.sourceSubject || "")
  );
  assert.ok(localSubject);
  const assessment = assessments[localSubject.id];
  assert.equal(assessment.communityInterest, "Moderate");
  assert.ok(assessment.collectionSignificance.includes("Local or regional relevance"));
  assert.match(assessment.explanation, /remains unverified/i);
});

test("assessment generation is deterministic and does not change catalog records", () => {
  assert.deepEqual(generateAssessments(), assessments);
  assert.equal(baseCatalog.length, 1500);
  assert.equal(specialCatalog.length, 150);
  assert.equal(audiovisualCatalog.length, 150);
});

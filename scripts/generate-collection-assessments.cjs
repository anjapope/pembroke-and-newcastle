const fs = require("node:fs");
const path = require("node:path");

const dataDirectory = path.join(__dirname, "..", "data");
const outputPath = path.join(dataDirectory, "collection-assessments.json");
const catalogPaths = [
  "catalog.json",
  "special-collections.json",
  "audiovisual.json"
];

const ARCHIVAL_CATEGORIES = new Set([
  "Photographic and oral-history collections",
  "Rare books and manuscripts",
  "Archival collections and ephemera",
  "Rare Books",
  "Manuscripts",
  "Historical Maps",
  "Rare Audio",
  "Ethnographic Collections",
  "Ephemera & Photographs"
]);

const CIRCULATING_CATEGORIES = new Set([
  "Adult fiction",
  "Adult nonfiction",
  "Juvenile fiction",
  "Juvenile nonfiction",
  "Young adult materials",
  "Movies & Television",
  "Music",
  "Audiobooks",
  "Video Games"
]);

function recordText(item) {
  const audiovisual = Object.values(item.audiovisualMetadata || {}).filter(value =>
    typeof value === "string"
  );
  return [
    item.materialCategory,
    item.format,
    item.catalogGroup,
    item.creationDate,
    item.metadata?.sourceSubject,
    item.metadata?.intendedUse,
    ...audiovisual
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function audienceFit(item, text) {
  const declaredAudience = [
    item.audiovisualMetadata?.Audience,
    item.metadata?.audience,
    item.metadata?.intendedAudience
  ].filter(value => typeof value === "string").join(" ").toLocaleLowerCase();
  const gameRating = item.materialCategory === "Video Games"
    ? item.audiovisualMetadata?.["Audience rating"]
    : null;

  if (/\byoung adult\b|\byoung-adult\b/.test(declaredAudience) ||
      item.materialCategory === "Young adult materials") return "Young adult";
  if (gameRating === "E" || gameRating === "E10+") return "Juvenile";
  if (gameRating === "T") return "Young adult";
  if (gameRating === "M") return "Adult";
  if (/\bchildren\b|\bjuvenile\b|\byouth\b/.test(declaredAudience) ||
      item.materialCategory === "Juvenile fiction" ||
      item.materialCategory === "Juvenile nonfiction") {
    return item.format === "Picture book" ||
      item.metadata?.bookType === "board-book" ||
      item.metadata?.eligibleFormats?.includes("board-book")
      ? "Early childhood"
      : "Juvenile";
  }
  if (/\badult\b/.test(declaredAudience) ||
      item.materialCategory === "Adult fiction" ||
      item.materialCategory === "Adult nonfiction") return "Adult";
  if (item.materialCategory === "Academic monographs and reference materials" ||
      item.materialCategory === "Periodicals and serials" ||
      /academic|research|scholarly|reference/.test(text)) return "Academic / research";
  if (ARCHIVAL_CATEGORIES.has(item.materialCategory) ||
      item.catalogGroup === "Special Collections & Archives" ||
      item.unique ||
      /museum objects|natural history|exhibition resources|licensed digital/.test(text)) {
    return "Specialized";
  }
  return "Unknown";
}

function collectionSignificance(item, text) {
  const tags = [];
  const archival = ARCHIVAL_CATEGORIES.has(item.materialCategory) ||
    item.catalogGroup === "Special Collections & Archives" ||
    (item.unique && !CIRCULATING_CATEGORIES.has(item.materialCategory));
  const academic = item.materialCategory === "Academic monographs and reference materials" ||
    item.materialCategory === "Periodicals and serials";
  const localContext = /\blocal\b|\bregional\b/.test(item.metadata?.sourceSubject || "");
  const educational = item.materialCategory === "Juvenile nonfiction" ||
    /\beducation(al)?\b|\bschool\b|\blearning\b/.test(text) ||
    item.audiovisualMetadata?.Genre === "Documentary";
  const historySubject = /\bhistory\b|\bhistorical\b|\bcultural\b/.test(text);

  if (archival) {
    tags.push("Historical or cultural significance", "Research significance");
  } else if (academic) {
    tags.push("Research significance");
  } else {
    tags.push("General interest");
  }
  if (localContext) tags.push("Local or regional relevance");
  if (educational && !tags.includes("Educational relevance")) {
    tags.push("Educational relevance");
  }
  if (historySubject && !tags.includes("Historical or cultural significance")) {
    tags.push("Historical or cultural significance");
  }
  return tags;
}

function assessmentFor(item) {
  const text = recordText(item);
  const audience = audienceFit(item, text);
  const subject = item.metadata?.sourceSubject || "";
  const localCue = /\blocal\b|\bregional\b|\bcommunity\b/.test(subject.toLocaleLowerCase());
  const archival = ARCHIVAL_CATEGORIES.has(item.materialCategory) ||
    item.catalogGroup === "Special Collections & Archives" ||
    (item.unique && !CIRCULATING_CATEGORIES.has(item.materialCategory));
  const circulating = !item.unique && CIRCULATING_CATEGORIES.has(item.materialCategory);
  const communityInterest = localCue ? "Moderate" : "Not assessed";
  const expectedDemand = archival
    ? "Not applicable / uncertain"
    : circulating ? "Moderate" : "Not applicable / uncertain";
  const collectionSignificanceTags = collectionSignificance(item, text);
  let explanation;

  if (archival) {
    explanation = `This specialized archival or unique material is considered through research and historical or cultural context, not circulation popularity. ${item.creationDate ? `Recorded date/context: ${item.creationDate}. ` : ""}Review the catalog's provenance, preservation, access, and institutional-fit details; local holdings are not supplied.`;
  } else if (circulating) {
    explanation = `Audience fit follows the catalog's material and audience metadata. ${item.creationDate ? `Recorded date/context: ${item.creationDate}. ` : ""}Moderate expected demand is a fictional classroom baseline for this circulating material type, not a local circulation forecast. Local holdings and usage data are not supplied.`;
  } else {
    explanation = `Audience fit and significance use the available material and subject metadata. ${item.creationDate ? `Recorded date/context: ${item.creationDate}. ` : ""}Local holdings, community survey, and demand data are not supplied, so coverage and demand remain unassessed.`;
  }
  if (localCue) {
    explanation += " The source subject explicitly names local, regional, or community context; relevance to a particular institution remains unverified.";
  }

  return {
    audienceFit: audience,
    communityInterest,
    existingCollectionCoverage: "Not assessed",
    expectedDemand,
    collectionSignificance: collectionSignificanceTags,
    explanation,
    assessmentNotice: "Fictional classroom assessment; these indicators are not local evidence or purchase recommendations."
  };
}

function generateAssessments() {
  const records = catalogPaths.flatMap(file =>
    JSON.parse(fs.readFileSync(path.join(dataDirectory, file), "utf8"))
  );
  if (records.length !== 1800) {
    throw new Error(`Expected 1,800 source catalog records; found ${records.length}.`);
  }
  const assessments = {};
  for (const item of records) {
    if (!item || typeof item.id !== "string" || !item.id ||
        Object.hasOwn(assessments, item.id)) {
      throw new Error("Cannot generate collection assessments for missing or duplicate catalog IDs.");
    }
    assessments[item.id] = assessmentFor(item);
  }
  return assessments;
}

if (require.main === module) {
  const assessments = generateAssessments();
  fs.writeFileSync(outputPath, `${JSON.stringify(assessments, null, 2)}\n`);
  console.log(`Generated ${Object.keys(assessments).length} deterministic collection assessments.`);
}

module.exports = { assessmentFor, generateAssessments, outputPath };

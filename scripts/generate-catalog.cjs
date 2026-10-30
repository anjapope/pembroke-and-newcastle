const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const catalogPath = path.join(__dirname, "..", "data", "catalog.json");
const seedDigest = "0edcc1dc96aaf9ef7e50bb5ac87ec34d0769f278841d2af0e2ef450aa5dafd98";
const targets = {
  "Adult fiction and nonfiction": 450,
  "Juvenile and young adult": 300,
  "Academic and reference": 250,
  "Archival and manuscript collections": 200,
  "Museum and special collections": 150,
  "Digital and audiovisual": 150
};

function seedGroup(item) {
  if (/ebook|audio|digital|lantern/i.test(item.format + item.materialCategory)) return "Digital and audiovisual";
  if (/juvenile|young adult/i.test(item.materialCategory)) return "Juvenile and young adult";
  if (/academic|periodical/i.test(item.materialCategory)) return "Academic and reference";
  if (/adult/i.test(item.materialCategory)) return "Adult fiction and nonfiction";
  if (/museum|natural history|rare/i.test(item.materialCategory)) return "Museum and special collections";
  return "Archival and manuscript collections";
}

const places = [
  "Alder Quay", "Bracken Vale", "Copper Fen", "Dunmere", "Elmbridge", "Foxhaven",
  "Greywater", "Hawthorn Reach", "Ivy Basin", "Juniper Bay", "Kestrel Hill", "Larchford",
  "Mossbank", "North Orchard", "Otter Marsh", "Plover Heath", "Rowan Common", "Sedgewick",
  "Thistle Cove", "Willow Crossing"
];
const creators = [
  "Ada Fenwick", "Basil Wren", "Clara March", "Devon Ash", "Elin Hart", "Felix Rowan",
  "Greta Dale", "Hugo Bell", "Imani Cross", "Jules Ward", "Kiran Frost", "Leonie Birch",
  "Mara Holt", "Nico Field", "Orla Wynn", "Pavel Crane", "Rosa Marsh", "Sami Fern",
  "Tessa Vale", "Uri Finch", "Vera Pike", "Wesley Reed", "Yara Moss", "Zane Brook"
];
const subjects = [
  "coastal ecology", "railway communities", "urban gardens", "public health",
  "women's working lives", "river navigation", "craft economies", "migrant histories",
  "astronomy", "food traditions", "renewable energy", "civic architecture",
  "grassland habitats", "book conservation", "cooperative housing", "weather observation",
  "rural education", "community theatre", "wetland birds", "industrial design",
  "water management", "oral storytelling", "mathematical patterns", "local democracy",
  "coastal fisheries", "rural medicine", "printing trades", "labour organizing",
  "archaeological methods", "soil science", "public sculpture", "musical traditions",
  "transport policy", "language learning", "library services", "animal migration"
];
const fiction = [
  "The Last Ferry to", "Winter Letters from", "The Clockmaker of", "A Summer Beyond",
  "The Missing Map of", "Songs beneath", "The Observatory at", "The Long Road through",
  "A Stranger in", "The Night Garden of", "The Small Library of", "Returning to",
  "The Glass House at", "The Forgotten Bridge of", "Nocturne for", "The Baker of",
  "Daughters of", "The Promised Orchard at", "A House above", "The Museum of",
  "Autumn at", "The Harbour Lights of", "Morning Comes to", "The Weavers of"
];
const children = [
  "The Lantern Club of", "A Fox Visits", "The Secret Garden at", "The Kite Makers of",
  "An Unexpected Journey to", "The Midnight Train to", "The Puzzle of", "A New Friend in",
  "The Lost Telescope of", "The Rain Collectors of", "The Great Picnic at", "Finding Home in",
  "The Owl Patrol of", "The Bicycle Detectives of", "The First Snow in", "The Hidden Path to"
];
const approaches = [
  "A Field Guide to", "Understanding", "An Illustrated History of", "Working with",
  "An Introduction to", "New Perspectives on", "The Everyday Practice of", "An Atlas of"
];
const documents = [
  ["Archival collections and ephemera", "Printed ephemera", "community theatre programmes", 12000, 185000],
  ["Archival collections and ephemera", "Map", "river survey maps", 35000, 480000],
  ["Rare books and manuscripts", "Manuscript volume", "botanical field journals", 90000, 1250000],
  ["Photographic and oral-history collections", "Archival photograph", "harbour workers' portraits", 18000, 320000],
  ["Photographic and oral-history collections", "Digital audio collection", "oral-history interviews", 22000, 190000],
  ["Rare books and manuscripts", "Manuscript volume", "family and trade correspondence", 65000, 850000]
];
const objects = [
  ["Museum objects and cultural heritage materials", "Material sample collection", "textile workshop samples", 38000, 720000],
  ["Museum objects and cultural heritage materials", "Natural history specimen set", "cast geological specimens", 65000, 1400000],
  ["Natural history and exhibition resources", "Herbarium specimen book", "reproduction botanical study sheets", 28000, 420000],
  ["Natural history and exhibition resources", "Exhibition resource set", "portable river-history displays", 12000, 180000],
  ["Rare books and manuscripts", "Rare atlas", "antiquarian regional atlas", 110000, 1600000],
  ["Natural history and exhibition resources", "Exhibition label set", "accessible interpretation labels", 4500, 32000]
];
const media = [
  ["Ebooks and licensed digital resources", "Licensed digital collection", "Community Research Online", 18000, 195000],
  ["Audiovisual resources", "Audiobook", "Listening Library", 1599, 5499],
  ["Audiovisual resources", "Digital audio recording", "Soundscapes", 2499, 12500],
  ["Audiovisual resources", "Lantern-slide set", "Historical Visual Studies", 12000, 245000],
  ["Adult nonfiction", "Ebook", "Digital Field Notes", 1299, 4299],
  ["Young adult materials", "Audiobook", "Voices for Young Readers", 1499, 3999]
];

function titleCase(value) {
  return value[0].toUpperCase() + value.slice(1);
}

function price(index, low, high) {
  return low + ((index * 7919) % (high - low + 1));
}

function offering(group, index, id) {
  const place = places[index % places.length];
  const subject = subjects[(index + Math.floor(index / subjects.length)) % subjects.length];
  const creator = creators[(index * 7 + Math.floor(index / 20)) % creators.length];
  const cycle = Math.floor(index / places.length);
  let title, category, format, description, low, high, unique = false;
  let date = String(1998 + index % 29);
  let origin = `${place} Press; fictional training imprint.`;
  if (group === "Adult fiction and nonfiction") {
    const literary = index % 3 === 0;
    category = literary ? "Adult fiction" : "Adult nonfiction";
    format = "Print book";
    title = literary
      ? `${fiction[(cycle + index % 3) % fiction.length]} ${place}`
      : `${approaches[cycle % approaches.length]} ${titleCase(subject)}: Studies from ${place}`;
    description = literary
      ? `A simulated literary work set in ${place}, exploring ${subject} through intergenerational relationships and a changing community.`
      : `A simulated illustrated study of ${subject}, using ${place} as a case study. Includes source notes, practical examples and a subject index.`;
    [low, high] = [899, 3899];
  } else if (group === "Juvenile and young adult") {
    const type = index % 4;
    category = type === 2 ? "Juvenile nonfiction" : type === 3 ? "Young adult materials" : "Juvenile fiction";
    format = type === 0 ? "Picture book" : "Print book";
    title = type === 2
      ? `${approaches[cycle % approaches.length]} ${titleCase(subject)}: A Young Explorer's Guide from ${place}`
      : `${children[cycle % children.length]} ${place}`;
    description = `A simulated ${type === 0 ? "read-aloud picture book with full-page illustrations for ages 4-7" :
      type === 1 ? "chapter book for ages 8-11" : type === 2 ? "illustrated nonfiction resource for ages 9-13" :
        "young adult coming-of-age novel for ages 13-17"}. Explores ${subject} through the people and places of ${place}.`;
    [low, high] = [699, 2499];
  } else if (group === "Academic and reference") {
    const serial = index % 5 === 0;
    category = serial ? "Periodicals and serials" : "Academic monographs and reference materials";
    format = serial ? "Print periodical" : "Print book";
    title = `${serial ? "Review of" : approaches[cycle % approaches.length]} ${titleCase(subject)}: ${place} ${serial ? `Annual ${date}` : "Research Studies"}`;
    description = `Simulated ${serial ? "annual serial issue" : "scholarly monograph and reference work"} on ${subject}. Contains comparative research, a methodological introduction, bibliographic references and teaching applications.`;
    [low, high] = [3500, 22500];
    origin = `${place} Institute for Comparative Studies; fictional scholarly publisher.`;
  } else if (group === "Archival and manuscript collections" || group === "Museum and special collections") {
    const types = group === "Archival and manuscript collections" ? documents : objects;
    const type = types[index % types.length];
    [category, format, , low, high] = type;
    const period = 1840 + ((index * 7) % 150);
    date = `${period}-${period + 5 + index % 17}`;
    title = `${place} ${titleCase(type[2])}, ${date}`;
    unique = !/Digital|Exhibition/.test(format);
    description = `Simulated ${type[2]} associated with the invented ${place} Study Society, covering ${subject}. ${
      /specimen/i.test(format) ? "Teaching casts only; no protected biological material or actual collecting locality is claimed." :
        /Manuscript|ephemera|photograph|Map/.test(format) ? "Includes an invented finding aid, extent statement and condition summary." :
          "Includes an invented condition report and suggested interpretation themes."
    } Fictional provenance only; no real ownership or transfer rights are asserted.`;
    origin = `${place} Study Society (invented originating organization); simulated provenance, not a real accession.`;
  } else {
    const type = media[index % media.length];
    [category, format, , low, high] = type;
    title = `${type[2]}: ${titleCase(subject)} in ${place}`;
    description = `Simulated ${format.toLowerCase()} covering ${subject}, with a searchable descriptive guide. ${
      /Licensed/.test(format) ? "Fictional annual institutional access for one site; no actual subscription is created." :
        /audio/i.test(format) ? "Includes an invented transcript and chapter index for accessible study." :
          "Includes simulated image captions and a teaching guide."
    } No actual files, media rights or digital access are delivered.`;
    origin = `${place} Media Cooperative; fictional supplier and rights statement.`;
  }
  return {
    id, title, creator: /Archival|Museum/.test(group) ? `${place} Study Society` : creator,
    catalogGroup: group, materialCategory: category, format, creationDate: date,
    publisherDescription: origin, description,
    unitPriceCents: price(index, low, high),
    availability: unique ? "One simulated offering available" : /digital|ebook|audio|licensed/i.test(format)
      ? "Simulated license available" : index % 4 === 0 ? "Limited availability" : "Available",
    maxQuantity: unique ? 1 : /Licensed/.test(format) ? 5 : 99, unique,
    metadata: {
      fictionalRecord: true, sourceSubject: subject,
      identifierStatus: "Simulated offering; no verified external identifier supplied",
      intendedUse: group, provenanceStatus: "Fictional; no real-world ownership claim"
    }
  };
}

function generateCatalog(records) {
  const seed = records.slice(0, 100).map(({ catalogGroup, ...item }) => item);
  if (createHash("sha256").update(JSON.stringify(seed)).digest("hex") !== seedDigest) {
    throw new Error("The original 100 records changed. Review preservation before regenerating.");
  }
  const output = seed.map(item => ({ ...item, catalogGroup: seedGroup(item) }));
  for (const [group, target] of Object.entries(targets)) {
    const count = output.filter(item => item.catalogGroup === group).length;
    for (let index = 0; index < target - count; index++) {
      output.push(offering(group, index, `PN${String(output.length + 1).padStart(4, "0")}`));
    }
  }
  return output;
}

if (require.main === module) {
  const output = generateCatalog(JSON.parse(fs.readFileSync(catalogPath, "utf8")));
  fs.writeFileSync(catalogPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Generated ${output.length} static simulated records.`);
}

module.exports = { generateCatalog, targets, seedDigest };

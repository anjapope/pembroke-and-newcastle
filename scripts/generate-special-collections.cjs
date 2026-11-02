const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "..", "data", "special-collections.json");
const group = "Special Collections & Archives";
const places = [
  "Alder Quay", "Bracken Vale", "Copper Fen", "Dunmere", "Elmbridge",
  "Foxhaven", "Greywater", "Hawthorn Reach", "Ivy Basin", "Juniper Bay",
  "Kestrel Hill", "Larchford", "Mossbank", "North Orchard", "Otter Marsh",
  "Plover Heath", "Rowan Common", "Sedgewick", "Thistle Cove", "Willow Crossing"
];
const creators = [
  "Mara Ellery", "Jonas Fen", "Celia Voss", "Rafi Calder", "Nell Armitage",
  "Tomas Wren", "Iris Morrow", "Ewan Calder", "Lena Quill", "Soren Vale",
  "Mina Ashcombe", "Pavel Lorne", "Asha Merritt", "Kit Rowan", "Elodie March",
  "Bram Alder", "Nia Corbett", "Felix Orme", "Talia West", "Oren Bell",
  "Sabine North", "Rhea Dallow", "Ivo Hart", "Maren Sol", "Dara Finch"
];

const conditionNotes = {
  "Rare Books": [
    "The quarter leather is split at the lower joint and the spine lining is exposed.",
    "Several gatherings are sound; two leaves have edge tears and a small loss to the final blank.",
    "The paper is brittle at the fore-edge and the sewing is loose in the opening gathering.",
    "A historic repair uses pressure-sensitive tape; adhesive migration needs assessment.",
    "The text block is stable, but the boards are detached and the endpapers are abraded."
  ],
  Manuscripts: [
    "The first and last leaves are brittle, with small losses at the outer corners.",
    "Ink corrosion is visible on three folded sheets and may be active.",
    "The wrapper is split; several folios are out of sequence and require collation.",
    "A water tide line crosses the lower margin; no treatment history is supplied.",
    "The paper is sound overall, with rust stains around former fasteners."
  ],
  "Historical Maps": [
    "Fold intersections show losses and the linen backing has begun to separate.",
    "The sheet has a fragile central fold and a repaired tear in the cartouche.",
    "Surface grime and a small water stain obscure part of the lower margin.",
    "The map is mounted on acidic board; removal would require a conservator.",
    "The paper is brittle at the folds and several neatline edges are chipped."
  ],
  "Rare Audio": [
    "The acetate disc has edge chips and suspected delamination; playback is not advised.",
    "The reel leader is brittle and the tape pack is uneven; inspect before any transport.",
    "The shellac disc has a hairline crack and requires a compatible, serviced deck.",
    "The cassette pressure pad is missing and the oxide surface has not been assessed.",
    "The recording carrier appears stable, but no conservation or playback report is supplied."
  ],
  "Ethnographic Collections": [
    "The composite set includes mixed materials; one textile fragment is visibly weakened.",
    "A surface coating is flaking from the carved teaching replica; handling is restricted.",
    "The woven sample has insect damage at one edge; no treatment record accompanies it.",
    "The set is intact, but the materials and prior storage environment are undocumented.",
    "One component has a loose joint and should be supported before examination."
  ],
  "Ephemera & Photographs": [
    "The acidic album leaves are brittle and several photographs are lifting at their corners.",
    "Two prints show silver mirroring; the negative sleeves are not identified.",
    "The newsprint is embrittled and one panel is missing from the folded handbill.",
    "The glass plate surrogate box is sound, but the accompanying print has a crease.",
    "The scrapbook has pressure-sensitive tape repairs and uncaptioned loose inserts."
  ]
};

const provenanceNotes = [
  "Offered by the fictional Alder Quay Reading Room; earlier ownership is unverified.",
  "A composite donor file records a transfer but contains no signed deed of gift.",
  "The invented supplier reports local custody since the 1970s; no chain of title is supplied.",
  "Attribution rests on an undated note in the fictional collection file and is uncertain.",
  "The record describes a private holding; lawful transfer documentation remains outstanding."
];

const rightsNotes = [
  "Copyright status is undetermined; reproduction requires rights research.",
  "A fictional donor requested reading-room access only; the restriction has no expiry date.",
  "Names in the material may identify living people; privacy review is required before access.",
  "No reproduction permission accompanies the offering; description does not grant rights.",
  "The simulated file contains a community-use request that requires consultation before publication."
];

const preservationNotes = [
  "Plan archival housing and stable, monitored storage before routine access.",
  "A condition survey and a documented handling protocol are needed before use.",
  "Budget for conservation assessment; no treatment estimate is included in the asking price.",
  "Create a preservation copy only after rights review; maintain the original in controlled storage.",
  "The item needs a supports review and a written emergency-response location."
];

const handlingNotes = [
  "Use a clean support surface and keep the item in its enclosure during transport.",
  "Supervised consultation only; use a cradle or other material-appropriate support.",
  "Limit handling to trained staff until the condition has been assessed.",
  "Do not play, unfold, remove fasteners, or separate components without specialist advice.",
  "Record movement and condition at each hand-off; keep associated parts together."
];

const concerns = [
  ["provenance-review", "rights-review"],
  ["condition-assessment", "preservation-plan"],
  ["privacy-review", "access-review"],
  ["community-consultation", "rights-review"],
  ["transfer-documentation", "provenance-review"]
];

const categoryData = [
  {
    name: "Rare Books",
    format: "Unique rare book",
    titles: [
      "Alder Quay Tide Tables and Coastal Almanac",
      "The Bracken Vale Press Book of Orchard Remedies",
      "Copper Fen Guild Ordinances, Hand-Printed Copy",
      "Dunmere Mariners' Pocket Directory",
      "Elmbridge Botanical Observations, Annotated Edition",
      "Foxhaven Schoolroom Reader with Local Imprint",
      "Greywater Canal Company's Illustrated Prospectus",
      "Hawthorn Reach Calendar of Markets and Fairs",
      "Ivy Basin Surveyor's Manual with Folding Plate",
      "Juniper Bay Printer's Specimen Book",
      "Kestrel Hill Natural Philosophy Lecture Notes",
      "Larchford Weaver's Pattern and Dye Register",
      "Mossbank Cooperative Press: First Annual Report",
      "North Orchard Catalogue of Fruit Trees",
      "Otter Marsh Guide to Common Water Plants",
      "Plover Heath Astronomical Tables for Navigators",
      "Rowan Common Book of Civic Addresses",
      "Sedgewick Illustrated Trades Directory",
      "Thistle Cove Sea Songs, Broadside Collection",
      "Willow Crossing Railway Timetable and Map",
      "Alder Quay Children's Chapbook, Illustrated",
      "Bracken Vale Printer's Binding Ledger",
      "Copper Fen Handbook of Market Weights",
      "Dunmere School Atlas, Teacher's Copy",
      "Elmbridge Theatre Season Book with Cast Notes"
    ],
    formats: ["Bound printed volume", "Illustrated pamphlet", "Hand-press book", "Annotated imprint"],
    extents: ["1 volume (84 pages)", "1 volume (212 pages)", "1 pamphlet (28 pages)", "1 volume with 3 folding plates", "1 volume (146 pages), incomplete"],
    prices: [28500, 64000, 112000, 37500, 89500, 46500, 128000, 52000, 73500, 158000, 94500, 68500, 214000, 59000, 83000, 172000, 45500, 106000, 31500, 98000, 25500, 137000, 49000, 118000, 57000],
    dates: ["1874", "1902", "1848", "1911", "1886", "1932", "1894", "1861", "1908", "1924", "1839", "1917", "1899", "1879", "1936", "1855", "1921", "1881", "1914", "1906", "1890", "1938", "1868", "1928", "1900"],
    notes: [
      "A colophon names a short-lived local press; its records have not been independently located.",
      "Marginal annotations appear to document practical use, but their author is unidentified.",
      "The volume may be a later issue: the supplied description does not distinguish states.",
      "A folding plate is present but has not been compared with the printed list of plates.",
      "The asking price excludes any conservation work or rights research."
    ],
    reproducible: [8, 20, 23]
  },
  {
    name: "Manuscripts",
    format: "Unique manuscript collection",
    titles: [
      "Alder Quay Harbour Master's Working Papers",
      "Bracken Vale Mutual Aid Society Minute Book",
      "Copper Fen Canal Survey Field Notebook",
      "Dunmere Midwives' Correspondence, Selected Years",
      "Elmbridge Conservators' Workshop Register",
      "Foxhaven Tenants' Association Petition File",
      "Greywater Weavers' Dye Recipes and Accounts",
      "Hawthorn Reach School Log and Attendance Book",
      "Ivy Basin Orchard Workers' Wage Ledger",
      "Juniper Bay Weather Observer's Journal",
      "Kestrel Hill Cooperative Housing Plans",
      "Larchford Theatre Company's Prompt Book",
      "Mossbank Settlement House Visitor Register",
      "North Orchard Estate Steward's Letters",
      "Otter Marsh Flood Committee Records",
      "Plover Heath Women's Institute Recipe Album",
      "Rowan Common Parish Repair Accounts",
      "Sedgewick Quarry Workers' Oral Notes",
      "Thistle Cove Lifeboat Crew Service Book",
      "Willow Crossing Railway Engineer's Sketches",
      "Alder Quay Migrant Aid Correspondence",
      "Bracken Vale Naturalists' Field Diary",
      "Copper Fen Print Shop Job Book",
      "Dunmere Market Traders' Petition Bundle",
      "Elmbridge Amateur Astronomers' Observations"
    ],
    formats: ["Paper manuscript volume", "Correspondence file", "Mixed paper archive", "Bound ledger"],
    extents: ["1 volume (96 leaves)", "1 box (0.08 linear metres)", "1 file (34 documents)", "2 folders (58 sheets)", "1 ledger (124 pages)"],
    prices: [38500, 92000, 67500, 148000, 56000, 119000, 74500, 43500, 86500, 51500, 184000, 63000, 97000, 158000, 108000, 48500, 72000, 127000, 59000, 166000, 112000, 79500, 53500, 139000, 68000],
    dates: ["1891-1904", "1918-1926", "1867", "1934-1941", "1905-1930", "1922", "1880-1897", "1901-1912", "1876", "1946-1958", "1939", "1927-1933", "1910-1916", "1858-1872", "1952-1964", "1931", "1889-1902", "1943", "1908-1921", "1870-1884", "1968-1975", "1899", "1920-1937", "1914-1919", "1936-1948"],
    notes: [
      "The collection is a fictional composite; names and events do not describe real people.",
      "One folder lists correspondents whose privacy status is unknown.",
      "The original order is uncertain; a preliminary inventory is supplied for review.",
      "Several sheets appear to have been detached from a larger, unidentified file.",
      "The supplied dates are approximate and have not been verified against external records."
    ],
    reproducible: [12, 24]
  },
  {
    name: "Historical Maps",
    format: "Unique historical map",
    titles: [
      "Alder Quay Estuary Soundings and Mudflats",
      "Bracken Vale Turnpike and Toll Stations",
      "Copper Fen Drainage Board Proposed Works",
      "Dunmere Market Quarter after the 1892 Fire",
      "Elmbridge Parish Boundaries and Footpaths",
      "Foxhaven Timber Tramway Route Plan",
      "Greywater Canal Locks and Wharfage",
      "Hawthorn Reach Land Allotments, West Ward",
      "Ivy Basin Waterworks Elevation and Catchment",
      "Juniper Bay Coastal Defences, Annotated Sheet",
      "Kestrel Hill Quarry Leases and Access Roads",
      "Larchford Tramways: Extensions under Review",
      "Mossbank Housing Survey, North District",
      "North Orchard Railway Junction Plan",
      "Otter Marsh Reclamation Scheme, Draft",
      "Plover Heath Common Rights and Boundary Marks",
      "Rowan Common Floodplain and Mill Races",
      "Sedgewick Mineral Survey, Coloured Sections",
      "Thistle Cove Harbour Entrance and Beacon Siting",
      "Willow Crossing Market Gardens and Rail Spur",
      "Alder Quay Insurance Plan of the Ropewalks",
      "Bracken Vale Woodland Compartments and Coppice",
      "Copper Fen River Ferry Crossings",
      "Dunmere Public Baths and Water Supply Plan",
      "Elmbridge Rural District Sanitary Survey"
    ],
    formats: ["Manuscript map sheet", "Printed map", "Survey plan", "Coloured cadastral sheet"],
    extents: ["1 sheet (42 × 58 cm)", "1 map (68 × 94 cm)", "2 sheets (each 51 × 73 cm)", "1 folded plan (33 × 41 cm)", "1 sheet on linen (76 × 102 cm)"],
    prices: [42500, 78500, 156000, 59000, 68000, 119000, 95000, 53000, 184000, 87000, 132000, 72000, 228000, 61500, 143000, 48500, 110000, 196000, 82500, 97000, 105000, 57500, 39000, 122000, 76500],
    dates: ["1889", "1841", "1907", "1893", "1872", "1916", "1865", "1923", "1901", "1937", "1880", "1912", "1954", "1898", "1949", "1826", "1877", "1909", "1853", "1929", "1896", "1862", "1919", "1904", "1933"],
    notes: [
      "The scale statement is partly obscured; georeferencing would require specialist review.",
      "Annotations use an unidentified hand and may post-date the printed base map.",
      "The depicted boundary is disputed in the fictional accompanying correspondence.",
      "A proposed route is shown, but the record does not establish that it was built.",
      "The sheet includes named properties; review privacy and reproduction concerns before release."
    ],
    reproducible: [5, 14, 22]
  },
  {
    name: "Rare Audio",
    format: "Unique audio collection",
    titles: [
      "Alder Quay Dockworkers' Shift Bell Recordings",
      "Bracken Vale Dialect Interviews, Reel Set A",
      "Copper Fen Foundry Sounds and Oral Notes",
      "Dunmere Flood Testimony: Acetate Disc Set",
      "Elmbridge Market Day Soundwalk Masters",
      "Foxhaven Railway Signalmen's Recorded Recollections",
      "Greywater Canal Songs, Field Recording Reels",
      "Hawthorn Reach Community Radio Test Transmissions",
      "Ivy Basin Orchard Workers' Song Recordings",
      "Juniper Bay Weather Station Voice Logs",
      "Kestrel Hill Brass Band Rehearsal Acetates",
      "Larchford Theatre Sound Effects and Cue Tapes",
      "Mossbank Tenants' Meeting Cassettes",
      "North Orchard Bell Foundry Test Tones",
      "Otter Marsh Bird Survey Reference Tapes",
      "Plover Heath Evacuation Drill Announcements",
      "Rowan Common Oral History: Mill Closure",
      "Sedgewick Quarry Machinery Demonstration Reels",
      "Thistle Cove Lifeboat Launch Sound Recordings",
      "Willow Crossing Station Announcements, Wire Set",
      "Alder Quay Harbour Voices: Community Interview Masters",
      "Bracken Vale Folklore Society Cylinder Transfers",
      "Copper Fen School Choir Broadcast Acetates",
      "Dunmere Market Traders' Oral History Cassettes",
      "Elmbridge Night Sky Radio Observations"
    ],
    formats: ["Open-reel audio tape", "Acetate disc set", "Compact cassette collection", "Wire recording set"],
    extents: ["3 reels (7-inch, ¼-inch tape)", "6 discs (12-inch, 78 rpm)", "8 cassettes (approx. 6 hours)", "2 reels with cue sheets", "1 box (12 carriers, mixed formats)"],
    prices: [68000, 124000, 89500, 178000, 72500, 142000, 109000, 97000, 83500, 61000, 156000, 75500, 118000, 99000, 54000, 86000, 132000, 167000, 92000, 204000, 147000, 112000, 73500, 126000, 58000],
    dates: ["1968", "1974-1979", "1958", "1981", "1971", "1962-1969", "1949", "1987", "1955-1960", "1977", "1966", "1973", "1991", "1952", "1983-1986", "1960", "1979", "1956", "1964", "1938", "1994-1998", "1908 (transfers 1972)", "1969", "1989", "1976"],
    notes: [
      "The carrier has not been auditioned; the description is based on a fictional label inventory.",
      "Playback speed and equalization are not confirmed; transfer specifications are absent.",
      "A transcript contains personal names; access should be reviewed before digitization.",
      "The recording may include third-party music; no synchronization or distribution rights are supplied.",
      "Any preservation transfer requires a compatible deck and a documented signal chain."
    ],
    reproducible: [7, 17]
  },
  {
    name: "Ethnographic Collections",
    format: "Unique ethnographic collection",
    titles: [
      "Alder Quay Net-Mending Demonstration Set",
      "Bracken Vale Seasonal Weaving Sample Group",
      "Copper Fen Market Basket-Making Study Set",
      "Dunmere Harbor Workwear Teaching Collection",
      "Elmbridge Cooperative Dye Recipe and Swatch Set",
      "Foxhaven Boat Caulking Tool Group",
      "Greywater Household Grain Measures",
      "Hawthorn Reach Community Festival Sash Set",
      "Ivy Basin Orchard Grafting Demonstration Tools",
      "Juniper Bay Fish-Curing Equipment Study Group",
      "Kestrel Hill Stone-Carving Workshop Samples",
      "Larchford Workers' Banner Textile Fragments",
      "Mossbank Migrant Kitchen Implements Study Set",
      "North Orchard Seed-Saving Implements",
      "Otter Marsh Reed-Bundle Basketry Samples",
      "Plover Heath Community Loom Components",
      "Rowan Common Dairy Cooperative Churn Tools",
      "Sedgewick Quarry Lunch Tin and Work Kit Group",
      "Thistle Cove Sailcloth Repair Sample Set",
      "Willow Crossing Traveling Market Display Objects",
      "Alder Quay Coastal Navigation Teaching Models",
      "Bracken Vale Winter Harvest Implements",
      "Copper Fen Printmakers' Block and Roller Set",
      "Dunmere Neighborhood Festival Costume Accessories",
      "Elmbridge Shared Garden Tool and Seed Exchange Set"
    ],
    formats: ["Mixed-material study collection", "Textile and tool group", "Community practice teaching set", "Composite object group"],
    extents: ["1 lidded tray (8 components)", "1 box (12 objects, mixed materials)", "3 textile samples and 4 tools", "1 crate (6 components; 2.4 kg)", "1 portfolio (9 mounted samples)"],
    prices: [112000, 86000, 157000, 194000, 97500, 142000, 78500, 168000, 93000, 125000, 214000, 186000, 138000, 67500, 82000, 151000, 103000, 119000, 93500, 246000, 178000, 108000, 134000, 162000, 99000],
    dates: ["c. 1960-1980", "c. 1930-1950", "c. 1975", "c. 1940-1965", "c. 1950-1970", "c. 1910-1930", "c. 1880-1910", "c. 1965-1990", "c. 1930", "c. 1955-1975", "c. 1900-1920", "c. 1920-1940", "c. 1970-1990", "c. 1910", "c. 1940-1960", "c. 1935-1955", "c. 1890-1920", "c. 1945-1960", "c. 1930-1950", "c. 1960-1985", "c. 1980 (teaching models)", "c. 1920-1940", "c. 1950-1970", "c. 1970-1990", "c. 1985-2000"],
    notes: [
      "The invented community file requests consultation before display or online description.",
      "Cultural attribution is uncertain; do not infer identity or ceremonial use from appearance.",
      "A fictional donor's account conflicts with the transfer note; lawful authority is unresolved.",
      "Potentially sensitive knowledge is summarized only at a high level pending community guidance.",
      "The composite offering is not presented as an authentic object from any real community."
    ],
    reproducible: [20, 22]
  },
  {
    name: "Ephemera & Photographs",
    format: "Unique ephemera and photograph collection",
    titles: [
      "Alder Quay Ferry Timetables and Passenger Notices",
      "Bracken Vale Cooperative Shop Circulars",
      "Copper Fen Flood Relief Photographs and Captions",
      "Dunmere Market Hall Opening Day Scrapbook",
      "Elmbridge Women's Workshop Handbills",
      "Foxhaven Railway Excursion Posters",
      "Greywater Canal Toll Tickets and Account Slips",
      "Hawthorn Reach School Pageant Photograph Album",
      "Ivy Basin Orchard Labels and Packing Cards",
      "Juniper Bay Lifeboat Fundraising Broadsides",
      "Kestrel Hill Public Lecture Lantern Slides",
      "Larchford Theatre Production Contact Sheets",
      "Mossbank Housing Campaign Leaflets",
      "North Orchard Harvest Fair Glass Plate Surrogates",
      "Otter Marsh River Clean-Up Press Prints",
      "Plover Heath Airfield Closure Notices",
      "Rowan Common Mill Workers' Farewell Album",
      "Sedgewick Miners' Welfare Concert Programmes",
      "Thistle Cove Harbor Festival Snapshot Group",
      "Willow Crossing Market Garden Seed Packets",
      "Alder Quay Local History Club Newsletter Files",
      "Bracken Vale Children's Picture Postcard Set",
      "Copper Fen Tenants' Association Petition Sheets",
      "Dunmere Street Traders' Window Cards",
      "Elmbridge Amateur Observatory Photographic Prints"
    ],
    formats: ["Photograph and paper ephemera file", "Scrapbook and loose inserts", "Printed ephemera collection", "Photographic negative and print group"],
    extents: ["1 folder (26 items)", "1 album (38 leaves, 54 prints)", "1 box (3 folders; 0.06 linear metres)", "1 set (18 prints and 7 captions)", "2 folders (41 sheets and 12 photographs)"],
    prices: [49000, 58000, 86000, 117000, 42500, 73000, 39000, 134000, 52500, 61000, 95000, 128000, 47000, 169000, 67500, 54500, 98000, 62000, 71500, 36500, 89000, 43000, 56000, 33500, 102000],
    dates: ["1936-1948", "1921-1930", "1953", "1908", "1940-1956", "1939-1952", "1887-1903", "1928", "1946-1962", "1912-1925", "1961", "1958-1969", "1974-1982", "1901 (surrogates)", "1986", "1965-1971", "1932", "1948-1960", "1978-1985", "1950-1968", "1969-1988", "1905-1915", "1976", "1930-1940", "1959-1973"],
    notes: [
      "Captions include names that may identify living relatives; conduct privacy review.",
      "A donor restriction limits online publication; the stated term is unclear.",
      "The file includes third-party photographs with no model or reproduction releases.",
      "The sequence was imposed by a later compiler and may not reflect original order.",
      "Some items may contain sensitive personal details; provide mediated access if approved."
    ],
    reproducible: [10, 20, 21]
  }
];

function record(definition, index, id) {
  const place = places[(index * 7 + categoryData.indexOf(definition) * 3) % places.length];
  const unique = !definition.reproducible.includes(index);
  const condition = conditionNotes[definition.name][index % conditionNotes[definition.name].length];
  const provenance = provenanceNotes[(index + categoryData.indexOf(definition)) % provenanceNotes.length];
  const rights = rightsNotes[(index * 2 + categoryData.indexOf(definition)) % rightsNotes.length];
  const preservation = preservationNotes[(index * 3 + categoryData.indexOf(definition)) % preservationNotes.length];
  const handling = handlingNotes[(index + categoryData.indexOf(definition) * 2) % handlingNotes.length];
  const note = definition.notes[index % definition.notes.length];
  const physicalExtent = definition.extents[index % definition.extents.length];
  const format = unique
    ? definition.format
    : definition.name === "Rare Books" || definition.name === "Manuscripts" || definition.name === "Historical Maps"
      ? "Published facsimile edition"
      : definition.name === "Rare Audio" ? "Licensed preservation access copy" : "Reproducible study edition";
  return {
    id,
    title: definition.titles[index],
    creator: creators[(index * 11 + categoryData.indexOf(definition) * 5) % creators.length],
    catalogGroup: group,
    materialCategory: definition.name,
    format,
    creationDate: definition.dates[index],
    publisherDescription: `Fictional composite offering assembled for classroom acquisitions practice; no real collection or chain of title is represented.`,
    description: `Simulated classroom offering. ${note} ${physicalExtent}. ${condition} ${provenance}`,
    unitPriceCents: definition.prices[index],
    availability: unique ? "One simulated offering; review documentation before acquisition" : "Simulated reproducible edition; rights review required",
    maxQuantity: unique ? 1 : 25,
    unique,
    metadata: {
      fictionalRecord: true,
      source: "fictional simulation",
      identifierStatus: "Simulated offering; no verified external identifier supplied",
      intendedUse: "Special collections classroom case study"
    },
    specialCollections: {
      classroomSimulation: true,
      physicalExtent,
      condition,
      provenanceSummary: provenance,
      acquisitionPriceCents: definition.prices[index],
      accessRightsRestrictions: rights,
      preservationConsiderations: preservation,
      specialHandlingNotes: handling,
      acquisitionNote: note,
      reviewConsiderations: concerns[(index + categoryData.indexOf(definition)) % concerns.length],
      transferAndEthicsNotice: "A listed price and simulated vendor description do not establish lawful ownership, transfer authority, cultural permission, or ethical acceptability."
    }
  };
}

function generateRecords() {
  const records = [];
  let number = 1601;
  for (const definition of categoryData) {
    for (let index = 0; index < definition.titles.length; index += 1) {
      records.push(record(definition, index, `PN${number}`));
      number += 1;
    }
  }
  return records;
}

if (require.main === module) {
  const records = generateRecords();
  fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Generated ${records.length} special-collections classroom records.`);
}

module.exports = { generateRecords, categoryData, outputPath };

const fs = require("node:fs");
const path = require("node:path");

const outputPath = path.join(__dirname, "..", "data", "audiovisual.json");
const catalogGroup = "Audiovisual & Gaming";

const movies = [
  "Northbound at Dawn", "The Glass Orchard", "Harbour of Small Lights", "A Map of Quiet Rivers",
  "The Last Weather Station", "Letters from Copper Fen", "The Long Winter Crossing", "A Room for the Tides",
  "The Clockmaker's Garden", "Field Notes from Greywater", "The Lanterns of Bracken Vale", "After the Floodmarks",
  "The Blue Cartographer", "A Season of Swallows", "The Fifth Bell", "The Archive at Willow Crossing",
  "Three Roads to Juniper Bay", "The Paper Astronomer", "A Song for the North Orchard", "Under the Sedgewick Bridge",
  "The River Keeps Its Names", "Alder Quay in Winter", "The Night Train to Plover Heath", "The Borrowed Observatory",
  "Orchard of the Far Shore", "The Weavers' Almanac", "An Atlas of Passing Clouds", "The Last Cinema in Dunmere",
  "A Small History of Rain", "Foxhaven: A Working Harbour", "The Mossbank Listening Project", "The Shape of a Footpath",
  "Children of the Tide Clock", "The Museum of Unfinished Maps", "A House Built for Wind", "The Copper Fen Inquiry",
  "A Field Guide to Lantern Light", "The Orchard at the End of the Line", "Songs from the Floodplain",
  "The Hawthorn Reach Letters", "A Summer at Rowan Common", "The Quiet Work of Repair", "The Saffron Road",
  "A Camera for the Common", "The Winter Market", "The Valley of Borrowed Time", "Notes from an Empty Station",
  "The Last Boatbuilder", "A School Above the Marsh", "The Island Between Two Ferries"
];
const movieSummaries = [
  "An intimate drama about a family archive and the choices hidden in its margins.",
  "A regional documentary follows volunteers mapping changes to a working waterfront.",
  "A children's adventure pairs a night journey with a practical lesson in observation.",
  "A historical portrait considers how ordinary residents recorded a changing town.",
  "A quiet science film explains field methods through a fictional watershed study.",
  "A multilingual ensemble story explores migration, memory, and neighborhood life.",
  "A restored-style cinema program is presented as a simulated collection edition.",
  "An educational production introduces local weather records and their interpretation.",
  "A music-led documentary traces a fictional community's changing traditions.",
  "A family feature follows young naturalists through a season of field discoveries."
];

const albums = [
  "Blue Room at Closing", "Songs for the Ferry Crossing", "Three Studies in Copper", "The Bracken Vale Sessions",
  "Alder Quay Work Songs", "Night Weather, Side A", "Juniper Bay String Band", "Small Hours Quartet",
  "The Willow Crossing Choir", "Maps in the Piano Bench", "Greywater Brass and Reed", "The Orchard Dance",
  "Letters Set to Music", "Sedgewick After Dark", "Kitchen Table Lullabies", "A Field Recording of Rain",
  "The North Orchard Ballads", "Copper Fen Percussion Circle", "Sunday at the Old Hall", "Tides and Turntables",
  "Hawthorn Reach Folk Archive", "The Lantern Parade", "Four Migrations", "Larchford Blue Notes",
  "Songs from a Borrowed Room", "Riverbank Ragas", "The Small Town Big Band", "A Winter of Sea Shanties",
  "Plover Heath Piano Works", "The Market Day Fiddlers", "Oral Histories in Song", "Dunmere Dance Orchestra",
  "The Last Reel-to-Reel Club", "A Choir for Every Season", "Quiet Songs for the Crossing"
];
const albumNotes = [
  "A studio jazz set with close-miked acoustic instruments and a restrained mix.",
  "A folk ensemble records newly arranged melodies from a fictional coastal district.",
  "A classical chamber program pairs contemporary pieces with a simulated local commission.",
  "A children's collection uses short songs and spoken transitions for group listening.",
  "A regional ensemble blends strings, hand percussion, and call-and-response vocals.",
  "A historical-style transfer is described as a classroom simulation, not a sourced recording.",
  "An instrumental album emphasizes dynamic range and careful playback handling.",
  "A community choir and small orchestra share a live-session program."
];

const audiobooks = [
  "The Estuary Ledger", "A Cabinet of River Stones", "The Weather Clerk's Daughter", "How Towns Remember",
  "The Borrowed Orchard", "A Short Atlas of Waiting", "The Keeper of Small Hours", "Learning to Read the Marsh",
  "The Last Tram to Larchford", "A History of Useful Things", "The Paper Bridge", "Fieldwork for Beginners",
  "The Island Postmistress", "The Bookbinder's Apprentice", "A House Full of Maps", "The Children's Guide to Tides",
  "The Year of the Night Garden", "Letters from a Shared Kitchen", "The Young Astronomers' Club",
  "The Foxhaven Inquiry", "A Practical History of Rain", "The Library at the Crossing", "The Orchard in Winter",
  "Stories from the Lantern Room", "Notes on a Common Life"
];
const audiobookNotes = [
  "Narrated by a single performer with clearly separated chapter tracks.",
  "A two-voice reading includes a short pronunciation guide for place names.",
  "Unabridged performance with a measured pace and descriptive track listing.",
  "Abridged edition; the packaging notes the adaptation and omitted appendices.",
  "A children's narration includes chapter breaks and a brief content note.",
  "A nonfiction title includes a pronunciation list and a supplementary reading guide."
];

const games = [
  "Tidepool Tinkerers", "The Clockwork Orchard", "Lantern Lines", "Marshland Survey",
  "Copper Fen Puzzle Works", "North Orchard Tactics", "The Last Ferry Home", "Museum After Hours",
  "Weather Station 9", "Sedgewick Signal Box", "Alder Quay Regatta", "The Quiet Cartographer",
  "Bracken Vale Builders", "The Lost Footpath", "River Riddle League", "Small Planet Garden",
  "Foxhaven Football Club", "Willow Crossing Rally", "The Archive Key", "Juniper Bay Chess House",
  "Cloud Atlas Junior", "Greywater Strategy Table", "The Lantern Keeper's Quest", "Dunmere Detectives",
  "Kestrel Hill Skaters", "Plover Heath Flight School", "The Orchard of Echoes", "Rowan Common Cricket",
  "Mapmakers of Mossbank", "The Railway Timekeeper", "Hawthorn Reach Storybook", "The Last Observatory",
  "Thistle Cove Rescue Crew", "Elmbridge Garden Puzzles", "The Museum of Many Doors",
  "Larchford Legends: Ashfall", "Shores Beyond the Beacon", "Stoneworks: Deep Quarry",
  "The Long Winter Campaign", "Night Shift at Greywater"
];
const gameNotes = [
  "Local cooperative play supports shared problem-solving; no network service is required.",
  "A turn-based strategy title with readable menus and a brief tutorial scenario.",
  "Physical cartridge/disc edition in this simulation; library circulation suitability needs review.",
  "Includes adjustable text size and subtitle settings as described in the simulated record.",
  "Requires the stated console family; save-data transfer and accessories are not included.",
  "Designed for one to four local players; examine age rating and equipment needs before selection.",
  "The mature-audience edition is clearly rated and should follow local collection policy.",
  "A puzzle-focused game with short sessions and no simulated online account entitlement."
];

const directors = ["Mina Sol", "Elliot Vale", "Rhea North", "Jonas Fen", "Dara Finch", "Ivo Hart", "Talia West", "Bram Alder"];
const artists = ["The Copper Fen Trio", "Mara Ellery Ensemble", "Juniper Bay String Band", "Greywater Brass Circle", "Nia Corbett", "Alder Quay Chorale", "Kit Rowan Quartet", "Willow Crossing Players"];
const narrators = ["Nell Armitage", "Oren Bell", "Sabine North", "Rafi Calder", "Maren Sol", "Felix Orme", "Asha Merritt", "Tomas Wren"];
const labels = ["North Orchard Sound", "Tideglass Sessions", "Common Room Records", "Bracken Vale Audio", "Fenlight Pressings"];
const genres = ["Documentary", "Family adventure", "Historical drama", "Nature study", "Mystery", "Classical", "Jazz", "Folk", "Children's music", "Strategy", "Puzzle adventure", "Sports"];
const languages = ["English", "English; Welsh", "English; French", "English; Spanish", "English; Arabic", "English; subtitles available"];
const ratings = ["G", "PG", "PG", "PG-13", "E", "E10+", "T", "M"];
const platforms = {
  switch: { name: "Nintendo Switch", cents: 4499 },
  switch2: { name: "Nintendo Switch 2", cents: 5999 },
  ps4: { name: "PlayStation 4", cents: 3999 },
  ps5: { name: "PlayStation 5", cents: 4999 },
  "xbox-one": { name: "Xbox One", cents: 3999 },
  "xbox-series-x": { name: "Xbox Series X", cents: 4999 }
};

const movieEditions = [
  ["dvd"], ["dvd", "bluray"], ["dvd", "bluray", "uhd4k"], ["dvd"],
  ["dvd", "bluray"], ["dvd", "bluray"], ["dvd", "bluray", "uhd4k"], ["dvd"]
];
const musicEditions = [["audio-cd"], ["audio-cd", "vinyl-lp"], ["audio-cd"], ["audio-cd", "vinyl-lp"], ["audio-cd"]];
const audiobookEditions = [
  ["audiobook-cd", "mp3-cd", "playaway"], ["audiobook-cd", "mp3-cd"],
  ["audiobook-cd", "playaway"], ["audiobook-cd"], ["audiobook-cd", "mp3-cd", "playaway"]
];
const gamePlatforms = [
  ["switch", "ps5"], ["switch", "ps4", "xbox-one"], ["switch", "ps5", "xbox-series-x"],
  ["ps4", "ps5"], ["switch", "switch2"], ["ps5", "xbox-series-x"], ["switch", "ps4"],
  ["switch", "ps5", "xbox-series-x"], ["switch", "ps4", "xbox-one"], ["switch2", "ps5"],
  ["switch", "ps4"], ["ps5", "xbox-series-x"], ["switch", "switch2", "ps5"],
  ["switch", "ps4", "xbox-one"], ["switch", "ps5"], ["switch", "switch2"],
  ["ps4", "ps5", "xbox-one"], ["switch", "ps5", "xbox-series-x"], ["ps5", "xbox-series-x"],
  ["switch", "ps4"], ["switch", "switch2"], ["ps4", "xbox-one"], ["switch", "ps5"],
  ["switch", "ps4", "xbox-one"], ["switch", "ps5"], ["ps4", "ps5", "xbox-series-x"],
  ["switch", "switch2", "ps5"], ["switch", "ps4", "xbox-one"], ["switch", "ps5"],
  ["switch", "ps4"], ["switch", "ps5"], ["ps5", "xbox-series-x"],
  ["switch", "ps5"], ["switch", "switch2"], ["switch", "ps5"],
  ["ps5", "xbox-series-x"], ["switch", "ps5", "xbox-series-x"], ["ps5", "xbox-series-x"],
  ["ps5", "xbox-series-x"], ["ps4", "ps5", "xbox-one", "xbox-series-x"]
];

const filmPrices = [
  1799, 2499, 2199, 1899, 2699, 2299, 1999, 2399, 1699, 2799,
  1899, 2999, 2599, 1799, 2099, 3199, 1999, 2299, 1899, 2499,
  2199, 1599, 2699, 2399, 1999, 2899, 2199, 1799, 2299, 2999,
  2599, 1899, 1699, 2799, 2199, 2399, 1999, 2599, 1899, 2299,
  2499, 1799, 2699, 2099, 1899, 2399, 1999, 2899, 2199, 2599
];
const albumPrices = [
  1499, 1899, 2199, 1699, 1999, 2399, 1799, 2299, 1599, 2099,
  1899, 2499, 1699, 2199, 1399, 1799, 1999, 2299, 1599, 2599,
  1899, 1499, 2399, 2199, 1799, 2499, 1999, 1699, 2299, 1899,
  2199, 2599, 1799, 1999, 1499
];
const audiobookPrices = [
  2499, 3299, 2799, 3599, 2299, 2999, 3899, 2699, 3199, 3499,
  2399, 2999, 3799, 2599, 3399, 2199, 2899, 3699, 2499, 3199,
  3499, 2799, 3899, 2399, 3299
];

function priceEdition(id, referencePriceCents) {
  const definitions = {
    dvd: ["DVD", 1],
    bluray: ["Blu-ray", 1.3],
    uhd4k: ["4K UHD Blu-ray", 1.65],
    "audio-cd": ["Audio CD", 1],
    "vinyl-lp": ["Vinyl LP", 1.5],
    "audiobook-cd": ["CD Audiobook", 1],
    "mp3-cd": ["MP3-CD", 0.85],
    playaway: ["Playaway", 1.6]
  };
  const [name, multiplier] = definitions[id];
  return { id, name, multiplier, unitPriceCents: Math.round(referencePriceCents * multiplier) };
}

function mediaRecord(type, index, id) {
  let title;
  let materialCategory;
  let format;
  let creator;
  let referencePriceCents;
  let simulatedEditions;
  let audiovisualMetadata;
  let description;
  let maxQuantity = 99;

  if (type === "movie") {
    title = movies[index];
    materialCategory = "Movies & Television";
    format = "Film";
    creator = directors[index % directors.length];
    referencePriceCents = filmPrices[index];
    simulatedEditions = movieEditions[index % movieEditions.length]
      .map(edition => priceEdition(edition, referencePriceCents));
    audiovisualMetadata = {
      "Director / originating organization": creator,
      "Release year": String(1974 + (index * 7) % 49),
      "Runtime": `${78 + (index * 11) % 77} minutes`,
      "Genre": genres[index % 5],
      "Audience rating": ratings[index % 4],
      "Language / subtitles": languages[index % languages.length],
      "Public-performance rights": "Not included; verify permissions separately",
      "Collection note": ["Check subtitle legibility and playback region.", "Confirm runtime and audience suitability against local policy.", "The simulated edition conveys no screening or public-performance rights.", "Review replacement availability before selecting a format."][index % 4]
    };
    description = `Simulated film acquisition. ${movieSummaries[index % movieSummaries.length]} Edition availability is limited to the formats listed for this record.`;
  } else if (type === "music") {
    title = albums[index];
    materialCategory = "Music";
    format = "Music recording";
    creator = artists[index % artists.length];
    referencePriceCents = albumPrices[index];
    simulatedEditions = musicEditions[index % musicEditions.length]
      .map(edition => priceEdition(edition, referencePriceCents));
    audiovisualMetadata = {
      "Artist / ensemble": creator,
      "Release year": String(1978 + (index * 3) % 45),
      "Genre": genres[5 + index % 4],
      "Label": labels[index % labels.length],
      "Duration": `${31 + (index * 7) % 38} minutes`,
      "Recording note": albumNotes[index % albumNotes.length],
      "Collection note": ["Confirm condition and playback equipment before adding vinyl.", "CD is a replaceable circulating edition; verify replacement availability.", "Audio quality and transfer notes are simulated and unverified.", "Consider local format demand and storage capacity."][index % 4]
    };
    description = `Simulated music recording. ${albumNotes[index % albumNotes.length]} Available editions are listed individually; recording provenance and rights are fictional.`;
  } else if (type === "audiobook") {
    title = audiobooks[index];
    materialCategory = "Audiobooks";
    format = "Audiobook recording";
    creator = ["Mara Ellery", "Ivo Hart", "Nia Corbett", "Sami Fern", "Tessa Vale"][index % 5];
    referencePriceCents = audiobookPrices[index];
    simulatedEditions = audiobookEditions[index % audiobookEditions.length]
      .map(edition => priceEdition(edition, referencePriceCents));
    audiovisualMetadata = {
      "Author": creator,
      "Narrator": narrators[index % narrators.length],
      "Duration": `${5 + (index * 3) % 14} hours ${[12, 24, 36, 48, 0][index % 5]} minutes`,
      "Audience": ["Adult fiction", "Adult nonfiction", "Young adult", "Children"][index % 4],
      "Text status": index % 3 === 0 ? "Unabridged" : index % 3 === 1 ? "Abridged; adaptation disclosed" : "Edition status not supplied",
      "Playback / accessibility": ["Track navigation and spoken-word playback; verify local equipment.", "Printed companion text not included in this simulated record.", "Confirm playback compatibility and accessible controls."][index % 3],
      "Collection note": "Playaway, when listed, is a distinct physical player-based format; no downloadable license is supplied."
    };
    description = `Simulated audiobook acquisition. ${audiobookNotes[index % audiobookNotes.length]} Edition availability is limited to the formats listed for this record.`;
  } else {
    title = games[index];
    materialCategory = "Video Games";
    format = "Physical video game";
    creator = ["North Orchard Interactive", "Tideglass Studio", "Common Room Games", "Bracken Vale Works", "Fenlight Play"][index % 5];
    const supportedPlatforms = gamePlatforms[index];
    simulatedEditions = supportedPlatforms.map(platformId => ({
      id: platformId,
      name: platforms[platformId].name,
      unitPriceCents: platforms[platformId].cents + (index % 4) * 300
    }));
    referencePriceCents = Math.min(...simulatedEditions.map(edition => edition.unitPriceCents));
    audiovisualMetadata = {
      "Publisher": creator,
      "Release year": String(2014 + (index * 2) % 12),
      "Genre": genres[9 + index % 3],
      "Audience rating": ratings[4 + index % 4],
      "Physical editions": simulatedEditions.map(edition => edition.name),
      "Compatibility note": `Only the platform editions listed for this record are simulated as available. ${["Check console generation and required accessories before acquisition.", "Local multiplayer requires the listed console and suitable controllers.", "Review age rating and circulation equipment policy.", "No digital license, online entitlement, or downloadable content is included."][index % 4]}`,
      "Collection note": "Physical purchase does not establish digital redistribution rights; verify platform and circulation requirements."
    };
    description = `Simulated physical video game acquisition. ${gameNotes[index % gameNotes.length]} Platform availability and prices are explicit for this record; no digital-only edition is implied.`;
    if ([21, 33, 38].includes(index)) maxQuantity = 25;
  }

  return {
    id,
    title,
    creator,
    catalogGroup,
    materialCategory,
    format,
    ...(audiovisualMetadata["Release year"]
      ? { creationDate: audiovisualMetadata["Release year"] }
      : {}),
    publisherDescription: "Fictional classroom supplier record; no commercial stock, license, or rights are represented.",
    description,
    unitPriceCents: referencePriceCents,
    availability: "Simulated offering; edition availability is record-specific",
    maxQuantity,
    unique: false,
    simulatedEditions,
    audiovisualMetadata: {
      "Material type": format,
      ...audiovisualMetadata,
      "Simulation notice": "Classroom pricing and edition availability are simulated, not vendor quotations or verified commercial inventory."
    },
    metadata: {
      fictionalRecord: true,
      source: "fictional simulation",
      identifierStatus: "Simulated offering; no verified external identifier supplied",
      intendedUse: "Audiovisual and gaming collection development",
      eligibleEditionIds: simulatedEditions.map(edition => edition.id)
    }
  };
}

function generateRecords() {
  const records = [];
  for (let index = 0; index < movies.length; index += 1) {
    records.push(mediaRecord("movie", index, `PN-MEDIA-${String(index + 1).padStart(3, "0")}`));
  }
  for (let index = 0; index < albums.length; index += 1) {
    records.push(mediaRecord("music", index, `PN-MEDIA-${String(records.length + 1).padStart(3, "0")}`));
  }
  for (let index = 0; index < audiobooks.length; index += 1) {
    records.push(mediaRecord("audiobook", index, `PN-MEDIA-${String(records.length + 1).padStart(3, "0")}`));
  }
  for (let index = 0; index < games.length; index += 1) {
    records.push(mediaRecord("game", index, `PN-MEDIA-${String(records.length + 1).padStart(3, "0")}`));
  }
  return records;
}

if (require.main === module) {
  const records = generateRecords();
  fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Generated ${records.length} simulated audiovisual and gaming records.`);
}

module.exports = { generateRecords, outputPath, platforms };

export async function loadData() {
  const responses = await Promise.all(["data/catalog.json", "data/policies.json"].map(path => fetch(path)));
  if (responses.some(response => !response.ok)) throw new Error("Unable to load catalog or policies.");
  const [catalog, policies] = await Promise.all(responses.map(response => response.json()));
  return { catalog, policies };
}

export function filterCatalog(catalog, search, subject) {
  const query = search.trim().toLowerCase();
  return catalog.filter(book =>
    (!subject || book.subject === subject) &&
    `${book.id} ${book.title} ${book.author}`.toLowerCase().includes(query)
  );
}

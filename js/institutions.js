export function getInstitution(policies, id) {
  return policies.institutions.find(institution => institution.id === id);
}

export function collectionCodes(policies, institutionId) {
  return getInstitution(policies, institutionId)?.collectionCodes ?? [];
}

export function formatMoney(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function parseBudget(value) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(String(value))) return NaN;
  const [pounds, pence = ""] = String(value).split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

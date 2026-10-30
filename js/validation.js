import { collectionCodes, getInstitution } from "./institutions.js";
import { orderTotal } from "./cart.js";

const isText = value => typeof value === "string" && value.trim().length > 0;
const isBudget = value => Number.isSafeInteger(value) && value > 0 && value <= 100000000;

export function validateData(catalog, policies) {
  if (!Array.isArray(catalog) || !catalog.length) throw new Error("Catalog must contain titles.");
  const ids = new Set();
  for (const book of catalog) {
    if (!book || !isText(book.id) || ids.has(book.id) ||
        !["title", "author", "subject"].every(key => isText(book[key])) ||
        !Number.isSafeInteger(book.pricePence) || book.pricePence <= 0 || book.pricePence > 100000000) {
      throw new Error("Catalog contains an invalid or duplicate title.");
    }
    ids.add(book.id);
  }
  if (!policies || policies.currency !== "GBP" ||
      !Number.isSafeInteger(policies.maxQuantity) || policies.maxQuantity < 1 || policies.maxQuantity > 1000 ||
      !Array.isArray(policies.institutions) || !policies.institutions.length) {
    throw new Error("Invalid acquisition policies.");
  }
  const institutions = new Set();
  for (const institution of policies.institutions) {
    if (!institution || !isText(institution.id) || institutions.has(institution.id) ||
        !isText(institution.name) || !isBudget(institution.budgetPence) ||
        !Array.isArray(institution.collectionCodes) || !institution.collectionCodes.length ||
        !institution.collectionCodes.every(isText) ||
        new Set(institution.collectionCodes).size !== institution.collectionCodes.length) {
      throw new Error("Invalid institution policy.");
    }
    institutions.add(institution.id);
  }
}

export function validateOrder(order, catalog, policies) {
  const errors = [];
  if (!order || !getInstitution(policies, order.institutionId)) errors.push("Select a valid institution.");
  if (!isBudget(order?.budgetPence)) errors.push("Set a budget between £0.01 and £1,000,000.");
  if (!Array.isArray(order?.lines) || !order.lines.length) {
    errors.push("Add at least one title to the cart.");
    return errors;
  }
  if (order.lines.length > catalog.length * collectionCodes(policies, order.institutionId).length) {
    errors.push("The order contains too many lines.");
  }
  const seen = new Set();
  for (const line of order.lines) {
    if (!line || !catalog.some(book => book.id === line.bookId)) {
      errors.push("The cart contains an unknown title.");
      continue;
    }
    if (!collectionCodes(policies, order.institutionId).includes(line.collectionCode)) {
      errors.push(`${line.bookId}: choose a collection code allowed by the institution.`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > policies.maxQuantity) {
      errors.push(`${line.bookId}: quantity must be from 1 to ${policies.maxQuantity}.`);
    }
    const key = JSON.stringify([line.bookId, line.collectionCode]);
    if (seen.has(key)) errors.push(`${line.bookId}: duplicate title/collection line.`);
    seen.add(key);
  }
  if (!errors.length && orderTotal(order.lines, catalog) > order.budgetPence) {
    errors.push("The order exceeds the institution's order budget.");
  }
  return errors;
}

export function readDraft(value, catalog, policies) {
  if (!value || value.version !== 1 || !value.order) throw new Error("Unsupported draft format.");
  const source = value.order;
  if (!getInstitution(policies, source.institutionId) || !isBudget(source.budgetPence) ||
      !Array.isArray(source.lines) || source.lines.length > catalog.length * 20) {
    throw new Error("Invalid draft setup.");
  }
  const lines = source.lines.map(line => {
    if (!line || !catalog.some(book => book.id === line.bookId) ||
        !collectionCodes(policies, source.institutionId).includes(line.collectionCode) ||
        !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > policies.maxQuantity) {
      throw new Error("Draft contains an invalid title, collection code or quantity.");
    }
    return { bookId: line.bookId, collectionCode: line.collectionCode, quantity: line.quantity };
  });
  const keys = lines.map(line => JSON.stringify([line.bookId, line.collectionCode]));
  if (new Set(keys).size !== keys.length) throw new Error("Draft contains duplicate order lines.");
  return { institutionId: source.institutionId, budgetPence: source.budgetPence, lines, status: "draft", correspondence: [] };
}

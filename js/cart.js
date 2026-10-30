export function orderTotal(lines, catalog) {
  return lines.reduce((total, line) => {
    const book = catalog.find(item => item.id === line.bookId);
    return total + (book?.pricePence ?? 0) * line.quantity;
  }, 0);
}

export function addToCart(lines, bookId, collectionCode, quantity, maxQuantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) {
    throw new Error(`Quantity must be a whole number from 1 to ${maxQuantity}.`);
  }
  const existing = lines.find(line => line.bookId === bookId && line.collectionCode === collectionCode);
  if (existing) {
    if (existing.quantity + quantity > maxQuantity) {
      throw new Error(`Each title/collection line is limited to ${maxQuantity} copies.`);
    }
    existing.quantity += quantity;
  } else {
    lines.push({ bookId, collectionCode, quantity });
  }
}

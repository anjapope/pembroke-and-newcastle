import { validateOrder } from "./validation.js";
import { orderTotal } from "./cart.js";
import { formatMoney } from "./institutions.js";

function correspond(order, message) {
  order.correspondence.push({ date: new Date().toISOString(), message });
  order.correspondence = order.correspondence.slice(-30);
}

export function reviewOrder(order, catalog, policies) {
  if (order.status === "processed") throw new Error("This order has already been processed.");
  const errors = validateOrder(order, catalog, policies);
  order.status = errors.length ? "draft" : "approved";
  correspond(order, errors.length
    ? `Doris: Please correct the following before resubmitting:\n${errors.join("\n")}`
    : `Doris: All checks passed. Your order for ${formatMoney(orderTotal(order.lines, catalog))} is approved for simulated processing.`);
  return errors;
}

export function processOrder(order, catalog, policies) {
  if (order.status !== "approved") throw new Error("Doris must approve this order before processing.");
  const errors = validateOrder(order, catalog, policies);
  if (errors.length) {
    order.status = "draft";
    correspond(order, `Doris: Processing stopped:\n${errors.join("\n")}`);
    throw new Error("The order no longer passes validation. Please resubmit to Doris.");
  }
  order.status = "processed";
  correspond(order, "Doris: Order processed in the simulation. No order has been sent to a supplier. Start a new order to continue.");
}

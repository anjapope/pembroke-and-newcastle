import { loadData, filterCatalog } from "./catalog.js";
import { addToCart, orderTotal } from "./cart.js";
import { getInstitution, collectionCodes, formatMoney, parseBudget } from "./institutions.js";
import { validateData, validateOrder, readDraft } from "./validation.js";
import { reviewOrder, processOrder } from "./doris.js";

const $ = id => document.getElementById(id);
const storageKey = "pembroke-newcastle-session-v1";
const pageSize = 10;
let catalog, policies, order, staffName = "", page = 0;

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").dataset.error = String(error);
}

function blankOrder(institutionId = policies.institutions[0].id) {
  return {
    institutionId, budgetPence: getInstitution(policies, institutionId).budgetPence,
    lines: [], status: "draft", correspondence: []
  };
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, staffName, order }));
    return true;
  } catch {
    notice("Browser storage is unavailable or full. Download your draft to keep it.", true);
    return false;
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    if (raw.length > 1000000) throw new Error("Saved session is too large.");
    const saved = JSON.parse(raw);
    order = readDraft(saved, catalog, policies);
    if (typeof saved.staffName !== "string" || !saved.staffName.trim() || saved.staffName.length > 60) {
      throw new Error("Invalid saved staff name.");
    }
    staffName = saved.staffName.trim();
    if (["approved", "processed"].includes(saved.order.status) && !validateOrder(order, catalog, policies).length) {
      order.status = saved.order.status;
    }
    if (Array.isArray(saved.order.correspondence)) {
      order.correspondence = saved.order.correspondence.filter(entry =>
        entry && typeof entry.date === "string" && entry.date.length <= 40 &&
        typeof entry.message === "string" && entry.message.length <= 10000
      ).slice(-30).map(entry => ({ date: entry.date, message: entry.message }));
    }
    notice("Saved session restored.");
  } catch {
    staffName = "";
    order = blankOrder();
    notice("Saved session could not be restored. Start a new session; browser storage may be unavailable.", true);
  }
}

function editable() {
  if (order.status === "processed") throw new Error("Processed orders are locked. Start a new order.");
}

function changed() {
  order.status = "draft";
  persist();
  render();
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function run(action) {
  try { action(); } catch (error) { notice(error.message, true); }
}

function renderCatalog() {
  const books = filterCatalog(catalog, $("search").value, $("subject").value);
  const pages = Math.max(1, Math.ceil(books.length / pageSize));
  page = Math.min(page, pages - 1);
  $("catalog-count").textContent = `${books.length} of ${catalog.length} titles`;
  $("page").textContent = `Page ${page + 1} of ${pages}`;
  $("previous").disabled = page === 0;
  $("next").disabled = page >= pages - 1;
  $("catalog").replaceChildren();
  for (const book of books.slice(page * pageSize, (page + 1) * pageSize)) {
    const row = element("tr");
    row.append(element("td", `${book.id} — ${book.title}`), element("td", `${book.author} / ${book.subject}`),
      element("td", formatMoney(book.pricePence)));
    const code = element("select");
    code.setAttribute("aria-label", `Collection for ${book.title}`);
    for (const value of collectionCodes(policies, order.institutionId)) code.add(new Option(value, value));
    const quantity = element("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(policies.maxQuantity);
    quantity.value = "1";
    quantity.setAttribute("aria-label", `Quantity for ${book.title}`);
    const add = element("button", "Add");
    add.type = "button";
    add.setAttribute("aria-label", `Add ${book.title}`);
    add.disabled = order.status === "processed";
    add.addEventListener("click", () => run(() => {
      editable();
      addToCart(order.lines, book.id, code.value, Number(quantity.value), policies.maxQuantity);
      notice(`Added ${book.title} to the cart.`);
      changed();
    }));
    for (const control of [code, quantity, add]) {
      const cell = element("td");
      cell.append(control);
      row.append(cell);
    }
    $("catalog").append(row);
  }
}

function renderCart() {
  $("cart").replaceChildren();
  for (const [index, line] of order.lines.entries()) {
    const book = catalog.find(item => item.id === line.bookId);
    const row = element("tr");
    row.append(element("td", book.title), element("td", line.collectionCode));
    const quantity = element("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(policies.maxQuantity);
    quantity.value = String(line.quantity);
    quantity.disabled = order.status === "processed";
    quantity.setAttribute("aria-label", `Cart quantity for ${book.title} (${line.collectionCode})`);
    quantity.addEventListener("change", () => run(() => {
      editable();
      const value = Number(quantity.value);
      if (!Number.isInteger(value) || value < 1 || value > policies.maxQuantity) {
        quantity.value = String(line.quantity);
        throw new Error(`Quantity must be a whole number from 1 to ${policies.maxQuantity}.`);
      }
      line.quantity = value;
      notice("Quantity updated. Resubmit to Doris for approval.");
      changed();
    }));
    const quantityCell = element("td");
    quantityCell.append(quantity);
    row.append(quantityCell, element("td", formatMoney(book.pricePence * line.quantity)));
    const remove = element("button", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${book.title} (${line.collectionCode})`);
    remove.disabled = order.status === "processed";
    remove.addEventListener("click", () => run(() => {
      editable();
      order.lines.splice(index, 1);
      notice("Order line removed.");
      changed();
    }));
    const action = element("td");
    action.append(remove);
    row.append(action);
    $("cart").append(row);
  }
  const total = orderTotal(order.lines, catalog);
  $("totals").textContent = `${order.lines.length} lines · Total ${formatMoney(total)} · Budget ${formatMoney(order.budgetPence)} · Remaining ${formatMoney(order.budgetPence - total)}${total > order.budgetPence ? " — OVER BUDGET" : ""}`;
}

function render() {
  $("login-panel").hidden = Boolean(staffName);
  $("desk").hidden = !staffName;
  $("session-name").textContent = `Signed in as ${staffName}`;
  $("institution").value = order.institutionId;
  $("budget").value = (order.budgetPence / 100).toFixed(2);
  $("policy").textContent = `Allowed collections: ${collectionCodes(policies, order.institutionId).join(", ")}. Maximum ${policies.maxQuantity} copies per title/collection. Budget applies to this order only.`;
  for (const control of $("institution-form").elements) control.disabled = order.status === "processed";
  $("order-status").textContent = `Order status: ${order.status}`;
  $("process").disabled = order.status !== "approved";
  $("validate").disabled = order.status === "processed";
  $("save").disabled = order.status === "processed";
  $("correspondence").replaceChildren(...order.correspondence.map(entry =>
    element("li", `${entry.date} — ${entry.message}`)
  ));
  renderCatalog();
  renderCart();
}

function wireEvents() {
  $("login-form").addEventListener("submit", event => {
    event.preventDefault();
    staffName = $("staff-name").value.trim();
    if (!staffName) return notice("Enter a fictional staff name.", true);
    notice("Welcome to the fictional acquisitions desk.");
    persist();
    render();
  });
  $("logout").addEventListener("click", () => {
    staffName = "";
    order = blankOrder();
    $("staff-name").value = "";
    notice("Signed out. The local session has been cleared.");
    try { localStorage.removeItem(storageKey); }
    catch { notice("Signed out, but browser storage could not be cleared. Clear site data before sharing this browser.", true); }
    render();
  });
  $("institution").addEventListener("change", () => {
    $("budget").value = (getInstitution(policies, $("institution").value).budgetPence / 100).toFixed(2);
  });
  $("institution-form").addEventListener("submit", event => {
    event.preventDefault();
    run(() => {
      editable();
      const budgetPence = parseBudget($("budget").value);
      if (!Number.isSafeInteger(budgetPence) || budgetPence <= 0 || budgetPence > 100000000) {
        throw new Error("Enter a budget between £0.01 and £1,000,000.");
      }
      const institutionId = $("institution").value;
      if (institutionId !== order.institutionId && order.lines.length) {
        if (!confirm("Changing institution clears the cart and correspondence. Continue?")) return render();
        order = blankOrder(institutionId);
      }
      order.institutionId = institutionId;
      order.budgetPence = budgetPence;
      notice("Institution setup applied.");
      changed();
    });
  });
  for (const id of ["search", "subject"]) $(id).addEventListener("input", () => { page = 0; renderCatalog(); });
  $("previous").addEventListener("click", () => { page--; renderCatalog(); });
  $("next").addEventListener("click", () => { page++; renderCatalog(); });
  $("save").addEventListener("click", () => {
    if (persist()) notice("Order saved in this browser.");
  });
  $("new-order").addEventListener("click", () => {
    if (!confirm("Replace the current order? Download it first if you need a copy.")) return;
    order = blankOrder(order.institutionId);
    notice("New draft started.");
    changed();
  });
  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, order: {
      institutionId: order.institutionId, budgetPence: order.budgetPence, lines: order.lines
    } }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = element("a");
    link.href = url;
    link.download = "pembroke-newcastle-draft.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Draft downloaded for sharing. Imported copies always require fresh approval.");
  });
  $("import").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Draft files must be smaller than 1 MB.");
      const imported = readDraft(JSON.parse(await file.text()), catalog, policies);
      if (!confirm("Replace the current order with this shared draft?")) return;
      order = imported;
      notice("Shared draft opened. Send it to Doris for validation.");
      changed();
    } catch (error) {
      notice(`Unable to open draft: ${error.message}`, true);
    } finally { event.target.value = ""; }
  });
  $("validate").addEventListener("click", () => run(() => {
    const errors = reviewOrder(order, catalog, policies);
    notice(errors.length ? "Doris returned the order. See correspondence." : "Doris approved the order.", Boolean(errors.length));
    persist();
    render();
  }));
  $("process").addEventListener("click", () => {
    run(() => {
      processOrder(order, catalog, policies);
      notice("Simulated order processing complete.");
    });
    persist();
    render();
  });
}

async function start() {
  try {
    ({ catalog, policies } = await loadData());
    validateData(catalog, policies);
    order = blankOrder();
    for (const institution of policies.institutions) $("institution").add(new Option(institution.name, institution.id));
    for (const subject of [...new Set(catalog.map(book => book.subject))].sort()) $("subject").add(new Option(subject, subject));
    notice("Ready. Sign in with a fictional name to begin.");
    restore();
    wireEvents();
    render();
  } catch (error) {
    notice(`Cannot start: ${error.message} Serve this folder over HTTP and check the data files, then reload.`, true);
  }
}

start();

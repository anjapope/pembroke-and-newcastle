# Pembroke & Newcastle

A dependency-free, fictional library acquisitions training application. All staff,
institutions, authors and catalog records are demonstration data. There is no real
authentication, supplier integration, payment, email or server-side order processing.
Do not enter real names, credentials or sensitive information.

## Run locally

From the repository root, with Python 3 installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000>. Use a modern browser with JavaScript modules, Fetch,
localStorage and file downloads enabled. Opening `index.html` directly with a
`file://` URL is not supported. No install or build step is needed.

## Implementation packages

| Package | Contents |
| --- | --- |
| PN-001: Foundation | Responsive interface, fictional staff login, institution setup, local session persistence and sign-out |
| PN-002: Acquisitions | Searchable, subject-filtered, paginated catalog; institution collection codes; quantities; order budgets and editable cart |
| PN-003: Technical Services | Save drafts, download/open shared drafts, Doris's validation and correspondence, approved-order processing |
| PN-004: Inventory & QA | 100 fictional catalog records across eight subjects, startup/import validation, QA checklist and static deployment instructions |

```text
index.html
css/styles.css
js/app.js
js/catalog.js
js/cart.js
js/institutions.js
js/validation.js
js/doris.js
data/catalog.json
data/policies.json
README.md
```

`app.js` connects the interface and persistence. The other JavaScript modules handle
catalog loading/filtering, cart totals, institution policy, validation and Doris's
workflow respectively.

## Workflow

1. Sign in with a fictional name. Select an institution, set an order budget and
   click **Apply setup**. Changing institution clears a nonempty cart after confirmation.
2. Search or filter titles. Choose a collection code and quantity, then **Add**.
   Repeated additions merge the same title/collection line. Edit quantities or
   remove lines in the cart.
3. Use **Save draft** to explicitly save; changes also save automatically in this
   browser. Reload to restore the current session, cart, status and correspondence.
   Storage is local to the browser and site origin, not synchronized across devices.
4. **Download to share** exports a versioned JSON draft containing institution,
   budget and lines, but no staff name or correspondence. Send this file yourself.
   Another session can **Open shared draft**. Imports are validated before replacing
   the order and always reset approval and correspondence. Empty and over-budget
   drafts can be saved/shared, but cannot be approved.
5. **Send to Doris for validation** checks the institution, collection codes,
   nonempty cart, quantities, duplicate lines and budget. Read Doris's response,
   fix any issues and resubmit. Any order edit invalidates approval.
6. **Process approved order** performs a fresh validation and records simulated
   completion. Processed orders are locked. Download a copy before **New order**
   replaces the current order; there is no separate order archive.
7. **Sign out** clears the local session and order. Downloads remain on your device.
   If storage is unavailable, the application reports it; download your draft before
   closing the page. Only use one tab at a time (no concurrent editing protection).

Budgets are per order, not an institution-wide running ledger. Prices and totals
use integer GBP pence, without tax/shipping. `policies.json` defines institution
defaults, allowed codes and a 99-copy maximum per title/collection line. Budgets
range from £0.01 to £1,000,000. Catalog records require unique IDs, a title, author,
subject and positive integer `pricePence`. Invalid catalog/policy data blocks startup.
Shared files are limited to 1 MB and cannot supply prices or processing status.
Browser storage and shared files are not trusted as real authorization.

## QA

There was no existing test framework, build system or linter; none is required.
Use the following focused manual regression checklist when changing the app:

- Sign in, apply each institution and confirm its codes and default budget.
  Reload with a cart and verify staff, institution, budget and quantities persist.
- Search by title, author and ID; filter subjects, page forward/back and check an
  empty search result. Confirm 100 titles are available without filters.
- Add the same title/code twice; confirm quantities merge and totals are exact.
  Add the same title under another code; confirm it stays a separate line.
- Reject zero, fractional, negative and more than 99 copies, including additions
  that exceed 99 in an existing line. Remove lines and check recalculated totals.
- Ask Doris to review an empty or over-budget cart: it must remain a draft with
  correction correspondence. Check that an exactly-on-budget order is approved.
- Approve a valid cart, edit it and verify processing becomes unavailable.
  Reapprove/process; verify editing and repeat processing are blocked after reload.
- Download and reopen a draft. Confirm no staff name is exported and imported
  approval is reset. Try malformed JSON, unknown IDs, invalid collection codes,
  duplicate lines, invalid quantities and oversized files; the old cart must survive.
- Cancel replacement prompts; the current order must survive unchanged.
- Test corrupted/blocked localStorage and missing/invalid JSON data; a useful
  error must appear instead of silently losing a draft or starting with bad data.
- Sign out, reload and verify the prior session is gone. Check keyboard navigation,
  form labels, status announcements and horizontal tables on a narrow screen.

## Deploy

Publish this directory unchanged to any static HTTPS host. For GitHub Pages,
configure **Settings → Pages → Deploy from a branch**, select the branch containing
these files and the **/(root)** folder. Relative asset paths support project sites
such as `https://<owner>.github.io/<repository>/`. No backend, secrets, environment
variables, third-party services or build artifacts are needed.

After deployment, verify `data/catalog.json` and `data/policies.json` load, run the
login → add → validate → process flow, and test download/import. A deployment to a
different origin has separate browser storage. This is a training tool, not a
production ordering or multi-user authentication system.
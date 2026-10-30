# Pembroke & Newcastle

Pembroke & Newcastle is a static, fictional training simulation for institutional
acquisitions. The bookseller identity is established in London in 1998. There is
no real authentication, supplier integration, purchase, payment, or server-side
processing. All catalog offerings and bibliographic/provenance metadata are
simulated; no ISBNs or other external identifiers are represented as verified.

## PN-004 classroom release

The complete simulation supports independent browser-local exercises using a
shared **1,500-record** catalog. Instructor timings, learning outcomes,
discussion prompts and troubleshooting are in
[the instructor guide](docs/INSTRUCTOR_GUIDE.md). All transactions are fictional.

## Run locally and deploy

Serve this directory from a static web server and open `index.html`. For example,
from the repository root:

```sh
python -m http.server 8000
```

Open <http://localhost:8000/>. The site has no install, build, backend, database,
package manager, or external service. Relative asset paths support GitHub Pages
project sites. The public classroom URL is
<https://anjapope.github.io/pembroke-and-newcastle/>.

GitHub Pages is configured for **Deploy from a branch: main / (root)** in
`anjapope/pembroke-and-newcastle`. `.nojekyll` publishes the static files without
Jekyll processing. No application build or Actions workflow is required.
Use ordinary commits and fast-forward pushes to `main`; then verify Pages has
finished publishing before assuming the new release is available. Configuration
alone is not deployment verification.

After deployment, check the PN-004 footer, the 1,500-record count, relative CSS/JS
and catalog requests, and a fresh requisition through Technical Services.
Hard-refresh and confirm that history and the budget remain unchanged.

## PN-001 foundation

- Simulated login accepts any nonempty client ID with password `collections`.
- The profile form collects an invented institution, its audience, collecting
  priorities, category, and department where required.
- Annual allocations are configured in `js/institutions.js`:

  | Institution | Annual allocation | Department |
  | --- | ---: | :---: |
  | Public Library | $5,000 | Required |
  | Academic Library | $8,000 | Required |
  | Archive / Special Collections | $4,000 | — |
  | Museum / Cultural Heritage | $10,000 | Required |
  | School Library / Media Center | $3,000 | — |

- Dashboard profile revision, navigation, browser persistence, and logout remain
  available.

## PN-002 catalog and requisitions

The shared vendor catalog has **1,500 simulated records** across fiction,
nonfiction, juvenile materials, reference, serials, audiovisual resources,
licensed digital resources, rare books, manuscripts, archival material,
photographs, oral histories, museum objects, natural history, and exhibition
resources. Record detail views include creator, category, format, date,
publisher/provenance note, description, unit price, availability, and identifier
disclaimer. There are 271 simulated unique offerings, each quantity-limited to
one, including acquisitions that cost more than some institutions' annual budgets.

| Catalog grouping | Records |
| --- | ---: |
| Adult fiction and nonfiction | 450 |
| Juvenile and young adult | 300 |
| Academic and reference | 250 |
| Archival and manuscript collections | 200 |
| Museum and special collections | 150 |
| Digital and audiovisual | 150 |
| **Total** | **1,500** |

`catalogGroup` is a descriptive grouping, separate from the existing material
category/format compatibility policy. Ebook and audio versions may be grouped
with digital offerings rather than their print audience. Search includes the
group name; material-category and format filters retain their established meaning.

`data/catalog.json` is a JSON array with this record schema:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable unique catalog identifier |
| `title` | string | Title or object name |
| `creator` | string | Creator, author, or originating organization |
| `catalogGroup` | string | One of the six inventory groupings above |
| `materialCategory` | string | Descriptive material category; not a collection-code restriction |
| `format` | string | Physical or digital format |
| `creationDate` | string | Publication or creation date, when known |
| `publisherDescription` | string | Simulated publisher, provenance, or supplier note |
| `description` | string | Brief record description |
| `unitPriceCents` | integer | Price in USD cents |
| `availability` | string | Simulated availability |
| `maxQuantity` | integer | Maximum line quantity |
| `unique` | boolean | Whether the offering is a unique simulated item |
| `metadata` | object | Additional descriptive/disclaimer metadata |

Search, category, format, minimum/maximum price, and title/price sorting combine
as filters. Twenty records are displayed per page; the complete catalog is never
inserted into the DOM at once.

### Reproducible inventory generation

The committed JSON loads directly at runtime. Optional development command:

```sh
node scripts/generate-catalog.cjs
```

The generator preserves all original 100 records and their identifiers/prices,
adding only `catalogGroup`. A SHA-256 preservation check refuses a changed seed.
It reads those first 100 records from the existing JSON and deterministically
recreates the other 1,400 offerings using curated subjects, invented places,
creators, publication/creation periods, meaningful title patterns and
format-specific descriptions/price bands. It uses no random numbers, network,
external bibliographic identifiers or real provenance claims.

Generating twice produces identical bytes. All 1,500 titles and IDs are unique.
Generated books are generally $6.99-$38.99, academic resources $35-$225, while
archival and museum offerings range into thousands of dollars. Generator/tests
use built-in Node modules only; Node is not required by students or the website.

### Institution-specific collection lines and funds

Codes are selectable for each worksheet line. Catalog material category does not
restrict the student to matching codes: the student makes the professional
designation.

| Institution | Collection lines | Funds |
| --- | --- | --- |
| Public Library | `AF` Adult Fiction; `ANF` Adult Nonfiction; `JF` Juvenile Fiction; `JNF` Juvenile Nonfiction; `YA` Young Adult; `REF` Reference; `AV` Audiovisual; `LOCAL` Local History; `DIGITAL` Digital Resources | `GENERAL` General Collections; `YOUTH` Youth Services; `ADULT` Adult Services; `LOCAL` Local History; `DIGITAL` Digital Resources |
| Academic Library | `MONO` Monographs; `REF` Reference; `SERIAL` Serials; `ERES` Electronic Resources; `SPEC` Special Collections; `MEDIA` Media | `GENERAL` General Collections; `SUBJECT` Subject Resources; `RESEARCH` Research Support; `SPECIAL` Special Collections; `ELECTRONIC` Electronic Resources |
| Archive / Special Collections | `MSS` Manuscripts; `PHOTO` Photographs; `AV` Audiovisual; `DIG` Digital Collections; `ORAL` Oral Histories; `EPHEM` Ephemera; `RARE` Rare Books | `GENERAL` General Acquisitions; `ACCESSION` Accessioning; `PRESERVATION` Preservation; `DIGITAL` Digital Collections; `SPECIAL` Special Collections |
| Museum / Cultural Heritage | `ART` Art; `HIST` Historical Collections; `NAT` Natural History; `ETHNO` Ethnographic Collections; `DOC` Documentary Collections; `DIG` Digital Collections; `EXHIBIT` Exhibition Resources | `GENERAL` General Acquisitions; `COLLECTIONS` Collections; `EXHIBITION` Exhibition; `EDUCATION` Education; `DIGITAL` Digital Resources |
| School Library / Media Center | `E` Easy Readers / Picture Books; `JF` Juvenile Fiction; `JNF` Juvenile Nonfiction; `YA` Young Adult; `REF` Reference; `MEDIA` Media; `DIGITAL` Digital Resources | `GENERAL` General Collections; `CURRICULUM` Curriculum Support; `LITERACY` Literacy; `MEDIA` Media Resources; `DIGITAL` Digital Resources |

Fund codes are accounting designations only; they do not have independent
balances. Each institution has one annual allocation.

### Requisition and persistence model

The PN-001 `pn-foundation-session` localStorage record remains the only
application storage key. PN-002 safely extends it with `schemaVersion`,
`requisitionSequence`, `activeRequisitionId`, and `workingJustification`.
`cart` is the current worksheet line array; `orders` is requisition history.
Profile and client ID fields remain in the same session.

Worksheet line fields are `catalogId`, `title`, `quantity`, `unitPriceCents`,
`extendedPriceCents`, `collectionCode`, `fundCode`, and `selectorNote`. All
arithmetic and budget checks use integer cents.

Saved requisition records contain:

- A browser-local sequential requisition ID, client ID, and institution/department
  snapshot.
- Creation and last-modified timestamps, line snapshots, integer-cent total,
  optional justification, and annual budget snapshot.
- Status, with `submittedAt` and an immutable `submittedSnapshot` added on
  forwarding.

Supported statuses are `draft`, `saved`, `submitted`, `returned`, and
`processed`. The editable worksheet is a draft until saved. Submitted
requisitions are read-only and cannot be forwarded again. Only Technical
Services assigns `processed`; those records alone count as committed expenditures.

### Annual budget rules

The simulated exercise begins in January, leaving eleven months of potential
acquisitions needs. The dashboard and worksheet distinguish annual allocation,
committed expenditures, available balance, proposed requisition, and projected
remaining funds. Draft, saved, and submitted requisitions do not commit funds.

The preliminary warning uses committed-plus-proposed annual spending. At 80% or
more of the allocation, explicit confirmation is required before forwarding.
For school libraries, archives/special collections, and museums, a nonempty
justification is required when the single proposed requisition is at least 80% of
the annual allocation. Public and academic libraries may provide a justification
optionally.

Submissions exceeding the available annual balance are blocked and show the
exact excess; quantities are never reduced automatically. An amount equal to the
available balance may be forwarded after any required warning confirmation.
Students cannot purchase directly; the application displays the required
authority notice and does not change budgets or create processed orders.

### PN-003 Technical Services and Doris

**Verification status:** PN-003 acceptance verification is complete. The
deterministic rule tests, browser lifecycle regressions, and real
browser refresh/correction workflow passed under `/pembroke-and-newcastle/`.
PN-004 has not been started.

The Technical Services page is an explicit, browser-local review desk. Opening
the page never processes an order. A staff-style **Review by Technical
Services** action validates the latest immutable submitted snapshot, records
the deterministic outcome, and immediately issues a formal processing notice
from Doris. The interface separates requisitions awaiting review, outstanding
corrections, processed orders, correspondence history, requisition details, and
the fictional institutional procedure register.

Doris is Technical Services Clerk II, with 45 years of service, no MLS, and no
supervisory authority. Her operational authority is limited to procedural
compliance and requisition processing. Her correspondence is formal, terse, and
neutral; she does not review the intellectual merits of collecting decisions.
No email, remote notification, AI service, or external processing is involved.

The deterministic validation and correspondence functions live in
`js/technical-services.js` and are exposed for independent browser testing as
`window.PN_TECHNICAL_SERVICES`. Validation uses the submission snapshot, active
catalog, institution-specific code tables, and processed expenditures. It checks
requisition/client/institution identity, required departments, timestamps,
catalog references and prices, quantities and unique-item limits, collection
and fund codes, recomputed integer-cent totals, available annual allocation,
justifications, and current financial acknowledgment.

#### Collection and fund compatibility

An authorized code is not automatically an appropriate designation. The
transparent compatibility rules recognize conventional matches for common
material types (for example adult fiction to `AF`, juvenile fiction to `JF`,
photographs to `PHOTO`, manuscripts to `MSS`, and electronic resources to
digital/electronic lines). Explicit category conflicts, including adult
nonfiction assigned to Juvenile Fiction, are invalid and require correction.
Other authorized but uncommon assignments are classified as reviewable: a
nonempty selector note is required, and Technical Services does not judge its
intellectual quality. This allows defensible choices such as an archival
photograph in a public library's Local History line or a museum object acquired
for an exhibition. A note cannot override a clearly invalid assignment.

Fund codes are checked against the institution's own code table and have no
separate balances. General funds are accepted. An uncommon specialized
assignment requests a short selector explanation; a valid general-fund choice
is not rejected merely because another fund is more specific.

The interface's fictional procedural register is operative and matches the
validator:

| Reference | Scope |
| --- | --- |
| Procedure 14-C, revised March 2009 | Institution-authorized collection lines and explanations for unconventional assignments |
| Procedure 8-B, revised June 2012 | Institution-authorized accounting codes; no independent fund balances |
| Procedure 11-A, revised February 2016 | Positive whole-number quantities, catalog and unique-item limits, one line per catalog item, catalog-price and financial-total integrity |
| Procedure 22-D, revised January 2024 | Integer-cent budget review, 80% acknowledgment, and one-time expenditure justification |
| Procedure 3-F, revised September 2018 | Complete submissions, explicit resubmission, and retained revision records |

#### Revisions, returns, and processing

Requisition status follows `saved` → `submitted` → `returned` → `submitted`
→ `processed`, with first-pass acceptance going directly from `submitted` to
`processed`. Submitted and processed requisitions are read-only. A returned
requisition can be opened from Outstanding Corrections, corrected in the
existing worksheet, saved, and explicitly resubmitted without changing its ID.

Each attempt has a sequential revision number, timestamp, immutable submitted
snapshot, validation outcome, correspondence, and its financial acknowledgment.
Corrected submissions append a new attempt; the previous snapshot and Doris's
notice remain available. Repeated review of an already reviewed requisition
shows its existing result and cannot create duplicate correspondence.
Requisition details include a labeled revision selector for reading every
previously submitted set of line items. Reopening a returned requisition restores
its saved corrections rather than overwriting them with the rejected snapshot.
Saving a correction refreshes the institutional profile snapshot for the new
submission; the profile recorded in earlier attempts remains unchanged.

Processing occurs only after an explicit review of a `submitted` requisition.
Doris revalidates the submitted snapshot against the current catalog and budget.
An accepted requisition receives a processing timestamp and one processing
record. Committed expenditures are derived from unique processed requisition
records, not from an incremented counter. Refreshing or revisiting the page
does not deduct funds again. If browser storage cannot persist the outcome, the
application does not report processing success. This is safe, deterministic
behavior within the existing local session, not a server-side transaction or
security boundary. Invalid processing records block further review rather than
being silently treated as an unspent balance. A profile-category revision cannot
reduce the allocation below already committed spending.

Available funds are the annual allocation less previously processed
requisitions. Submitted, saved, and returned requisitions do not commit funds.
An amount equal to the available balance may be processed; an overage is
returned with the exact shortfall.

The simulated fiscal year begins in January. When cumulative processing would
reach 80% of the annual allocation, the student must explicitly acknowledge the
allocation, previously committed funds, proposed expenditure, projected
remaining balance, committed percentage, and eleven months remaining.
PN-002's persisted acknowledgment is reused when those financial facts have not
changed; a changed budget situation requires a fresh confirmation. Archives,
museums, and school libraries additionally require a nonempty justification
when the individual requisition is at least 80% of its allocation. Public and
academic libraries require the acknowledgment but may provide justification
optionally.

The old `js/doris.js`, `js/validation.js`, and `data/policies.json` prototype
remain inactive. The old policy JSON is GBP-denominated and is not loaded by the
active app; PN-003 continues to use the US-dollar institutional configuration
in `js/institutions.js`.

The `window.PN_APP` methods remain `getSession()`, `updateSession(updates)`,
`refreshDashboard()`, and `navigate(page)`. PN-002 adds
`window.PN_ACQUISITIONS` helpers for budget refresh and catalog filtering/
pagination; requisition state itself continues through `PN_APP`.

## Local sessions and Reset Simulation

The only application storage key is `pn-foundation-session`. Reloading preserves
profile, worksheet, requisitions, correspondence, revisions and processing
history in this browser profile on this device and origin. Client IDs are
fictional labels, not remote accounts: entering the same ID in a different
browser does not retrieve or modify the first browser's state. There is no
central storage, instructor dashboard or cross-device synchronization.

Tabs/windows sharing the same browser profile and origin are not separate
student sessions. Use separate devices/profiles for independent exercises.
Private/incognito sessions are separate from regular storage, may share storage
with other private windows, and normally lose data when that private session
closes. The password `collections` provides no real security.

Dashboard **Reset Simulation** presents an explicit destructive confirmation
listing the profile, worksheet, requisitions, correspondence and budget history.
Cancel changes nothing. Confirm removes only the application key, returns to
login, and restores a full allocation with the next newly established profile.
The catalog, code and unrelated storage keys are untouched. Reset never runs on
refresh. A storage failure is reported rather than silently claiming success.
**Logout also clears this browser's session**; it is not a way to save an exercise
for retrieval by Client ID.

## PN-004 policy and verification

The expanded catalog retains the 14 established material categories and all
33 existing category/format combinations, adding a Picture book format under
Juvenile fiction (34 combinations total). The established E collection rule
already recognizes picture books. No competing compatibility model or financial
policy was introduced. Tests exercise every pair across all five
institution types; a customary or explained defensible designation is available.
Unknown categories now report an explicit catalog-policy configuration problem
instead of silently accepting or indiscriminately rejecting them.

Run all dependency-free Node regressions:

```sh
node --test tests/pn003.test.cjs tests/pn004.test.cjs
```

The **41 original PN-003 tests plus 15 PN-004 tests (56 total)** passed after
expansion. New tests check exact distribution, unique IDs and titles, preservation
of the original records, reproducible output, required metadata, safe prices and
quantities, simulation disclaimers and catalog-policy coverage. The **27 original
browser scenarios** also passed with all 1,500 records loaded; their initial
catalog-readiness guard now requires the expanded inventory's exact record count.

`tests/pn004-browser.cjs` exports an async acceptance helper accepting a Playwright
`Page` and a base URL ending in `/`. Supply it from a development browser runner
with Playwright and an installed browser; those tools are not website dependencies.
For example, from such a runner:

```js
const run = require("./tests/pn004-browser.cjs");
console.log(await run(page, "http://localhost:8000/"));
```

The helper creates and closes two independent private browser contexts. Student
actions use visible UI controls, not injected application state. An unrelated
storage sentinel is used only to test reset isolation. The complete scenario
selects three materials, receives a deliberate rejection, saves corrections,
resubmits under the same ID, processes a second requisition, verifies cumulative
spending, reloads, cancels and confirms reset, and establishes a new profile.
It also tests combined filters, all four sort orders, pagination, details,
keyboard dialog dismissal/focus, same-ID browser independence and responsive
layouts at 1440, 1366, 768 and 375 pixels.

Local Chromium verification processed **$90.96**, left **$4,909.04**, and retained
two requisitions, both revisions and three correspondence notices after reload.
Reset restored $5,000 and empty history without changing the other browser or
unrelated storage. No page-level horizontal overflow or console errors occurred;
wide tables remain keyboard-focusable horizontal scroll regions. Local initial
load was about 80 ms and a combined 1,500-record filter about 2 ms on the
development machine. Automated task timings are not evidence of human completion
speed; the instructor guide proposes a 20-minute exercise, not a usability-study
result. No physical-device, cross-browser or 20-student classroom pilot is claimed.

## Executed PN-003 verification

The application still requires no dependencies or build. Optional development
tests use Node's built-in test runner:

```sh
node --test tests/pn003.test.cjs
```

The **41 rule regressions** cover mandatory fields, all department policies,
collection compatibility, institution-specific funds, invalid/unique/duplicate
quantities, catalog prices and totals, exact and insufficient budgets, cumulative
80% thresholds, stale acknowledgments, all justification policies, and
deterministic correspondence. All passed.

The browser harness is `tests/pn003-browser.js`; it is not loaded by the
application. It creates and replaces only its own QA session and refuses to run
over an active non-QA client. Log out of any real exercise session before
running it. On the served application page, load and run it from DevTools:

```js
const script = document.createElement("script");
script.src = "tests/pn003-browser.js";
await new Promise((resolve, reject) => {
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});
await window.runPN003BrowserTests();
```

All **27 browser regression scenarios** passed, including first-review
acceptance, snapshot-authoritative review, return/correction/resubmission,
saved-edit reopening, immutable revisions, processed-state locks, duplicate
review protection, persisted and renewed financial acknowledgments, exact
balance, overage, one-time justification, legacy PN-002 migration, storage-failure
recovery, invalid stored records, and safe profile-budget revision. Malformed
submissions use explicit fixtures because ordinary PN-002 controls already
prevent several invalid inputs; normal catalog/save/forward/correct actions
also run through the application UI.

Additional real-browser checks verified combined catalog filters and details,
live quantity totals, rejection and correction through ordinary controls, and
full browser reload persistence. Two processed requisitions committed exactly
$59.85; the $4,940.15 remaining balance and all three correspondence notices
remained unchanged after reload, including both revisions of the corrected
requisition. No console errors were observed. A generated 1,500-record fixture
also verified combined filtering and 75-page pagination without rendering the
whole catalog.

JavaScript syntax checks, workspace diagnostics, and `git diff --check` passed.
These results describe a local static-server test at the GitHub Pages-style
subpath, not a test of a newly deployed GitHub Pages release.

## QA checklist

- Sign in, create/revise a profile, navigate among all pages, refresh, and log out.
- At `/pembroke-and-newcastle/`, verify relative CSS, scripts, and catalog data.
- Combine search, category, format, and price filters; verify sorting, detail
  metadata, and pagination.
- Add several items, edit quantities/codes/funds/notes, remove lines, and confirm
  unique acquisitions reject quantities above one.
- Save, edit, and create multiple requisitions; reload and confirm session,
  worksheet, and history persistence.
- Submit a saved requisition and explicitly review it; verify first-pass
  acceptance, processed status, correspondence, and the budget deduction.
- Refresh and repeat review attempts; verify no duplicate correspondence or
  processing and no repeated budget deduction.
- Test missing/unauthorized collection and fund codes, invalid and
  unique-object quantities, catalog-price changes, and inaccurate totals.
- Test valid, reviewable, and invalid collection assignments, including a
  reviewable assignment with and without a selector explanation.
- Test exact-balance processing, overage shortfalls, cumulative 80% warnings,
  changed-budget re-acknowledgment, and one-time justifications.
- Return a requisition, correct and save it, explicitly resubmit under the same
  ID, then verify both submitted snapshots and correspondence remain intact.
- Confirm processed requisitions cannot be edited or resubmitted and that
  multiple processing records produce accurate cumulative commitments.
- Test direct-purchase denial, the cumulative 80% warning, required
  justifications, overspending, exact-balance forwarding, and uncommitted saved
  requisitions.
- Exercise filtering and pagination helpers with at least 1,500 generated records.
- Run all workflows under `/pembroke-and-newcastle/`; verify no active GBP
  currency or ordinary-workflow console errors.

All package files are static HTML, CSS, JavaScript, and JSON. PN-004 may later
expand the inventory; no backend or build process is needed.

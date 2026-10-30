# Pembroke & Newcastle

Pembroke & Newcastle is a static, fictional training simulation for institutional
acquisitions. The bookseller identity is established in London in 1998. There is
no real authentication, supplier integration, purchase, payment, or server-side
processing. All catalog offerings and bibliographic/provenance metadata are
simulated; no ISBNs or other external identifiers are represented as verified.

## Run locally and deploy

Serve this directory from a static web server and open `index.html`. For example,
from the repository root:

```sh
python -m http.server 8000
```

Open <http://localhost:8000/>. The site has no install, build, backend, database,
package manager, or external service. Relative asset paths support GitHub Pages
project sites, including
`https://<owner>.github.io/pembroke-and-newcastle/`.

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

The shared vendor catalog has **100 simulated records** across fiction,
nonfiction, juvenile materials, reference, serials, audiovisual resources,
licensed digital resources, rare books, manuscripts, archival material,
photographs, oral histories, museum objects, natural history, and exhibition
resources. Record detail views include creator, category, format, date,
publisher/provenance note, description, unit price, availability, and identifier
disclaimer. Twelve simulated unique records are quantity-limited to one.

`data/catalog.json` is a JSON array with this record schema:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable unique catalog identifier |
| `title` | string | Title or object name |
| `creator` | string | Creator, author, or originating organization |
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
requisitions are read-only and cannot be forwarded again. PN-002 never assigns
`processed`; only `processed` records count as committed expenditures, ready for
the PN-003 workflow.

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

**Implementation checkpoint:** PN-003 is in progress. First-pass processing and
return/correction/resubmission have been exercised in the browser, but the full
acceptance checklist and final integration verification are not yet complete.
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
| Procedure 11-A, revised February 2016 | Positive whole-number quantities, catalog limits, and unique-item limits |
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

Processing occurs only after an explicit review of a `submitted` requisition.
Doris revalidates the submitted snapshot against the current catalog and budget.
An accepted requisition receives a processing timestamp and one processing
record. Committed expenditures are derived from unique processed requisition
records, not from an incremented counter. Refreshing or revisiting the page
does not deduct funds again. If browser storage cannot persist the outcome, the
application does not report processing success. This is safe, deterministic
behavior within the existing local session, not a server-side transaction or
security boundary.

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

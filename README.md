# Practice CRM

Client and task management for a public accounting practice. Built on the frame
and design system of the PO App (sibling project): same header/tab shell,
toolbar, table with search / sort / column filters, and footer pagination.

## Running it

Static site, no build step. Serve the folder and open it:

```bash
npx http-server -c-1 .
```

## Layout

| Path | What it is |
|---|---|
| `index.html` | Page shell — header nav, toolbar, companies table, company detail view, footer |
| `crm.css` | Design system carried over from the PO App, plus CRM-specific sections at the bottom |
| `js/config.js` | Domain vocabulary — schedule options, the five service areas |
| `js/util.js` | Display, sort-compare, search-highlight, and status-message helpers |
| `js/store.js` | Data layer (localStorage + seed data) |
| `js/app-shell.js` | View switching, header menu, CSV export |
| `js/companies-filters.js` | Toolbar service filter + per-column filter popover |
| `js/companies.js` | Companies table — search, sort, pagination, render |
| `js/company-detail.js` | Full-page company detail with service toggles |
| `js/company-form.js` | Add / edit company modal and the detail-page menu |
| `js/main.js` | Boot |

## Data model

```
Owner   { id, name, email, phone }
Company { id, name, ownerId, location,
          payrollSchedules: string[],
          payrollTax, salesTax,
          services: { payroll, salesTax, bookkeeping, registration, reporting } }
```

One owner is assigned to many companies.

Schedule options:

- **Payroll** (multi-select — a company can run several at once)
  - Monthly — pay date is the end of every month
  - Semi-Monthly — the 15th and the end of every month
  - Bi-Weekly — every other chosen weekday, anchored to a first pay date
- **Payroll Tax** — Monthly (due the 15th of the following month), Semi-Weekly
- **Sales Tax** — Quarterly, Y6, Y12

## The five service areas

Each company opts into any combination. Enabled services become tabs on the
company detail page.

| Service | Tracks |
|---|---|
| Payroll | Payroll processing and tax payment schedules |
| Sales Tax | Sales tax payments and schedules |
| Bookkeeping | Bookkeeping progress |
| Registration | SOI renewal, business license renewal, etc. |
| Reporting | Quarterly payroll and sales tax reporting |

## Storage

`js/store.js` is the only file that knows where data lives. It currently uses
`localStorage` (keys under `practiceCrm.*`) and seeds 15 demo companies and 4
owners on first run. Every function is `async` and returns plain objects, so
moving to a Supabase-backed Express API is a change to that one file.

*Reset demo data* in the header menu wipes local edits and re-seeds.

## Not built yet

- Owners page (owners exist in the data layer and drive the Owner column/filter)
- Section bodies for the five services
- Calendar view (to be carried over from the PO App dashboard)
- Email functionality (to be carried over from the PO App Apps Script relay)

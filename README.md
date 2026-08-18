# Practice CRM

Client and task management for a public accounting practice. Built on the frame
and design system of the PO App (sibling project): same header/tab shell,
toolbar, table with search / sort / column filters, and footer pagination.

## Running it

Static site, no build step. Serve the folder and open it:

```bash
npx http-server -c-1 .
```

## Before committing js/ or crm.css changes

```bash
node scripts/stamp-assets.js
```

GitHub Pages serves assets with `Cache-Control: max-age=600` and no content
hash in the filename, so without this a browser happily runs cached old JS
against new HTML — which produces a half-updated app rather than an obvious
failure. The script rewrites the `?v=` on every local asset reference in
index.html so the URLs change on every deploy.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Page shell — header nav, toolbar, companies table, company detail view, footer |
| `crm.css` | Design system carried over from the PO App, plus CRM-specific sections at the bottom |
| `js/config.js` | Domain vocabulary — schedule options, the five service areas |
| `js/util.js` | Display, sort-compare, search-highlight, and status-message helpers |
| `js/store.js` | Data layer (localStorage) |
| `js/app-shell.js` | View switching, header menu, CSV export |
| `js/companies-filters.js` | Toolbar service filter + per-column filter popover |
| `js/companies.js` | Companies table — search, sort, pagination, render |
| `js/company-detail.js` | Full-page company detail with service toggles |
| `js/company-form.js` | Add / edit company modal and the detail-page menu |
| `js/payroll-schedule.js` | Pay date / tax due date engine — pure date math, no DOM |
| `js/payroll.js` | Payroll section: schedule groups, employees, upcoming tasks |
| `js/calendar.js` | Calendar view of every payroll task across all clients |
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
`localStorage` (keys under `practiceCrm.*`), starting empty on first run.
Every function is `async` and returns plain objects, so moving to a
Supabase-backed Express API is a change to that one file.

*Clear all data* in the header menu permanently wipes every company, owner,
and completed task.

## Payroll

Group-first: one group per schedule. Which schedules a company runs, and
which services it buys, are both set in **Edit company details** — the
company page then shows only what is actually in use.

In that form, Payroll and Sales Tax own the settings nested under them.
Switching a service off disables its settings and blanks its columns and
pills everywhere else, but the stored values are kept, so switching it back
on restores the schedules, deposit status, and employees intact. The bi-weekly pay calendar (weekday + first pay date)
lives on the *group*, not the employee, because a company runs one bi-weekly
cycle that everyone on it shares.

### Date rules

All of this lives in `js/payroll-schedule.js`.

| | Rule |
|---|---|
| Monthly pay | Last day of every month |
| Semi-Monthly pay | The 15th and the last day of every month |
| Bi-Weekly pay | Anchor pay date, then every 14 days |
| Monthly deposit | The 15th of the following month |
| Semi-Weekly deposit | Pay date Sat/Sun/Mon/Tue → that week's upcoming Friday. Pay date Wed/Thu/Fri → the following Wednesday |

**Weekends.** A date that lands on a weekend does not move. The *task* is
pulled back to the Friday before, so work is done ahead of the date rather
than after. This is deliberately stricter than the IRS rule, which pushes a
due date forward to the next business day.

**Federal holidays are not handled.** A task due the Friday after
Thanksgiving still reads as that Friday.

### Tasks

Each pay run produces a Paystub task. Tax deposits are separate: one deposit
covers every payroll falling in its window, so a monthly depositor gets one
task per month and a semi-weekly depositor gets one per Wed/Fri deadline —
not one per pay run.

Only completion is stored (`practiceCrm.completedTasks`). The tasks
themselves are always regenerated from the schedules, so there is no calendar
to backfill.

## Not built yet

- Owners page (owners exist in the data layer and drive the Owner column/filter)
- Sales Tax, Bookkeeping, Registration, and Reporting section bodies
- Federal holiday handling
- Email functionality (to be carried over from the PO App Apps Script relay)

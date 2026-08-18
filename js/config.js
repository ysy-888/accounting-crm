/**
 * App-wide constants and small shared helpers.
 *
 * The data layer is currently local (see js/store.js). When this moves to a
 * Supabase-backed Express API, only store.js changes — everything else calls
 * through it.
 */

const APP_NAME = "Practice CRM";
const STORAGE_PREFIX = "practiceCrm";

/** localStorage key namespaced to this app. */
function scopedStorageKey(base) {
  return `${STORAGE_PREFIX}.${base}`;
}

// ── Domain vocabulary ────────────────────────────────────────────────────────

/**
 * Payroll processing cadence. A company can run more than one at a time —
 * e.g. monthly for salaried staff and bi-weekly for hourly — so this is a
 * multi-select, not a single value.
 *
 *   Monthly      — pay date is the end of every month
 *   Semi-Monthly — pay dates are the 15th and the end of every month
 *   Bi-Weekly    — every other <weekday>, anchored to a chosen first pay date
 */
const PAYROLL_SCHEDULES = ["Monthly", "Semi-Monthly", "Bi-Weekly"];

/**
 * Payroll tax deposit cadence (IRS depositor status).
 *   Monthly      — due the 15th of the following month
 *   Semi-Weekly  — due relative to each pay date (see PAYROLL_TAX_RULES)
 */
const PAYROLL_TAX_SCHEDULES = ["Monthly", "Semi-Weekly"];

/**
 * Sales tax filing cadence.
 *   Pre-Payment — a payment every month
 *   Quarterly   — every calendar quarter
 *   Y6          — every 6 months
 *   Y12         — annual
 *
 * Listed shortest-period first, which is also the cadence order the schedule
 * columns sort by.
 */
const SALES_TAX_SCHEDULES = ["Pre-Payment", "Quarterly", "Y6", "Y12"];

/**
 * Short forms for the narrow places — table cells, calendar chips, header
 * pills. Anything without an entry is already short enough to use as-is.
 */
const SCHEDULE_ABBREVIATIONS = {
  "Pre-Payment": "PP",
};

/** The narrow-space label for a schedule value. */
function getScheduleAbbreviation(value) {
  const s = String(value ?? "").trim();
  return SCHEDULE_ABBREVIATIONS[s] ?? s;
}

/**
 * States the practice files sales tax in, and when each one's payment is due.
 *
 * `dueDay` is the day of the month *after* the period being filed for — CA
 * wants it by the 24th, Minnesota by the 20th. Weekend handling is the same
 * as everywhere else in the app: the task moves back to the Friday before.
 */
const STATES = [
  { code: "CA", name: "California", salesTaxDueDay: 24 },
  { code: "MN", name: "Minnesota", salesTaxDueDay: 20 },
];

const STATE_CODES = STATES.map(s => s.code);

function getStateMeta(code) {
  const s = String(code ?? "").trim().toUpperCase();
  return STATES.find(state => state.code === s) ?? null;
}

function getStateName(code) {
  return getStateMeta(code)?.name ?? "";
}

/**
 * The five service areas a company can be signed up for. `key` is what is
 * stored on the company record; `label` is what the UI shows.
 */
const SERVICES = [
  {
    key: "payroll",
    label: "Payroll",
    hint: "Payroll processing and tax payment schedules.",
  },
  {
    key: "salesTax",
    label: "Sales Tax",
    hint: "Sales tax payments and filing schedules.",
  },
  {
    key: "bookkeeping",
    label: "Bookkeeping",
    hint: "Monthly bookkeeping progress and close status.",
  },
  {
    key: "registration",
    label: "Registration",
    hint: "SOI renewal, business license renewal, and similar filings.",
  },
  {
    key: "reporting",
    label: "Reporting",
    hint: "Quarterly payroll and sales tax reporting.",
  },
];

const SERVICE_KEYS = SERVICES.map(s => s.key);

function getServiceMeta(key) {
  return SERVICES.find(s => s.key === key) ?? null;
}

function getServiceLabel(key) {
  return getServiceMeta(key)?.label ?? key;
}

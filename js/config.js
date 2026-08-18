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

/** Payroll processing cadence. */
const PAYROLL_SCHEDULES = ["Monthly", "Bi-Monthly", "Semi-Weekly"];

/** Payroll tax deposit cadence. */
const PAYROLL_TAX_SCHEDULES = ["Monthly", "Semi-Weekly"];

/** Sales tax filing cadence. Y6 = every 6 months, Y12 = annual. */
const SALES_TAX_SCHEDULES = ["Quarterly", "Y6", "Y12"];

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

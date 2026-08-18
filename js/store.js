/**
 * Data layer.
 *
 * Backed by localStorage for now, with seeded demo data on first run.
 * Every function here is async and returns plain objects, so swapping in a
 * Supabase-backed Express API later is a change to this file only.
 *
 * Shape:
 *   Owner   { id, name, email, phone }
 *   Company { id, name, ownerId, location,
 *             payrollSchedules: string[],        // may hold more than one
 *             payrollTax, salesTax,              // "" when not applicable
 *             services: { payroll, salesTax, bookkeeping, registration, reporting } }
 */

const OWNERS_STORAGE_KEY = scopedStorageKey("owners");
const COMPANIES_STORAGE_KEY = scopedStorageKey("companies");

let allOwners = [];
let allCompanies = [];

// ── Seed data ────────────────────────────────────────────────────────────────

const SEED_OWNERS = [
  { id: "own-1", name: "Grace Nakamura", email: "grace@northlineaccounting.com", phone: "(415) 555-0142" },
  { id: "own-2", name: "Daniel Okafor",  email: "daniel@northlineaccounting.com", phone: "(415) 555-0187" },
  { id: "own-3", name: "Priya Raman",    email: "priya@northlineaccounting.com",  phone: "(510) 555-0119" },
  { id: "own-4", name: "Miles Sorensen", email: "miles@northlineaccounting.com",  phone: "(408) 555-0163" },
];

const SEED_COMPANIES = [
  {
    id: "co-1", name: "Aster Coffee Roasters", ownerId: "own-1", location: "Oakland, CA",
    payrollSchedules: ["Semi-Monthly", "Bi-Weekly"], payrollTax: "Monthly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-2", name: "Brightline Dental Group", ownerId: "own-2", location: "San Jose, CA",
    payrollSchedules: ["Bi-Weekly"], payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-3", name: "Cedar & Vine Interiors", ownerId: "own-1", location: "Berkeley, CA",
    payrollSchedules: ["Monthly"], payrollTax: "Monthly", salesTax: "Y6",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: false },
  },
  {
    id: "co-4", name: "Delta Freight Logistics", ownerId: "own-3", location: "Stockton, CA",
    payrollSchedules: ["Bi-Weekly"], payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-5", name: "Evergreen Landscaping", ownerId: "own-4", location: "Santa Rosa, CA",
    payrollSchedules: ["Semi-Monthly"], payrollTax: "Monthly", salesTax: "Y12",
    services: { payroll: true, salesTax: true, bookkeeping: false, registration: true, reporting: false },
  },
  {
    id: "co-6", name: "Fairmount Property Mgmt", ownerId: "own-2", location: "San Francisco, CA",
    payrollSchedules: ["Monthly"], payrollTax: "Monthly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: false },
  },
  {
    id: "co-7", name: "Golden Gate Auto Body", ownerId: "own-3", location: "Daly City, CA",
    payrollSchedules: ["Semi-Monthly"], payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: true },
  },
  {
    id: "co-8", name: "Harbor Point Consulting", ownerId: "own-1", location: "Sausalito, CA",
    payrollSchedules: ["Monthly"], payrollTax: "Monthly", salesTax: "",
    services: { payroll: false, salesTax: false, bookkeeping: true, registration: true, reporting: false },
  },
  {
    id: "co-9", name: "Ironwood Construction", ownerId: "own-4", location: "Concord, CA",
    payrollSchedules: ["Monthly", "Bi-Weekly"], payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-10", name: "Juniper Bakery", ownerId: "own-2", location: "Alameda, CA",
    payrollSchedules: ["Semi-Monthly"], payrollTax: "Monthly", salesTax: "Y6",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: false },
  },
  {
    id: "co-11", name: "Kestrel Software Studio", ownerId: "own-3", location: "Palo Alto, CA",
    payrollSchedules: ["Semi-Monthly"], payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-12", name: "Lantern Hill Winery", ownerId: "own-4", location: "Napa, CA",
    payrollSchedules: ["Monthly"], payrollTax: "Monthly", salesTax: "Y12",
    services: { payroll: true, salesTax: true, bookkeeping: false, registration: true, reporting: false },
  },
  {
    id: "co-13", name: "Meridian Physical Therapy", ownerId: "own-1", location: "Walnut Creek, CA",
    payrollSchedules: ["Bi-Weekly"], payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-14", name: "Northgate Hardware", ownerId: "own-2", location: "Vallejo, CA",
    payrollSchedules: ["Semi-Monthly"], payrollTax: "Monthly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-15", name: "Orchard Lane Childcare", ownerId: "own-3", location: "Fremont, CA",
    payrollSchedules: ["Monthly"], payrollTax: "Monthly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: false, reporting: false },
  },
];

/**
 * Demo payroll detail: bi-weekly anchors (so those groups can generate dates
 * out of the box) and a few employees per group.
 */
const SEED_PAYROLL_DETAIL = {
  "co-1": {
    "Semi-Monthly": ["Amara Osei", "Ben Kaplan"],
    "Bi-Weekly": { anchorDate: "2026-08-14", employees: ["Chris Duval", "Dana Reyes", "Eli Moore"] },
  },
  "co-2": { "Bi-Weekly": { anchorDate: "2026-08-21", employees: ["Farah Haddad", "Greg Lin"] } },
  "co-3": { "Monthly": ["Hana Sato"] },
  "co-4": { "Bi-Weekly": { anchorDate: "2026-08-07", employees: ["Ivan Petrov", "Jae Kim", "Kira Novak", "Luis Ortega"] } },
  "co-9": {
    "Monthly": ["Mina Chowdhury"],
    "Bi-Weekly": { anchorDate: "2026-08-14", employees: ["Noah Bright", "Omar Sy"] },
  },
  "co-13": { "Bi-Weekly": { anchorDate: "2026-08-28", employees: ["Pia Andersen"] } },
};

/** Expand SEED_PAYROLL_DETAIL into the payrollGroups shape. */
function buildSeedPayrollGroups(company) {
  const detail = SEED_PAYROLL_DETAIL[company.id];
  const enabled = new Set(company.payrollSchedules ?? []);

  return PAYROLL_SCHEDULES.map((schedule, i) => {
    const entry = detail?.[schedule];
    const names = Array.isArray(entry) ? entry : (entry?.employees ?? []);
    const anchorDate = Array.isArray(entry) ? "" : (entry?.anchorDate ?? "");
    return {
      schedule,
      enabled: enabled.has(schedule),
      anchorDate,
      weekday: anchorDate ? parseYmd(anchorDate)?.getDay() ?? null : null,
      employees: names.map((name, j) => ({ id: `emp-seed-${company.id}-${i}-${j}`, name })),
    };
  });
}

const SEED_COMPANIES_FULL = SEED_COMPANIES.map(company => ({
  ...company,
  payrollGroups: buildSeedPayrollGroups(company),
}));

// ── Normalisation ────────────────────────────────────────────────────────────

function normalizeServices(raw) {
  const services = {};
  SERVICE_KEYS.forEach(key => {
    services[key] = raw?.[key] === true;
  });
  return services;
}

/** Renamed when the payroll vocabulary moved to standard payroll terms. */
const LEGACY_PAYROLL_SCHEDULE_NAMES = {
  "Bi-Monthly": "Semi-Monthly",
  "Semi-Weekly": "Bi-Weekly",
};

/**
 * Which schedules a company runs. Accepts the current array form or the
 * original single-string `payroll` field, so older data still loads.
 */
function normalizePayrollSchedules(raw) {
  const source = Array.isArray(raw?.payrollSchedules)
    ? raw.payrollSchedules
    : [raw?.payroll];

  const seen = new Set();
  source.forEach(value => {
    const s = String(value ?? "").trim();
    if (!s) return;
    const canonical = LEGACY_PAYROLL_SCHEDULE_NAMES[s] ?? s;
    if (PAYROLL_SCHEDULES.includes(canonical)) seen.add(canonical);
  });

  // Keep a stable cadence order rather than insertion order.
  return PAYROLL_SCHEDULES.filter(s => seen.has(s));
}

function normalizeEmployee(raw, index) {
  return {
    id: String(raw?.id ?? `emp-${Date.now()}-${index}`),
    name: String(raw?.name ?? "").trim(),
  };
}

/**
 * One group per schedule, always all three, with `enabled` saying which the
 * company actually runs. Keeping disabled groups around means turning a
 * schedule off and back on doesn't lose its employees or its anchor date.
 *
 * The bi-weekly pay calendar (weekday + anchor date) lives on the group
 * because a company runs one bi-weekly cycle that all its employees share —
 * storing it per-employee would let two people drift onto different Fridays.
 */
function normalizePayrollGroups(raw) {
  const enabled = new Set(normalizePayrollSchedules(raw));
  const existing = new Map(
    (Array.isArray(raw?.payrollGroups) ? raw.payrollGroups : [])
      .map(g => [LEGACY_PAYROLL_SCHEDULE_NAMES[g?.schedule] ?? g?.schedule, g])
  );

  return PAYROLL_SCHEDULES.map(schedule => {
    const prior = existing.get(schedule);
    const weekday = Number(prior?.weekday);
    return {
      schedule,
      // payrollSchedules is what the company form edits, so it wins when
      // present; otherwise fall back to the stored group flag.
      enabled: Array.isArray(raw?.payrollSchedules) || raw?.payroll !== undefined
        ? enabled.has(schedule)
        : prior?.enabled === true,
      weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : null,
      anchorDate: String(prior?.anchorDate ?? "").trim(),
      employees: (Array.isArray(prior?.employees) ? prior.employees : []).map(normalizeEmployee),
    };
  });
}

function normalizeCompany(raw) {
  const payrollGroups = normalizePayrollGroups(raw);
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "").trim(),
    ownerId: String(raw?.ownerId ?? ""),
    location: String(raw?.location ?? "").trim(),
    payrollGroups,
    // Derived from the groups so there is one source of truth.
    payrollSchedules: payrollGroups.filter(g => g.enabled).map(g => g.schedule),
    payrollTax: String(raw?.payrollTax ?? "").trim(),
    salesTax: String(raw?.salesTax ?? "").trim(),
    services: normalizeServices(raw?.services),
  };
}

function normalizeOwner(raw) {
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "").trim(),
    email: String(raw?.email ?? "").trim(),
    phone: String(raw?.phone ?? "").trim(),
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private-mode failure — the in-memory copy stays authoritative
    // for this session.
  }
}

function persistCompanies() {
  writeStorage(COMPANIES_STORAGE_KEY, allCompanies);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Load owners and companies, seeding demo data on first run. */
async function loadAppData() {
  const storedOwners = readStorage(OWNERS_STORAGE_KEY);
  const storedCompanies = readStorage(COMPANIES_STORAGE_KEY);

  if (!storedOwners) writeStorage(OWNERS_STORAGE_KEY, SEED_OWNERS);
  if (!storedCompanies) writeStorage(COMPANIES_STORAGE_KEY, SEED_COMPANIES_FULL);

  allOwners = (storedOwners ?? SEED_OWNERS).map(normalizeOwner);
  allCompanies = (storedCompanies ?? SEED_COMPANIES_FULL).map(normalizeCompany);
  loadCompletedTasks();

  return { owners: allOwners, companies: allCompanies };
}

/** Wipe local edits and re-seed. */
async function resetDemoData() {
  writeStorage(OWNERS_STORAGE_KEY, SEED_OWNERS);
  writeStorage(COMPANIES_STORAGE_KEY, SEED_COMPANIES_FULL);
  writeStorage(TASKS_STORAGE_KEY, []);
  return loadAppData();
}

function getAllCompanies() {
  return allCompanies;
}

function getAllOwners() {
  return allOwners;
}

function getCompanyById(id) {
  return allCompanies.find(c => c.id === String(id)) ?? null;
}

function getOwnerById(id) {
  return allOwners.find(o => o.id === String(id)) ?? null;
}

/** Owner display name for a company, or "" when unassigned. */
function getCompanyOwnerName(company) {
  return getOwnerById(company?.ownerId)?.name ?? "";
}

/** Companies assigned to an owner — one owner, many companies. */
function getCompaniesForOwner(ownerId) {
  return allCompanies.filter(c => c.ownerId === String(ownerId));
}

// ── Payroll groups and employees ─────────────────────────────────────────────

function getPayrollGroup(company, schedule) {
  return (company?.payrollGroups ?? []).find(g => g.schedule === schedule) ?? null;
}

/** Groups the company actually runs, in cadence order. */
function getEnabledPayrollGroups(company) {
  return (company?.payrollGroups ?? []).filter(g => g.enabled);
}

/**
 * A bi-weekly group can only produce dates once its anchor is set, so the UI
 * needs to know which enabled groups are still incomplete.
 */
function isPayrollGroupConfigured(group) {
  if (!group?.enabled) return false;
  if (group.schedule !== "Bi-Weekly") return true;
  return Boolean(group.anchorDate);
}

/** Set the bi-weekly cycle: the weekday and the first pay date it runs on. */
async function setPayrollGroupAnchor(companyId, schedule, anchorDate) {
  const company = getCompanyById(companyId);
  const group = getPayrollGroup(company, schedule);
  if (!group) throw new Error(`No ${schedule} group on this company.`);

  const parsed = parseYmd(anchorDate);
  if (!parsed) throw new Error("Pick a valid first pay date.");

  group.anchorDate = anchorDate;
  group.weekday = parsed.getDay();
  persistCompanies();
  return group;
}

async function addEmployee(companyId, schedule, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("Employee name is required.");

  const company = getCompanyById(companyId);
  const group = getPayrollGroup(company, schedule);
  if (!group) throw new Error(`No ${schedule} group on this company.`);

  const employee = { id: `emp-${Date.now()}-${group.employees.length}`, name: trimmed };
  group.employees.push(employee);
  persistCompanies();
  return employee;
}

async function removeEmployee(companyId, schedule, employeeId) {
  const company = getCompanyById(companyId);
  const group = getPayrollGroup(company, schedule);
  if (!group) throw new Error(`No ${schedule} group on this company.`);

  const index = group.employees.findIndex(e => e.id === employeeId);
  if (index === -1) return null;
  const [removed] = group.employees.splice(index, 1);
  persistCompanies();
  return removed;
}

/** Move an employee to a different schedule, enabling that group if needed. */
async function moveEmployee(companyId, fromSchedule, toSchedule, employeeId) {
  if (fromSchedule === toSchedule) return null;
  const company = getCompanyById(companyId);
  const from = getPayrollGroup(company, fromSchedule);
  const to = getPayrollGroup(company, toSchedule);
  if (!from || !to) throw new Error("Unknown payroll schedule.");

  const index = from.employees.findIndex(e => e.id === employeeId);
  if (index === -1) throw new Error("Employee not found.");
  const [employee] = from.employees.splice(index, 1);
  to.employees.push(employee);
  if (!to.enabled) {
    to.enabled = true;
    company.payrollSchedules = company.payrollGroups.filter(g => g.enabled).map(g => g.schedule);
  }
  persistCompanies();
  return employee;
}

// ── Task completion ──────────────────────────────────────────────────────────

const TASKS_STORAGE_KEY = scopedStorageKey("completedTasks");

/**
 * Only completion is stored — the tasks themselves are always regenerated from
 * the schedules, so there is no calendar to backfill or migrate.
 */
let completedTaskIds = new Set();

function loadCompletedTasks() {
  completedTaskIds = new Set(readStorage(TASKS_STORAGE_KEY) ?? []);
}

function persistCompletedTasks() {
  writeStorage(TASKS_STORAGE_KEY, [...completedTaskIds]);
}

function isTaskComplete(taskId) {
  return completedTaskIds.has(taskId);
}

async function setTaskComplete(taskId, complete) {
  if (complete) completedTaskIds.add(taskId);
  else completedTaskIds.delete(taskId);
  persistCompletedTasks();
  return complete;
}

/** Sequential id that won't collide with anything already stored. */
function nextCompanyId() {
  const used = new Set(allCompanies.map(c => c.id));
  let n = allCompanies.length + 1;
  while (used.has(`co-${n}`)) n += 1;
  return `co-${n}`;
}

/**
 * Create a company. Name is the only required field; everything else falls
 * back to an empty value so a record can be started from very little.
 */
async function createCompany(fields) {
  const name = String(fields?.name ?? "").trim();
  if (!name) throw new Error("Company name is required.");

  const company = normalizeCompany({ ...fields, id: nextCompanyId(), name });
  allCompanies.push(company);
  persistCompanies();
  return company;
}

async function deleteCompany(id) {
  const index = allCompanies.findIndex(c => c.id === String(id));
  if (index === -1) throw new Error(`Company ${id} not found.`);
  const [removed] = allCompanies.splice(index, 1);
  persistCompanies();
  return removed;
}

/** Merge `patch` into a company and persist. Returns the updated record. */
async function updateCompany(id, patch) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Company ${id} not found.`);
  Object.assign(company, normalizeCompany({ ...company, ...patch }));
  persistCompanies();
  return company;
}

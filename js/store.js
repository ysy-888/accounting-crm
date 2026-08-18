/**
 * Data layer.
 *
 * Backed by localStorage for now. Every function here is async and returns
 * plain objects, so swapping in a Supabase-backed Express API later is a
 * change to this file only.
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

/**
 * State moved out of the free-text location into its own field, because the
 * sales tax due date depends on it. Older records (and the seed data) carry
 * it as a "City, ST" suffix, so it is lifted out of the location when there
 * is no explicit state — leaving the location holding just the city.
 */
function splitLocationAndState(raw) {
  const location = String(raw?.location ?? "").trim();
  const explicit = String(raw?.state ?? "").trim().toUpperCase();
  if (explicit) {
    return { location, state: STATE_CODES.includes(explicit) ? explicit : "" };
  }

  const match = /^(.*?),\s*([A-Za-z]{2})$/.exec(location);
  const suffix = match?.[2]?.toUpperCase() ?? "";
  if (!match || !STATE_CODES.includes(suffix)) return { location, state: "" };
  return { location: match[1].trim(), state: suffix };
}

function normalizeCompany(raw) {
  const payrollGroups = normalizePayrollGroups(raw);
  const { location, state } = splitLocationAndState(raw);
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "").trim(),
    ownerId: String(raw?.ownerId ?? ""),
    location,
    state,
    payrollGroups,
    // Derived from the groups so there is one source of truth.
    payrollSchedules: payrollGroups.filter(g => g.enabled).map(g => g.schedule),
    payrollTax: String(raw?.payrollTax ?? "").trim(),
    salesTax: String(raw?.salesTax ?? "").trim(),
    services: normalizeServices(raw?.services),
    // Free-form memo, shown and edited on the detail page.
    notes: String(raw?.notes ?? ""),
  };
}

/** "Oakland, CA" — the two fields recombined for display. */
function getCompanyLocationDisplay(company) {
  return [company?.location, company?.state].filter(Boolean).join(", ");
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

function persistOwners() {
  writeStorage(OWNERS_STORAGE_KEY, allOwners);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Load owners and companies, seeding demo data on first run. */
async function loadAppData() {
  const storedOwners = readStorage(OWNERS_STORAGE_KEY);
  const storedCompanies = readStorage(COMPANIES_STORAGE_KEY);

  allOwners = (storedOwners ?? []).map(normalizeOwner);
  allCompanies = (storedCompanies ?? []).map(normalizeCompany);
  loadCompletedTasks();

  return { owners: allOwners, companies: allCompanies };
}

/** Wipe every company, owner, and completed task. Cannot be undone. */
async function clearAllData() {
  writeStorage(OWNERS_STORAGE_KEY, []);
  writeStorage(COMPANIES_STORAGE_KEY, []);
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

/** Case-insensitive lookup by name — what the owner combobox matches on. */
function findOwnerByName(name) {
  const needle = String(name ?? "").trim().toLowerCase();
  if (!needle) return null;
  return allOwners.find(o => o.name.toLowerCase() === needle) ?? null;
}

/** Sequential id that won't collide with anything already stored. */
function nextOwnerId() {
  const used = new Set(allOwners.map(o => o.id));
  let n = allOwners.length + 1;
  while (used.has(`own-${n}`)) n += 1;
  return `own-${n}`;
}

/**
 * Create an owner from a name alone — the company form makes one on the fly
 * when a name is typed that is not on file yet. Contact details are filled in
 * later. An existing owner with the same name is returned instead of a
 * duplicate.
 */
async function createOwner(fields) {
  const name = String(fields?.name ?? "").trim();
  if (!name) throw new Error("Owner name is required.");

  const existing = findOwnerByName(name);
  if (existing) return existing;

  const owner = normalizeOwner({ ...fields, id: nextOwnerId(), name });
  allOwners.push(owner);
  persistOwners();
  return owner;
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

/**
 * A tax deposit's paystub is expected to already be checked off; reopening
 * the paystub afterwards would leave a filed deposit resting on payroll that
 * (as far as this app knows) never ran, so the deposit reopens with it.
 */
function uncompleteDependentTaxTask(paystubTaskId) {
  const parsed = parseTaskId(paystubTaskId);
  if (!parsed || parsed.kind !== TASK_KIND_PAYSTUB) return;

  const company = getCompanyById(parsed.companyId);
  const depositor = String(company?.payrollTax ?? "").trim();
  const payDate = parseYmd(parsed.date);
  if (!company || !depositor || !payDate) return;

  const taxDate = taxDueDateForPayDate(payDate, depositor);
  if (!taxDate) return;
  completedTaskIds.delete(buildTaxTaskId(company.id, ymd(taxDate)));
}

async function setTaskComplete(taskId, complete) {
  if (complete && !canCompleteTask(taskId)) {
    throw new Error("Complete the paystub for this run before marking the tax payment done.");
  }

  if (complete) {
    completedTaskIds.add(taskId);
  } else {
    completedTaskIds.delete(taskId);
    uncompleteDependentTaxTask(taskId);
  }
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

/**
 * Notes autosave as they are typed, so this writes the one field rather than
 * re-normalising the whole record on every keystroke.
 */
async function setCompanyNotes(id, notes) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Company ${id} not found.`);
  company.notes = String(notes ?? "");
  persistCompanies();
  return company;
}

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
 *             payroll, payrollTax, salesTax,     // "" when not applicable
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
    payroll: "Bi-Monthly", payrollTax: "Monthly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-2", name: "Brightline Dental Group", ownerId: "own-2", location: "San Jose, CA",
    payroll: "Semi-Weekly", payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-3", name: "Cedar & Vine Interiors", ownerId: "own-1", location: "Berkeley, CA",
    payroll: "Monthly", payrollTax: "Monthly", salesTax: "Y6",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: false },
  },
  {
    id: "co-4", name: "Delta Freight Logistics", ownerId: "own-3", location: "Stockton, CA",
    payroll: "Semi-Weekly", payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-5", name: "Evergreen Landscaping", ownerId: "own-4", location: "Santa Rosa, CA",
    payroll: "Bi-Monthly", payrollTax: "Monthly", salesTax: "Y12",
    services: { payroll: true, salesTax: true, bookkeeping: false, registration: true, reporting: false },
  },
  {
    id: "co-6", name: "Fairmount Property Mgmt", ownerId: "own-2", location: "San Francisco, CA",
    payroll: "Monthly", payrollTax: "Monthly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: false },
  },
  {
    id: "co-7", name: "Golden Gate Auto Body", ownerId: "own-3", location: "Daly City, CA",
    payroll: "Bi-Monthly", payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: true },
  },
  {
    id: "co-8", name: "Harbor Point Consulting", ownerId: "own-1", location: "Sausalito, CA",
    payroll: "Monthly", payrollTax: "Monthly", salesTax: "",
    services: { payroll: false, salesTax: false, bookkeeping: true, registration: true, reporting: false },
  },
  {
    id: "co-9", name: "Ironwood Construction", ownerId: "own-4", location: "Concord, CA",
    payroll: "Semi-Weekly", payrollTax: "Semi-Weekly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-10", name: "Juniper Bakery", ownerId: "own-2", location: "Alameda, CA",
    payroll: "Bi-Monthly", payrollTax: "Monthly", salesTax: "Y6",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: false, reporting: false },
  },
  {
    id: "co-11", name: "Kestrel Software Studio", ownerId: "own-3", location: "Palo Alto, CA",
    payroll: "Bi-Monthly", payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-12", name: "Lantern Hill Winery", ownerId: "own-4", location: "Napa, CA",
    payroll: "Monthly", payrollTax: "Monthly", salesTax: "Y12",
    services: { payroll: true, salesTax: true, bookkeeping: false, registration: true, reporting: false },
  },
  {
    id: "co-13", name: "Meridian Physical Therapy", ownerId: "own-1", location: "Walnut Creek, CA",
    payroll: "Semi-Weekly", payrollTax: "Semi-Weekly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-14", name: "Northgate Hardware", ownerId: "own-2", location: "Vallejo, CA",
    payroll: "Bi-Monthly", payrollTax: "Monthly", salesTax: "Quarterly",
    services: { payroll: true, salesTax: true, bookkeeping: true, registration: true, reporting: true },
  },
  {
    id: "co-15", name: "Orchard Lane Childcare", ownerId: "own-3", location: "Fremont, CA",
    payroll: "Monthly", payrollTax: "Monthly", salesTax: "",
    services: { payroll: true, salesTax: false, bookkeeping: true, registration: false, reporting: false },
  },
];

// ── Normalisation ────────────────────────────────────────────────────────────

function normalizeServices(raw) {
  const services = {};
  SERVICE_KEYS.forEach(key => {
    services[key] = raw?.[key] === true;
  });
  return services;
}

function normalizeCompany(raw) {
  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "").trim(),
    ownerId: String(raw?.ownerId ?? ""),
    location: String(raw?.location ?? "").trim(),
    payroll: String(raw?.payroll ?? "").trim(),
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
  if (!storedCompanies) writeStorage(COMPANIES_STORAGE_KEY, SEED_COMPANIES);

  allOwners = (storedOwners ?? SEED_OWNERS).map(normalizeOwner);
  allCompanies = (storedCompanies ?? SEED_COMPANIES).map(normalizeCompany);

  return { owners: allOwners, companies: allCompanies };
}

/** Wipe local edits and re-seed. */
async function resetDemoData() {
  writeStorage(OWNERS_STORAGE_KEY, SEED_OWNERS);
  writeStorage(COMPANIES_STORAGE_KEY, SEED_COMPANIES);
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

/** Merge `patch` into a company and persist. Returns the updated record. */
async function updateCompany(id, patch) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Company ${id} not found.`);
  Object.assign(company, normalizeCompany({ ...company, ...patch }));
  persistCompanies();
  return company;
}

/** Turn one service on or off for a company. */
async function setCompanyService(id, serviceKey, enabled) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Company ${id} not found.`);
  if (!SERVICE_KEYS.includes(serviceKey)) throw new Error(`Unknown service '${serviceKey}'.`);
  company.services[serviceKey] = enabled === true;
  persistCompanies();
  return company;
}

/**
 * Payroll section on the company detail page.
 *
 * Group-first: one card per schedule (Monthly / Semi-Monthly / Bi-Weekly).
 * Enable the ones the company runs, add employees under each, and the pay
 * calendar config — the bi-weekly anchor — lives on the group, because a
 * company runs one bi-weekly cycle that everyone on it shares.
 *
 * The run calendar itself — mini month view plus the upcoming list, each pay
 * date shown as a run with its Paystub and Tax Payment sub-tasks — lives in
 * the sidebar panel next to the section tabs, not in this panel; see the
 * "Schedule sidebar" section below.
 */

/** How far ahead the upcoming list looks. */
const PAYROLL_UPCOMING_DAYS = 60;

/**
 * Re-render whatever is currently showing this company's payroll state —
 * the section panel (if Payroll is the active tab), the sidebar schedule
 * panel, and the Home calendar/rail if that's the active view. Called after
 * any edit that changes the run calendar: employee changes, an anchor date,
 * or a task being checked off.
 */
function refreshPayrollViews(company) {
  if (!company) return;
  if (getCurrentAppView() === "company" && currentCompanyId === company.id) {
    // Goes through renderCompanySectionPanel rather than calling the section
    // renderer directly, so the inactive banner is re-applied with it.
    if (currentSectionKey === "payroll") renderCompanySectionPanel(company);
    renderCompanySchedulePanel(company);
  }
  if (typeof refreshCalendarIfActive === "function") refreshCalendarIfActive();
}

// ── Group card ───────────────────────────────────────────────────────────────

/**
 * Only enabled groups get a card. Which schedules a company runs is set in
 * Edit company details, so there is no toggle here.
 */
function createPayrollGroupCard(company, group) {
  const card = document.createElement("section");
  card.className = "payroll-group is-on";
  card.dataset.schedule = group.schedule;

  const head = document.createElement("div");
  head.className = "payroll-group-head";

  const name = document.createElement("div");
  name.className = "payroll-group-name";
  name.textContent = group.schedule;
  head.appendChild(name);
  card.appendChild(head);

  if (group.schedule === "Bi-Weekly") card.appendChild(createBiWeeklyAnchorRow(company, group));
  card.appendChild(createEmployeeList(company, group));
  return card;
}

/** Bi-weekly needs a first pay date; the weekday follows from it. */
function createBiWeeklyAnchorRow(company, group) {
  const row = document.createElement("div");
  row.className = "payroll-anchor-row" + (group.anchorDate ? "" : " is-unset");

  const label = document.createElement("label");
  label.className = "payroll-anchor-label";
  label.textContent = "First pay date";

  const input = document.createElement("input");
  input.type = "date";
  input.className = "form-input payroll-anchor-input";
  input.value = group.anchorDate || "";

  const hint = document.createElement("span");
  hint.className = "payroll-anchor-hint";
  const setHint = () => {
    const parsed = parseYmd(input.value);
    hint.textContent = parsed
      ? `Every other ${WEEKDAY_NAMES[parsed.getDay()]} from here.`
      : "Pick the first pay date — every other week counts from it.";
  };
  setHint();

  input.addEventListener("change", async () => {
    if (!input.value) return;
    try {
      await setPayrollGroupAnchor(company.id, group.schedule, input.value);
      refreshPayrollViews(getCompanyById(company.id));
      showIndicator("Bi-weekly cycle set", "success");
    } catch (err) {
      showIndicator(err.message || "Could not set the pay date.", "error");
    }
  });
  input.addEventListener("input", setHint);

  label.appendChild(input);
  row.append(label, hint);
  return row;
}

// ── Employees ────────────────────────────────────────────────────────────────

function createEmployeeList(company, group) {
  const wrap = document.createElement("div");
  wrap.className = "payroll-employees";

  const head = document.createElement("div");
  head.className = "payroll-employees-head";
  const title = document.createElement("span");
  title.className = "payroll-employees-title";
  title.textContent = `Employees (${group.employees.length})`;
  head.appendChild(title);
  wrap.appendChild(head);

  if (group.employees.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    empty.textContent = "No employees on this schedule yet.";
    wrap.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "payroll-employee-list";
    group.employees.forEach(employee => {
      list.appendChild(createEmployeeRow(company, group, employee));
    });
    wrap.appendChild(list);
  }

  wrap.appendChild(createAddEmployeeRow(company, group));
  return wrap;
}

function createEmployeeRow(company, group, employee) {
  const item = document.createElement("li");
  item.className = "payroll-employee";

  const name = document.createElement("span");
  name.className = "payroll-employee-name";
  name.textContent = employee.name;

  const actions = document.createElement("div");
  actions.className = "payroll-employee-actions";

  // Moving between schedules is common enough (someone goes salaried) to be
  // inline. Only schedules the company actually runs are offered — adding a
  // schedule happens in Edit company details.
  const targets = getEnabledPayrollGroups(company).map(g => g.schedule);
  const move = targets.length > 1 ? document.createElement("select") : null;
  if (move) {
    move.className = "payroll-employee-move";
    move.setAttribute("aria-label", `Move ${employee.name} to another schedule`);
    targets.forEach(schedule => {
      const option = document.createElement("option");
      option.value = schedule;
      option.textContent = schedule;
      option.selected = schedule === group.schedule;
      move.appendChild(option);
    });
    move.addEventListener("change", async () => {
      try {
        await moveEmployee(company.id, group.schedule, move.value, employee.id);
        refreshPayrollViews(getCompanyById(company.id));
        renderCompaniesTable();
        showIndicator(`${employee.name} moved to ${move.value}`, "success");
      } catch (err) {
        showIndicator(err.message || "Could not move employee.", "error");
      }
    });
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "payroll-employee-remove";
  remove.title = `Remove ${employee.name}`;
  remove.setAttribute("aria-label", `Remove ${employee.name}`);
  remove.textContent = "✕";
  remove.addEventListener("click", async () => {
    if (!confirm(`Remove ${employee.name} from ${group.schedule} payroll?`)) return;
    try {
      await removeEmployee(company.id, group.schedule, employee.id);
      refreshPayrollViews(getCompanyById(company.id));
      showIndicator(`${employee.name} removed`, "success");
    } catch (err) {
      showIndicator(err.message || "Could not remove employee.", "error");
    }
  });

  if (move) actions.appendChild(move);
  actions.appendChild(remove);
  item.append(name, actions);
  return item;
}

function createAddEmployeeRow(company, group) {
  const row = document.createElement("div");
  row.className = "payroll-add-employee";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-input";
  input.placeholder = "Add employee…";
  input.autocomplete = "off";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary";
  btn.textContent = "Add";

  const submit = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await addEmployee(company.id, group.schedule, name);
      input.value = "";
      refreshPayrollViews(getCompanyById(company.id));
      showIndicator(`${name} added`, "success");
      // Put focus back so several people can be added in a row.
      document.querySelector(`.payroll-group[data-schedule="${CSS.escape(group.schedule)}"] .payroll-add-employee input`)?.focus();
    } catch (err) {
      showIndicator(err.message || "Could not add employee.", "error");
    }
  };

  btn.addEventListener("click", submit);
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submit();
  });

  row.append(input, btn);
  return row;
}

// ── Task checkbox ────────────────────────────────────────────────────────────

/**
 * A tax task's checkbox is disabled until every paystub it covers is done —
 * enforced for real in setTaskComplete; the disabled state here just keeps
 * the user from clicking into a rejection.
 *
 * `data-task-id` is what the mini calendar's "jump to this task" click
 * searches for, so every row carries it regardless of which list it's in.
 */
function createTaskCheckbox(task, onChange, { nameOverride } = {}) {
  const unlocked = isTaxTaskUnlocked(task);
  const label = document.createElement("label");
  label.className = "payroll-task" + (isTaskComplete(task.id) ? " is-done" : "") + (unlocked ? "" : " is-locked");
  label.dataset.kind = task.kind;
  label.dataset.taskId = task.id;
  if (!unlocked) label.title = "Complete the paystub for this run first.";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = isTaskComplete(task.id);
  cb.disabled = !unlocked;

  const box = document.createElement("span");
  box.className = "payroll-task-box";
  box.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "payroll-task-text";

  const name = document.createElement("span");
  name.className = "payroll-task-name";
  name.textContent = nameOverride ?? task.label;

  const due = document.createElement("span");
  due.className = "payroll-task-due";
  due.textContent = formatTaskDate(task.dueDate);
  if (task.movedForWeekend) {
    due.classList.add("is-moved");
    due.title = `Falls on ${formatTaskDate(task.date)}, a weekend — due the Friday before.`;
  }

  text.append(name, due);

  cb.addEventListener("change", async () => {
    const next = cb.checked;
    try {
      await setTaskComplete(task.id, next);
    } catch (err) {
      cb.checked = !next;
      showIndicator(err.message || "Could not update task.", "error");
      return;
    }
    label.classList.toggle("is-done", next);
    onChange?.();
  });

  label.append(cb, box, text);
  return label;
}

// ── Section entry point ──────────────────────────────────────────────────────

/** Called by company-detail.js when the Payroll tab is active. */
function renderPayrollSection(company) {
  const panel = document.getElementById("companySectionPanel");
  if (!panel || !company) return;

  const wrap = document.createElement("div");
  wrap.className = "payroll-section";

  // Without a depositor there is no rule to derive deposit dates from, so no
  // tax tasks get generated — worth saying, since it is silent otherwise.
  if (!String(company.payrollTax ?? "").trim()) {
    const banner = document.createElement("div");
    banner.className = "payroll-depositor is-warning";
    banner.textContent = "No payroll tax schedule set — pick Monthly or Semi-Weekly in Edit company details, or no tax payment tasks will be generated.";
    wrap.appendChild(banner);
  }

  const enabled = getEnabledPayrollGroups(company);

  const groupsTitle = document.createElement("div");
  groupsTitle.className = "company-section-title";
  groupsTitle.textContent = "Pay schedules";
  wrap.appendChild(groupsTitle);

  if (enabled.length === 0) {
    const empty = document.createElement("div");
    empty.className = "payroll-employees-empty";
    empty.textContent = "No pay schedules yet — add one in Edit company details.";
    wrap.appendChild(empty);
  } else {
    const groups = document.createElement("div");
    groups.className = "payroll-groups";
    enabled.forEach(group => groups.appendChild(createPayrollGroupCard(company, group)));
    wrap.appendChild(groups);
  }

  panel.replaceChildren(wrap);
}

// ── Schedule sidebar — mini calendar + upcoming runs ─────────────────────────
//
// Lives beside the section tabs regardless of which tab is active, since the
// run calendar belongs to the company as a whole rather than to the Payroll
// tab specifically. Each run pairs its paystub with the (possibly shared)
// tax task covering it, so the two sub-tasks are always shown together.

let miniCalCursor = null;
let miniCalSelectedYmd = "";

/** Called by company-detail.js each time a (possibly different) company opens. */
function resetCompanyMiniCal() {
  const now = new Date();
  miniCalCursor = { year: now.getFullYear(), month: now.getMonth() };
  miniCalSelectedYmd = "";
}

function getMiniCalCursor() {
  if (!miniCalCursor) resetCompanyMiniCal();
  return miniCalCursor;
}

function stepMiniCal(delta, company) {
  const { year, month } = getMiniCalCursor();
  const next = new Date(year, month + delta, 1);
  miniCalCursor = { year: next.getFullYear(), month: next.getMonth() };
  renderCompanyMiniCalendar(company);
}

/**
 * Clicking a day doesn't expand anything in the mini calendar itself — it
 * jumps the Upcoming list (below) to that day's task(s) and flashes them,
 * so there's one place tasks actually live rather than two.
 */
function selectMiniCalDay(company, dayYmd, tasksForDay) {
  const wasSelected = miniCalSelectedYmd === dayYmd;
  miniCalSelectedYmd = wasSelected ? "" : dayYmd;
  renderCompanyMiniCalendar(company);
  if (!wasSelected) scrollToUpcomingTasks(tasksForDay ?? []);
}

/** Scroll the Upcoming list to the row(s) for these tasks and flash them. */
function scrollToUpcomingTasks(tasks) {
  const list = document.getElementById("companyUpcomingList");
  if (!list || tasks.length === 0) return;

  const rows = tasks
    .map(task => list.querySelector(`[data-task-id="${task.id}"]`))
    .filter(Boolean);

  if (rows.length === 0) {
    showIndicator("That date is outside the next 60 days.", "");
    return;
  }

  rows[0].scrollIntoView({ block: "center", behavior: "smooth" });
  rows.forEach(row => {
    row.classList.add("is-highlighted");
    setTimeout(() => row.classList.remove("is-highlighted"), 1600);
  });
}

function miniCalEmptyNode(text) {
  const empty = document.createElement("div");
  empty.className = "dash-empty";
  empty.textContent = text;
  return empty;
}

/** Every task this company owes in a window — payroll runs and sales tax alike. */
function buildCompanyTasks(company, fromYmd, toYmd) {
  const payroll = buildPayrollTasks(company, fromYmd, toYmd);
  const salesTax = typeof buildSalesTaxTasks === "function"
    ? buildSalesTaxTasks(company, fromYmd, toYmd)
    : [];
  return [...payroll, ...salesTax].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate) || a.kind.localeCompare(b.kind));
}

/** ymd → task[] for the month either side of the cursor, so cross-month tax lag still shows. */
function buildMiniCalEventsByDate(company) {
  const { year, month } = getMiniCalCursor();
  const start = ymd(new Date(year, month - 1, 1));
  const end = ymd(new Date(year, month + 2, 0));
  const byDate = new Map();
  buildCompanyTasks(company, start, end).forEach(task => {
    if (!byDate.has(task.dueDate)) byDate.set(task.dueDate, []);
    byDate.get(task.dueDate).push(task);
  });
  return byDate;
}

function renderCompanyMiniCalendar(company) {
  const body = document.getElementById("companyMiniCalBody");
  const titleEl = document.getElementById("companyMiniCalTitle");
  if (!body) return;

  const { year, month } = getMiniCalCursor();
  if (titleEl) {
    titleEl.textContent = new Date(year, month, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
  }

  if (!company.services?.payroll) {
    body.replaceChildren(miniCalEmptyNode("Enable Payroll to see scheduled runs."));
    return;
  }

  const byDate = buildMiniCalEventsByDate(company);
  const today = todayYmd();

  const grid = document.createElement("div");
  grid.className = "mini-cal-grid";

  WEEKDAY_SHORT.forEach(day => {
    const head = document.createElement("div");
    head.className = "mini-cal-head-cell";
    head.textContent = day[0];
    grid.appendChild(head);
  });

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < first.getDay(); i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellYmd = ymd(new Date(year, month, day));
    const events = byDate.get(cellYmd) ?? [];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mini-cal-cell";
    if (cellYmd === today) cell.classList.add("is-today");
    if (cellYmd === miniCalSelectedYmd) cell.classList.add("is-selected");

    const num = document.createElement("span");
    num.className = "mini-cal-date";
    num.textContent = String(day);
    cell.appendChild(num);

    if (events.length > 0) {
      cell.classList.add("has-events");
      const dots = document.createElement("span");
      dots.className = "mini-cal-dots";
      [...new Set(events.map(e => e.kind))].forEach(kind => {
        const dot = document.createElement("span");
        dot.className = `mini-cal-dot mini-cal-dot--${kind}`;
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
      cell.title = events.map(e => e.label).join(", ");
      cell.addEventListener("click", () => selectMiniCalDay(company, cellYmd, events));
    } else {
      cell.disabled = true;
    }

    grid.appendChild(cell);
  }

  body.replaceChildren(grid);
}

/**
 * The company name line the Home rail puts on every card — the detail page
 * already knows whose runs these are, so it leaves it off.
 */
function appendCardCompanyName(card, company) {
  const name = document.createElement("button");
  name.type = "button";
  name.className = "payroll-run-company";
  name.textContent = company.name;
  name.addEventListener("click", () => openCompanyDetail(company.id));
  card.appendChild(name);
}

/** Default refresh: whatever view the card is sitting in. */
function defaultCardRefresh(companyId) {
  return () => {
    refreshPayrollViews(getCompanyById(companyId));
    if (typeof renderUpcomingTasks === "function") renderUpcomingTasks();
  };
}

/** One card per pay run: the paystub sub-task, and the tax sub-task if a depositor is set. */
function createPayrollRunCard(company, run, { showCompany = false, onChange } = {}) {
  const complete = isPayrollRunComplete(run);
  const card = document.createElement("div");
  card.className = "payroll-run" + (complete ? " is-complete" : "");

  if (showCompany) appendCardCompanyName(card, company);

  const head = document.createElement("div");
  head.className = "payroll-run-head";

  const date = document.createElement("span");
  date.className = "payroll-run-date";
  date.textContent = formatTaskDate(run.paystub.dueDate);

  const pill = document.createElement("span");
  pill.className = "schedule-pill";
  pill.dataset.schedule = run.schedule;
  pill.dataset.group = "payroll";
  pill.textContent = run.schedule;

  const count = document.createElement("span");
  count.className = "payroll-run-count";
  count.textContent = `${run.paystub.employeeCount} employee${run.paystub.employeeCount === 1 ? "" : "s"}`;

  head.append(date, pill, count);

  if (complete) {
    const badge = document.createElement("span");
    badge.className = "payroll-run-complete-badge";
    badge.textContent = "Done";
    head.appendChild(badge);
  }
  card.appendChild(head);

  const onToggle = onChange ?? defaultCardRefresh(company.id);
  const tasksWrap = document.createElement("div");
  tasksWrap.className = "payroll-run-tasks";
  tasksWrap.appendChild(createTaskCheckbox(run.paystub, onToggle));
  if (run.tax) tasksWrap.appendChild(createTaskCheckbox(run.tax, onToggle));
  card.appendChild(tasksWrap);

  return card;
}

/**
 * Runs that feed the same tax deposit belong to one card, not one each —
 * a Monthly depositor can batch every Semi-Monthly and Bi-Weekly pay date
 * in the month into a single deposit, and showing that deposit's checkbox
 * once per contributing run made it look like N separate tax tasks instead
 * of the one it actually is.
 */
function groupPayrollRuns(runs) {
  const groups = new Map();
  runs.forEach(run => {
    const key = run.tax ? run.tax.id : `solo:${run.paystub.id}`;
    if (!groups.has(key)) groups.set(key, { tax: run.tax, runs: [] });
    groups.get(key).runs.push(run);
  });

  return [...groups.values()]
    .map(group => ({ ...group, runs: group.runs.sort((a, b) => a.payDate.localeCompare(b.payDate)) }))
    .sort((a, b) => a.runs[0].paystub.dueDate.localeCompare(b.runs[0].paystub.dueDate));
}

function isPayrollGroupComplete(group) {
  const paystubsDone = group.runs.every(run => isTaskComplete(run.paystub.id));
  return paystubsDone && (!group.tax || isTaskComplete(group.tax.id));
}

/**
 * One card for every run that shares a single tax deposit: each paystub is
 * its own sub-task row, and the (one, shared) deposit is the last row —
 * checked once, for all of them, once every paystub above it is done.
 */
function createBatchedRunCard(company, group, { showCompany = false, onChange } = {}) {
  const complete = isPayrollGroupComplete(group);
  const card = document.createElement("div");
  card.className = "payroll-run payroll-run--batched" + (complete ? " is-complete" : "");

  if (showCompany) appendCardCompanyName(card, company);

  const head = document.createElement("div");
  head.className = "payroll-run-head";

  const date = document.createElement("span");
  date.className = "payroll-run-date";
  date.textContent = formatTaskDate(group.tax.dueDate);

  const pill = document.createElement("span");
  pill.className = "schedule-pill";
  pill.dataset.schedule = group.tax.depositor;
  pill.dataset.group = "payroll";
  pill.textContent = `${group.tax.depositor} deposit`;

  const count = document.createElement("span");
  count.className = "payroll-run-count";
  count.textContent = `${group.runs.length} runs`;

  head.append(date, pill, count);

  if (complete) {
    const badge = document.createElement("span");
    badge.className = "payroll-run-complete-badge";
    badge.textContent = "Done";
    head.appendChild(badge);
  }
  card.appendChild(head);

  const onToggle = onChange ?? defaultCardRefresh(company.id);

  const subruns = document.createElement("div");
  subruns.className = "payroll-run-subruns";
  group.runs.forEach(run => {
    subruns.appendChild(createTaskCheckbox(run.paystub, onToggle, {
      nameOverride: `${run.schedule} Paystub`,
    }));
  });
  card.appendChild(subruns);

  const tasksWrap = document.createElement("div");
  tasksWrap.className = "payroll-run-tasks";
  tasksWrap.appendChild(createTaskCheckbox(group.tax, onToggle));
  card.appendChild(tasksWrap);

  return card;
}

/**
 * Every upcoming card for one company — grouped payroll runs and sales tax
 * payments interleaved by due date, so the panel reads as one to-do list
 * rather than one list per service.
 */
function buildCompanyUpcomingCards(company, from, to, options = {}) {
  const entries = [];

  if (company.services?.payroll) {
    groupPayrollRuns(buildPayrollRuns(company, from, to)).forEach(group => {
      entries.push({
        sortKey: group.runs[0].paystub.dueDate,
        build: () => group.runs.length > 1
          ? createBatchedRunCard(company, group, options)
          : createPayrollRunCard(company, group.runs[0], options),
      });
    });
  }

  if (typeof buildSalesTaxTasks === "function") {
    buildSalesTaxTasks(company, from, to).forEach(task => {
      entries.push({ sortKey: task.dueDate, build: () => createSalesTaxCard(company, task, options) });
    });
  }

  return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function renderCompanyUpcomingRuns(company) {
  const list = document.getElementById("companyUpcomingList");
  const countEl = document.getElementById("companyUpcomingCount");
  if (!list) return;

  const from = todayYmd();
  const to = ymd(addDays(new Date(), PAYROLL_UPCOMING_DAYS));
  const cards = buildCompanyUpcomingCards(company, from, to);

  if (countEl) countEl.textContent = cards.length ? String(cards.length) : "";

  if (cards.length === 0) {
    const configured = getEnabledPayrollGroups(company).filter(isPayrollGroupConfigured);
    list.replaceChildren(miniCalEmptyNode(
      !company.services?.payroll && !company.services?.salesTax
        ? "Enable Payroll or Sales Tax to start tracking work."
        : configured.length === 0 && company.services?.payroll
          ? "Set a pay schedule to generate the run calendar."
          : "Nothing due in the next 60 days."
    ));
    return;
  }

  list.replaceChildren(...cards.map(entry => entry.build()));
}

/** Called whenever the company detail page opens, and after any payroll edit. */
function renderCompanySchedulePanel(company) {
  if (!document.getElementById("companyDetailSide")) return;
  renderCompanyMiniCalendar(company);
  renderCompanyUpcomingRuns(company);
}

function initCompanyMiniCal() {
  document.getElementById("companyMiniCalPrev")?.addEventListener("click", () => {
    if (currentCompanyId) stepMiniCal(-1, getCompanyById(currentCompanyId));
  });
  document.getElementById("companyMiniCalNext")?.addEventListener("click", () => {
    if (currentCompanyId) stepMiniCal(1, getCompanyById(currentCompanyId));
  });
}

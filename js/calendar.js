/**
 * Calendar — every payroll task across every client, on the day it is due.
 *
 * Ported from the PO App dashboard: a continuously scrolling month grid with
 * a day pane that opens beside it. Events here are payroll tasks, placed on
 * their *due* date, which is the Friday before when the real date is a weekend.
 */

const CAL_MONTHS_BEFORE = 2;
const CAL_MONTHS_AFTER = 12;
const CAL_MAX_EVENTS = 3;

let calCursor = null;          // { year, month } the arrows/title target
let calSelectedYmd = "";       // day whose pane is open
let calScrollEl = null;
let calMonthAnchors = {};
let calScrollRaf = 0;

/** Which task kinds are shown. Both on by default. */
let calFilterSelection = new Set([TASK_KIND_PAYSTUB, TASK_KIND_TAX]);

/** Hide tasks already ticked off. */
let calHideCompleted = false;

// ── Event assembly ───────────────────────────────────────────────────────────

function getCalRange() {
  const { year, month } = getCalCursor();
  const start = new Date(year, month - CAL_MONTHS_BEFORE, 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, month + CAL_MONTHS_AFTER + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  return { start, end };
}

/** ymd → task[] for the visible range, after filters. */
function buildCalEventsByDate() {
  const { start, end } = getCalRange();
  const tasks = buildAllPayrollTasks(ymd(start), ymd(end));
  const byDate = new Map();

  tasks.forEach(task => {
    if (!calFilterSelection.has(task.kind)) return;
    const done = isTaskComplete(task.id);
    if (calHideCompleted && done) return;
    if (!byDate.has(task.dueDate)) byDate.set(task.dueDate, []);
    byDate.get(task.dueDate).push({ ...task, done });
  });

  return byDate;
}

// ── Cursor / title ───────────────────────────────────────────────────────────

function getCalCursor() {
  if (!calCursor) {
    const now = new Date();
    calCursor = { year: now.getFullYear(), month: now.getMonth() };
  }
  return calCursor;
}

function setCalTitle(year, month) {
  const el = document.getElementById("calTitle");
  if (!el) return;
  el.textContent = new Date(year, month, 1)
    .toLocaleString(undefined, { month: "long", year: "numeric" });
}

function stepCalMonth(delta) {
  const { year, month } = getCalCursor();
  const next = new Date(year, month + delta, 1);
  calCursor = { year: next.getFullYear(), month: next.getMonth() };
  setCalTitle(calCursor.year, calCursor.month);
  scrollCalToMonth(calCursor.year, calCursor.month);
}

function scrollCalToMonth(year, month, { instant = false } = {}) {
  const anchor = calMonthAnchors[`${year}-${month}`];
  if (!anchor || !calScrollEl) return;
  const headH = calScrollEl.querySelector(".dash-cal-head")?.offsetHeight ?? 0;
  calScrollEl.scrollTo({
    top: anchor.offsetTop - headH,
    behavior: instant ? "auto" : "smooth",
  });
}

/** Keep the centered title in step with what's actually on screen. */
function onCalScroll() {
  if (calScrollRaf) return;
  calScrollRaf = requestAnimationFrame(() => {
    calScrollRaf = 0;
    if (!calScrollEl) return;
    const headH = calScrollEl.querySelector(".dash-cal-head")?.offsetHeight ?? 0;
    const probe = calScrollEl.scrollTop + headH + 8;

    let best = null;
    Object.entries(calMonthAnchors).forEach(([key, cell]) => {
      if (cell.offsetTop <= probe && (!best || cell.offsetTop > best.top)) {
        best = { key, top: cell.offsetTop };
      }
    });
    if (!best) return;
    const [year, month] = best.key.split("-").map(Number);
    if (calCursor && calCursor.year === year && calCursor.month === month) return;
    calCursor = { year, month };
    setCalTitle(year, month);
  });
}

// ── Grid ─────────────────────────────────────────────────────────────────────

function createCalEventChip(event) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `dash-event cal-event--${event.kind}${event.done ? " is-done" : ""}`;
  chip.title = `${event.companyName} · ${event.label} · ${describeTaskContext(event)}`;

  const label = document.createElement("span");
  label.className = "dash-event-title";
  label.textContent = event.companyName;
  chip.appendChild(label);

  const meta = document.createElement("span");
  meta.className = "dash-event-meta";
  meta.textContent = event.kind === TASK_KIND_TAX ? "Tax" : "Pay";
  chip.appendChild(meta);

  chip.addEventListener("click", e => {
    e.stopPropagation();
    selectCalDay(event.dueDate);
  });
  return chip;
}

function buildCalCell(date, byDate, today) {
  const cellYmd = ymd(date);
  const cell = document.createElement("div");
  cell.className = "dash-cal-cell";
  cell.dataset.ymd = cellYmd;
  if (isWeekend(date)) cell.classList.add("is-weekend");
  if (cellYmd === today) cell.classList.add("is-today");
  if (cellYmd === calSelectedYmd) cell.classList.add("is-selected");

  const num = document.createElement("span");
  num.className = "dash-cal-date";
  num.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
  if (date.getDate() === 1) {
    cell.classList.add("is-month-start");
    calMonthAnchors[`${date.getFullYear()}-${date.getMonth()}`] = cell;
  }
  cell.appendChild(num);

  const events = byDate.get(cellYmd) ?? [];
  const collapsed = events.length > CAL_MAX_EVENTS + 1;
  events.forEach((event, i) => {
    if (collapsed && i >= CAL_MAX_EVENTS) return;
    cell.appendChild(createCalEventChip(event));
  });

  if (collapsed) {
    const more = document.createElement("span");
    more.className = "dash-cal-more";
    more.textContent = `+${events.length - CAL_MAX_EVENTS} more`;
    cell.appendChild(more);
  }

  if (events.length > 0) {
    cell.classList.add("has-events");
    cell.addEventListener("click", () => selectCalDay(cellYmd));
  }

  return cell;
}

function sizeCalRows() {
  if (!calScrollEl) return;
  const headH = calScrollEl.querySelector(".dash-cal-head")?.offsetHeight ?? 0;
  const avail = calScrollEl.clientHeight - headH;
  calScrollEl.style.setProperty("--dash-cal-row-h", `${Math.max(84, Math.floor(avail / 5))}px`);
}

function renderCalendarGrid() {
  const grid = document.getElementById("calGrid");
  if (!grid) return;

  const { year, month } = getCalCursor();
  setCalTitle(year, month);

  const byDate = buildCalEventsByDate();
  const today = todayYmd();
  calMonthAnchors = {};
  grid.replaceChildren();

  const scroll = document.createElement("div");
  scroll.className = "dash-cal-scroll dash-scroll";

  const head = document.createElement("div");
  head.className = "dash-cal-head";
  WEEKDAY_SHORT.forEach((day, i) => {
    const cell = document.createElement("div");
    cell.className = "dash-cal-head-cell";
    if (i === 0 || i === 6) cell.classList.add("is-weekend");
    cell.textContent = day;
    head.appendChild(cell);
  });
  scroll.appendChild(head);

  const body = document.createElement("div");
  body.className = "dash-cal-body";
  const { start, end } = getCalRange();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    body.appendChild(buildCalCell(new Date(d), byDate, today));
  }
  scroll.appendChild(body);
  grid.appendChild(scroll);

  calScrollEl = scroll;
  scroll.addEventListener("scroll", onCalScroll, { passive: true });
  sizeCalRows();
  scrollCalToMonth(year, month, { instant: true });
}

// ── Day pane ─────────────────────────────────────────────────────────────────

function applyCalDaySelection() {
  document.querySelectorAll("#calGrid .dash-cal-cell.is-selected")
    .forEach(cell => cell.classList.remove("is-selected"));
  if (calSelectedYmd) {
    document.querySelector(`#calGrid .dash-cal-cell[data-ymd="${calSelectedYmd}"]`)
      ?.classList.add("is-selected");
  }
}

function selectCalDay(dayYmd) {
  calSelectedYmd = dayYmd === calSelectedYmd ? "" : dayYmd;
  applyCalDaySelection();
  renderCalDayPane();
}

function closeCalDayPane() {
  calSelectedYmd = "";
  applyCalDaySelection();
  renderCalDayPane();
}

function renderCalDayPane() {
  const pane = document.getElementById("calDayPane");
  if (!pane) return;

  if (!calSelectedYmd) {
    pane.hidden = true;
    return;
  }
  pane.hidden = false;

  const title = document.getElementById("calDayPaneTitle");
  if (title) title.textContent = formatTaskDate(calSelectedYmd);

  // Read straight from the source so completions tick live without a re-render.
  const events = (buildAllPayrollTasks(calSelectedYmd, calSelectedYmd) ?? [])
    .filter(task => calFilterSelection.has(task.kind))
    .filter(task => !(calHideCompleted && isTaskComplete(task.id)));

  const count = document.getElementById("calDayPaneCount");
  if (count) count.textContent = events.length ? String(events.length) : "";

  const body = document.getElementById("calDayPaneList");
  if (!body) return;

  if (events.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dash-empty";
    empty.textContent = "Nothing due this day.";
    body.replaceChildren(empty);
    return;
  }

  body.replaceChildren(...events.map(task => {
    const row = document.createElement("div");
    row.className = "cal-day-task" + (isTaskComplete(task.id) ? " is-done" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "cal-day-task-check";
    cb.checked = isTaskComplete(task.id);
    cb.setAttribute("aria-label", `${task.label} for ${task.companyName}`);
    cb.addEventListener("change", async () => {
      await setTaskComplete(task.id, cb.checked);
      row.classList.toggle("is-done", cb.checked);
      renderCalendarGrid();
      applyCalDaySelection();
    });

    const main = document.createElement("div");
    main.className = "cal-day-task-main";

    const name = document.createElement("button");
    name.type = "button";
    name.className = "cal-day-task-company";
    name.textContent = task.companyName;
    name.addEventListener("click", () => openCompanyDetail(task.companyId));

    const sub = document.createElement("span");
    sub.className = "cal-day-task-sub";
    sub.textContent = `${task.label} · ${describeTaskContext(task)}`;
    main.append(name, sub);

    row.append(cb, main);

    if (task.movedForWeekend) {
      const flag = document.createElement("span");
      flag.className = "cal-day-task-flag";
      flag.textContent = "moved";
      flag.title = `Falls on ${formatTaskDate(task.date)}, a weekend — pulled back to the Friday before.`;
      row.appendChild(flag);
    }

    return row;
  }));
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function updateCalFilterButton() {
  const btn = document.getElementById("calFilterBtn");
  if (btn) btn.classList.toggle("active", calFilterSelection.size < 2 || calHideCompleted);
}

function renderCalFilterList() {
  const list = document.getElementById("calFilterList");
  if (!list) return;

  const options = [
    { key: TASK_KIND_PAYSTUB, label: "Paystub tasks" },
    { key: TASK_KIND_TAX, label: "Tax payment tasks" },
  ];

  const nodes = options.map(option => {
    const label = document.createElement("label");
    label.className = "column-filter-option";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = calFilterSelection.has(option.key);
    cb.addEventListener("change", () => {
      if (cb.checked) calFilterSelection.add(option.key);
      else calFilterSelection.delete(option.key);
      updateCalFilterButton();
      renderCalendarGrid();
      renderCalDayPane();
    });
    const span = document.createElement("span");
    span.textContent = option.label;
    label.append(cb, span);
    return label;
  });

  const hide = document.createElement("label");
  hide.className = "column-filter-option cal-filter-sep";
  const hideCb = document.createElement("input");
  hideCb.type = "checkbox";
  hideCb.checked = calHideCompleted;
  hideCb.addEventListener("change", () => {
    calHideCompleted = hideCb.checked;
    updateCalFilterButton();
    renderCalendarGrid();
    renderCalDayPane();
  });
  const hideSpan = document.createElement("span");
  hideSpan.textContent = "Hide completed";
  hide.append(hideCb, hideSpan);

  list.replaceChildren(...nodes, hide);
}

function toggleCalFilterPopover() {
  const pop = document.getElementById("calFilterPopover");
  const btn = document.getElementById("calFilterBtn");
  if (!pop || !btn) return;

  if (!pop.hidden) {
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    return;
  }

  renderCalFilterList();
  pop.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  const rect = btn.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 4}px`;
  pop.style.left = `${Math.min(rect.left, window.innerWidth - pop.offsetWidth - 8)}px`;
}

// ── Entry points ─────────────────────────────────────────────────────────────

function renderCalendar() {
  renderCalendarGrid();
  renderCalDayPane();
  updateCalFilterButton();
}

/** Cheap no-op unless the calendar is the active view. */
function refreshCalendarIfActive() {
  if (getCurrentAppView() === "calendar") renderCalendar();
}

function initCalendar() {
  document.getElementById("calPrev")?.addEventListener("click", () => stepCalMonth(-1));
  document.getElementById("calNext")?.addEventListener("click", () => stepCalMonth(1));
  document.getElementById("calToday")?.addEventListener("click", () => {
    const now = new Date();
    calCursor = { year: now.getFullYear(), month: now.getMonth() };
    setCalTitle(calCursor.year, calCursor.month);
    scrollCalToMonth(calCursor.year, calCursor.month);
  });

  document.getElementById("calDayPaneClose")?.addEventListener("click", closeCalDayPane);
  document.getElementById("calFilterBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleCalFilterPopover();
  });

  document.addEventListener("click", e => {
    const pop = document.getElementById("calFilterPopover");
    if (!pop || pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest("#calFilterBtn")) return;
    pop.hidden = true;
    document.getElementById("calFilterBtn")?.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("resize", () => {
    if (getCurrentAppView() === "calendar") sizeCalRows();
  });
}

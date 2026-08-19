import { DASHBOARD_HEADING, OCCUPANCY_FILTERS, SORT_OPTIONS } from "../constants.js";
import { can, canManageExtraHours } from "../permissions.js";
import {
  computeAllMemberStats,
  computeKpis,
  getActiveTeamMembers,
  matchesOccupancyFilter,
  sortMemberStats,
} from "../occupancy.js";
import { store } from "../store.js";
import {
  dateNavHtml,
  emptyState,
  kpiSkeleton,
  occupancyRemainHtml,
  openDrawer,
  renderAvatar,
  renderBadge,
  renderProgress,
  renderProjectChip,
  skeletons,
} from "../components.js";
import { bindTeamDetails, renderTeamDetails } from "./TeamDetailsPage.js";
import { openAssignModal, openExtraHoursModal, openMemberModal, openProjectModal } from "../forms.js";
import { bindShell, pageActions, renderShell } from "../layout.js";
import {
  addDays,
  escapeHtml,
  formatDateKey,
  formatHours,
  formatPercent,
  monthRange,
  pagePath,
  refreshIcons,
  todayKey,
  weekRange,
} from "../utils.js";

function kpiCards(kpis, dateKey) {
  const dateQ = dateKey ? `&date=${encodeURIComponent(dateKey)}` : "";
  const extraHint =
    kpis.extraDelta === 0 ? "vs last week" : `${kpis.extraDelta > 0 ? "+" : ""}${kpis.extraDelta}% vs last week`;
  const items = [
    ["Total Team Members", kpis.totalMembers, "users", "Active roster", dateKey ? `team.html?date=${encodeURIComponent(dateKey)}` : "team.html", "View team members"],
    ["Fully Occupied", kpis.fullyOccupied, "gauge", `${kpis.fullyOccupiedPct}% of team`, `team.html?status=fully-occupied${dateQ}`, "View fully occupied members"],
    ["Available Capacity", formatHours(kpis.availableCapacity), "battery-medium", "Unallocated hours", `team.html?status=available${dateQ}`, "View available members"],
    ["Over Capacity", kpis.overCapacityCount, "alert-triangle", `${kpis.overCapacityCount} members`, `team.html?status=overloaded${dateQ}`, "View overloaded members"],
    ["Active Projects", kpis.activeProjects, "folder-kanban", "On this date", "projects.html?status=active", "View active projects"],
    ["Total Allocated Hours", formatHours(kpis.allocatedHours), "clock-3", "Active assignments", "assignments.html?status=active", "View assignments"],
    ["Extra Hours This Week", formatHours(kpis.extraThisWeek), "timer", extraHint, "extra-hours.html?range=this-week", "View extra hours"],
  ];
  return `<div class="kpi-grid">${items
    .map(
      ([label, value, icon, hint, href, cta]) => `
      <button class="card kpi is-link" type="button" data-go="${escapeHtml(href)}" tabindex="0" aria-label="${escapeHtml(label)}. ${escapeHtml(cta)}">
        <div class="kpi-label"><span>${label}</span><i data-lucide="${icon}"></i></div>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(hint)}</small>
        <span class="kpi-cta">${escapeHtml(cta)} <i data-lucide="arrow-right"></i></span>
      </button>`
    )
    .join("")}</div>`;
}

function extraHoursWidget(state, dateKey, extraMemberId = "") {
  const { start, end } = weekRange(dateKey);
  const { start: monthStart, end: monthEnd } = monthRange(dateKey);
  const members = getActiveTeamMembers(state.members);
  const rows = (state.extraHours || []).filter((row) => {
    if (extraMemberId && row.memberId !== extraMemberId) return false;
    return true;
  });
  const weeklyRows = rows.filter((row) => row.date >= start && row.date <= end);
  const monthlyRows = extraMemberId
    ? rows.filter((row) => row.date >= monthStart && row.date <= monthEnd)
    : [];
  const totals = {};
  weeklyRows.forEach((row) => {
    totals[row.memberId] = (totals[row.memberId] || 0) + Number(row.hours || 0);
  });
  const ranked = Object.entries(totals)
    .map(([memberId, hours]) => ({
      member: state.members.find((item) => item.id === memberId),
      hours,
    }))
    .filter((item) => item.member && item.member.active !== false)
    .sort((a, b) => b.hours - a.hours);
  const max = Math.max(...ranked.map((item) => item.hours), 1);
  const weekTotal = ranked.reduce((sum, item) => sum + item.hours, 0);
  const monthTotal = monthlyRows.reduce((sum, row) => sum + Number(row.hours || 0), 0);
  const selected = members.find((item) => item.id === extraMemberId);
  return `
    <section class="card report-card extra-widget">
      <header style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h3>Extra Hours This Week</h3>
        <strong>${formatHours(weekTotal)}</strong>
      </header>
      <label class="select">
        <span class="sr-only">Extra hours member</span>
        <select id="dash-extra-member">
          <option value="">All Members</option>
          ${members.map((item) => `<option value="${item.id}" ${item.id === extraMemberId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
      </label>
      ${
        selected
          ? `<p>${escapeHtml(selected.name)} · this week ${formatHours(weekTotal)} · this month ${formatHours(monthTotal)}</p>`
          : ""
      }
      ${
        ranked.length
          ? ranked
              .map(
                (item) => `<div class="chart-bar"><span class="truncate">${escapeHtml(item.member.name)}</span><div class="progress extra-accent" style="--w:${(item.hours / max) * 100}%"><span></span></div><strong>${formatHours(item.hours)}</strong></div>`
              )
              .join("")
          : "<p>No extra hours recorded.</p>"
      }
      ${canManageExtraHours() ? `<a class="btn ghost" href="${pagePath("extra-hours.html?range=this-week")}">View all</a>` : ""}
    </section>`;
}

function occupancyRow(stats, projects, canManage) {
  const memberProjects = stats.assignments
    .map((item) => renderProjectChip(projects.find((project) => project.id === item.projectId), item.allocatedHours))
    .join("");
  return `
    <article class="occ-row" data-member="${stats.member.id}">
      <div class="member-cell">
        ${renderAvatar(stats.member.name)}
        <div>
          <strong>${escapeHtml(stats.member.name)}</strong>
          <small>${escapeHtml(stats.member.designation || "QA Engineer")}</small>
        </div>
      </div>
      <div class="hours" data-label="Occupied">${formatHours(stats.occupied)}</div>
      <div class="hours" data-label="Capacity">${formatHours(stats.capacity)}</div>
      <div data-label="Availability">${occupancyRemainHtml(stats)}</div>
      <div class="util-cell" data-label="Utilization">
        ${renderProgress(stats.utilization, stats.tone)}
        <small>${formatPercent(stats.utilization)}</small>
      </div>
      <div class="project-stack" data-label="Projects">${memberProjects || '<span class="badge neutral">None</span>'}</div>
      <div data-label="Status">${renderBadge(stats.status)}</div>
      <div><button class="btn ghost" type="button" data-member="${stats.member.id}">View</button></div>
    </article>`;
  void canManage;
}

function pageMarkup(state, ui) {
  const extraHours = state.extraHours || [];
  const kpis = computeKpis(state.members, state.projects, state.assignments, extraHours, ui.dateKey);
  let stats = computeAllMemberStats(state.members, state.assignments, extraHours, ui.dateKey);
  if (ui.memberId) stats = stats.filter((item) => item.member.id === ui.memberId);
  if (ui.projectId) {
    stats = stats.filter((item) => item.assignments.some((assignment) => assignment.projectId === ui.projectId));
  }
  stats = stats.filter((item) => matchesOccupancyFilter(item, ui.filter));
  if (ui.search) {
    const q = ui.search.toLowerCase();
    stats = stats.filter((item) =>
      [item.member.name, item.member.designation, item.member.department].join(" ").toLowerCase().includes(q)
    );
  }
  stats = sortMemberStats(stats, ui.sort);
  const selected = state.members.find((item) => item.id === ui.memberId);
  const selectedStats = selected
    ? computeAllMemberStats([selected], state.assignments, extraHours, ui.dateKey)[0]
    : null;

  const dataBanner = state.error
    ? `<div class="empty card" style="margin-bottom:16px">
        <h3>Live data is unavailable</h3>
        <p>${escapeHtml(state.error.message || "Firestore did not respond. Create a database for teamflowupdation and deploy security rules.")}</p>
      </div>`
    : "";

  return `
    <div class="page-head">
      <div>
        <h2>${DASHBOARD_HEADING}</h2>
        <p>Who is working on what on ${escapeHtml(formatDateKey(ui.dateKey))}.</p>
      </div>
      <div class="actions">${pageActions()}</div>
    </div>
    ${dataBanner}
    <div class="filters">
      ${dateNavHtml(ui.dateKey, formatDateKey(ui.dateKey))}
      <label class="select">
        <span class="sr-only">Member</span>
        <select id="member-filter">
          <option value="">All Members</option>
          ${getActiveTeamMembers(state.members).map((item) => `<option value="${item.id}" ${item.id === ui.memberId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
      </label>
    </div>
    ${kpiCards(kpis, ui.dateKey)}
    ${
      selectedStats
        ? `<div class="summary-strip">
            <span><strong>${escapeHtml(selected.name)}</strong></span>
            <span>Occupied ${formatHours(selectedStats.occupied)}</span>
            <span>Capacity ${formatHours(selectedStats.capacity)}</span>
            <span>${selectedStats.overCapacity > 0 ? `Over Capacity +${selectedStats.overCapacity}h` : `Available ${formatHours(selectedStats.available)}`}</span>
            <span>Extra ${formatHours(selectedStats.extra)}</span>
          </div>`
        : ""
    }
    <div class="filters">
      <input id="team-search" placeholder="Search team member" value="${escapeHtml(ui.search)}" />
      <select id="project-filter">
        <option value="">All Projects</option>
        ${state.projects.map((item) => `<option value="${item.id}" ${item.id === ui.projectId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
      </select>
      <select id="sort-filter">${SORT_OPTIONS.map((item) => `<option value="${item.id}" ${item.id === ui.sort ? "selected" : ""}>${item.label}</option>`).join("")}</select>
    </div>
    <div class="chip-row" role="tablist">
      ${OCCUPANCY_FILTERS.map((item) => `<button class="chip ${ui.filter === item.id ? "is-active" : ""}" data-filter="${item.id}">${item.label}</button>`).join("")}
    </div>
    <div class="occ-table-wrap">
    <section class="card occ-table" aria-label="Team occupancy">
      <div class="occ-head">
        <span>Team Member</span><span>Occupied</span><span>Capacity</span><span>Available / Over</span>
        <span>Utilization</span><span>Projects</span><span>Status</span><span>Actions</span>
      </div>
      ${
        stats.length
          ? stats.map((item) => occupancyRow(item, state.projects, can("removeAssignment"))).join("")
          : emptyState({
              title: "No matching team members",
              message: "Try a different date or filter.",
              actionLabel: can("assignMember") ? "Assign Work" : "",
              actionId: "assign",
            })
      }
    </section>
    </div>
    <div class="project-grid" style="margin-top:16px">${extraHoursWidget(state, ui.dateKey, ui.extraMemberId)}</div>`;
}

export class DashboardPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.ui = {
      search: "",
      filter: "all",
      sort: "name",
      projectId: "",
      memberId: "",
      extraMemberId: "",
      dateKey: todayKey(),
    };
  }

  async openMember(state, memberId) {
    const member = state.members.find((item) => item.id === memberId);
    if (!member) return;
    const stats = computeAllMemberStats([member], state.assignments, state.extraHours || [], this.ui.dateKey)[0];
    let logs = [];
    try {
      const page = await store.fetchAuditLogs({ memberId });
      logs = page.rows || [];
    } catch {
      logs = [];
    }
    const drawer = openDrawer({ title: "Member occupancy", body: renderTeamDetails(stats, state, logs) });
    bindTeamDetails(drawer, state, memberId, this.ui.dateKey);
    refreshIcons();
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const ui = this.ui;
    store.subscribe((state) => {
      if (state.loading) {
        app.innerHTML = renderShell("dashboard", `${kpiSkeleton()}${skeletons()}`);
        bindShell(state);
        return;
      }
      const paint = (restoreSearch = false) => {
        app.innerHTML = renderShell("dashboard", pageMarkup(state, ui));
        bindShell(state);
        wire();
        if (restoreSearch) {
          const input = document.querySelector("#team-search");
          if (input) {
            input.focus();
            input.setSelectionRange(ui.search.length, ui.search.length);
          }
        }
      };
      const wire = () => {
        document.querySelector("#team-search")?.addEventListener("input", (event) => {
          ui.search = event.target.value;
          paint(true);
        });
        document.querySelectorAll("[data-open=assign], [data-action=assign]").forEach((btn) =>
          btn.addEventListener("click", () => openAssignModal(state, { date: ui.dateKey }))
        );
        document.querySelector("[data-open=member]")?.addEventListener("click", () => openMemberModal(state));
        document.querySelector("[data-open=project]")?.addEventListener("click", () => openProjectModal(state));
        document.querySelectorAll("[data-filter]").forEach((btn) =>
          btn.addEventListener("click", () => {
            ui.filter = btn.dataset.filter;
            paint();
          })
        );
        document.querySelector("#project-filter")?.addEventListener("change", (event) => {
          ui.projectId = event.target.value;
          paint();
        });
        document.querySelector("#member-filter")?.addEventListener("change", (event) => {
          ui.memberId = event.target.value;
          paint();
        });
        document.querySelector("#dash-extra-member")?.addEventListener("change", (event) => {
          ui.extraMemberId = event.target.value;
          paint();
        });
        document.querySelector("#sort-filter")?.addEventListener("change", (event) => {
          ui.sort = event.target.value;
          paint();
        });
        document.querySelector("#occ-date")?.addEventListener("change", (event) => {
          ui.dateKey = event.target.value || todayKey();
          paint();
        });
        document.querySelector("[data-today]")?.addEventListener("click", () => {
          ui.dateKey = todayKey();
          paint();
        });
        document.querySelectorAll("[data-day]").forEach((btn) =>
          btn.addEventListener("click", () => {
            ui.dateKey = addDays(ui.dateKey, Number(btn.dataset.day));
            paint();
          })
        );
        document.querySelectorAll("[data-go]").forEach((el) => {
          const go = () => {
            window.location.href = pagePath(el.dataset.go);
          };
          el.addEventListener("click", go);
          el.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              go();
            }
          });
        });
        document.querySelectorAll("[data-member]").forEach((el) =>
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            this.openMember(state, el.dataset.member);
          })
        );
      };
      paint();
    });
    void openExtraHoursModal;
  }
}

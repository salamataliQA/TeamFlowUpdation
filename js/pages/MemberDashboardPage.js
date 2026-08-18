import { DASHBOARD_HEADING } from "../constants.js";
import { getCurrentUser } from "../auth.js";
import { ownMemberId } from "../permissions.js";
import { computeMemberStats } from "../occupancy.js";
import { store } from "../store.js";
import { dateNavHtml, emptyState, occupancyRemainHtml, renderBadge, renderProgress, renderProjectChip } from "../components.js";
import { bindShell, renderShell } from "../layout.js";
import { addDays, escapeHtml, formatDateKey, formatHours, formatPercent, refreshIcons, todayKey } from "../utils.js";

export class MemberDashboardPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.dateKey = todayKey();
  }

  markup(state) {
    const user = getCurrentUser();
    const memberId = ownMemberId(user) || state.members.find((item) => item.email === user.email)?.id;
    const member = state.members.find((item) => item.id === memberId);
    if (!member) {
      return emptyState({
        title: "Profile not linked",
        message: "Ask an admin to link your login to a team member record.",
      });
    }
    const dateKey = this.dateKey;
    const stats = computeMemberStats(member, state.assignments, state.extraHours || [], dateKey);
    const projects = stats.assignments
      .map((item) => {
        const project = state.projects.find((p) => p.id === item.projectId);
        return `<article class="card assign-card">
          <header style="display:flex;justify-content:space-between;gap:8px">
            <strong>${escapeHtml(project?.name || "Project")}</strong>
            ${renderBadge(item.status)}
          </header>
          <div class="stat-row"><span>Date</span><span>${escapeHtml(formatDateKey(item.date))}</span></div>
          <div class="stat-row"><span>Hours</span><strong>${formatHours(item.allocatedHours)}</strong></div>
        </article>`;
      })
      .join("");

    return `
      <div class="page-head">
        <div>
          <h2>${escapeHtml(DASHBOARD_HEADING)}</h2>
          <p>Welcome, ${escapeHtml(member.name)}. Your occupancy for ${escapeHtml(formatDateKey(dateKey))}.</p>
        </div>
      </div>
      <div class="filters">${dateNavHtml(dateKey, formatDateKey(dateKey))}</div>
      <div class="kpi-grid">
        <article class="card kpi"><div class="kpi-label"><span>Occupied</span></div><strong>${formatHours(stats.occupied)}</strong></article>
        <article class="card kpi"><div class="kpi-label"><span>My Capacity</span></div><strong>${formatHours(stats.capacity)}</strong></article>
        <article class="card kpi"><div class="kpi-label"><span>Extra Hours</span></div><strong>${formatHours(stats.extra)}</strong></article>
        <article class="card kpi"><div class="kpi-label"><span>${stats.overCapacity > 0 ? "Over Capacity" : "Remaining"}</span></div><strong>${stats.overCapacity > 0 ? `+${stats.overCapacity}h` : formatHours(stats.available)}</strong></article>
        <article class="card kpi"><div class="kpi-label"><span>My Active Projects</span></div><strong>${stats.projectCount}</strong></article>
      </div>
      <section class="card report-card">
        <h3>Your Occupancy</h3>
        <p class="hours">${formatHours(stats.totalWork)} / ${formatHours(stats.capacity)}</p>
        ${renderProgress(stats.utilization, stats.tone)}
        <p>${formatPercent(stats.utilization)} · ${occupancyRemainHtml(stats)}</p>
        <div class="stat-row"><span>Regular occupied</span><strong>${formatHours(stats.occupied)}</strong></div>
        <div class="stat-row"><span>Extra hours</span><strong>${formatHours(stats.extra)}</strong></div>
        <div class="stat-row"><span>Total work</span><strong>${formatHours(stats.totalWork)}</strong></div>
        <div style="margin-top:12px">${renderBadge(stats.status)}</div>
      </section>
      <h3 style="margin:22px 0 12px">Currently Working On</h3>
      <p>${escapeHtml(formatDateKey(dateKey))}</p>
      ${
        projects
          ? `<div class="project-grid" style="margin-top:12px">${projects}</div>`
          : emptyState({ title: "No active work", message: "You have no active assignments for this date." })
      }`;
    void renderProjectChip;
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const user = getCurrentUser();
    const memberId = ownMemberId(user);
    store.subscribe((state) => {
      const paint = () => {
        app.innerHTML = renderShell("dashboard", this.markup(state));
        bindShell(state);
        document.querySelector("#occ-date")?.addEventListener("change", (event) => {
          this.dateKey = event.target.value || todayKey();
          paint();
        });
        document.querySelector("[data-today]")?.addEventListener("click", () => {
          this.dateKey = todayKey();
          paint();
        });
        document.querySelectorAll("[data-day]").forEach((btn) =>
          btn.addEventListener("click", () => {
            this.dateKey = addDays(this.dateKey, Number(btn.dataset.day));
            paint();
          })
        );
        refreshIcons();
      };
      paint();
    }, { memberId });
  }
}

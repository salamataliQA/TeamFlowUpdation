import { OCCUPANCY_FILTERS, SORT_OPTIONS } from "../constants.js";
import { can } from "../permissions.js";
import { computeAllMemberStats, matchesOccupancyFilter, sortMemberStats } from "../occupancy.js";
import { TeamService } from "../services/TeamService.js";
import { occupancyRemainHtml, confirmDialog, emptyState, renderAvatar, renderBadge, renderProgress, renderProjectChip, showToast } from "../components.js";
import { openAssignModal, openMemberModal } from "../forms.js";
import { bindShell, handleError, pageActions, renderShell } from "../layout.js";
import { UrlState } from "../url-state.js";
import { escapeHtml, formatDateKey, formatHours, formatPercent, todayKey } from "../utils.js";

export class TeamPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.ui = {
      search: "",
      filter: UrlState.occupancyFilter() || "all",
      sort: "name",
      dateKey: UrlState.date() || todayKey(),
    };
  }

  applyStatusFilter(status) {
    this.ui.filter = UrlState.occupancyFilter(status) || "all";
  }

  markup(state) {
    const ui = this.ui;
    let stats = computeAllMemberStats(state.members, state.assignments, state.extraHours || [], ui.dateKey);
    stats = stats.filter((item) => matchesOccupancyFilter(item, ui.filter));
    if (ui.search) {
      const q = ui.search.toLowerCase();
      stats = stats.filter((item) => item.member.name.toLowerCase().includes(q));
    }
    stats = sortMemberStats(stats, ui.sort);

    return `
      <div class="page-head">
        <div>
          <h2>Team Members</h2>
          <p>Active roster occupancy for ${escapeHtml(formatDateKey(ui.dateKey))}.</p>
        </div>
        <div class="actions">${pageActions()}</div>
      </div>
      <div class="filters">
        <input id="q" placeholder="Search team member" value="${escapeHtml(ui.search)}" />
        <input type="date" id="team-date" value="${ui.dateKey}" aria-label="Occupancy date" />
        <select id="filter">${OCCUPANCY_FILTERS.map((item) => `<option value="${item.id}" ${ui.filter === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select>
        <select id="sort">${SORT_OPTIONS.map((item) => `<option value="${item.id}" ${item.id === ui.sort ? "selected" : ""}>${item.label}</option>`).join("")}</select>
      </div>
      <div class="project-grid">
        ${
          stats.length
            ? stats
                .map(
                  (item) => `
                  <article class="card project-card" data-id="${item.member.id}">
                    <header>
                      <div class="member-cell">
                        ${renderAvatar(item.member.name)}
                        <div>
                          <strong>${escapeHtml(item.member.name)}</strong>
                          <small>${escapeHtml(item.member.designation || "QA Engineer")} · ${item.member.active === false ? "Inactive" : "Active"}</small>
                        </div>
                      </div>
                      ${renderBadge(item.member.active === false ? "inactive" : item.status)}
                    </header>
                    <p class="hours">${formatHours(item.occupied)} / ${formatHours(item.capacity)} · ${formatPercent(item.utilization)}</p>
                    ${renderProgress(item.utilization, item.tone)}
                    <p>${occupancyRemainHtml(item)}</p>
                    <div class="project-stack" style="margin-top:12px">
                      ${item.assignments.map((a) => renderProjectChip(state.projects.find((p) => p.id === a.projectId), a.allocatedHours)).join("") || '<span class="badge neutral">No project</span>'}
                    </div>
                    <div class="actions" style="margin-top:14px">
                      ${can("manageTeam") ? `<button class="btn secondary" data-edit="${item.member.id}">Edit</button>` : ""}
                      ${
                        can("manageTeam")
                          ? item.member.active === false
                            ? `<button class="btn" data-enable="${item.member.id}">Activate</button>`
                            : `<button class="btn ghost" data-disable="${item.member.id}">Deactivate</button>`
                          : ""
                      }
                      ${can("assignMember") && item.member.active !== false ? `<button class="btn" data-assign="${item.member.id}">Assign</button>` : ""}
                    </div>
                  </article>`
                )
                .join("")
            : emptyState({ title: "No team members", message: "No people match this operational filter.", actionLabel: can("manageTeam") ? "Add Team Member" : "", actionId: "member" })
        }
      </div>`;
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const ui = this.ui;
    const selected = UrlState.get("member");

    TeamService.subscribe((state) => {
      const paint = () => {
        app.innerHTML = renderShell("team", this.markup(state));
        bindShell(state);
        wire(state);
      };
      const wire = (current) => {
        document.querySelector("#q")?.addEventListener("input", (e) => {
          ui.search = e.target.value;
          paint();
          const input = document.querySelector("#q");
          input.focus();
          input.setSelectionRange(ui.search.length, ui.search.length);
        });
        document.querySelector("#filter")?.addEventListener("change", (e) => {
          ui.filter = e.target.value;
          paint();
        });
        document.querySelector("#sort")?.addEventListener("change", (e) => {
          ui.sort = e.target.value;
          paint();
        });
        document.querySelector("#team-date")?.addEventListener("change", (e) => {
          ui.dateKey = e.target.value || todayKey();
          paint();
        });
        document.querySelector("[data-open=assign]")?.addEventListener("click", () => openAssignModal(current, { date: ui.dateKey }));
        document.querySelector("[data-open=member], [data-action=member]")?.addEventListener("click", () => openMemberModal(current));
        document.querySelector("[data-open=project]")?.addEventListener("click", () => import("../forms.js").then((m) => m.openProjectModal(current)));
        document.querySelectorAll("[data-edit]").forEach((btn) =>
          btn.addEventListener("click", () => openMemberModal(current, current.members.find((m) => m.id === btn.dataset.edit)))
        );
        document.querySelectorAll("[data-assign]").forEach((btn) =>
          btn.addEventListener("click", () => openAssignModal(current, { memberId: btn.dataset.assign, date: ui.dateKey }))
        );
        document.querySelectorAll("[data-disable]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            const member = current.members.find((m) => m.id === btn.dataset.disable);
            const ok = await confirmDialog({
              title: `Deactivate ${member.name}?`,
              message: `This will remove ${member.name} from active team operations. Historical assignments and reports will be preserved.`,
              confirmText: "Deactivate",
              danger: true,
            });
            if (!ok) return;
            try {
              await TeamService.setActive(member, false);
              showToast(`${member.name} deactivated.`);
            } catch (error) {
              handleError(error);
            }
          })
        );
        document.querySelectorAll("[data-enable]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            const member = current.members.find((m) => m.id === btn.dataset.enable);
            const ok = await confirmDialog({
              title: `Activate ${member.name}?`,
              message: `${member.name} will return to the active roster, assignment lists, and occupancy views.`,
              confirmText: "Activate",
            });
            if (!ok) return;
            try {
              await TeamService.setActive(member, true);
              showToast(`${member.name} activated.`);
            } catch (error) {
              handleError(error);
            }
          })
        );
      };
      paint();
      if (selected) {
        const member = state.members.find((item) => item.id === selected);
        if (member && can("manageTeam")) openMemberModal(state, member);
      }
    });
  }
}

import { ASSIGNMENT_STATUSES } from "../constants.js";
import { isMember } from "../auth.js";
import { can, ownMemberId } from "../permissions.js";
import { store } from "../store.js";
import { emptyState, renderAvatar, renderBadge, renderProjectChip } from "../components.js";
import { changeAssignmentStatus, openAssignModal } from "../forms.js";
import { bindShell, pageActions, renderShell } from "../layout.js";
import { escapeHtml, formatDateKey, formatHours } from "../utils.js";
import { UrlState } from "../url-state.js";
import { isActiveMember } from "../occupancy.js";

export class AssignmentsPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.ui = { search: "", status: UrlState.get("status") || "all" };
  }

  markup(state) {
    const ui = this.ui;
    const userIsMember = isMember();
    const myId = ownMemberId();
    let rows = state.assignments.filter((item) => {
      if (ui.status === "all") return item.status !== "cancelled" && item.status !== "removed";
      return item.status === ui.status;
    });
    if (userIsMember) rows = rows.filter((item) => item.memberId === myId);
    else {
      rows = rows.filter((item) => {
        const member = state.members.find((m) => m.id === item.memberId);
        return isActiveMember(member);
      });
    }
    if (ui.search) {
      const q = ui.search.toLowerCase();
      rows = rows.filter((item) => {
        const member = state.members.find((m) => m.id === item.memberId);
        const project = state.projects.find((p) => p.id === item.projectId);
        return `${member?.name || ""} ${project?.name || ""}`.toLowerCase().includes(q);
      });
    }
    rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return `
      <div class="page-head">
        <div>
          <h2>${userIsMember ? "My Assignments" : "Assignments"}</h2>
          <p>${userIsMember ? "Your scheduled project work by date." : "Date-based project work for the team."}</p>
        </div>
        <div class="actions">${userIsMember ? "" : pageActions()}</div>
      </div>
      <div class="filters">
        <input id="q" placeholder="Search member or project" value="${escapeHtml(ui.search)}" />
        <select id="status">
          <option value="all">All statuses</option>
          ${ASSIGNMENT_STATUSES.map((status) => `<option value="${status}" ${ui.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      ${
        rows.length
          ? `<div class="project-grid">${rows
              .map((item) => {
                const member = state.members.find((m) => m.id === item.memberId);
                const project = state.projects.find((p) => p.id === item.projectId);
                return `<article class="card assign-card">
                  <header style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                    <div class="member-cell">${renderAvatar(member?.name || "?", "sm")}<div><strong>${escapeHtml(userIsMember ? (project?.name || "Project") : (member?.name || "Unknown"))}</strong><small>${item.date ? formatDateKey(item.date) : "Needs date"}</small></div></div>
                    ${renderBadge(item.status)}
                  </header>
                  <div style="margin:10px 0">${renderProjectChip(project, item.allocatedHours)}</div>
                  <div class="stat-row"><span>Hours</span><strong>${formatHours(item.allocatedHours)}</strong></div>
                  <p>${escapeHtml(item.notes || "No notes")}</p>
                  ${
                    userIsMember
                      ? ""
                      : `<div class="actions" style="margin-top:12px">
                    ${can("editAssignmentHours") ? `<button class="btn secondary" data-edit="${item.id}">Edit</button>` : ""}
                    ${can("removeAssignment") && item.status === "active" ? `<button class="btn ghost" data-pause="${item.id}">Pause</button>` : ""}
                    ${can("removeAssignment") && item.status === "paused" ? `<button class="btn ghost" data-resume="${item.id}">Resume</button>` : ""}
                    ${can("removeAssignment") && item.status !== "cancelled" && item.status !== "removed" ? `<button class="btn danger" data-remove="${item.id}">Remove</button>` : ""}
                  </div>`
                  }
                </article>`;
              })
              .join("")}</div>`
          : emptyState({
              title: "No assignments",
              message: "Assign a project to a team member to populate this list.",
              actionLabel: can("assignMember") ? "Assign Project" : "",
              actionId: "assign",
            })
      }`;
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const ui = this.ui;
    const memberId = isMember() ? ownMemberId() : "";
    store.subscribe((state) => {
      const paint = () => {
        app.innerHTML = renderShell("assignments", this.markup(state));
        bindShell(state);
        wire();
      };
      const wire = () => {
        document.querySelector("#q")?.addEventListener("input", (e) => {
          ui.search = e.target.value;
          paint();
          const input = document.querySelector("#q");
          input.focus();
          input.setSelectionRange(ui.search.length, ui.search.length);
        });
        document.querySelector("#status")?.addEventListener("change", (e) => {
          ui.status = e.target.value;
          paint();
        });
        document.querySelector("[data-open=assign], [data-action=assign]")?.addEventListener("click", () => openAssignModal(state));
        document.querySelector("[data-open=member]")?.addEventListener("click", () => import("../forms.js").then((m) => m.openMemberModal(state)));
        document.querySelector("[data-open=project]")?.addEventListener("click", () => import("../forms.js").then((m) => m.openProjectModal(state)));
        document.querySelectorAll("[data-edit]").forEach((btn) =>
          btn.addEventListener("click", () => openAssignModal(state, { assignment: state.assignments.find((item) => item.id === btn.dataset.edit) }))
        );
        document.querySelectorAll("[data-pause]").forEach((btn) =>
          btn.addEventListener("click", () => changeAssignmentStatus(state, state.assignments.find((item) => item.id === btn.dataset.pause), "paused"))
        );
        document.querySelectorAll("[data-resume]").forEach((btn) =>
          btn.addEventListener("click", () => changeAssignmentStatus(state, state.assignments.find((item) => item.id === btn.dataset.resume), "active"))
        );
        document.querySelectorAll("[data-remove]").forEach((btn) =>
          btn.addEventListener("click", () => changeAssignmentStatus(state, state.assignments.find((item) => item.id === btn.dataset.remove), "cancelled"))
        );
      };
      paint();
    }, { memberId });
  }
}

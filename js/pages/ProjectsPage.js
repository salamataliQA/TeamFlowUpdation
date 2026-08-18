import { PROJECT_STATUSES } from "../constants.js";
import { can } from "../permissions.js";
import { computeProjectStats } from "../occupancy.js";
import { ProjectService } from "../services/ProjectService.js";
import { confirmDialog, emptyState, openDrawer, renderBadge, renderProjectChip, showToast } from "../components.js";
import { changeAssignmentStatus, openAssignModal, openProjectModal } from "../forms.js";
import { bindShell, handleError, pageActions, renderShell } from "../layout.js";
import { store } from "../store.js";
import { UrlState } from "../url-state.js";
import { escapeHtml, formatDate, formatHours, refreshIcons } from "../utils.js";
import { renderProjectDetails } from "./ProjectDetailsPage.js";

export class ProjectsPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.ui = { search: "", status: UrlState.get("status") || "all" };
  }

  cards(state) {
    const ui = this.ui;
    let projects = state.projects.filter((item) => (ui.status === "all" ? true : item.status === ui.status));
    if (ui.search) {
      const q = ui.search.toLowerCase();
      projects = projects.filter((item) => item.name.toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q));
    }
    if (!projects.length) {
      return emptyState({
        icon: "folder-plus",
        title: "No projects found",
        message: "Create a project to start assigning occupancy.",
        actionLabel: can("createProject") ? "New Project" : "",
        actionId: "project",
      });
    }
    return `<div class="project-grid">${projects
      .map((project) => {
        const stats = computeProjectStats(project, state.assignments, state.members);
        return `
          <article class="card project-card" data-project="${project.id}">
            <header>
              <div>
                <div class="project-chip">${renderProjectChip(project)}</div>
                <h3 style="margin-top:10px">${escapeHtml(project.name)}</h3>
              </div>
              ${renderBadge(project.status)}
            </header>
            <p>${escapeHtml(project.description || "No description")}</p>
            <div class="stat-row"><span>Allocated</span><strong>${formatHours(stats.allocatedHours)}</strong></div>
            <div class="stat-row"><span>Team members</span><strong>${stats.memberCount}</strong></div>
            <div class="stat-row"><span>Created</span><span>${formatDate(project.createdAt)}</span></div>
            <div class="stat-row"><span>Updated</span><span>${formatDate(project.updatedAt)}</span></div>
          </article>`;
      })
      .join("")}</div>`;
  }

  markup(state) {
    return `
      <div class="page-head">
        <div>
          <h2>Projects</h2>
          <p>Understand staffing and allocated hours for every engagement.</p>
        </div>
        <div class="actions">${pageActions()}</div>
      </div>
      <div class="filters">
        <input id="q" placeholder="Search projects" value="${escapeHtml(this.ui.search)}" />
        <select id="status">
          <option value="all">All statuses</option>
          ${PROJECT_STATUSES.map((status) => `<option value="${status}" ${this.ui.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>
      ${this.cards(state)}`;
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const ui = this.ui;
    const selected = new URLSearchParams(location.search).get("project");

    store.subscribe((state) => {
      const paint = () => {
        app.innerHTML = renderShell("projects", this.markup(state));
        bindShell(state);
        wire();
      };
      const openProject = (projectId) => {
        const project = state.projects.find((item) => item.id === projectId);
        if (!project) return;
        const drawer = openDrawer({ title: project.name, body: renderProjectDetails(state, project) });
        refreshIcons(drawer.root);
        drawer.root.addEventListener("click", async (event) => {
          const editAssign = event.target.closest("[data-edit-assign]");
          const pause = event.target.closest("[data-pause]");
          const remove = event.target.closest("[data-remove]");
          if (event.target.closest("[data-action=assign]")) {
            drawer.close();
            openAssignModal(state, { projectId: project.id });
          }
          if (event.target.closest("[data-action=edit]")) {
            drawer.close();
            openProjectModal(state, project);
          }
          if (event.target.closest("[data-action=archive]")) {
            const ok = await confirmDialog({
              title: "Archive project",
              message: `Archive ${project.name}? It will be hidden from default project views.`,
              confirmText: "Archive",
              danger: true,
            });
            if (!ok) return;
            try {
              await ProjectService.update(project, { status: "archived" });
              showToast("Project archived.");
              drawer.close();
            } catch (error) {
              handleError(error);
            }
          }
          if (editAssign) {
            const assignment = state.assignments.find((item) => item.id === editAssign.dataset.editAssign);
            drawer.close();
            openAssignModal(state, { assignment });
          }
          if (pause) {
            const assignment = state.assignments.find((item) => item.id === pause.dataset.pause);
            await changeAssignmentStatus(state, assignment, "paused");
          }
          if (remove) {
            const assignment = state.assignments.find((item) => item.id === remove.dataset.remove);
            await changeAssignmentStatus(state, assignment, "cancelled");
          }
        });
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
        document.querySelector("[data-open=assign]")?.addEventListener("click", () => openAssignModal(state));
        document.querySelector("[data-open=member]")?.addEventListener("click", () => import("../forms.js").then((m) => m.openMemberModal(state)));
        document.querySelector("[data-open=project], [data-action=project]")?.addEventListener("click", () => openProjectModal(state));
        document.querySelectorAll("[data-project]").forEach((card) =>
          card.addEventListener("click", () => openProject(card.dataset.project))
        );
      };
      paint();
      if (selected) openProject(selected);
    });
  }
}

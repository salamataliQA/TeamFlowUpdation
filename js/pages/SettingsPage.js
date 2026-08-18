import { PERMISSIONS, DEFAULT_MANAGER_PERMISSIONS, COMPANY_NAME, AUDIT_ACTIONS } from "../constants.js";
import { createAuthUser, getCurrentUser, isAdmin, logAudit } from "../auth.js";
import { store } from "../store.js";
import { confirmDialog, emptyState, field, openModal, renderAvatar, renderBadge, showToast } from "../components.js";
import { bindShell, handleError, renderShell } from "../layout.js";
import { escapeHtml, parseNumber, validateRequired } from "../utils.js";
import { isFirebaseConfigured } from "../firebase-config.js";

function toggles(permissions, prefix) {
  return PERMISSIONS.map(
    (item) => `
      <div class="toggle">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <div style="color:var(--text-secondary);font-size:13px">${escapeHtml(item.description)}</div>
        </div>
        <button class="switch ${permissions[item.key] ? "is-on" : ""}" role="switch" aria-checked="${permissions[item.key] ? "true" : "false"}" data-perm="${item.key}" data-scope="${prefix}" aria-label="${escapeHtml(item.label)}"></button>
      </div>`
  ).join("");
}

export class SettingsPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.users = [];
    this.storeSnapshot = { settings: {}, members: [] };
  }

  markup(state, users) {
    const settings = state.settings || {};
    const defaults = { ...DEFAULT_MANAGER_PERMISSIONS, ...(settings.defaultManagerPermissions || {}) };
    const managers = users.filter((user) => user.role === "manager");
    const memberUsers = users.filter((user) => user.role === "member");
    const linked = new Set(memberUsers.map((user) => user.memberId).filter(Boolean));
    const unlinkedMembers = (state.members || []).filter((member) => !linked.has(member.id));

    return `
      <div class="page-head">
        <div>
          <h2>Settings</h2>
          <p>Company defaults, manager access, and member logins.</p>
        </div>
      </div>
      <div class="project-grid">
        <section class="card report-card">
          <h3>Workspace</h3>
          ${field("Company name", `<input id="company" value="${escapeHtml(settings.companyName || COMPANY_NAME)}" />`)}
          ${field("Default daily capacity", `<input id="capacity" type="number" min="1" max="24" step="0.5" value="${settings.defaultDailyCapacity || 8}" />`)}
          <button class="btn" id="save-workspace" style="margin-top:12px">Save workspace</button>
        </section>
        <section class="card report-card">
          <h3>Appearance</h3>
          <p>Dark mode is available from the header moon icon and is stored on this device.</p>
          <p style="margin-top:12px;color:var(--text-secondary)">Data source: <strong>${isFirebaseConfigured ? "Firebase" : "Demo / localStorage"}</strong></p>
          ${
            isFirebaseConfigured
              ? `<button class="btn secondary" id="seed-firebase" style="margin-top:12px">Load Excel demo data into Firestore</button>`
              : `<button class="btn secondary" id="reset-demo" style="margin-top:12px">Reset demo data</button>`
          }
        </section>
      </div>
      <section class="card report-card" style="margin-top:16px">
        <h3>Default manager permissions</h3>
        <p style="color:var(--text-secondary);margin-bottom:8px">Applied when a new manager is created. Existing managers keep their own toggles until you change them.</p>
        ${toggles(defaults, "default")}
      </section>
      <section class="card report-card" style="margin-top:16px">
        <div class="page-head" style="margin:0">
          <h3>Managers</h3>
          <button class="btn" id="add-manager">Create manager</button>
        </div>
        ${
          managers.length
            ? managers
                .map(
                  (user) => `
              <article class="assign-card" style="margin-top:12px">
                <header style="display:flex;justify-content:space-between;align-items:center">
                  <div class="member-cell">${renderAvatar(user.name, "sm")}<div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></div></div>
                  ${renderBadge(user.role)}
                </header>
                ${toggles({ ...DEFAULT_MANAGER_PERMISSIONS, ...(user.permissions || {}) }, user.id)}
              </article>`
                )
                .join("")
            : emptyState({ title: "No managers yet", message: "Create a manager account to delegate occupancy updates." })
        }
      </section>
      <section class="card report-card" style="margin-top:16px">
        <div class="page-head" style="margin:0">
          <h3>Member logins</h3>
          <button class="btn" id="add-member-user" ${unlinkedMembers.length ? "" : "disabled"}>Create member login</button>
        </div>
        <p style="color:var(--text-secondary);margin:8px 0 12px">A Member login can only see that person's occupancy, assignments, and extra hours.</p>
        ${
          memberUsers.length
            ? memberUsers
                .map((user) => {
                  const member = (state.members || []).find((item) => item.id === user.memberId);
                  return `<article class="assign-card" style="margin-top:12px">
                    <div class="member-cell">${renderAvatar(user.name, "sm")}<div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)} · linked to ${escapeHtml(member?.name || user.memberId || "unlinked")}</small></div></div>
                  </article>`;
                })
                .join("")
            : emptyState({ title: "No member logins", message: "Create a login and link it to a team member record." })
        }
      </section>`;
  }

  async init() {
    const app = document.querySelector(this.rootSelector);
    const page = this;
    if (!isAdmin()) {
      app.innerHTML = renderShell(
        "settings",
        emptyState({ title: "Admin only", message: "Only administrators can change permissions and workspace settings." })
      );
      bindShell();
      return;
    }

    const refreshUsers = async () => {
      this.users = await store.listUsers();
    };

    const changePermission = async (targetId, key, nextValue, previous) => {
      const ok = await confirmDialog({
        title: "Change permission?",
        message: `Are you sure you want to turn ${key} ${nextValue ? "on" : "off"}?`,
        confirmText: "Change permission",
      });
      if (!ok) return false;
      try {
        if (targetId === "default") {
          const current = { ...DEFAULT_MANAGER_PERMISSIONS, ...(this.storeSnapshot.settings?.defaultManagerPermissions || {}) };
          current[key] = nextValue;
          await store.updateSettings({ defaultManagerPermissions: current, updatedBy: getCurrentUser().id });
        } else {
          const user = this.users.find((item) => item.id === targetId);
          const permissions = { ...DEFAULT_MANAGER_PERMISSIONS, ...(user.permissions || {}), [key]: nextValue };
          await store.updateUser(targetId, { permissions });
        }
        await logAudit(AUDIT_ACTIONS.CHANGE_PERMISSION, {
          oldValue: { [key]: previous },
          newValue: { [key]: nextValue, targetId },
        });
        showToast("Permission updated.");
        return true;
      } catch (error) {
        handleError(error, "Unable to change permission.");
        return false;
      }
    };

    const wire = (state) => {
      document.querySelector("#save-workspace")?.addEventListener("click", async () => {
        try {
          await store.updateSettings({
            companyName: document.querySelector("#company").value.trim() || COMPANY_NAME,
            defaultDailyCapacity: parseNumber(document.querySelector("#capacity").value, 8),
            updatedBy: getCurrentUser().id,
          });
          showToast("Workspace saved.");
        } catch (error) {
          handleError(error);
        }
      });
      document.querySelectorAll(".switch").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const next = !btn.classList.contains("is-on");
          const changed = await changePermission(btn.dataset.scope, btn.dataset.perm, next, !next);
          if (changed) {
            btn.classList.toggle("is-on", next);
            btn.setAttribute("aria-checked", String(next));
          }
        });
      });
      document.querySelector("#reset-demo")?.addEventListener("click", async () => {
        const ok = await confirmDialog({ title: "Reset demo data?", message: "This restores the original occupancy snapshot on this browser.", confirmText: "Reset", danger: true });
        if (ok) {
          store.resetDemo();
          showToast("Demo data restored.");
        }
      });
      document.querySelector("#seed-firebase")?.addEventListener("click", async () => {
        const ok = await confirmDialog({ title: "Seed Firestore?", message: "This writes the demo members, projects, assignments, and extra hours into your Firebase project.", confirmText: "Seed data" });
        if (!ok) return;
        try {
          await store.seedDemoData(getCurrentUser());
          showToast("Demo data loaded into Firestore.");
        } catch (error) {
          handleError(error, "Unable to seed Firestore.");
        }
      });
      document.querySelector("#add-manager")?.addEventListener("click", () => {
        openModal({
          title: "Create manager",
          body: `
            <div class="form-grid">
              ${field("Full name", `<input name="name" />`)}
              ${field("Email", `<input name="email" type="email" />`)}
              ${field("Temporary password", `<input name="password" type="password" minlength="8" />`)}
            </div>`,
          footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>Create manager</button>`,
          onOpen: (root, close) => {
            root.querySelector("[data-cancel]").addEventListener("click", close);
            root.querySelector("[data-save]").addEventListener("click", async () => {
              const name = root.querySelector("[name=name]").value.trim();
              const email = root.querySelector("[name=email]").value.trim();
              const password = root.querySelector("[name=password]").value;
              if (validateRequired(name, "Name") || validateRequired(email, "Email") || password.length < 8) {
                return showToast("Name, email, and an 8+ character password are required.", "error");
              }
              try {
                const created = await createAuthUser(email, password, {
                  name,
                  role: "manager",
                  memberId: "",
                  permissions: { ...DEFAULT_MANAGER_PERMISSIONS, ...(state.settings?.defaultManagerPermissions || {}) },
                  active: true,
                });
                await logAudit(AUDIT_ACTIONS.CREATE_MANAGER, {
                  newValue: { name, email, role: "manager" },
                  targetMemberName: name,
                });
                showToast("Manager created.");
                close();
                this.users = [...this.users, created];
                render();
              } catch (error) {
                handleError(error, "Unable to create manager.");
              }
            });
          },
        });
      });
      document.querySelector("#add-member-user")?.addEventListener("click", () => {
        const linked = new Set(this.users.filter((user) => user.role === "member").map((user) => user.memberId));
        const options = (state.members || []).filter((member) => !linked.has(member.id));
        openModal({
          title: "Create member login",
          body: `
            <div class="form-grid">
              ${field("Team member", `<select name="memberId">${options.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}</select>`)}
              ${field("Email", `<input name="email" type="email" />`)}
              ${field("Temporary password", `<input name="password" type="password" minlength="8" />`)}
            </div>`,
          footer: `<button class="btn secondary" data-cancel>Cancel</button><button class="btn" data-save>Create login</button>`,
          onOpen: (root, close) => {
            root.querySelector("[data-cancel]").addEventListener("click", close);
            root.querySelector("[data-save]").addEventListener("click", async () => {
              const memberId = root.querySelector("[name=memberId]").value;
              const member = options.find((item) => item.id === memberId);
              const email = root.querySelector("[name=email]").value.trim();
              const password = root.querySelector("[name=password]").value;
              if (!member || validateRequired(email, "Email") || password.length < 8) {
                return showToast("Select a member and enter email plus an 8+ character password.", "error");
              }
              try {
                const created = await createAuthUser(email, password, {
                  name: member.name,
                  role: "member",
                  memberId: member.id,
                  permissions: {},
                  active: true,
                });
                await logAudit(AUDIT_ACTIONS.CREATE_MEMBER_USER, {
                  targetMemberId: member.id,
                  targetMemberName: member.name,
                  newValue: { email, role: "member" },
                });
                showToast("Member login created.");
                close();
                this.users = [...this.users, created];
                render();
              } catch (error) {
                handleError(error, "Unable to create member login.");
              }
            });
          },
        });
      });
    };

    const render = () => {
      app.innerHTML = renderShell("settings", this.markup(this.storeSnapshot, this.users));
      bindShell(this.storeSnapshot);
      wire(this.storeSnapshot);
    };

    await refreshUsers();
    store.subscribe((state) => {
      this.storeSnapshot = state;
      render();
    });
  }
}

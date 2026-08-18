import { occupancyLabel } from "./occupancy.js";
import { colorFromName, escapeHtml, initials, refreshIcons, trapFocus } from "./utils.js";

const toastRoot = () => {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    root.setAttribute("aria-live", "polite");
    document.body.append(root);
  }
  return root;
};

export function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  toastRoot().append(el);
  setTimeout(() => el.remove(), 3600);
}

export function renderAvatar(name, size = "") {
  const cls = size ? `avatar ${size}` : "avatar";
  return `<span class="${cls}" style="background:${colorFromName(name)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function renderBadge(status) {
  const map = {
    active: ["success", "Active"],
    paused: ["paused", "Paused"],
    completed: ["info", "Completed"],
    archived: ["neutral", "Archived"],
    removed: ["neutral", "Removed"],
    cancelled: ["neutral", "Cancelled"],
    available: ["success", occupancyLabel("available")],
    near: ["warning", occupancyLabel("near")],
    full: ["warning", occupancyLabel("full")],
    over: ["danger", occupancyLabel("over")],
    overloaded: ["danger", occupancyLabel("over")],
    none: ["neutral", occupancyLabel("none")],
    inactive: ["neutral", occupancyLabel("inactive")],
    admin: ["info", "Admin"],
    manager: ["paused", "Manager"],
    member: ["success", "Member"],
  };
  const [tone, label] = map[status] || ["neutral", status];
  return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
}

export function renderProgress(percent, tone) {
  const width = Math.min(Math.max(percent, 0), 140);
  return `<div class="progress ${tone}" style="--w:${width}%" aria-label="Utilization ${percent}%"><span></span></div>`;
}

export function occupancyRemainHtml(stats) {
  if (stats.overCapacity > 0) {
    return `<span class="remain over">${stats.overCapacity}h Over Capacity</span>`;
  }
  if (Number(stats.occupied) >= Number(stats.capacity) && Number(stats.totalWork) >= Number(stats.capacity)) {
    return `<span class="remain full">Fully Occupied</span>`;
  }
  return `<span class="remain ok">${stats.available}h Available</span>`;
}

export function assignmentActionMenu(assignment, { canEdit, canRemove }) {
  if (!canEdit && !canRemove) return "";
  return `
    <div class="dropdown action-menu">
      <button class="icon-btn" type="button" data-open-menu="${assignment.id}" aria-label="Assignment actions" aria-haspopup="true">
        <i data-lucide="more-vertical"></i>
      </button>
      <div class="menu" data-menu="${assignment.id}">
        ${canEdit ? `<button type="button" data-edit-assign="${assignment.id}">Edit</button>` : ""}
        ${canRemove && assignment.status === "active" ? `<button type="button" data-pause="${assignment.id}">Pause</button>` : ""}
        ${canRemove && assignment.status === "paused" ? `<button type="button" data-resume="${assignment.id}">Resume</button>` : ""}
        ${canRemove && assignment.status !== "cancelled" ? `<button type="button" data-remove="${assignment.id}">Remove</button>` : ""}
      </div>
    </div>`;
}

export function dateNavHtml(dateKey, label) {
  return `
    <div class="date-nav" role="group" aria-label="Occupancy date">
      <button class="icon-btn" type="button" data-day="-1" aria-label="Previous day"><i data-lucide="chevron-left"></i></button>
      <button class="btn secondary" type="button" data-today>Today</button>
      <label class="date-field">
        <span class="sr-only">Select date</span>
        <input type="date" id="occ-date" value="${dateKey}" />
      </label>
      <strong>${escapeHtml(label)}</strong>
      <button class="icon-btn" type="button" data-day="1" aria-label="Next day"><i data-lucide="chevron-right"></i></button>
    </div>`;
}

export function renderProjectChip(project, hours) {
  if (!project) return "";
  const hoursLabel = hours != null ? ` · ${hours}h` : "";
  return `<span class="project-chip"><span class="dot" style="--c:${project.color || "#2563EB"}"></span>${escapeHtml(project.name)}${hoursLabel}</span>`;
}

export function emptyState({ icon = "inbox", title, message, actionLabel, actionId }) {
  return `
    <div class="empty card">
      <i data-lucide="${icon}"></i>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button class="btn" data-action="${actionId}">${escapeHtml(actionLabel)}</button>` : ""}
    </div>`;
}

export function skeletons(count = 5) {
  return `<div class="card skeleton-wrap">${Array.from({ length: count }, () => '<div class="skeleton" style="height:46px;margin:10px 0"></div>').join("")}</div>`;
}

export function kpiSkeleton() {
  return `<div class="kpi-grid">${Array.from({ length: 6 }, () => '<div class="card kpi"><div class="skeleton"></div><div class="skeleton" style="height:28px;margin-top:12px;width:40%"></div></div>').join("")}</div>`;
}

function ensureModalRoot() {
  let root = document.querySelector(".modal-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "modal-root";
    document.body.append(root);
  }
  return root;
}

function formFingerprint(root) {
  return [...root.querySelectorAll("input, select, textarea")]
    .map((el) => `${el.name}:${el.type === "checkbox" || el.type === "radio" ? el.checked : el.value}`)
    .join("|");
}

export function clearFieldErrors(root) {
  root.querySelectorAll(".field .error").forEach((el) => el.remove());
  root.querySelectorAll(".field.is-invalid").forEach((el) => el.classList.remove("is-invalid"));
}

export function setFieldErrors(root, errors = {}) {
  clearFieldErrors(root);
  Object.entries(errors).forEach(([name, message]) => {
    if (!message) return;
    const input = root.querySelector(`[name="${name}"]`);
    const fieldEl = input?.closest(".field");
    if (!fieldEl) return;
    fieldEl.classList.add("is-invalid");
    const err = document.createElement("span");
    err.className = "error";
    err.textContent = message;
    fieldEl.append(err);
  });
}

export function closeTopModal() {
  const root = document.querySelector(".modal-root");
  const stack = root?.querySelectorAll(".modal-backdrop");
  const top = stack?.[stack.length - 1];
  if (!top) return false;
  top.dispatchEvent(new CustomEvent("teamflow:request-close"));
  return true;
}

export function closeModal() {
  const root = document.querySelector(".modal-root");
  if (!root) return;
  root.querySelectorAll(".modal-backdrop").forEach((el) => {
    el.dispatchEvent(new CustomEvent("teamflow:force-close"));
  });
  root.innerHTML = "";
}

export function openModal({ title, body, footer, onOpen, checkDirty = false }) {
  const root = ensureModalRoot();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.setAttribute("role", "presentation");
  backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <h3>${escapeHtml(title)}</h3>
          <button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>
        </header>
        <div class="body">${body}</div>
        ${footer ? `<footer>${footer}</footer>` : ""}
        <div class="unsaved-overlay" hidden>
          <div class="unsaved-card">
            <h4>You have unsaved changes.</h4>
            <p>Leave this form? Unsaved data will be lost.</p>
            <div class="unsaved-actions">
              <button class="btn" type="button" data-continue>Continue Editing</button>
              <button class="btn secondary" type="button" data-discard>Discard</button>
            </div>
          </div>
        </div>
      </div>`;
  root.append(backdrop);
  refreshIcons(backdrop);
  const dialog = backdrop.querySelector(".modal");
  const overlay = backdrop.querySelector(".unsaved-overlay");
  const release = trapFocus(dialog);
  let initial = "";
  let force = false;
  const forceClose = () => {
    force = true;
    release();
    backdrop.remove();
  };
  const requestClose = () => {
    if (checkDirty && !force && formFingerprint(backdrop) !== initial) {
      overlay.hidden = false;
      overlay.querySelector("[data-continue]")?.focus();
      return;
    }
    forceClose();
  };
  overlay.querySelector("[data-continue]")?.addEventListener("click", () => {
    overlay.hidden = true;
  });
  overlay.querySelector("[data-discard]")?.addEventListener("click", forceClose);
  backdrop.querySelector("[data-close]")?.addEventListener("click", requestClose);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) requestClose();
  });
  backdrop.addEventListener("teamflow:request-close", requestClose);
  backdrop.addEventListener("teamflow:force-close", forceClose);
  onOpen?.(backdrop, requestClose, forceClose);
  requestAnimationFrame(() => {
    initial = formFingerprint(backdrop);
  });
  return { root: backdrop, close: requestClose, forceClose };
}

export function confirmDialog({
  title,
  message,
  confirmText = "Confirm",
  danger = false,
}) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p>${escapeHtml(message)}</p>`,
      footer: `
        <button class="btn secondary" data-cancel>Cancel</button>
        <button class="btn ${danger ? "danger" : ""}" data-ok>${escapeHtml(confirmText)}</button>`,
      checkDirty: false,
      onOpen(root, close) {
        root.querySelector("[data-cancel]").addEventListener("click", () => {
          close();
          resolve(false);
        });
        root.querySelector("[data-ok]").addEventListener("click", () => {
          close();
          resolve(true);
        });
      },
    });
  });
}

export function openDrawer({ title, body }) {
  let root = document.querySelector(".drawer-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "drawer-root";
    document.body.append(root);
  }
  root.innerHTML = `
    <div class="drawer-backdrop">
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <h3>${escapeHtml(title)}</h3>
          <button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>
        </header>
        <div class="body">${body}</div>
      </aside>
    </div>`;
  document.body.classList.add("drawer-open");
  refreshIcons(root);
  const close = () => {
    root.innerHTML = "";
    document.body.classList.remove("drawer-open");
  };
  root.querySelector("[data-close]").addEventListener("click", close);
  root.querySelector(".drawer-backdrop").addEventListener("click", (event) => {
    if (event.target.classList.contains("drawer-backdrop")) close();
  });
  return { root, close };
}

export function field(label, control, error = "") {
  return `<label class="field"><span>${escapeHtml(label)}</span>${control}${error ? `<span class="error">${escapeHtml(error)}</span>` : ""}</label>`;
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (closeTopModal()) return;
  const drawer = document.querySelector(".drawer-root");
  if (drawer && drawer.innerHTML.trim()) {
    drawer.innerHTML = "";
    document.body.classList.remove("drawer-open");
  }
});

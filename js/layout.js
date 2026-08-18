import { COMPANY_NAME, PAGE_TITLES, PRODUCT_NAME, PRODUCT_SUBTITLE } from "./constants.js";
import { getCurrentUser, logout } from "./auth.js";
import { can, visibleNav } from "./permissions.js";
import { store } from "./store.js";
import {
  applyTheme,
  assetPath,
  escapeHtml,
  getStoredTheme,
  pagePath,
  refreshIcons,
} from "./utils.js";
import { renderAvatar, showToast } from "./components.js";
import { formatDateTime } from "./utils.js";

let lastState = { members: [], projects: [], assignments: [] };

export function renderShell(activePage, content) {
  const pageTitle = PAGE_TITLES[activePage];
  document.title = pageTitle ? `${COMPANY_NAME} | ${pageTitle}` : COMPANY_NAME;
  const user = getCurrentUser();
  const nav = visibleNav(user)
    .map(
      (item) => `
        <a class="nav-link ${item.id === activePage ? "is-active" : ""}" href="${pagePath(item.href)}">
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </a>`
    )
    .join("");

  return `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <div class="brand-mark">SC</div>
          <div>
            <h1>${PRODUCT_NAME}</h1>
            <p>${PRODUCT_SUBTITLE}</p>
          </div>
          <button class="icon-btn sidebar-close" id="sidebar-close" aria-label="Close navigation"><i data-lucide="x"></i></button>
        </div>
        <nav class="nav" aria-label="Primary">${nav}</nav>
        <div class="sidebar-foot">${COMPANY_NAME}<br>${store.mode === "demo" ? "Demo mode · local data" : "Firebase connected"}</div>
      </aside>
      <div class="overlay" id="nav-overlay"></div>
      <section class="main">
        <header class="topbar">
          <button class="menu-btn" id="menu-btn" aria-label="Open navigation"><i data-lucide="menu"></i></button>
          <button class="icon-btn search-toggle" id="search-toggle" aria-label="Search"><i data-lucide="search"></i></button>
          <div class="search" id="search-box">
            <i data-lucide="search"></i>
            <label class="sr-only" for="global-search">Search</label>
            <input id="global-search" placeholder="Search people or projects" autocomplete="off" />
            <div class="global-results" id="global-results"></div>
          </div>
          <div class="actions">
            <button class="icon-btn" id="theme-btn" aria-label="Toggle dark mode"><i data-lucide="moon"></i></button>
            <div class="dropdown">
              <button class="icon-btn" id="notice-btn" aria-label="Notifications"><i data-lucide="bell"></i></button>
              <div class="menu notice-list" id="notice-menu"></div>
            </div>
            <div class="dropdown">
              <button class="user-chip" id="user-btn" aria-haspopup="true">
                ${renderAvatar(user.name, "sm")}
                <span>
                  <strong>${escapeHtml(user.name)}</strong>
                  <small>${escapeHtml(user.role)}</small>
                </span>
              </button>
              <div class="menu" id="user-menu">
                <button id="logout-btn"><i data-lucide="log-out"></i> Logout</button>
              </div>
            </div>
          </div>
        </header>
        <div class="page">${content}</div>
      </section>
    </div>`;
}

let documentListenersBound = false;

export function bindShell(state = lastState) {
  lastState = state;
  const sidebar = document.querySelector("#sidebar");
  const overlay = document.querySelector("#nav-overlay");
  const closeNav = () => {
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("nav-locked");
  };
  document.querySelector("#menu-btn")?.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
    overlay.classList.toggle("is-open");
    document.body.classList.toggle("nav-locked", sidebar.classList.contains("is-open"));
  });
  document.querySelector("#sidebar-close")?.addEventListener("click", closeNav);
  overlay?.addEventListener("click", closeNav);
  sidebar?.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", closeNav);
  });
  document.querySelector("#search-toggle")?.addEventListener("click", () => {
    document.querySelector("#search-box")?.classList.toggle("is-expanded");
  });

  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    refreshIcons();
  });

  document.querySelector("#logout-btn")?.addEventListener("click", () => logout());
  document.querySelector("#user-btn")?.addEventListener("click", () => {
    document.querySelector("#user-menu").classList.toggle("is-open");
  });
  document.querySelector("#notice-btn")?.addEventListener("click", async () => {
    const menu = document.querySelector("#notice-menu");
    menu.classList.toggle("is-open");
    if (menu.classList.contains("is-open")) {
      const { rows } = await store.fetchAuditLogs({});
      menu.innerHTML = rows.slice(0, 6).map((row) => `
        <div class="notice-item">
          <strong>${escapeHtml(row.action.replaceAll("_", " "))}</strong>
          <div>${escapeHtml(row.performedByName)} · ${escapeHtml(formatDateTime(row.timestamp))}</div>
        </div>`).join("") || `<div class="notice-item">No recent activity</div>`;
    }
  });

  const input = document.querySelector("#global-search");
  const results = document.querySelector("#global-results");
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      results.classList.remove("is-open");
      results.innerHTML = "";
      return;
    }
    const people = (lastState.members || [])
      .filter((item) => item.active !== false && item.name.toLowerCase().includes(q))
      .slice(0, 5);
    const projects = (lastState.projects || [])
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 5);
    results.innerHTML = [
      ...people.map((item) => `<button data-go="team.html?member=${item.id}">${escapeHtml(item.name)} · team</button>`),
      ...projects.map((item) => `<button data-go="projects.html?project=${item.id}">${escapeHtml(item.name)} · project</button>`),
    ].join("") || `<button>No matches</button>`;
    results.classList.add("is-open");
    results.querySelectorAll("button[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.href = pagePath(btn.dataset.go);
      });
    });
  });

  if (!documentListenersBound) {
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".dropdown")) {
        document.querySelectorAll(".menu").forEach((menu) => menu.classList.remove("is-open"));
      }
      if (!event.target.closest(".search")) {
        document.querySelector("#global-results")?.classList.remove("is-open");
      }
    });
    documentListenersBound = true;
  }

  refreshIcons();
}

export function pageActions() {
  const buttons = [];
  if (can("assignMember")) buttons.push(`<button class="btn" data-open="assign"><i data-lucide="plus"></i> Assign Project</button>`);
  if (can("manageTeam")) buttons.push(`<button class="btn secondary" data-open="member"><i data-lucide="user-plus"></i> Add Team Member</button>`);
  if (can("createProject")) buttons.push(`<button class="btn secondary" data-open="project"><i data-lucide="folder-plus"></i> New Project</button>`);
  return buttons.join("");
}

export function bootTheme() {
  applyTheme(getStoredTheme());
}

export function handleError(error, fallback = "Unable to load data. Please try again.") {
  console.error(error);
  const code = error?.code || "";
  if (error?.userSafe && error.message) {
    showToast(error.message, "error");
    return;
  }
  const map = {
    "permission-denied": "You don't have permission to perform this action.",
    "unavailable": "Unable to load data. Please try again.",
    "deadline-exceeded": "The request timed out. Please try again.",
    "not-found": "That record could not be found.",
    "already-exists": "A matching record already exists.",
    "network-request-failed": "Unable to load data. Please try again.",
    "failed-precondition": "Unable to save changes. No changes were applied.",
  };
  showToast(map[code] || fallback, "error");
}

void assetPath;

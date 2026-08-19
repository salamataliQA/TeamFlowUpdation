/** Formatting, validation, and small DOM helpers. */

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundHours(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

export function formatHours(value) {
  const hours = roundHours(value);
  const formatted = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${formatted}h`;
}

export function formatPercent(value) {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return `${n}%`;
  return `${n.toFixed(1)}%`;
}

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value, options = { dateStyle: "medium" }) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Local calendar key YYYY-MM-DD — never use UTC toISOString().slice(0,10). */
export function dateKeyFromLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return dateKeyFromLocal(new Date());
}

export function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey || todayKey()).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateKey, amount) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + amount);
  return dateKeyFromLocal(date);
}

export function formatDateKey(dateKey, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!dateKey) return "—";
  return new Intl.DateTimeFormat("en-US", options).format(dateFromKey(dateKey));
}

export function weekRange(dateKey) {
  const date = dateFromKey(dateKey);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(dateKey, mondayOffset);
  return { start, end: addDays(start, 6) };
}

export function monthRange(dateKey) {
  const date = dateFromKey(dateKey);
  const start = dateKeyFromLocal(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = dateKeyFromLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { start, end };
}

export function daysInRange(fromKey, toKey) {
  const days = [];
  let cursor = fromKey;
  while (cursor <= toKey) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function relativeDayLabel(value) {
  const date = toDate(value);
  if (!date) return "";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.round((startToday - startDate) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(date, { month: "short", day: "numeric", year: "numeric" });
}

export function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function colorFromName(name) {
  const palette = [
    "#2563EB", "#7C3AED", "#0F766E", "#C2410C", "#BE185D",
    "#0369A1", "#4F46E5", "#15803D", "#B45309", "#9333EA",
  ];
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function uid(prefix = "id") {
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function validateHours(value) {
  if (value === "" || value === null || value === undefined) {
    return "Hours are required.";
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return "Hours must be a number.";
  if (n <= 0) return "Hours must be greater than 0.";
  if (n > 24) return "Hours cannot exceed 24 per day.";
  return "";
}

export function validateRequired(value, label) {
  if (!String(value || "").trim()) return `${label} is required.`;
  return "";
}

export function assetPath(path) {
  return `/${String(path).replace(/^\//, "")}`;
}

const PAGE_ROUTES = {
  "login.html": "/login",
  "dashboard.html": "/dashboard",
  "team.html": "/team",
  "projects.html": "/projects",
  "assignments.html": "/assignments",
  "reports.html": "/reports",
  "extra-hours.html": "/extra-hours",
  "audit-logs.html": "/audit-logs",
  "settings.html": "/settings",
};

export function withTimeout(promise, ms, message = "Request timed out.") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error(message), { code: "timeout" }));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function pagePath(file) {
  const queryIndex = file.indexOf("?");
  const path = queryIndex >= 0 ? file.slice(0, queryIndex) : file;
  const query = queryIndex >= 0 ? file.slice(queryIndex) : "";
  const route = PAGE_ROUTES[path];
  if (route) return `${route}${query}`;
  const clean = String(path).replace(/\.html$/i, "").replace(/^pages\//, "");
  return `/${clean}${query}`;
}

export function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("teamflow.theme", next);
  return next;
}

export function getStoredTheme() {
  return localStorage.getItem("teamflow.theme") || "light";
}

export function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({
      attrs: { "stroke-width": 1.75 },
    });
  }
}

export function trapFocus(container) {
  const focusable = $$(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    container
  );
  if (!focusable.length) return () => {};
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();

  function onKey(event) {
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener("keydown", onKey);
  return () => container.removeEventListener("keydown", onKey);
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function setButtonLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${escapeHtml(label || "Saving...")}`;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;
  }
}

export function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

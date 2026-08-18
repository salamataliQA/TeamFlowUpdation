import { ADMIN_PERMISSIONS, DEFAULT_MANAGER_PERMISSIONS } from "./constants.js";
import { getCurrentUser, isAdmin, isMember } from "./auth.js";

export function getPermissions(user = getCurrentUser()) {
  if (!user) {
    return Object.fromEntries(Object.keys(DEFAULT_MANAGER_PERMISSIONS).map((key) => [key, false]));
  }
  if (isAdmin(user)) return { ...ADMIN_PERMISSIONS };
  if (isMember(user)) return Object.fromEntries(Object.keys(DEFAULT_MANAGER_PERMISSIONS).map((key) => [key, false]));
  return { ...DEFAULT_MANAGER_PERMISSIONS, ...(user.permissions || {}) };
}

export function can(permission, user = getCurrentUser()) {
  if (isAdmin(user)) return true;
  if (isMember(user)) return false;
  return Boolean(getPermissions(user)[permission]);
}

export function canAssignWork(user = getCurrentUser()) {
  return isAdmin(user) || (!isMember(user) && can("assignMember", user));
}

export function canManageExtraHours(user = getCurrentUser()) {
  return isAdmin(user) || can("manageExtraHours", user);
}

export const staffNav = [
  { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "layout-dashboard" },
  { id: "team", label: "Team Members", href: "team.html", icon: "users" },
  { id: "projects", label: "Projects", href: "projects.html", icon: "folder-kanban" },
  { id: "assignments", label: "Assignments", href: "assignments.html", icon: "git-merge" },
  { id: "reports", label: "Reports", href: "reports.html", icon: "bar-chart-3" },
  { id: "extra", label: "Extra Hours", href: "extra-hours.html", icon: "timer", permission: "manageExtraHours", adminAlways: true },
  { id: "audit", label: "Audit Logs", href: "audit-logs.html", icon: "scroll-text", permission: "viewAuditLogs" },
  { id: "settings", label: "Settings", href: "settings.html", icon: "settings", adminOnly: true },
];

export const memberNav = [
  { id: "dashboard", label: "My Dashboard", href: "dashboard.html", icon: "layout-dashboard" },
  { id: "assignments", label: "My Assignments", href: "assignments.html", icon: "git-merge" },
  { id: "reports", label: "My Reports", href: "reports.html", icon: "bar-chart-3" },
  { id: "extra", label: "My Extra Hours", href: "extra-hours.html", icon: "timer" },
];

export const navItems = staffNav;

export function visibleNav(user = getCurrentUser()) {
  if (isMember(user)) return memberNav;
  return staffNav.filter((item) => {
    if (item.adminOnly) return isAdmin(user);
    if (item.adminAlways && isAdmin(user)) return true;
    if (item.permission) return can(item.permission, user);
    return true;
  });
}

export function assertCan(permission) {
  if (!can(permission)) {
    const error = new Error("You do not have permission to perform this action.");
    error.code = "permission-denied";
    throw error;
  }
}

export function assertStaff() {
  const user = getCurrentUser();
  if (isMember(user) || (!isAdmin(user) && user?.role !== "manager")) {
    const error = new Error("Only Admin and Manager can perform this action.");
    error.code = "permission-denied";
    throw error;
  }
}

export function ownMemberId(user = getCurrentUser()) {
  return user?.memberId || "";
}

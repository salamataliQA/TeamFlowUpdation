/** Shared field, duplicate, and hours validation. Services throw AppError so UI never writes invalid data. */

import { ASSIGNMENT_STATUSES, PROJECT_STATUSES, ROLES } from "./constants.js";
import { isValidEmail } from "./utils.js";

export class AppError extends Error {
  constructor(message, code = "validation-error") {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.userSafe = true;
  }
}

export function validatePositiveHours(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "Hours are required.";
  if (!/^-?\d+(\.\d+)?$/.test(text)) return "Hours must be a number.";
  const n = Number(text);
  if (!Number.isFinite(n)) return "Hours must be a number.";
  if (n === 0) return "Hours must be greater than 0.";
  if (n < 0) return "Hours cannot be negative.";
  if (n > 24) return "Hours cannot exceed 24 per day.";
  return "";
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

export function validateMemberPayload(data, members = [], existingId = "") {
  const errors = {};
  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const designation = String(data.designation || "").trim();
  if (!name) errors.name = "Full name is required.";
  if (!email) errors.email = "Email is required.";
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
  if (!designation) errors.designation = "Designation is required.";
  const capacity = Number(data.weeklyCapacity);
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 24) {
    errors.weeklyCapacity = "Daily capacity must be between 1 and 24 hours.";
  }
  const emailKey = normalizeEmail(email);
  const duplicateEmail = members.find(
    (item) => item.id !== existingId && normalizeEmail(item.email) && normalizeEmail(item.email) === emailKey
  );
  if (!errors.email && duplicateEmail) {
    errors.email = "A team member with this email already exists.";
  }
  const duplicateName = members.find(
    (item) => item.id !== existingId && normalizeName(item.name) === normalizeName(name) && normalizeEmail(item.email) === emailKey
  );
  if (!errors.name && duplicateName) {
    errors.name = "A team member with this name and email already exists.";
  }
  return errors;
}

export function validateProjectPayload(data, projects = [], existingId = "") {
  const errors = {};
  const name = String(data.name || "").trim();
  if (!name) errors.name = "Project name is required.";
  if (data.status && !PROJECT_STATUSES.includes(data.status)) {
    errors.status = "Select a valid project status.";
  }
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.endDate = "End date cannot be before start date.";
  }
  const duplicate = projects.find(
    (item) =>
      item.id !== existingId &&
      item.status !== "archived" &&
      normalizeName(item.name) === normalizeName(name)
  );
  if (!errors.name && duplicate) {
    errors.name = "A project with this name already exists.";
  }
  return errors;
}

export function validateAssignmentPayload(data, context = {}) {
  const errors = {};
  const { members = [], projects = [], assignments = [], existingId = "" } = context;
  if (!data.memberId) errors.memberId = "Team member is required.";
  if (!data.projectId) errors.projectId = "Project is required.";
  if (!data.date) errors.date = "Assignment date is required.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = "Use YYYY-MM-DD for the assignment date.";
  const hoursError = validatePositiveHours(data.allocatedHoursRaw ?? data.allocatedHours);
  if (hoursError) errors.allocatedHours = hoursError;
  if (data.status && !ASSIGNMENT_STATUSES.includes(data.status)) {
    errors.status = "Select a valid assignment status.";
  }
  const member = members.find((item) => item.id === data.memberId);
  const project = projects.find((item) => item.id === data.projectId);
  if (data.memberId && !member) errors.memberId = "Team member is required.";
  if (member && member.active === false) errors.memberId = "Inactive members cannot receive assignments.";
  if (data.projectId && !project) errors.projectId = "Project is required.";
  if (project && project.status === "archived") errors.projectId = "Archived projects cannot receive assignments.";
  const duplicate = assignments.find(
    (item) =>
      item.id !== existingId &&
      item.memberId === data.memberId &&
      item.projectId === data.projectId &&
      item.date === data.date &&
      item.status !== "cancelled" &&
      item.status !== "removed"
  );
  if (!errors.memberId && !errors.projectId && !errors.date && duplicate) {
    errors.date = "An assignment for this member/project/date already exists.";
  }
  return errors;
}

export function validateExtraHoursPayload(data, context = {}) {
  const errors = {};
  const { members = [] } = context;
  if (!data.memberId) errors.memberId = "Team member is required.";
  if (!data.date) errors.date = "Date is required.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = "Use YYYY-MM-DD.";
  const hoursError = validatePositiveHours(data.hoursRaw ?? data.hours);
  if (hoursError) errors.hours = hoursError;
  if (!String(data.reason || "").trim()) errors.reason = "Reason is required.";
  const member = members.find((item) => item.id === data.memberId);
  if (data.memberId && member && member.active === false) {
    errors.memberId = "Inactive members cannot receive extra hours.";
  }
  return errors;
}

export function validateUserRole(role) {
  const allowed = Object.values(ROLES);
  if (!role) return "Role is required.";
  if (!allowed.includes(role)) return "Select a valid application role: Admin, Manager, or Member.";
  return "";
}

export function firstError(errors) {
  return Object.values(errors).find(Boolean) || "";
}

export function throwIfInvalid(errors) {
  const message = firstError(errors);
  if (message) throw new AppError(message);
}

import { store } from "../store.js";

export const AuditService = {
  fetch: (filters) => store.fetchAuditLogs(filters),
};

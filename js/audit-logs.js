import { startAuthenticatedPage } from "./boot.js";
import { bootTheme } from "./layout.js";
import { AuditLogsPage } from "./pages/AuditLogsPage.js";

bootTheme();

startAuthenticatedPage(async () => {
  await new AuditLogsPage("#app").init();
}, { staff: true });

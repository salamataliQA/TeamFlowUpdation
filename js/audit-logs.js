import { requireStaff } from "./auth.js";
import { bootTheme } from "./layout.js";
import { AuditLogsPage } from "./pages/AuditLogsPage.js";

bootTheme();

async function main() {
  await requireStaff();
  await new AuditLogsPage("#app").init();
}

main();

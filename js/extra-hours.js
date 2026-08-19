import { isMember } from "./auth.js";
import { startAuthenticatedPage } from "./boot.js";
import { canManageExtraHours } from "./permissions.js";
import { bootTheme, bindShell, renderShell } from "./layout.js";
import { emptyState } from "./components.js";
import { ExtraHoursPage } from "./pages/ExtraHoursPage.js";

bootTheme();

startAuthenticatedPage(async () => {
  if (!isMember() && !canManageExtraHours()) {
    document.querySelector("#app").innerHTML = renderShell(
      "extra",
      emptyState({ title: "Restricted", message: "You do not have permission to manage extra hours." })
    );
    bindShell();
    return;
  }
  new ExtraHoursPage("#app").init();
});

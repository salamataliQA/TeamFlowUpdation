import { DEMO_CREDENTIALS } from "./constants.js";
import { isFirebaseConfigured } from "./firebase-config.js";
import { login, redirectIfLoggedIn, resetPassword, ACCOUNT_INACTIVE_MESSAGE } from "./auth.js";
import { showToast } from "./components.js";
import { applyTheme, getStoredTheme, pagePath, refreshIcons, setButtonLoading } from "./utils.js";

applyTheme(getStoredTheme());
redirectIfLoggedIn();
refreshIcons();

const form = document.querySelector("#login-form");
const resetBtn = document.querySelector("#forgot-btn");
const demoBox = document.querySelector("#demo-box");

if (!isFirebaseConfigured && demoBox) demoBox.hidden = false;

if (new URLSearchParams(location.search).get("reason") === "inactive") {
  const banner = document.querySelector("#inactive-banner");
  if (banner) banner.hidden = false;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = form.email.value.trim();
  const password = form.password.value;
  const button = form.querySelector("button[type=submit]");
  setButtonLoading(button, true, "Signing in...");
  try {
    await login(email, password);
    window.location.href = pagePath("dashboard.html");
  } catch (error) {
    if (error.code === "account-inactive") {
      const banner = document.querySelector("#inactive-banner");
      if (banner) banner.hidden = false;
      showToast(ACCOUNT_INACTIVE_MESSAGE, "error");
      return;
    }
    const map = {
      "auth/invalid-credential": "Invalid email or password.",
      "auth/user-not-found": "No account found for that email.",
      "auth/wrong-password": "Invalid email or password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
    };
    showToast(map[error.code] || error.message || "Unable to sign in.", "error");
  } finally {
    setButtonLoading(button, false);
  }
});

resetBtn?.addEventListener("click", async () => {
  const email = form.email.value.trim();
  if (!email) return showToast("Enter your email first.", "warning");
  try {
    await resetPassword(email);
    showToast("Password reset email sent.", "info");
  } catch (error) {
    showToast(error.message, "error");
  }
});

document.querySelector("#fill-admin")?.addEventListener("click", () => {
  form.email.value = DEMO_CREDENTIALS.admin.email;
  form.password.value = DEMO_CREDENTIALS.admin.password;
});
document.querySelector("#fill-manager")?.addEventListener("click", () => {
  form.email.value = DEMO_CREDENTIALS.manager.email;
  form.password.value = DEMO_CREDENTIALS.manager.password;
});
document.querySelector("#fill-member")?.addEventListener("click", () => {
  form.email.value = DEMO_CREDENTIALS.member.email;
  form.password.value = DEMO_CREDENTIALS.member.password;
});

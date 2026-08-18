/** Read page query parameters without duplicating URL parsing in each Page Object. */

export const UrlState = {
  params() {
    return new URLSearchParams(window.location.search);
  },
  get(name, fallback = "") {
    const value = this.params().get(name);
    return value == null || value === "" ? fallback : value;
  },
  occupancyFilter(raw = this.get("status")) {
    const map = {
      "fully-occupied": "full",
      full: "full",
      available: "available",
      overloaded: "overloaded",
      over: "overloaded",
      near: "near",
      none: "none",
      active: "active",
      inactive: "inactive",
    };
    return map[raw] || "";
  },
  date(raw = this.get("date")) {
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  },
  range(raw = this.get("range")) {
    const map = {
      "this-week": "thisWeek",
      thisweek: "thisWeek",
      today: "today",
      yesterday: "yesterday",
      "last-week": "lastWeek",
      "this-month": "thisMonth",
    };
    return map[String(raw).toLowerCase()] || raw || "";
  },
};

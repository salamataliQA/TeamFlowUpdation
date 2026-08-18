import { isMember } from "../auth.js";
import { canManageExtraHours, ownMemberId } from "../permissions.js";
import { computeMemberStats, calculateWeeklyExtraHours, getActiveTeamMembers } from "../occupancy.js";
import { ExtraHoursService } from "../services/ExtraHoursService.js";
import { store } from "../store.js";
import { confirmDialog, emptyState, occupancyRemainHtml, renderAvatar } from "../components.js";
import { openExtraHoursModal } from "../forms.js";
import { bindShell, handleError, renderShell } from "../layout.js";
import { monthRange, escapeHtml, formatDateKey, formatHours, todayKey, weekRange } from "../utils.js";
import { UrlState } from "../url-state.js";

export class ExtraHoursPage {
  constructor(rootSelector = "#app") {
    this.rootSelector = rootSelector;
    this.memberId = isMember() ? ownMemberId() : "";
    this.range = UrlState.range() || "";
  }

  markup(state) {
    const viewOnly = isMember() || !canManageExtraHours();
    if (isMember() && !ownMemberId()) {
      return emptyState({
        title: "Profile not linked",
        message: "Ask an admin to link your login to a team member record.",
      });
    }
    const members = getActiveTeamMembers(state.members);
    const selected = this.memberId
      ? state.members.find((item) => item.id === this.memberId)
      : null;
    if (isMember() && selected && selected.id !== ownMemberId()) {
      return emptyState({ title: "Restricted", message: "You can only view your own extra hours." });
    }
    const dateKey = todayKey();
    const weekBounds = weekRange(dateKey);
    let extraHours = state.extraHours || [];
    if (this.range === "thisWeek") {
      extraHours = extraHours.filter((row) => row.date >= weekBounds.start && row.date <= weekBounds.end);
    }
    if (isMember()) extraHours = extraHours.filter((row) => row.memberId === ownMemberId());
    const stats = selected
      ? computeMemberStats(selected, state.assignments, extraHours, dateKey)
      : null;
    const week = selected ? calculateWeeklyExtraHours(extraHours, dateKey, selected.id) : 0;
    const month = selected
      ? extraHours
          .filter((row) => {
            const { start, end } = monthRange(dateKey);
            return row.memberId === selected.id && row.date >= start && row.date <= end;
          })
          .reduce((sum, row) => sum + Number(row.hours || 0), 0)
      : 0;
    const rows = extraHours
      .filter((row) => !this.memberId || row.memberId === this.memberId)
      .sort((a, b) => b.date.localeCompare(a.date));

    return `
      <div class="page-head">
        <div>
          <h2>${viewOnly ? "My Extra Hours" : "Extra Hours"}</h2>
          <p>${this.range === "thisWeek" ? "This week's overtime, separate from regular project occupancy." : "Track overtime separately from regular project occupancy."}</p>
        </div>
        <div class="actions">${viewOnly ? "" : `<button class="btn" data-add>Add Extra Hours</button>`}</div>
      </div>
      ${
        viewOnly
          ? ""
          : `<div class="filters">
        <label class="select">
          <span>Select member</span>
          <select id="eh-member">
            <option value="">All Members</option>
            ${members.map((item) => `<option value="${item.id}" ${item.id === this.memberId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </label>
      </div>`
      }
      ${
        stats
          ? `<section class="card report-card">
              <div class="member-cell">${renderAvatar(selected.name)}<div><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.designation || "QA Engineer")}</p></div></div>
              <div class="stat-row"><span>Regular occupied</span><strong>${formatHours(stats.occupied)}</strong></div>
              <div class="stat-row"><span>Extra hours today</span><strong>${formatHours(stats.extra)}</strong></div>
              <div class="stat-row"><span>Total worked</span><strong>${formatHours(stats.totalWork)}</strong></div>
              <div class="stat-row"><span>${stats.overCapacity > 0 ? "Over capacity" : "Available"}</span><strong>${occupancyRemainHtml(stats)}</strong></div>
              <div class="stat-row"><span>This week</span><strong>${formatHours(week)}</strong></div>
              <div class="stat-row"><span>This month</span><strong>${formatHours(month)}</strong></div>
            </section>`
          : `<section class="card report-card"><p>All members · this week ${formatHours(calculateWeeklyExtraHours(extraHours, dateKey))}</p></section>`
      }
      <section class="card" style="margin-top:16px;overflow:auto">
        <table class="audit-table">
          <thead><tr><th>Date</th><th>Member</th><th>Hours</th><th>Reason</th><th>Added by</th>${viewOnly ? "" : "<th></th>"}</tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((row) => {
                      const member = state.members.find((item) => item.id === row.memberId);
                      return `<tr>
                        <td>${escapeHtml(formatDateKey(row.date))}</td>
                        <td>${escapeHtml(member?.name || "—")}</td>
                        <td>${formatHours(row.hours)}</td>
                        <td>${escapeHtml(row.reason)}</td>
                        <td>${escapeHtml(row.addedByName || "—")}</td>
                        ${viewOnly ? "" : `<td><button class="btn ghost" data-del="${row.id}">Remove</button></td>`}
                      </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="${viewOnly ? 5 : 6}">No extra hours yet.</td></tr>`
            }
          </tbody>
        </table>
      </section>`;
  }

  init() {
    const app = document.querySelector(this.rootSelector);
    const memberId = isMember() ? ownMemberId() : "";
    store.subscribe((state) => {
      const paint = () => {
        app.innerHTML = renderShell("extra", this.markup(state));
        bindShell(state);
        document.querySelector("#eh-member")?.addEventListener("change", (event) => {
          this.memberId = event.target.value;
          paint();
        });
        document.querySelector("[data-add]")?.addEventListener("click", () =>
          openExtraHoursModal(state, { memberId: this.memberId })
        );
        document.querySelectorAll("[data-del]").forEach((btn) =>
          btn.addEventListener("click", async () => {
            const record = (state.extraHours || []).find((item) => item.id === btn.dataset.del);
            const member = state.members.find((item) => item.id === record.memberId);
            const ok = await confirmDialog({
              title: "Remove extra hours?",
              message: `Remove ${record.hours}h for ${member?.name || "this member"}?`,
              confirmText: "Remove",
              danger: true,
            });
            if (!ok) return;
            try {
              await ExtraHoursService.remove(record, member);
            } catch (error) {
              handleError(error);
            }
          })
        );
      };
      paint();
    }, memberId ? { memberId } : {});
  }
}

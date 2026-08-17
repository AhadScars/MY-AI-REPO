/**
 * Instant class / section / search filter for student & attendance tables.
 * Rows need: data-cls, data-sec, data-search
 */
(function () {
  function bindFilter(formId, tableSelector, countSelector) {
    const form = document.getElementById(formId);
    if (!form) return;

    const table = document.querySelector(tableSelector);
    if (!table) return;
    const tbody = table.tBodies[0];
    if (!tbody) return;

    const countEl = countSelector ? document.querySelector(countSelector) : null;
    const clsSel = form.querySelector('[name="cls"]');
    const secSel = form.querySelector('[name="sec"]');
    const qInput = form.querySelector('[name="q"]');
    const total = tbody.querySelectorAll("tr[data-cls]").length;

    function apply() {
      const cls = (clsSel && clsSel.value) || "";
      const sec = (secSel && secSel.value) || "";
      const q = ((qInput && qInput.value) || "").trim().toLowerCase();
      let visible = 0;

      tbody.querySelectorAll("tr[data-cls]").forEach((row) => {
        const rCls = row.getAttribute("data-cls") || "";
        const rSec = row.getAttribute("data-sec") || "";
        const hay = (row.getAttribute("data-search") || "").toLowerCase();
        let show = true;
        if (cls && rCls !== cls) show = false;
        if (sec && rSec !== sec) show = false;
        if (q && hay.indexOf(q) === -1) show = false;
        row.style.display = show ? "" : "none";
        if (show) visible += 1;
      });

      // empty message row
      tbody.querySelectorAll("tr.empty-filter-row").forEach((r) => r.remove());
      if (visible === 0) {
        const colCount = table.tHead
          ? table.tHead.rows[0].cells.length
          : 4;
        const tr = document.createElement("tr");
        tr.className = "empty-filter-row";
        tr.innerHTML =
          '<td colspan="' +
          colCount +
          '" class="empty-row">No students match these filters.</td>';
        tbody.appendChild(tr);
      }

      if (countEl) {
        countEl.textContent =
          visible === total ? String(total) : visible + " / " + total;
      }

      const summary = document.getElementById("filter-summary");
      if (summary) {
        if (cls || sec || q) {
          summary.hidden = false;
          summary.innerHTML =
            "Showing <strong>" +
            visible +
            "</strong> of " +
            total +
            (cls ? " · class <strong>" + cls + "</strong>" : "") +
            (sec ? " · section <strong>" + sec + "</strong>" : "") +
            (q ? " · search “" + q + "”" : "");
        } else {
          summary.hidden = true;
        }
      }
    }

    if (clsSel) clsSel.addEventListener("change", apply);
    if (secSel) secSel.addEventListener("change", apply);
    if (qInput) {
      qInput.addEventListener("input", apply);
      qInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          apply();
        }
      });
    }

    // Prevent full page reload on Apply — filter in place (students page)
    form.addEventListener("submit", (e) => {
      // Attendance uses GET for date/status — only block if no server action needed
      if (form.getAttribute("data-client-only") === "1") {
        e.preventDefault();
        apply();
      }
    });

    // Apply once on load (honors pre-selected dropdowns)
    apply();

    // Expose for Clear button
    form._applyFilter = apply;
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindFilter("student-filters", ".students-table", "#student-count-pill");
    // Attendance: also client-filter class/section on top of server list
    bindFilter("attendance-filters", ".students-table", "#attendance-count-pill");
  });
})();

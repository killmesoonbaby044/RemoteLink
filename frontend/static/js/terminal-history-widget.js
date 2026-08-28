// Wires up the header "History" dropdown (templates/components/history.html).
// Loaded on every page from base.html, since the header is included on
// every page. Rendering itself is shared with the host-field autosuggest
// via common/history.js -- this file only owns the open/close toggle.

import { renderHistoryList } from "./common/history.js";

function initTerminalHistory() {
    const wrapper = document.querySelector(".terminal-history");
    const toggle = document.getElementById("terminal-history-title");
    const menu = document.getElementById("terminal-history-body");

    if (!wrapper || !toggle || !menu) {
        return;
    }

    renderHistoryList(menu);

    toggle.addEventListener("click", () => {
        wrapper.classList.toggle("terminal-history-open");
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".terminal-history")) {
            wrapper.classList.remove("terminal-history-open");
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            wrapper.classList.remove("terminal-history-open");
        }
    });
}

initTerminalHistory();

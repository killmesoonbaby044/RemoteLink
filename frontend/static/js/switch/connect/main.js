// Entry point for the "Connect to device" form (templates/pages/switches.html).
// Was switches.js at the top level - moved here alongside lookup/ and
// inventory/ so all of switch scope lives in one place.

import { getRecentHosts } from "../../shared/history/store.js";
import { hasCredentials } from "../../shared/credentials/store.js";
import { createAutosuggest } from "../../common/autosuggest.js"

const connectForm = document.getElementById("connect-form");
const hostInput = document.getElementById("host");

if (hostInput) {
    createAutosuggest({
        wrapper: document.getElementById("host-wrapper"),
        input: hostInput,
        menu: document.getElementById("host-menu"),
        getItems: getRecentHosts,
    });
}

connectForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const host = hostInput.value.trim();
    if (!host) {
        return;
    }

    if (!hasCredentials()) {
        window.location.href = "/credentials";
        return;
    }

    window.location.href = `/ssh_terminal?host=${encodeURIComponent(host)}`;
});
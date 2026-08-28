import { pushHistory, getRecentHosts } from "./common/history.js";
import { hasCredentials } from "./common/credentials.js";
import { createAutosuggest } from "./common/autosuggest.js";

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

    pushHistory({ type: "ssh", host });
    window.location.href = `/terminal?host=${encodeURIComponent(host)}`;
});

const form = document.getElementById(
    "connect-form"
);

const hostInput = document.getElementById(
    "host"
);

const hostHistoryMenu = document.getElementById(
    "host-history-menu"
);


function getSshHistoryHosts() {
    const history =
        JSON.parse(localStorage.getItem("terminal_history") || "[]");

    const seen = new Set();
    const hosts = [];

    history.forEach((entry) => {
        if (entry.type === "ssh" && entry.host && !seen.has(entry.host)) {
            seen.add(entry.host);
            hosts.push(entry.host);
        }
    });

    return hosts;
}

function closeHostHistory() {
    hostHistoryMenu.classList.remove("host-history-open");
    hostHistoryMenu.innerHTML = "";
}

function openHostHistory() {
    const hosts = getSshHistoryHosts();

    if (!hosts.length) {
        closeHostHistory();
        return;
    }

    hostHistoryMenu.innerHTML = "";

    hosts.forEach((host) => {
        const row = document.createElement("div");

        row.className = "host-history-row";
        row.textContent = host;

        row.addEventListener("click", () => {
            hostInput.value = host;
            closeHostHistory();
            hostInput.focus();
        });

        hostHistoryMenu.appendChild(row);
    });

    hostHistoryMenu.classList.add("host-history-open");
}

hostInput.addEventListener("click", openHostHistory);

document.addEventListener("click", (event) => {
    if (!event.target.closest("#host-input-wrapper")) {
        closeHostHistory();
    }
});

hostInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeHostHistory();
    }
});


// --- PC search --------------------------------------------------------
// Runs the same script the "Run a script" card would (see PC_SEARCH_SCRIPT),
// over the same /ws/script endpoint app.js uses on the terminal page --
// but headless: no xterm, no /terminal navigation. It only waits for the
// "search_results" message, renders the list, then closes the socket.
// Picking one result *does* navigate to /terminal, same as any other
// script run, just with the picked name packed in as the argument.

const PC_SEARCH_SCRIPT = "search_pc"; // must match the script's name in "Run a script"

const pcSearchForm = document.getElementById("pc-search-form");
const pcSearchInput = document.getElementById("pc-search-query");
const pcSearchStatus = document.getElementById("pc-search-status");
const pcSearchResults = document.getElementById("pc-search-results");

const pcScriptsSection = document.getElementById("pc-scripts-section");
const pcScriptsTarget = document.getElementById("pc-scripts-target");
const pcScriptLinks = pcScriptsSection
    ? Array.from(pcScriptsSection.querySelectorAll(".pc-script-link"))
    : [];

function wsUrl(path) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}${path}`;
}

function setPcSearchStatus(text) {
    pcSearchStatus.textContent = text || "";
}

// Points each script in pc_scripts at this PC and reveals the block --
// same script cards as "Run a script", just with the checked PC's name
// packed in as the argument (same "name|arg" convention as everywhere
// else scripts are run with a parameter).
function showPcScripts(pcName) {
    pcScriptLinks.forEach((link) => {
        const scriptName = link.dataset.script;
        const scriptRef = `pc\\${scriptName}|${pcName}`;
        link.href = `/terminal?script=${encodeURIComponent(scriptRef)}`;
    });

    if (pcScriptsTarget) {
        pcScriptsTarget.textContent = pcName;
    }

    pcScriptsSection?.removeAttribute("hidden");
}

function hidePcScripts() {
    pcScriptsSection?.setAttribute("hidden", "");
}

function renderPcSearchResults(computers) {
    pcSearchResults.innerHTML = "";
    hidePcScripts();

    if (!computers.length) {
        setPcSearchStatus("No matches found.");
        return;
    }

    setPcSearchStatus(`${computers.length} found — check one to continue.`);

    computers.forEach((name) => {
        const item = document.createElement("li");
        item.className = "pc-search-result";

        const label = document.createElement("label");
        label.className = "pc-search-result-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "pc-search-result";
        checkbox.className = "pc-search-result-radio";
        checkbox.value = name;

        const nameSpan = document.createElement("span");
        nameSpan.className = "pc-search-result-name";
        nameSpan.textContent = name;

        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        item.appendChild(label);
        pcSearchResults.appendChild(item);

        checkbox.addEventListener("change", () => {
            const rows = pcSearchResults.querySelectorAll(".pc-search-result");
            const boxes = pcSearchResults.querySelectorAll(
                ".pc-search-result-radio"
            );

            if (checkbox.checked) {
                // Only one PC at a time -- uncheck any other.
                boxes.forEach((other) => {
                    if (other !== checkbox) {
                        other.checked = false;
                    }
                });

                // Shrink: hide every row except the checked one.
                rows.forEach((row) => {
                    row.hidden = row !== item;
                });

                showPcScripts(name);
            } else {
                // Expand: show the full list again.
                rows.forEach((row) => {
                    row.hidden = false;
                });

                hidePcScripts();
            }
        });
    });
}

function searchPc(query) {
    pcSearchResults.innerHTML = "";
    setPcSearchStatus("Searching...");

    const scriptRef = `${PC_SEARCH_SCRIPT}|${query}`;
    const socket = new WebSocket(
        wsUrl(`/ws/script?name=${encodeURIComponent(scriptRef)}`)
    );

    socket.onmessage = (event) => {
        if (typeof event.data !== "string") {
            return;
        }

        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        if (message.type === "search_results") {
            renderPcSearchResults(message.computers || []);
            socket.close();
            return;
        }

        if (message.type === "error") {
            setPcSearchStatus(message.message || "Search failed.");
            socket.close();
        }

        // "status" messages (e.g. "Starting PC...") have nowhere to go
        // here since there's no terminal — ignored on purpose.
    };

    socket.onerror = () => {
        setPcSearchStatus("WebSocket error.");
    };
}

pcSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const query = pcSearchInput.value.trim();

    if (!query) {
        return;
    }

    searchPc(query);
});


form.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const host =
            hostInput.value.trim();

        if (!host) {
            return;
        }

        const username =
            localStorage.getItem("ssh_username");

        const password =
            localStorage.getItem("ssh_password");

        if (!username || !password) {

            window.location.href =
                "/credentials";

            return;
        }

        const historyKey = "terminal_history";
        const history =
            JSON.parse(localStorage.getItem(historyKey) || "[]");

        history.unshift({
            type: "ssh",
            host: host
        });

        history.splice(10);

        localStorage.setItem(
            historyKey,
            JSON.stringify(history)
        );

        window.location.href =
            `/terminal?host=${encodeURIComponent(host)}`;
    }
);
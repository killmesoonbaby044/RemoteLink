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
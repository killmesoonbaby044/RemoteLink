// Pure DOM building for the interface-config page -- no fetching, no
// state of its own. Clicks are reported back through callbacks.

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function filterRows(rows, query) {
    const q = query.trim().toLowerCase();
    for (const row of rows) {
        row.hidden = Boolean(q) && !row.dataset.search.includes(q);
    }
}

export function renderPorts(tbody, interfaces, { selectedPort, onSelect }) {
    tbody.innerHTML = "";
    for (const iface of interfaces) {
        const tr = el("tr", "iface-port-row");
        tr.tabIndex = 0;
        tr.dataset.port = iface.port;
        tr.dataset.search = `${iface.port} ${iface.description} ${iface.vlan} ${iface.status}`.toLowerCase();
        if (iface.port === selectedPort) tr.classList.add("is-selected");

        const status = el("td", `iface-status iface-status--${iface.status.replace(/[^a-z-]/gi, "")}`, iface.status);
        const vlan = el("td", iface.vlan === "trunk" ? "iface-vlan-trunk" : "", iface.vlan);

        tr.append(el("td", "", iface.port), status, vlan, el("td", "iface-desc", iface.description));
        tr.addEventListener("click", () => onSelect(iface.port));
        tr.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(iface.port);
            }
        });
        tbody.append(tr);
    }
}

export function markSelectedPort(tbody, port) {
    for (const tr of tbody.querySelectorAll("tr")) {
        tr.classList.toggle("is-selected", tr.dataset.port === port);
    }
}

// Each running-config line is a button on access ports: clicking marks
// it for removal ("no <line>"). On a trunk the lines are read-only.
export function renderLines(container, lines, { removable, removed, onToggle }) {
    container.innerHTML = "";

    if (!lines.length) {
        container.append(el("p", "lookup-empty", "No configuration lines."));
        return;
    }

    for (const line of lines) {
        const isRemoved = removed.has(line);
        const row = el(removable ? "button" : "div", "iface-line");
        if (removable) {
            row.type = "button";
            row.setAttribute("aria-pressed", String(isRemoved));
            row.addEventListener("click", () => onToggle(line));
        } else {
            row.classList.add("is-readonly");
        }
        row.classList.toggle("is-removed", isRemoved);

        row.append(el("span", "iface-line-marker"), el("span", "iface-line-text", line));
        if (isRemoved) {
            row.append(el("span", "iface-line-no", line.startsWith("no ") ? line.slice(3) : `no ${line}`));
        }
        container.append(row);
    }
}

export function renderCommands(pre, commands) {
    pre.textContent = commands.join("\n");
}

// "show run int" style block for the result panel.
export function renderConfigBlock(pre, config) {
    pre.textContent = [`interface ${config.interface}`, ...config.lines.map((l) => ` ${l}`), "end"].join("\n");
}

export function renderErrors(list, errors) {
    list.innerHTML = "";
    list.hidden = !errors.length;
    for (const message of errors) list.append(el("li", "", message));
}

export function setStatus(node, text, isError = false) {
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle("lookup-error", isError);
}

// One "Extra lines" row: a free-text interface command plus a remove button.
export function addExtraLineRow(container, { value = "", onRemove }) {
    const row = el("div", "iface-extra-line");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "iface-extra-input";
    input.placeholder = "e.g. spanning-tree portfast";
    input.autocomplete = "off";
    input.value = value;

    const remove = el("button", "iface-extra-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove line");
    remove.addEventListener("click", () => {
        row.remove();
        onRemove();
    });

    row.append(input, remove);
    container.append(row);
    return input;
}

export function portSummaryText(iface) {
    return [iface.port, iface.status, iface.vlan === "trunk" ? "trunk" : `VLAN ${iface.vlan}`, iface.description]
        .filter(Boolean)
        .join(" · ");
}

// A step is either open (its body visible) or collapsed to a one-line
// summary with a "Change" button.
export function setStepCollapsed({ summary, body }, collapsed) {
    summary.hidden = !collapsed;
    body.hidden = collapsed;
}

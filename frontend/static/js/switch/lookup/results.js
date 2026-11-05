// Pure rendering for the lookup-results panel -- no state, no fetching,
// just "given this data (or this error), draw it into this container".

// HostTaskResult puts parsed hits under `matches` (see app/services/switch/
// runtime.py / schemas.py) - each entry has host, vlan, mac, type, interface. A host
// that ran fine but found nothing contributes no rows. A host that
// errored (unreachable, auth failure, timeout) is listed under the table,
// so "no matches" never hides a switch that wasn't actually checked.
//
// The err-disabled lookup's matches are {interface, description, reason}
// instead (ErrDisabledEntry), so it gets its own columns.
// `sources` (MacEntry.sources): which table(s) the MAC was found in.
// Shown as small colored badges, not text.
const SOURCES = {
    M: { className: "lookup-source--mac", title: "MAC address table" },
    S: { className: "lookup-source--psec", title: "Port-security table" },
};

const MAC_COLUMNS = [
    { title: "Host", key: "host", link: "terminal" },
    { title: "VLAN", key: "vlan" },
    { title: "MAC", key: "mac" },
    { title: "Interface", key: "interface", link: "interface" },
    { title: "Source", key: "sources", render: renderSources },
];

// The S badge's tooltip also names the secure type (SecureSticky, ...),
// since that's what tells sticky/configured/dynamic apart.
function renderSources(td, sources, row) {
    td.classList.add("lookup-sources");
    for (const code of sources || []) {
        const meta = SOURCES[code];
        const badge = document.createElement("span");
        badge.className = `lookup-source ${meta ? meta.className : ""}`;
        badge.textContent = code;
        badge.title = meta ? meta.title : code;
        if (code === "S" && row.type) badge.title += ` - ${row.type}`;
        badge.setAttribute("aria-label", badge.title);
        td.append(badge);
    }
}

const ERR_DISABLED_COLUMNS = [
    { title: "Host", key: "host", link: "terminal" },
    { title: "Interface", key: "interface", link: "interface" },
    { title: "Description", key: "description" },
    { title: "Reason", key: "reason" },
];

export function renderResults(resultsEl, results, { errDisabled = false } = {}) {
    const columns = errDisabled ? ERR_DISABLED_COLUMNS : MAC_COLUMNS;

    resultsEl.innerHTML = "";
    resultsEl.hidden = false;

    if (!Array.isArray(results)) {
        resultsEl.append(Object.assign(document.createElement("p"), {
            className: "lookup-empty",
            textContent: "No results.",
        }));
        return;
    }

    const rows = [];
    const failures = [];
    for (const item of results) {
        if (!item.ok) {
            failures.push(item);
            continue;
        }
        if (!Array.isArray(item.matches)) continue;
        for (const match of item.matches) {
            rows.push({
                ...match,
                host: match.host || item.host,
                hostName: item.host, // inventory name - what /switch/interface looks up
                address: item.address,
            });
        }
    }

    const checked = results.length - failures.length;
    if (!rows.length) {
        // Only claim "nothing found" when at least one switch answered.
        if (checked > 0) {
            const noun = errDisabled ? "No err-disabled ports" : "No matches found";
            resultsEl.append(Object.assign(document.createElement("p"), {
                className: "lookup-empty",
                textContent: failures.length ? `${noun} on the ${checked} reachable switch${checked === 1 ? "" : "es"}.` : `${noun}.`,
            }));
        }
        renderFailures(resultsEl, failures, results.length);
        return;
    }

    const table = document.createElement("table");
    table.className = "lookup-results-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const column of columns) {
        headRow.append(Object.assign(document.createElement("th"), { textContent: column.title }));
    }
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const row of rows) {
        const tr = document.createElement("tr");

        // An <a> can't legally wrap a <tr> (browsers will hoist it out and
        // break the table), so instead each cell's content is wrapped in a
        // full-cell link. That makes the whole row behave like a link -
        // ctrl/cmd-click, right-click "open in new tab", etc. all work.
        // Add `display: block` (plus your normal cell padding) on
        // .lookup-results-row-link in CSS so the link fills the <td>.
        const hrefs = {
            terminal: row.host
                ? `/ssh_terminal?host=${encodeURIComponent(row.address)}`
                : null,
            // Opens the interface-config page with this switch and port
            // already picked (see interface/main.js), in a new tab so the
            // lookup results stay put.
            interface: row.hostName && row.interface
                ? `/switch/interface?host=${encodeURIComponent(row.hostName)}&port=${encodeURIComponent(row.interface)}`
                : null,
        };

        for (const column of columns) {
            const value = row[column.key];
            const href = column.link && hrefs[column.link];
            const td = document.createElement("td");
            // columns are equal-width and cut long values with "…" (CSS),
            // so the full value is on hover
            if (!column.render && value) td.title = value;
            if (column.render) {
                column.render(td, value, row);
            } else if (href) {
                const link = document.createElement("a");
                link.className = "lookup-results-host-link";
                link.href = href;
                if (column.link === "interface") {
                    link.target = "_blank";
                    link.rel = "noopener";
                }
                link.textContent = value ?? "";
                td.append(link);
            } else {
                td.textContent = value ?? "";
            }
            tr.append(td);
        }
        tbody.append(tr);
    }
    table.append(tbody);

    const wrap = document.createElement("div");
    wrap.className = "lookup-results-table-wrap";
    wrap.append(table);

    resultsEl.append(wrap);
    renderFailures(resultsEl, failures, results.length);
}

// Hosts that couldn't be checked, with the reason from the backend.
function renderFailures(resultsEl, failures, total) {
    if (!failures.length) return;

    const block = document.createElement("div");
    block.className = "lookup-failures";
    block.append(Object.assign(document.createElement("p"), {
        className: "lookup-error",
        textContent: failures.length === total
            ? `Lookup failed on all ${total} switch${total === 1 ? "" : "es"}:`
            : `Couldn't check ${failures.length} of ${total} switches:`,
    }));

    const list = document.createElement("ul");
    list.className = "lookup-failures-list";
    for (const item of failures) {
        const li = document.createElement("li");
        const where = item.address ? `${item.host} (${item.address})` : item.host;
        li.append(
            Object.assign(document.createElement("span"), { className: "lookup-failures-host", textContent: where }),
            document.createTextNode(` - ${item.error || "unknown error"}`),
        );
        list.append(li);
    }
    block.append(list);
    resultsEl.append(block);
}

export function renderError(resultsEl, message) {
    resultsEl.innerHTML = "";
    resultsEl.hidden = false;
    resultsEl.append(Object.assign(document.createElement("p"), {
        className: "lookup-empty lookup-error",
        textContent: message,
    }));
}

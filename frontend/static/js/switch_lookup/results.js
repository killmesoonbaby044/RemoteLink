// Pure rendering for the lookup-results panel -- no state, no fetching,
// just "given this data (or this error), draw it into this container".

// HostTaskResult puts parsed hits under `matches` (see switch_runtime.py /
// schemas.py) - each entry has host, vlan, mac, type, interface. A host
// that errored, or that ran fine but found nothing, contributes no rows:
// the point of this view is "where was it found", not a per-host status.
export function renderResults(resultsEl, results) {
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
    for (const item of results) {
        if (!item.ok || !Array.isArray(item.matches)) continue;
        for (const match of item.matches) {
            rows.push({
                host: match.host || item.host,
                address: item.address,
                vlan: match.vlan,
                mac: match.mac,
                interface: match.interface,
            });
        }
    }

    if (!rows.length) {
        resultsEl.append(Object.assign(document.createElement("p"), {
            className: "lookup-empty",
            textContent: "No matches found.",
        }));
        return;
    }

    const table = document.createElement("table");
    table.className = "lookup-results-table";

    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Host</th><th>VLAN</th><th>MAC</th><th>Interface</th></tr>";
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
        const terminalHref = row.host
            ? `/terminal?host=${encodeURIComponent(row.address)}`
            : null;

        for (const value of [row.host, row.vlan, row.mac, row.interface]) {
            const td = document.createElement("td");
            if (terminalHref && value === row.host) {
                const link = document.createElement("a");
                link.className = "lookup-results-host-link";
                link.href = terminalHref;
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
}

export function renderError(resultsEl, message) {
    resultsEl.innerHTML = "";
    resultsEl.hidden = false;
    resultsEl.append(Object.assign(document.createElement("p"), {
        className: "lookup-empty lookup-error",
        textContent: message,
    }));
}

// Pure rendering for one search block - no fetching, no history writes.
// Takes dom refs (from dom.js) and data in, draws it, and reports back
// which entity got checked via onSelect/onDeselect so main.js decides
// what happens next (script hrefs, history).

// "user" results are labelled "display[value]" - only the bracketed
// value should ever be used as the actual entity name (script args,
// history, etc). Names without brackets ("pc" kind) pass through as-is.
export function extractEntityValue(name) {
    const match = name.match(/\[([^\]]+)\]/);
    return match ? match[1] : name;
}

export function showScripts({ dom }, name, hrefFor) {
    dom.scriptLinks.forEach((link) => {
        const scriptName = link.dataset.script;
        link.href = hrefFor(scriptName, name);
    });

    if (dom.scriptsTarget) {
        dom.scriptsTarget.textContent = name;
    }

    if (dom.scriptsSection) {
        dom.scriptsSection.dataset.targetName = name;
    }

    dom.scriptsSection?.removeAttribute("hidden");
}

export function hideScripts({ dom }) {
    dom.scriptsSection?.setAttribute("hidden", "");
}

export function renderResults({ config, dom }, names, { onSelect, onDeselect }) {
    dom.results.innerHTML = "";
    hideScripts({ dom });

    if (!names.length) {
        dom.status.textContent = "No matches found.";
        return;
    }

    dom.status.textContent = `${names.length} found — check one to continue.`;

    names.forEach((name) => {
        const row = document.createElement("label");
        row.className = "search-result-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = `${config.kind}-search-result`;
        checkbox.className = "search-result-radio";
        checkbox.value = name;

        const nameSpan = document.createElement("span");
        nameSpan.className = "search-result-name";
        nameSpan.textContent = name;

        row.appendChild(checkbox);
        row.appendChild(nameSpan);
        dom.results.appendChild(row);

        checkbox.addEventListener("change", () => {
            const rows = dom.results.querySelectorAll(".search-result-label");
            const boxes = dom.results.querySelectorAll(".search-result-radio");

            if (checkbox.checked) {
                // Only one at a time - uncheck any other.
                boxes.forEach((other) => {
                    if (other !== checkbox) {
                        other.checked = false;
                    }
                });

                // Shrink: hide every row except the checked one.
                rows.forEach((r) => {
                    r.hidden = r !== row;
                });

                onSelect(extractEntityValue(name));
            } else {
                // Expand: show the full list again.
                rows.forEach((r) => {
                    r.hidden = false;
                });

                onDeselect();
            }
        });
    });
}

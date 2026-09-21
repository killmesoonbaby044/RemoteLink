// Wires up plain (non-targeted) "Run a script" lists in the DOM. URL
// building itself lives in one place, buildScriptHref() in
// script-ref.js -- this module only finds the lists, fills in hrefs,
// and records history on click.

import { pushHistory } from "../shared/history/store.js";
import { buildScriptHref } from "./script-ref.js";

// Wires up one plain (non-targeted) "Run a script" list: fills in every
// link's href immediately from its own data-script plus the list's
// data-scope, and records a plain script run (no args) to history on
// click. Unlike the targeted lists, there's no target to wait on, so
// hrefs are set once at init time rather than on selection.
export function initScriptList(container) {
    if (!container) {
        return;
    }

    const scope = container.dataset.scope;

    if (!scope) {
        return;
    }

    const links = container.querySelectorAll(".script-link[data-script]");

    links.forEach((link) => {
        const scriptName = link.dataset.script;

        if (!scriptName) {
            return;
        }

        link.href = buildScriptHref(scope, scriptName);

        link.addEventListener("click", () => {
            pushHistory({ type: "script", scope, script: scriptName });
        });
    });
}

// Entry point for the domain "search" blocks (templates/pages/index.html).
// Was index.js + common/entity-search.js - split the same way as
// switch/lookup: config/dom/api/render here, this file just wires them
// together and loops over every entry in SEARCH_KINDS. A page missing a
// block's elements (getSearchDom returns null) is skipped.

import {getRecentSearches, pushHistory, pushSearch} from "../../shared/history/store.js";
import {createAutosuggest} from "../../common/autosuggest.js";
import {SEARCH_KINDS} from "./config.js";
import {getSearchDom} from "./dom.js";
import {scriptHrefFor, searchEntities} from "./api.js";
import {hideScripts, renderResults, showScripts} from "./render.js";

// Every initialised search block (user, PC). Used so that selecting a
// target in one block hides the scripts panel of the others - only one
// targeted scripts panel is visible at a time.
const blocks = [];

function initSearchBlock(config) {
    const dom = getSearchDom(config);

    if (!dom) {
        return;
    }

    blocks.push(dom);

    createAutosuggest({
        wrapper: dom.wrapper,
        input: dom.input,
        menu: dom.menu,
        getItems: () => getRecentSearches(config.kind),
    });

    // Recorded the same way a plain script run records itself - same
    // shared pushHistory() call, at click time, since the browser
    // already has everything the entry would carry.
    dom.scriptsSection?.addEventListener("click", (event) => {
        const link = event.target.closest(`.${dom.scriptLinkClass}`);
        if (!link) {
            return;
        }

        const scriptName = link.dataset.script;
        const targetName = dom.scriptsSection.dataset.targetName;

        if (!scriptName || !targetName) {
            return;
        }

        pushHistory({ type: "script", folder: config.kind, script: scriptName, args: targetName });
    });

    function runSearch(query, { script, recordHistory = true } = {}) {
        dom.results.innerHTML = "";
        dom.status.textContent = "Searching...";

        // The locked-users shortcut has no typed query, so it's kept out
        // of search_history:<kind> (the autosuggest store) the same way
        // ou-history.js is kept out of shared/history - it's a different
        // kind of "recent", not a name someone typed.
        if (recordHistory) {
            pushSearch(config.kind, query);
        }

        searchEntities(dom.form, query, { script })
            .then((names) => {
                renderResults({ config, dom }, names, {
                    onSelect: (name) => {
                        showScripts({ dom }, name, (scriptName, targetName) =>
                            scriptHrefFor(config.kind, scriptName, targetName));

                        // only one targeted scripts panel at a time
                        blocks
                            .filter((other) => other !== dom && other.scriptsSection)
                            .forEach((other) => hideScripts({ dom: other }));
                    },
                    onDeselect: () => hideScripts({ dom }),
                });
            })
            .catch((err) => {
                dom.status.textContent = err.message || "Search failed.";
            });
    }

    dom.form.addEventListener("submit", (event) => {
        event.preventDefault();

        const query = dom.input.value.trim();
        if (!query) {
            return;
        }

        runSearch(query);
    });

    // Optional per-kind shortcut (see config.js/dom.js) - same
    // search -> pick one -> run script flow as a name search, just
    // skips typing a query and hits data-locked-script instead of
    // data-search-script.
    dom.lockedButton?.addEventListener("click", () => {
        const lockedScript = dom.form.dataset.lockedScript;
        if (!lockedScript) {
            return;
        }

        dom.input.value = "";
        runSearch("", { script: lockedScript, recordHistory: false });
    });
}

Object.values(SEARCH_KINDS).forEach(initSearchBlock);

// Entry point for the domain "search" blocks (templates/pages/index.html).
// Was index.js + common/entity-search.js - split the same way as
// switch/lookup: config/dom/api/render here, this file just wires them
// together and loops over every entry in SEARCH_KINDS. A page missing a
// block's elements (getSearchDom returns null) is skipped.

import { getRecentSearches, pushSearch, pushHistory } from "../../shared/history/store.js";
import { createAutosuggest } from "../../common/autosuggest.js";
import { SEARCH_KINDS } from "./config.js";
import { getSearchDom } from "./dom.js";
import { searchEntities, scriptHrefFor } from "./api.js";
import { renderResults, showScripts, hideScripts } from "./render.js";

function initSearchBlock(config) {
    const dom = getSearchDom(config);

    if (!dom) {
        return;
    }

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

    function runSearch(query) {
        dom.results.innerHTML = "";
        dom.status.textContent = "Searching...";
        pushSearch(config.kind, query);

        searchEntities(dom.form, query)
            .then((names) => {
                renderResults({ config, dom }, names, {
                    onSelect: (name) =>
                        showScripts({ dom }, name, (scriptName, targetName) =>
                            scriptHrefFor(config.kind, scriptName, targetName)),
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
}

Object.values(SEARCH_KINDS).forEach(initSearchBlock);

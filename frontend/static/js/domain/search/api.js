// Network layer for one search block: the /domain/scripts request that
// runs a search, and the script-link hrefs shown once a result is
// checked. Both live here so main.js and render.js never touch fetch()
// or buildScriptHref() directly - one place knows how this feature
// talks to the rest of the app.

import { buildScriptHref } from "../../common/script-ref.js";

export async function searchEntities(form, query) {
    const searchFolder = form.dataset.searchFolder;
    const searchScript = form.dataset.searchScript;

    if (!searchFolder || !searchScript) {
        throw new Error("Search isn't configured (missing data-search-folder/data-search-script).");
    }

    const params = new URLSearchParams({
        folder: searchFolder,
        script: searchScript,
        args: query,
    });

    const response = await fetch(`/domain/scripts?${params.toString()}`, { method: "POST" });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Search failed.");
    }

    const result = await response.json();
    return result.result || [];
}

// Points one revealed script link at the checked entity. scope/script/
// args are kept as flat query params rather than packed into one value
// (see buildScriptHref in common/script-ref.js).
export function scriptHrefFor(kind, scriptName, targetName) {
    return buildScriptHref(kind, scriptName, targetName);
}

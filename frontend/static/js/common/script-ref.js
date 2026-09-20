// Shared by buildScriptHref and buildScriptSocketPath below -- the two
// query strings differ only in which path they're attached to.
function buildScriptParams(folder, script, args) {
    const params = new URLSearchParams({ folder, script });

    if (args) {
        params.set("args", args);
    }

    return params;
}

// Single place that turns (scope, script, args) into a /terminal URL.
// Both the plain "Run a script" lists (wired up by script-links.js, at
// page load) and the targeted user/PC lists (wired up by
// entity-search.js, once a target is picked) call this same function --
// so there is exactly one place a script link is ever assembled.
export function buildScriptHref(folder, script, args) {
    return `/terminal?${buildScriptParams(folder, script, args).toString()}`;
}

// Same (folder, script, args) triple, but for the /ws/script socket that
// terminal.js opens once it's landed on the page built by
// buildScriptHref() above. Keeping this next to buildScriptHref means
// there's still exactly one place these three params get encoded.
export function buildScriptSocketPath(folder, script, args) {
    return `/ws/script?${buildScriptParams(folder, script, args).toString()}`;
}


// Single place that reaches into the page for the schema block's
// elements. Returns null if `.schema-page` isn't on this page, so
// main.js can skip wiring up entirely instead of throwing.

export function getSchemaDom() {
    const page = document.querySelector(".schema-page");

    if (!page) {
        return null;
    }

    const groups = document.getElementById("schema-groups");
    const banner = document.getElementById("schema-banner");
    const filterInput = document.getElementById("schema-filter");
    const syncBtn = document.getElementById("schema-sync");
    const syncLabel = syncBtn ? syncBtn.querySelector(".schema-sync-label") : null;

    return {
        endpoint: page.dataset.endpoint,
        groups,
        banner,
        filterInput,
        syncBtn,
        syncLabel,
        syncLabelDefault: syncLabel ? syncLabel.textContent : "",
    };
}

// Config for the "search an entity, reveal its scripts" blocks on the
// domain home page (templates/pages/index.html). Both blocks are the
// same feature (see main.js) with different ids/kind - add an entry
// here to wire up another one, no other file needs to change.

export const SEARCH_KINDS = {
    user: {
        kind: "user",
        formId: "user-search-form",
        inputId: "user-search-query",
        statusId: "user-search-status",
        resultsId: "user-search-results",
        scriptsSectionId: "user-scripts-section",
        scriptsTargetId: "user-scripts-target",
    },
    pc: {
        kind: "pc",
        formId: "pc-search-form",
        inputId: "pc-search-query",
        statusId: "pc-search-status",
        resultsId: "pc-search-results",
        scriptsSectionId: "pc-scripts-section",
        scriptsTargetId: "pc-scripts-target",
    },
};

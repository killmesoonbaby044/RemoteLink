import { initEntitySearch } from "./common/entity-search.js";

initEntitySearch({
    kind: "user",
    formId: "user-search-form",
    inputId: "user-search-query",
    statusId: "user-search-status",
    resultsId: "user-search-results",
    scriptsSectionId: "user-scripts-section",
    scriptsTargetId: "user-scripts-target",
});

initEntitySearch({
    kind: "pc",
    formId: "pc-search-form",
    inputId: "pc-search-query",
    statusId: "pc-search-status",
    resultsId: "pc-search-results",
    scriptsSectionId: "pc-scripts-section",
    scriptsTargetId: "pc-scripts-target",
});

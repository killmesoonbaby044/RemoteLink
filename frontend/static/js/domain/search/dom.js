// Single place that reaches into the page for one search block's
// elements, given its config from config.js. Returns null if the
// block's required elements aren't on this page, so main.js can skip
// wiring up a block that doesn't exist here instead of throwing.

export function getSearchDom(config) {
    const form = document.getElementById(config.formId);
    const input = document.getElementById(config.inputId);
    const status = document.getElementById(config.statusId);
    const results = document.getElementById(config.resultsId);

    if (!form || !input || !status || !results) {
        return null;
    }

    const scriptsSection = document.getElementById(config.scriptsSectionId);
    const scriptsTarget = document.getElementById(config.scriptsTargetId);
    const scriptLinkClass = `${config.kind}-script-link`;

    return {
        form,
        input,
        status,
        results,
        scriptsSection,
        scriptsTarget,
        scriptLinkClass,
        scriptLinks: scriptsSection
            ? Array.from(scriptsSection.querySelectorAll(`.${scriptLinkClass}`))
            : [],
        wrapper: document.getElementById(`${config.inputId}-wrapper`),
        menu: document.getElementById(`${config.inputId}-menu`),
    };
}

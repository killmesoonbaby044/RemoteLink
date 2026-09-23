// Single place that reaches into the page for the Add user feature's
// elements (both the row list and the OU picker modal, since the modal
// only exists on this page). Returns null if the page isn't this one,
// so main.js can bail out cleanly.

export function getAddUserDom() {
    const page = document.getElementById("add-user-page");

    if (!page) {
        return null;
    }

    const rowsContainer = document.getElementById("add-user-rows");
    const rowTemplate = document.getElementById("add-user-row-template");
    const addRowBtn = document.getElementById("add-user-add-row");
    const uploadBtn = document.getElementById("add-user-upload");
    const uploadInput = document.getElementById("add-user-upload-input");
    const submitBtn = document.getElementById("add-user-submit");
    const summary = document.getElementById("add-user-summary");

    const modalOverlay = document.getElementById("ou-modal-overlay");
    const modalBack = document.getElementById("ou-modal-back");
    const modalTitle = document.getElementById("ou-modal-title");
    const modalClose = document.getElementById("ou-modal-close");
    const modalFilter = document.getElementById("ou-modal-filter");
    const modalStatus = document.getElementById("ou-modal-status");
    const modalGroups = document.getElementById("ou-modal-groups");
    const modalRecentBlock = document.getElementById("ou-modal-recent");
    const modalRecentList = document.getElementById("ou-recent-list");

    if (!rowsContainer || !rowTemplate || !addRowBtn || !submitBtn || !modalOverlay
        || !modalBack || !modalTitle || !modalClose || !modalFilter || !modalStatus
        || !modalGroups || !modalRecentBlock || !modalRecentList || !uploadInput) {
        return null;
    }

    return {
        schemaEndpoint: page.dataset.schemaEndpoint,
        submitEndpoint: page.dataset.submitEndpoint,
        uploadEndpoint: page.dataset.uploadEndpoint,
        rowsContainer,
        rowTemplate,
        addRowBtn,
        uploadBtn,
        uploadInput,
        submitBtn,
        summary,
        modalOverlay,
        modalBack,
        modalTitle,
        modalClose,
        modalFilter,
        modalStatus,
        modalGroups,
        modalRecentBlock,
        modalRecentList,
    };
}

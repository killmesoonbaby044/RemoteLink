// Single place that reaches into the page for the "MAC address lookup"
// block's elements, so the other modules just take these as params
// instead of each calling document.getElementById themselves.

export const form = document.getElementById("lookup-form");
export const macField = document.getElementById("mac-suffix-field");
export const macInput = document.getElementById("mac-suffix");
export const macWrapper = document.getElementById("mac-suffix-wrapper");
export const macMenu = document.getElementById("mac-suffix-menu");
export const actionSelect = document.getElementById("lookup-action");
export const fixedTarget = document.getElementById("lookup-fixed-target");
export const fixedBadge = document.getElementById("lookup-fixed-badge");
export const fixedName = document.getElementById("lookup-fixed-name");
export const fixedChange = document.getElementById("lookup-fixed-change");
export const targetPicker = document.getElementById("lookup-target-picker");
export const targetStatus = document.getElementById("lookup-target-status");
export const rootPointsBlock = document.getElementById("lookup-target-root-points-block");
export const rootPointsList = document.getElementById("lookup-target-root-points");
export const groupsBlock = document.getElementById("lookup-target-groups-block");
export const groupsStatus = document.getElementById("lookup-target-groups-status");
export const groupsList = document.getElementById("lookup-target-groups");
export const resultsEl = document.getElementById("lookup-results");
export const submitButton = form?.querySelector("button[type=submit]");

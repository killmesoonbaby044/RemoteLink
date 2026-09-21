// Generic "pick a root point, optionally narrow to one or more groups
// inside it" widget -- same spirit as common/autosuggest.js: takes DOM
// refs and data functions in, hands back a small API, and doesn't know
// anything about MAC lookups specifically.
//
// A root point on its own is a valid target. Groups (checkboxes, so more
// than one can be picked) narrow it down further -- if any are checked
// they win over the root point. getSelectedTargets() always returns an
// array: the checked groups, the root point as a single-item array, or
// an empty array if nothing is selected yet.

export function createTargetPicker({
    form,
    rootPointRadioName,
    targetRadioName,
    rootPointsBlock,
    rootPointsList,
    groupsBlock,
    groupsList,
    groupsStatus,
    targetStatus,
    submitButton,
    disableOnEmpty = [],
    fetchRootPoints,
    fetchRootPointGroups,
}) {
    // Tracks which root point is currently checked, purely so a click on
    // the already-checked radio can be recognized as "clear it" -- native
    // radios don't uncheck themselves on a repeat click the way
    // checkboxes do.
    let checkedRootPointValue = null;

    // Same markup/classes as the Search users / Search PC result lists
    // (see search.css: .search-results / .search-result-label / etc.)
    // so this picker looks and behaves like the rest of the app.
    function renderTargetList(container, names, inputName, inputType = "radio") {
        container.innerHTML = "";
        for (const name of names) {
            const label = document.createElement("label");
            label.className = "search-result-label";

            const input = document.createElement("input");
            input.type = inputType;
            input.className = "search-result-radio";
            input.name = inputName;
            input.value = name;

            const span = document.createElement("span");
            span.className = "search-result-name";
            span.textContent = name;

            label.append(input, span);
            container.append(label);
        }
    }

    function getSelectedTargets() {
        const checkedGroups = Array.from(
            form.querySelectorAll(`input[name="${targetRadioName}"]:checked`)
        ).map((input) => input.value);

        if (checkedGroups.length) return checkedGroups;

        const rootPoint = form.querySelector(`input[name="${rootPointRadioName}"]:checked`)?.value;
        return rootPoint ? [rootPoint] : [];
    }

    function updateSubmitAvailability() {
        if (submitButton) submitButton.disabled = getSelectedTargets().length === 0;
    }

    // Resets the groups UI, e.g. when the root point is deselected or
    // switched - there's nothing valid to show or keep checked anymore.
    function clearGroupSelection() {
        groupsBlock.hidden = true;
        groupsList.innerHTML = "";
        groupsStatus.hidden = true;
    }

    // Once a root point is checked, drill into it and show the groups it
    // contains so the lookup can be narrowed further. The root point
    // itself is already a usable target at this point (see
    // getSelectedTargets), so this is just an optional refinement, not a
    // prerequisite.
    async function loadGroupsForRootPoint(rootPointName) {
        groupsBlock.hidden = false;
        groupsList.innerHTML = "";
        groupsStatus.hidden = false;
        groupsStatus.textContent = "Loading groups…";
        updateSubmitAvailability();

        try {
            const groups = await fetchRootPointGroups(rootPointName);

            if (!groups.length) {
                groupsStatus.textContent = "This root point has no groups - you can still look up against the root point itself.";
                return;
            }

            renderTargetList(groupsList, groups, targetRadioName, "checkbox");
            groupsStatus.hidden = true;
        } catch (err) {
            groupsStatus.hidden = false;
            groupsStatus.textContent = "Failed to load groups - you can still look up against the root point itself.";
            console.error(err);
        } finally {
            updateSubmitAvailability();
        }
    }

    // Safe-check: with no root point to pick, there's nothing valid to
    // run a lookup against, so lock the rest of the form down rather
    // than just the submit button (e.g. Enter in a text field would
    // otherwise still submit).
    function lockForm(message) {
        targetStatus.textContent = message;
        disableOnEmpty.forEach((el) => { if (el) el.disabled = true; });
        if (submitButton) submitButton.disabled = true;
    }

    async function populateTargets() {
        if (!targetStatus) return;

        try {
            const rootPoints = await fetchRootPoints();

            if (!rootPoints.length) {
                lockForm("No root points found in your inventory.");
                return;
            }

            renderTargetList(rootPointsList, rootPoints, rootPointRadioName);
            rootPointsBlock.hidden = false;
            targetStatus.textContent = "";
            updateSubmitAvailability();
        } catch (err) {
            lockForm("Failed to load inventory.");
            console.error(err);
        }
    }

    rootPointsList?.addEventListener("click", (event) => {
        const input = event.target;
        if (input?.name !== rootPointRadioName) return;
        if (input.value === checkedRootPointValue) {
            input.checked = false;
            checkedRootPointValue = null;
            clearGroupSelection();
            updateSubmitAvailability();
        }
    });

    rootPointsList?.addEventListener("change", (event) => {
        if (event.target?.name !== rootPointRadioName) return;
        checkedRootPointValue = event.target.value;
        loadGroupsForRootPoint(event.target.value);
    });

    form?.addEventListener("change", (event) => {
        if (event.target?.name === rootPointRadioName || event.target?.name === targetRadioName) {
            updateSubmitAvailability();
        }
    });

    return {
        getSelectedTargets,
        updateSubmitAvailability,
        populateTargets,
    };
}

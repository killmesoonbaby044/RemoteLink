// Generic "click an input to show a list of past values, click one to
// fill the input" widget. Drives both the host-history dropdown on the
// connect form and the search-history dropdown on the PC-search form --
// same open/close/select behavior, different data source (getItems).

export function createAutosuggest({
    wrapper,
    input,
    menu,
    getItems,
    className = "autosuggest-open",
}) {
    function close() {
        menu.classList.remove(className);
        menu.innerHTML = "";
    }

    function open() {
        const items = getItems();

        if (!items.length) {
            close();
            return;
        }

        menu.innerHTML = "";

        items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "autosuggest-row";
            row.textContent = item;

            row.addEventListener("click", () => {
                input.value = item;
                close();
                input.focus();
            });

            menu.appendChild(row);
        });

        menu.classList.add(className);
    }

    input.addEventListener("click", open);

    document.addEventListener("click", (event) => {
        if (wrapper && !event.target.closest(`#${wrapper.id}`)) {
            close();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            close();
        }
    });

    return { open, close };
}

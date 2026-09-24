// Generic "click an input to show a list of past values, click one to
// fill the input" widget. Drives both the host-history dropdown on the
// connect form and the search-history dropdown on the PC-search form --
// same open/close/select behavior, different data source (getItems).
//
// Filtering: as the user types, only items that START WITH the typed text
// (case-insensitive) are listed; the matching prefix is highlighted. Empty
// input lists everything.
//
// Keyboard: ArrowDown/ArrowUp move through the list (and open it if closed),
// Enter picks the highlighted row, Escape closes. Enter with no highlighted
// row still submits the form as before.

export function createAutosuggest({
    wrapper,
    input,
    menu,
    getItems,
    className = "autosuggest-open",
}) {
    let activeIndex = -1;

    function rows() {
        return Array.from(menu.querySelectorAll(".autosuggest-row"));
    }

    function isOpen() {
        return menu.classList.contains(className);
    }

    function close() {
        menu.classList.remove(className, "autosuggest-refresh");
        menu.innerHTML = "";
        activeIndex = -1;
    }

    function matchingItems() {
        const query = input.value.trim().toLowerCase();
        const items = getItems();

        if (!query) return items;
        return items.filter((item) => String(item).toLowerCase().startsWith(query));
    }

    function select(item) {
        input.value = item;
        close();
        input.focus();
    }

    function setActive(index) {
        const list = rows();
        if (!list.length) return;

        activeIndex = (index + list.length) % list.length;

        list.forEach((row, i) => row.classList.toggle("is-active", i === activeIndex));
        list[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function open() {
        const items = matchingItems();

        if (!items.length) {
            close();
            return;
        }

        // Re-rendering while already open (typing): skip the entrance animation
        // so the list doesn't flicker on every keystroke.
        const wasOpen = isOpen();
        const prefixLength = input.value.trim().length;

        menu.innerHTML = "";
        activeIndex = -1;

        items.forEach((item) => {
            const text = String(item);
            const row = document.createElement("div");
            row.className = "autosuggest-row";

            if (prefixLength) {
                const match = document.createElement("span");
                match.className = "autosuggest-match";
                match.textContent = text.slice(0, prefixLength);
                row.append(match, text.slice(prefixLength));
            } else {
                row.textContent = text;
            }

            row.addEventListener("click", () => select(text));

            menu.appendChild(row);
        });

        menu.classList.toggle("autosuggest-refresh", wasOpen);
        menu.classList.add(className);
    }

    input.addEventListener("click", open);
    input.addEventListener("input", open);

    document.addEventListener("click", (event) => {
        if (wrapper && !event.target.closest(`#${wrapper.id}`)) {
            close();
        }
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            close();
            return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();

            if (!isOpen()) {
                open();
                if (!isOpen()) return;
            }

            setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
            return;
        }

        if (event.key === "Enter" && isOpen() && activeIndex >= 0) {
            event.preventDefault();
            select(rows()[activeIndex].textContent);
        }
    });

    return { open, close };
}
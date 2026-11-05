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
//
// Optional hooks, for lists whose row text isn't the value to fill in
// (e.g. the VLAN pickers: row "374 (USERS)", value "374"):
//   getQuery()        - the text to filter by (default: the whole input)
//   matches(item, q)  - whether a row matches (default: starts with q)
//   applyItem(item)   - what picking a row does (default: input = item)
// A pick fires a "change" event on the input, so forms listening for
// changes see it.

export function createAutosuggest({
    wrapper,
    input,
    menu,
    getItems,
    className = "autosuggest-open",
    getQuery = () => input.value,
    matches = (item, query) => item.toLowerCase().startsWith(query),
    applyItem = (item) => { input.value = item; },
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

    function currentQuery() {
        return getQuery().trim().toLowerCase();
    }

    function matchingItems() {
        const query = currentQuery();
        const items = getItems();

        if (!query) return items;
        return items.filter((item) => matches(String(item), query));
    }

    function select(item) {
        applyItem(item);
        close();
        input.focus();
        input.dispatchEvent(new Event("change", { bubbles: true }));
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
        const query = currentQuery();

        menu.innerHTML = "";
        activeIndex = -1;

        items.forEach((item) => {
            const text = String(item);
            const row = document.createElement("div");
            row.className = "autosuggest-row";

            // highlight the typed prefix (rows matched some other way,
            // e.g. by VLAN name, just aren't highlighted)
            if (query && text.toLowerCase().startsWith(query)) {
                const match = document.createElement("span");
                match.className = "autosuggest-match";
                match.textContent = text.slice(0, query.length);
                row.append(match, text.slice(query.length));
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
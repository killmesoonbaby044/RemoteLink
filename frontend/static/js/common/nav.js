(function () {
    const body = document.body;
    const toggle = document.getElementById("menu-toggle");
    const closeBtn = document.getElementById("drawer-close");
    const overlay = document.getElementById("drawer-overlay");
    const drawer = document.getElementById("site-drawer");
    if (!toggle || !drawer) return;

    function setOpen(open) {
        body.classList.toggle("drawer-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        if (open) {
            // wait for the panel to become visible before focusing
            setTimeout(() => closeBtn.focus({ preventScroll: true }), 50);
        } else {
            toggle.focus({ preventScroll: true });
        }
    }

    toggle.addEventListener("click", () => setOpen(true));
    closeBtn.addEventListener("click", () => setOpen(false));
    overlay.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && body.classList.contains("drawer-open")) setOpen(false);
    });

    // Mark the current page
    drawer.querySelectorAll(".nav-link").forEach((a) => {
        if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
    });
})();
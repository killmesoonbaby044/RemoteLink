# Frontend

```
frontend/
├── templates/     Jinja: pages/, macros/, components/, base.html
├── static/js/     ES modules, no bundler, no build step
├── static/css/
├── static/icons/
└── static/vendor/ third-party, loaded via plain <script> (currently: xterm)
```

No build tooling anywhere in `static/js/` — every page loads its entry file directly as
`<script type="module" src="...">`. `static/vendor/*` and `shared/auth/redirect.js` are
loaded as classic (non-module) scripts because they need to run before/without module
scoping (xterm exposes a global `Terminal`; redirect.js patches `window.fetch` globally).

`templates/pages/` mirrors the same scope split as `static/js/` where a scope has more than
one or two pages — the domain pages live under `templates/pages/domain/` (`domain.html`,
`domain_schema.html`, `domain_add_user.html`) rather than flat in `templates/pages/`. New
domain pages go there too; other scopes stay flat until they have enough pages to justify
the same move.

## The split

`static/js/` has four top-level folders, split by **what owns the code**, not by page:

| Folder | What goes here |
|---|---|
| `switch/` | Everything specific to the switch scope: `connect/`, `lookup/`, `inventory/` |
| `domain/` | Everything specific to the AD domain scope: `search/`, `schema/`, `add-user/` |
| `shared/` | Cross-scope **features** — their own state, DOM, endpoints, used by both scopes: `auth/`, `history/`, `credentials/`, `terminal/` |
| `common/` | Stateless **helpers** with no identity of their own — a fetch wrapper, an href builder. Don't know what app they're in. |

**Rule of thumb for new code:** does it have its own state/DOM/endpoint? → a feature
(`switch/`, `domain/`, or `shared/` if more than one scope needs it). Is it just a
function other files call? → `common/`.

`switch/` vs `domain/` vs `shared/` is a judgment call, not a hard line — e.g. `credentials`
is only consumed by `switch/` today but lives in `shared/` because the concept (SSH
credentials) isn't scope-specific, just not-yet-reused. If a `shared/` module ever ends up
with only one caller forever, that's a sign it should move into that caller's scope folder
instead.

## Module shape

Every feature folder (`switch/lookup`, `switch/inventory`, `domain/search`, `domain/schema`,
`domain/add-user`, `shared/terminal`) follows the same shape, first established in
`switch/lookup` — see its own `README_SWITCH.md` for the original write-up:

- **`config.js`** *(if the feature has real config)* — static constants: endpoint names,
  radio-group names, per-instance settings. Skip this file if there's nothing to put in it
  (single-instance features like `domain/schema` don't have one).
- **`dom.js`** — every `getElementById`/`querySelector` for this feature, in one place.
  Returns `null` (not throws) when the feature's elements aren't on the current page, so
  the entry file can bail out cleanly.
- **`api.js`** — every `fetch()` call this feature makes, plus anything that builds a
  request or a link (hrefs, query params). If you're tempted to call `fetch()` from
  `main.js` or `render.js`, it belongs in `api.js` instead.
- **`render.js`** — pure DOM building from data. No fetching, no history, no state beyond
  what's passed in. Talks back to the caller via callbacks (`onSelect`, `onDeselect`, etc.)
  rather than owning what happens next.
- **`main.js`** (or the feature's own name, e.g. `lookup.js`) — the entry point loaded by
  the template. Holds any mutable state, wires `dom`/`api`/`render` together, and is the
  only place that should ever wire up event listeners.

New feature, same shape. Deviating from it silently is how the codebase got messy the
first time.

A feature can outgrow the plain five files without breaking the shape — `domain/add-user`
splits off two extra files rather than bloating `main.js` or overloading `render.js`/`api.js`
with things that aren't quite pure DOM-building or fetching:

- **`upload.js`** — the "Upload file" flow (pick a file, send it, pre-fill rows from the
  result) has its own multi-step state that doesn't fit `render.js`'s "pure, no side
  effects" rule. It's still wired up *from* `main.js`, same as everything else — `main.js`
  passes it the row-management functions it needs rather than `upload.js` importing
  `main.js` back.
- **`ou-history.js`** — see "History convention" below; this is a second, deliberately
  separate history module, not a replacement for `shared/history/store.js`.

## Page → entry file map

| Template | Loads |
|---|---|
| `pages/switches.html` | `switch/connect/main.js` + `switch/lookup/lookup.js` |
| `pages/switch_inventory.html` | `switch/inventory/main.js` |
| `pages/domain/domain.html` | `domain/search/main.js` |
| `pages/domain/domain_schema.html` | `domain/schema/main.js` |
| `pages/domain/domain_add_user.html` | `domain/add-user/main.js` |
| `pages/terminal.html` | `shared/terminal/main.js` |
| `pages/credentials.html` | `shared/credentials/page.js` |
| `pages/login.html` | `shared/auth/login.js` |
| `base.html` (every page) | `shared/history/widget.js`, `shared/auth/redirect.js` |

## History convention

Every `pushHistory()` call fires **at intent** — the moment the code knows what's being
attempted (a click, or a page load with the target already known) — never after waiting
for a server confirmation or a socket to open. This was a deliberate fix (history used to
fire at 4 different moments depending on the file); keep new history calls consistent with
it rather than reintroducing a "wait for confirmation" variant.

Not everything that looks like "history" belongs in `shared/history/store.js`, though.
`domain/add-user/ou-history.js` keeps its own `domain_add_user_ou_history` localStorage key
for the OU picker's "recently used" list — by design, not oversight. It's a convenience
local to one picker, not something that should show up in the header History dropdown or
get mixed into `terminal_history`/`search_history:<kind>`. If a future feature wants a
"recent picks" list that's similarly picker-local rather than global, follow this pattern
(own key, own tiny module) instead of overloading `shared/history`.

## Known gaps

- **The plain "Run a script" list is dead.** `macros/script_list.html`'s `scope`-based
  (non-targeted) list expects `common/script_links.js`'s `initScriptList()` to fill in
  hrefs and wire click-to-history — but nothing currently calls `initScriptList()`
  anywhere, and `pages/switches.html`'s `{{ script_list(scripts) }}` call doesn't pass a
  `scope=` argument either, so `data-scope` never renders. Net effect: those links are
  `href="#"` and do nothing. Needs someone to decide the actual `scope` value the backend
  expects and wire the call into `switch/connect/main.js`.
- **`static/css`, `static/icons`, `static/vendor`** weren't part of this pass — nothing here
  describes their internal organization.

## Where things came from

This structure replaced a flat pile of top-level `.js` files (`index.js`, `switches.js`,
`terminal.js`, etc.) plus a `common/` folder that had accumulated feature logic alongside
real generic helpers. Individual files still carry a one-line comment noting what they
replaced, where that's non-obvious.
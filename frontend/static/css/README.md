# RemoteLink — UI Style Guide

A brief for generating new pages/components in this app's visual style.
Give this file (plus `base.css` and one or two existing pages as examples)
to any chat that needs to build UI for this project.

## In one sentence

A dark, industrial, editorial-poster look — condensed display headlines,
sharp square corners, thin hairline borders, one blue accent, and quiet
line-drawn motion — inspired by dark "agency/portfolio" Framer templates
(specifically the **Nakula** template on navbar.gallery), adapted into a
functional admin tool.

## Reference

- Visual reference: **Nakula** (Framer template, navbar.gallery/navbar/nakula).
  Borrowed from it: the full-height slide-in side panel with a "MENU" label,
  large uppercase link list with a drawing underline on hover, small square
  dot/marker as a recurring accent shape, and "(LABEL)" style captions in
  parentheses.
- Everything else (forms, tables, modals, toasts) is an original extension
  of that language applied to ordinary admin-tool UI, not part of the
  original template.

## Environment

- Desktop/laptop only. No mobile breakpoints, no touch-target sizing, no
  `@media (max-width: 600px)` rules — assume a mouse and a keyboard.
- Dark theme only (`color-scheme: dark`), no light-mode variant.
- Plain CSS + Jinja templates, no framework, no CSS preprocessor. Every
  page shares tokens from one `:root` in `base.css`.

## Color

All colors are CSS custom properties from `base.css` — never hardcode a
hex value in a component file except for semantic red/green
(error/success) and even those should eventually become tokens.

| Token | Use |
|---|---|
| `--color-bg` | page background, input backgrounds |
| `--color-surface` / `--color-surface-2` / `--color-surface-hover` | cards, panels, table headers, hover states (progressively lighter) |
| `--color-border` / `--color-border-strong` | hairlines; `-strong` for card/input outlines, plain for internal row dividers |
| `--color-text` / `--color-text-secondary` / `--color-text-muted` | primary / body / caption text, in that order of emphasis |
| `--color-accent` (+ `-hover`, `-active`, `-soft`) | the one accent color (blue). Used for: buttons, focus states, the small square "marker" motif, hover bars, link underlines. Nothing else is ever colored. |

Errors use `#d9534f` / `#f2b9b9` / `#e5605a` inline, success uses `#4caf7d`
/ `#4bc27a` — these are the only hardcoded colors and only for status text.

## Typography

Three font stacks, each with one job — never mix them:

- `--font-sans` — system UI font. Body copy, form inputs, buttons, table
  cells, normal UI text.
- `--font-display` — condensed uppercase headline face (`Anton` → `Bebas
  Neue` → `Oswald` → `Impact` → `Arial Narrow Bold` fallback chain). Used
  **only** for: page titles (`h1`), section/group headings, big stat
  numbers, modal titles. Always `text-transform: uppercase`, always
  `font-weight: 400` (the font itself carries the weight), tight
  `line-height: 1`.
- `--font-mono` — monospace. Used for anything that's an identifier or
  data value: usernames, hostnames, DNs, IP addresses, script names, table
  cells holding raw values.

Small uppercase captions (field labels, group counts, status pills) are
`font-size: 11–13px`, `font-weight: 500–600`, `letter-spacing: 0.06–0.1em`,
`text-transform: uppercase`, colored `--color-text-muted`.

## The "(LABEL)" convention

Field labels, counts and small subheadings are wrapped in literal
parentheses via CSS, not typed into the HTML:

```css
.field label::before { content: "("; }
.field label::after  { content: ")"; }
```

So `<label>Username</label>` renders as **(USERNAME)**. Apply this to any
new small caption-style label. Don't apply it to `h1`/section headings,
button text, or anything longer than 2–3 words.

## Shape language

- **Square corners everywhere.** `border-radius: 0` on every new
  component — cards, buttons, inputs, tables, chips, modals, tooltips.
  (Older parts of `base.css` still reference `--radius-*` tokens from a
  earlier rounded style; those tokens are legacy and shouldn't be reused
  in new work. The two circular exceptions below are deliberate.)
- **Two round exceptions:** the header's circular menu/close buttons
  (`.circle-btn`, 44px circle) and small icon-only round buttons inside
  modals (close, back, remove-row). Round is reserved for a single
  icon-only control that opens/closes/dismisses something — never for a
  card, input, or anything holding text.
- **1px hairline borders** (`--color-border` / `--color-border-strong`)
  do almost all of the visual separation. Shadows (`--shadow-sm/md`) are
  used sparingly — mainly on things that float above content (modals,
  toasts, dropdowns), not on inline cards.
- **The small square marker** (a `10px × 10px` solid `--color-accent`
  square) precedes page titles and section headings as a recurring
  signature, e.g.:

  ```css
  .page-title::before {
      content: "";
      width: 10px; height: 10px;
      background: var(--color-accent);
  }
  ```

## Interaction pattern: the left accent bar

The single most-repeated hover affordance in the app: a 2px vertical bar
in `--color-accent`, `scaleY(0)` at rest, growing to `scaleY(1)` from the
top on hover/focus, on the left edge of the hovered element:

```css
.row::before {
    content: "";
    position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px; background: var(--color-accent);
    transform: scaleY(0); transform-origin: top center;
    transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
.row:hover::before { transform: scaleY(1); }
```

Used on: table rows, list rows, script tiles, search results, tree rows,
OU-picker rows — anything list-like that's clickable. Don't use box-shadow
lift/translateY hover effects; this bar replaced that pattern everywhere.

## Interaction pattern: the square → diamond marker

A second recurring marker, distinct from the static square in front of
headings: a small **hollow square** that fills solid in `--color-accent`
and **rotates 45° into a diamond** on hover, selection, or open state.
Reads as "off/closed" when hollow and square, "on/open" when filled and
rotated.

```css
.marker {
    width: 10px; height: 10px;
    border: 1.5px solid var(--color-text-muted);
    background: transparent;
    transition: background var(--transition-base),
                border-color var(--transition-base),
                transform var(--transition-base);
}
.row:hover .marker,
.marker.is-active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    transform: rotate(45deg);
}
```

Used on: custom checkbox/radio replacements (e.g. search-result
selection), the autosuggest dropdown's row marker, the History button's
own toggle marker (hollow square that fills and rotates to a diamond when
the dropdown is open). Use this instead of a browser-default checkbox/
radio/disclosure indicator anywhere a binary or open/closed state needs a
small visual marker — it's the "off/on" counterpart to the static square
used for pure decoration in front of headings.

## Interaction pattern: the drawing underline

Big nav-style text links get an underline that grows in from one side on
hover and recedes to the other side on hover-out (`transform-origin`
flips), rather than fading:

```css
.link-text::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -8px;
    height: 2px; background: var(--color-accent);
    transform: scaleX(0); transform-origin: right center;
    transition: transform 400ms cubic-bezier(0.4, 0, 0.2, 1);
}
.link:hover .link-text::after {
    transform: scaleX(1); transform-origin: left center;
}
```

Used on: the side-menu links, tab underlines, home-page section links.

## Motion, generally

- Easing is always `cubic-bezier(0.4, 0, 0.2, 1)` (a standard
  "ease-out"-ish curve) or plain `ease` for very short things. No bounce,
  no spring, no elastic easing anywhere.
- Entrances fade up: `opacity: 0` + `translateY(12–18px)` → `opacity: 1` +
  `translateY(0)`, 400–700ms. Panels/cards/rows use `animation` with
  `both`/`backwards` fill (never leave a stacking side-effect behind —
  see gotcha below), lists stagger children by ~60–100ms via
  `animation-delay` or a `--i` custom property per item.
- Dropdowns/panels "wipe" open with `clip-path: inset(...)` rather than
  just fading, when they're a menu-like surface (History dropdown,
  autosuggest, side drawer).
- Small accent dots/squares sometimes get a slow (~3s) opacity pulse as a
  purely decorative "alive" detail (used on the inventory-hub and login
  page background motifs). This is rare — reserve it for background
  decoration, never for anything the user needs to read.
- **Always** provide a `@media (prefers-reduced-motion: reduce)` block
  that kills non-essential `animation`/`transition` declarations.
- **Gotcha to avoid:** an `animation ... both` on a card/section that sits
  next to other interactive content (e.g. two form cards side by side)
  keeps that element on its own compositing layer forever, which can make
  a dropdown from one card render *behind* the card next to it. Use
  `backwards` (not `both`) for one-shot entrance animations, and give the
  currently-focused container `:focus-within { z-index: 10; }` so its
  popovers always win.

## Layout conventions

- Content areas are card-like blocks (`.connect-section`,
  `.schema-group`, etc.): `background: var(--color-surface)`, 1px
  `--color-border`/`-strong`, square corners, generous padding (28–40px).
- Two-up layouts use CSS grid with `minmax(0, 1fr)` columns so both sides
  stay equal width. Default `align-items: start` so independent cards
  size to their own content and never stretch to match a sibling — only
  opt into `stretch` if a design explicitly calls for matched heights.
- Status/result text that can appear/disappear (a "Searching…" line, a
  loading skeleton row) should be sized so its appearance doesn't shift
  surrounding layout — reserve the space, or draw it inside existing
  padding, rather than letting it push content down.
- Tables: uppercase muted headers, 1px row dividers, the left-accent-bar
  hover, no zebra striping, no rounded cells.
- Buttons: solid `--color-accent` fill for primary actions, transparent
  with a `--color-border-strong` outline for secondary, both uppercase
  with letter-spacing, square corners, height snapped to the same grid as
  neighboring inputs (44–52px depending on context).
- Inputs: `--color-bg` or `--color-surface` fill, `--color-border-strong`
  border, focus state is a border-color change to accent **plus** an
  inset bottom border (`box-shadow: inset 0 -2px 0 var(--color-accent)`)
  rather than the browser's default outline glow.

## Decorative touches (use sparingly)

- Thin inline-SVG line-art "node/branch" diagrams (circles connected by
  1.5px stroked paths in `--color-border-strong`, with one or two nodes
  in `--color-accent`) are used as quiet background decoration on
  otherwise-empty space — a hub/choice page, the login screen's side
  margins. They're `aria-hidden`, `pointer-events: none`, sit behind
  content (`z-index: 0`), and hide below a width where they'd start
  overlapping real content instead of flanking it.
- Never use photographic images, icon packs, or filled illustrations —
  everything decorative is drawn with strokes/circles in the existing
  palette, so it never introduces a new color or visual weight.

## Accessibility baseline

- Every interactive element gets a visible `:focus-visible` state (accent
  outline, usually `2px solid var(--color-accent)` with 2–4px offset) —
  never `outline: none` without a replacement.
- Decorative SVGs/icons: `aria-hidden="true"`.
- Respect `prefers-reduced-motion` everywhere motion is added.

## What NOT to do

- Don't round corners on new components (except the two round-button
  exceptions above).
- Don't introduce a second accent color, a gradient, or a drop shadow as
  a primary decoration — depth comes from borders and the accent bar, not
  shadows.
- Don't use the default browser focus ring, default `<select>` arrow, or
  default checkbox/radio appearance — restyle to match (square markers,
  custom SVG chevrons — see `.schema-search-input`/`.lookup-section
  select` for the pattern).
- Don't add mobile-specific CSS unless explicitly asked — this app is
  desktop-only by decision.
- Don't reach for a UI framework or CSS utility library — everything is
  hand-written CSS against the shared token set in `base.css`.

## Handoff checklist for a new page

1. Reuse `base.css` tokens — don't invent new colors/radii/fonts.
2. Page title = `--font-display`, uppercase, blue square marker in front.
3. Field labels = small uppercase "(LABEL)" captions.
4. Cards = surface background, 1px border, square corners, generous
   padding.
5. Any list/table row = left accent bar on hover.
6. Any input/button = square corners, accent-color focus state.
7. Any big nav-style link = drawing underline on hover.
8. Add a fade-up entrance (`backwards` fill) for content that loads in.
9. Add a `prefers-reduced-motion` override.
10. No mobile breakpoints.
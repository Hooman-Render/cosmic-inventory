# Cosmic Inventory

Cosmic Inventory is an informative website about cosmic scale, built as a school project. It guides the user through the Solar System, the Milky Way, and intergalactic structures through two presentation modes: Solid and Glide.

## Website Preview

[Open Cosmic Inventory](https://hooman-render.github.io/cosmic-inventory/)

## Reflection & Personal Note

My name is Hooman, and I completed this project during a period of significant personal difficulty.

Despite the major ups and downs in my recent life circumstances, the loss of loved ones, and the ongoing situation in my homeland, which deeply affected my courage and motivation, I kept going. Building this website became an important escape for me. Even when it was difficult to find the strength to continue, I completed this project with real pleasure and learned a great deal throughout the process.

This website is still a work in progress. The project currently has a GitHub Pages preview, and I plan to continue improving it, apply the updates it still needs, and publish a more complete version when it is ready.

## Project Overview

- Type: Informative website
- Subject: Astronomy and cosmic scale, from the Solar System to the Milky Way and intergalactic space
- Focus: Clean structure, accessibility, and professional CSS implementation

Main project areas:

- A landing page that lets the visitor choose between Solid mode and Glide mode (`index.html:24-79`)
- Three content pages: Solar System, Milky Way, and Intergalactic (`pages/solar-system.html`, `pages/milky-way.html`, `pages/intergalactic.html`)
- A dedicated 404 recovery page for unmapped routes (`404.html:22-57`, `css/style.css:3165-3598`)
- A shared visual system driven by CSS custom properties and reusable layout components (`css/style.css:54-182`)

## Latest Development: 404 Page

The project now includes a dedicated `404.html` page for unmapped routes instead of relying on a JavaScript redirect. The document is intentionally marked with `noindex` so error routes stay out of search results (`404.html:7-19`).

The recovery flow is kept simple on purpose. A regular `Call Home` link returns the visitor to `index.html`, while the decorative `404` layer is set to `pointer-events: none` and the action block keeps its own stacking context so the button remains clickable (`404.html:25-40`, `css/style.css:3235-3254`, `css/style.css:3293-3303`).

The styling follows the same shared token system and responsive layout rules as the rest of the site, so the error page feels consistent with the landing experience rather than looking like a disconnected fallback (`css/style.css:3170-3358`, `css/style.css:3578-3598`).

## Requirements Checklist

Checked against the current codebase:

- ✅ Responsive & Mobile First: Base layout styles are defined before the breakpoints (`css/style.css:246-353`, `css/style.css:610-642`), then adapted with responsive media queries at `css/style.css:3210`, `css/style.css:3748`, `css/style.css:4245`, and `css/style.css:4254`.
- ✅ Flexbox & Grid: Flexbox is used in `.top-controls` (`css/style.css:330-353`) and `.nav-bar` (`css/style.css:611-641`). Grid is used in `.settings-intensity-main` (`css/style.css:1057-1062`) and `.landing-modes` (`css/style.css:2955-2964`).
- ✅ Desktop Layout: The landing page uses a two-column layout in `.landing-modes` (`css/style.css:2955-2964`), and the desktop content grid expands to three columns in `.astra-grid` (`css/style.css:4065-4071`).
- ✅ Custom Properties: Design tokens such as `--color-primary`, `--font-size-base`, and `--spacing-md` are defined in `:root` (`css/style.css:54-182`).
- ✅ Typography: The body uses `line-height: 1.5` (`css/style.css:246-250`), while headings use tighter line-height values in `css/style.css:267-294`.
- ✅ Spacing (em/rem): `em` is used for text-based spacing and typographic detail in `css/style.css:301-315` and `css/style.css:1069-1076`, while `rem` is used for layout spacing and sizing tokens in `css/style.css:171-180` and component spacing such as `css/style.css:341`.
- ✅ Selectors: `::selection` is implemented in `css/style.css:296-299`, and link hover/focus styling is implemented in `css/style.css:312-315`.
- ✅ Vendor Prefixes: Browser prefixes are present throughout the stylesheet, for example `-webkit-text-size-adjust`, `-moz-text-size-adjust`, and `-ms-text-size-adjust` in `css/style.css:186-191`, plus prefixed backdrop and transform rules such as `css/style.css:350-351` and `css/style.css:418-420`.

## HTML and CSS Working Together

The project uses semantic HTML to establish a clear content structure. The landing page is organized with `<main>`, `<header>`, `<section>`, `<aside>`, and `<footer>` (`index.html:24-86`). The content pages continue that approach with a semantic hero, structured content regions, card-based articles, and expandable details (`pages/solar-system.html:121-170`, `pages/solar-system.html:610-793`).

Accessibility is part of the structure rather than an afterthought. Examples include `aria-label` values in the top controls and navigation (`pages/solar-system.html:44-59`), screen-reader-only headings on the landing page (`index.html:36-37`), and dialog-based popups with `role="dialog"`, `aria-modal`, `aria-controls`, and `aria-expanded` (`pages/solar-system.html:170-179`, `pages/solar-system.html:179-183`).

CSS turns that semantic structure into a fluid responsive layout. The stylesheet starts with a central token system for colors, typography, spacing, shadows, and radius values (`css/style.css:55-181`). Those tokens are then reused across the full site to keep the design consistent. Flexbox is applied where alignment and flow matter most, such as the top controls and navigation, while Grid handles denser UI patterns such as settings layouts, landing cards, and desktop card grids (`css/style.css:330-353`, `css/style.css:1057-1062`, `css/style.css:2955-2963`, `css/style.css:4066-4070`).

The responsive approach relies on strong base rules first and targeted breakpoint adjustments later. In practice, this means the same HTML content can shift from compact mobile layouts to wider desktop presentations without changing the document structure itself. The result is a cleaner codebase and a more maintainable front-end.

## JavaScript Analysis

JavaScript was not strictly required for the core assignment, but it adds substantial value to the website and makes the experience much more polished.

### 1. Mode switching and persistence

The website supports two presentation modes, Solid and Glide. JavaScript updates the page state through `data-mode`, synchronizes the toggle UI, and stores the chosen mode in `localStorage` so the preference follows the visitor across pages (`js/script.js:408-443`).

This adds value because the site feels connected and intentional rather than behaving like separate disconnected pages.

### 2. Deferred particles system

The particles layer is loaded with performance in mind. The script delays booting until after paint or idle time, reacts to visibility changes, and stores both the enabled state and intensity in `localStorage` (`js/script.js:117-152`, `js/script.js:246-280`).

This adds value because the visual atmosphere can be richer without forcing unnecessary work during the first paint, especially on smaller devices.

### 3. Responsive navigation logic

The navigation is not static. JavaScript manages active states, expanded and collapsed behavior, the moving indicator, and outside-click closing for both mobile and desktop (`js/script.js:520-678`, `js/script.js:810-819`).

This adds value because the nav behaves like an interface system rather than a simple list of links, while still using real HTML links underneath.

### 4. Settings flyout

The settings panel is dynamically created and positioned with JavaScript, and it controls particles and particles intensity (`js/script.js:793-1158`).

This adds value because it keeps the UI cleaner by only opening controls when they are relevant, especially in Glide mode.

### 5. Scroll-driven Glide set module

The Glide view is one of the strongest technical parts of the project. The script reads each content item, maps theme tokens, updates the shared preview, and calculates focus states while the user scrolls (`js/script.js:1178-1537`).

This adds value because the same content is transformed into a more immersive, story-driven mode without duplicating the information architecture.

### 6. Popups, overlays, and focus behavior

The card system includes popup dialogs, overlay cards, hover and focus states, outside-click closing, and Escape-key support (`js/script.js:1538-1738`).

This adds value because it improves both usability and accessibility. The user gets richer detail views, while the script still returns focus and keeps interactions under control.

### 7. Utility interactions

Small but important enhancements are also handled in JavaScript, such as the back-to-top button (`js/script.js:1165-1175`) and the focus-mode behavior inside the card grid (`js/script.js:1544-1605`).

These details help the project feel complete and professional, even though they go beyond the minimum technical requirement.

## Transparency About AI Use

I would like to be transparent about my workflow for this project. While the core HTML structure, CSS styling, and JavaScript logic were developed by me as part of my learning process, I used AI as a collaborative tool to:

- Analyze and audit my code against the school's requirements checklist.
- Assist in structuring this README documentation.

Using AI in this way helped me stay organized and focused during a challenging time, and it allowed me to better document the technical decisions I made throughout the build.

## Final Note

This project reflects both technical growth and personal perseverance. It began as a school assignment, but it also became a place where I could keep building, learning, and moving forward during a difficult time. For that reason, Cosmic Inventory means a great deal to me, and I intend to keep improving it.

I would like to close with a reflection that stayed with me while my thoughts were often with my homeland:

"Human beings are members of a whole,
In creation of one essence and soul.
If one member is afflicted with pain,
Other members uneasy will remain.
If you've no sympathy for human pain,
The name of human you cannot retain."

"Saadi Shirazi"

Even when one part of the world, or the heart, is in pain, we can still find the strength to create, to connect, and to keep looking at the stars.

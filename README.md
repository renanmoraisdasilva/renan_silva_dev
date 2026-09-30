# renan-silva.dev

Source for the single-page portfolio. Static HTML, no framework, no build
tool. Tailwind is compiled to CSS ahead of time and the fonts are self-hosted,
so the page ships its HTML, CSS and fonts with no framework runtime.

The one exception is the Cal.com booking embed, which is a third-party script
loaded from `app.cal.com`. It is the only JavaScript on the page and it is
there to make the contact CTA work.

The page itself argues for the two open source projects it links to. This
repository is the evidence, so the build stays boring on purpose: one HTML
file, one stylesheet, no package manager.

## Layout

```
index.html         the page, the only HTML file
src/input.css      @font-face rules, base styles, Tailwind directives
assets/output.css  GENERATED. Do not edit.
assets/fonts/      self-hosted Inter, JetBrains Mono, Material Symbols subset
assets/*.pdf       the resume, linked with a download attribute
assets/luna-demo.gif  copied from the Luna repo, not generated here
assets/portrait.jpg  the hero photo, downscaled from a 1254px export
assets/favicon-source.png  the icon artwork, GENERATED inputs, not generated
assets/favicon.ico, favicon-32x32.png, apple-touch-icon.png  GENERATED. Do not hand-edit.
tailwind.config.js Tailwind theme
tools/build.cmd    regenerates assets/output.css
tools/serve.mjs    dependency-free local preview server
tools/make-favicon.mjs  regenerates the icon files
```

## Build the CSS

The page uses utility classes, so `assets/output.css` has to be regenerated
whenever the HTML or the config changes. Open the HTML, make your edit, run:

```
tools\build.cmd
```

It is a `.cmd` rather than a `.ps1` on purpose: PowerShell's default execution
policy on this machine blocks unsigned scripts, so a `.ps1` would fail for you.
If you would rather run the build by hand, the command it wraps is:

```
tools\tailwindcss.exe build -c tailwind.config.js -i src\input.css -o assets\output.css --minify
```

`assets/output.css` is committed so the site renders from a plain clone with no
build step, which is how GitHub Pages serves it. The cost of that choice is that
editing the HTML and forgetting to rebuild will ship stale CSS, so run
`tools\build.cmd` before every commit that touches the markup.

Linux and macOS use the platform binary from the same release:

```
https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-linux-x64
```

`tools/` is gitignored, so the binary has to be re-downloaded on a fresh clone.
It is a single 38 MB file with no runtime and no npm install.

## Preview

```powershell
node .\tools\serve.mjs 4321 .
```

Then open <http://localhost:4321>. Serving over HTTP rather than opening the
file directly matters, because browsers refuse to load woff2 fonts from `file://`.

## Resume

`assets/Renan_Silva_Resume.pdf` is committed to the repository, so GitHub
Pages serves it at `/assets/Renan_Silva_Resume.pdf` with no extra config. The
page links it twice, from the hero and from the contact list, both with
`download` and `type="application/pdf"`. Replace the file in place and keep
the filename; renaming it means editing both links.

## Links into GitHub

The two showcase repositories are public and each project card links to its own,
in three places: the preview image, the title, and the "GitHub Repo" text link.

```
https://github.com/renanmoraisdasilva/luna
https://github.com/renanmoraisdasilva/portfolio-dashboard
```

The hero button and the contact list point at the profile,
`https://github.com/renanmoraisdasilva`, because they are not about one project.

The Luna card's "Architecture Spec" link goes to
`luna/documentation/dev_phases/phase-1/architecture.md`, the system-wide
architecture document. Phase 2's file is the messaging deep-dive, not the
general spec, so it is not the one linked.

`finance-app` is deliberately absent. It is a private repository holding
personal financial data, and it does not belong on a public portfolio.

## Outstanding: one image still hotlinked

The **Portfolio Dashboard** card preview in `#projects` still points at
`https://lh3.googleusercontent.com`. That host is Google's image CDN. The URL
was produced by an image generator and is not under this repository's control,
so it can be revoked or expire with no warning, which would leave a broken
image on a page recruiters are using. It also keeps the "no third-party
requests" claim in this README false.

The image is an AI-generated mockup rather than a real screenshot, which is
why the card's alt text says "demo preview". The real application has genuine
captures in the other repository, at `portfolio-dashboard/docs/images/` —
`dashboard.png`, `analytics.png`, `simulator.png`, `allocation-investments.png`
— and `npm run demo:stills` there regenerates them. Any of those would be more
convincing than the mockup.

The fix is to copy the chosen file into `assets/` and point the `src` at it, as
`luna-demo.gif` and `portrait.jpg` already do, and add `width`/`height` so the
browser reserves the space before the file arrives.

The hero avatar is no longer in this list: `assets/portrait.jpg` replaced it.

## Booking

The contact CTA opens a Cal.com modal. Two things have to agree, and changing
one without the other is the easy mistake:

- the `data-cal-link` and `data-cal-namespace` attributes on the CTA
- the `Cal("init", ...)` and `Cal.ns[...]("ui", ...)` calls in the loader

The contact CTA has two forms, chosen by CSS media query with no JavaScript
involved, so there is nothing to fall out of sync:

- **Below 768px**: a plain `<a>` to the booking page. The modal proved
  unreliable in a small viewport, so it is not used there at all.
- **768px and up**: the Cal.com modal, via element-click embed. This has to be
  a `<button>`, not an `<a href>`, because `embed.js` does not call
  `preventDefault()` on the click it intercepts, so any `href` is *also*
  followed by the browser on top of the modal opening. Both were tried and both
  were wrong: an anchor to the booking page opened a stray cal.com tab every
  time, an anchor to `mailto:` opened an email client every time. A button has
  no default navigation, so the modal is the only outcome.

The loader in `<head>` is wrapped in the same 768px check, so mobile does not
fetch the 30 KB embed at all. Two things must stay in step: the `768px` in the
`matchMedia` guard, and the `hidden md:inline-flex` on the desktop button.
768px is Tailwind's default `md` breakpoint.

The event is named in three places that must agree: the mobile link's `href`,
the button's `data-cal-link`, and `Cal("init", "15min", ...)`.

**Do not reposition `cal-modal-box` with CSS.** An earlier version of this file
did, on the theory that the embed positioned the modal against the document
instead of the viewport. That was wrong. Reading
`packages/embeds/embed-core/src/ModalBox/ModalBoxHtml.ts` shows `:host
{ position: absolute }` only takes the host out of the grid flow, and the real
viewport-sized overlay is a `position: fixed` `.my-backdrop` inside the shadow
root. A computed `top` of ~5213px on the host is just the static position of an
absolutely positioned box at the end of `<body>`, not a bug. Overriding it to
`position: fixed` fought the flex box and made mobile worse.

**Do raise the iframe's `min-height`, which is in `src/input.css` for two
reasons.** Cal's `embed.css` sets `.cal-embed { min-height: 300px }` and injects
it into `<head>` at runtime, so on desktop the calendar renders as a 300px strip
— 43% of the window — surrounded by a full-viewport backdrop that dismisses the
modal on any click reaching the host. Raising the floor to `80dvh` gives the
calendar room and shrinks the area where a stray tap can land.

Two things make that rule work, and both are easy to undo by accident:

- The selector includes `.cal-embed`. Cal's rule is a class selector, so it
  beats two type selectors on specificity *even though it is injected later*.
  There is no `!important` involved.
- The rule sits **outside** `@layer components`. Tailwind tree-shakes that layer
  against `index.html`, and neither `<cal-modal-box>` nor `.cal-embed` appears
  there, so a rule in that layer was silently dropped from the build.

It sets `min-height`, not `height`, on purpose: Cal sets `height` inline and
caps `max-height` at `innerHeight - 100` to keep the close button reachable.
Raising only the floor leaves that ceiling in charge.

If the event length ever changes, the visible copy is in three more places in
`index.html`: the heading, the duration pill, and both CTA labels.
Cal's `embed.js` does not call `preventDefault()` on the click it intercepts,
so whatever `href` you put there is *also* followed by the browser, on top of
the modal opening. Both were tried and both were wrong:

- `href="mailto:..."` opened an email client on every click
- `href="https://cal.com/..."` opened a stray cal.com tab on every click

A `<button>` has no default navigation, so the modal is the only outcome. The
cost is that the CTA does nothing at all if `app.cal.com` never loads, which
is why the email address is printed in the contact column beside it. If that
trade ever needs to change, do not put an `href` back on this element without
re-testing the click, and check the browser's tab count before and after.

**Colours.** The modal cannot be themed from the embed code. Brand colour is
set per-account under Settings > Branding, in Cal's own dashboard, and it
applies to the booking page and the embed together. To match this site, set the
brand colour to the slate-900 the page uses, `#0f172a`. Embed-side `theme` and
`cssVarsPerTheme` config keys exist but are unreliable in the modal, so the
account setting is the one to trust.

The loader is inline because the Cal snippet requires a synchronous call to
`Cal(...)` before `embed.js` arrives. It is only ~30 KB gzipped and does not
block rendering.

## The Luna demo

`assets/luna-demo.gif` is copied from `luna/documentation/luna-demo.gif` in
the Luna repository, not generated here. It is a 680x458, 52-frame capture
showing the storefront and the Luna Ops shipment console. Replace the file in
place when the demo is re-recorded; the filename and the `width`/`height`
attributes in `index.html` must stay in step with it.

## Fonts

Self-hosted, latin subset only. Every character used here, in English and in
Portuguese, sits inside U+0000-00FF, so the `latin-ext` files were deleted
instead of shipped unused. Total is 81 KB across three files.

The Material Symbols subset is restricted to the four icons the page uses
(`translate`, `school`, `verified`, `calendar_month`), which is 3.4 KB instead
of the full icon font. It was generated with `&icon_names=` on the Google Fonts
API. If you add an icon, regenerate the subset and add its name to the URL.

`font-feature-settings: 'cv02' 'cv03' 'cv04' 'cv11'` in `src/input.css` applies
Inter's alternate glyphs. It has no visible effect without the real Inter
loaded, which is why the fonts are self-hosted rather than left to the system
stack.

## Domain

The site is published through GitHub Pages and served at `renan-silva.dev`.
`CNAME` is committed and holds the bare hostname, with no scheme and no path.
GitHub Pages reads it to decide which custom domain to serve, and it will keep
serving the old `*.github.io` address too, so the domain resolves as soon as
the DNS records exist.

Until the records are in place the site is live at
`https://renanmoraisdasilva.github.io/renan_silva_dev/` and
`renan-silva.dev` will not resolve. The wordmark in the header, the mailto
subject in the contact CTA, and this README all spell the domain the same way,
so a rename means changing all of them.

## The icon

`assets/favicon.ico` (16/32/48px), `assets/favicon-32x32.png` and
`assets/apple-touch-icon.png` (180px) are generated by
`tools/make-favicon.mjs` from `assets/favicon-source.png`. They are committed,
so a clone renders correctly without running anything. Re-run the generator
only when the source artwork changes:

```
node tools\make-favicon.mjs
```

There is no image library here and no npm install. The script decodes the
source PNG itself (8-bit RGBA, non-interlaced, all five scanline filters),
crops to the artwork's real bounds so the mark is centred regardless of the
export's margins, then resamples with a box filter and writes the PNG using
`node:zlib` for DEFLATE plus a CRC32 table. The ICO is a directory of records
pointing at those PNGs. Everything downscale-filters from one 256px master per
variant, so the 16px icon is a real average of the artwork rather than a single
sampled pixel.

**Two variants, deliberately.** The tab icon is transparent; the home screen
icon is not, and must not be:

- `favicon.ico` and `favicon-32x32.png` keep the source's transparency, so the
  mark sits on whatever the tab bar is. Verified by rendering the 16px entry on
  both backgrounds: crisp on a dark tab, washed out on a light one, because the
  artwork is a **white** R whose only contrast on white is its own soft black
  shadow. That is the intended look, and it is why the source art carries a
  shadow at all. `TILE` in the script restores the slate background if that
  trade is ever unwanted.
- `apple-touch-icon.png` is always composited onto slate-900. iOS draws an
  opaque white rounded square behind this icon regardless of what you supply,
  so a transparent white R would be very close to invisible on an iPhone home
  screen. `TOUCH_TILE` controls that one.

The resizer works in premultiplied alpha. That is not optional once the icon is
transparent: averaging colour channels independently of alpha mixes the fully
transparent black background into the artwork's antialiased edges and prints a
dark fringe around the R, which is easy to mistake for the design.

Two more details worth knowing before editing it:

- **The crop window is `side / (1 - 2*margin)`, not `side`.** The window has to
  be larger than the artwork so the art lands inset inside the tile. Cropping to
  the artwork's own bounds cuts the R off at the edges.
- **Look at the 16px ICO entry, not the 180px PNG**, when judging whether a
  change to the mark worked.

## Adding a Tailwind plugin

Only if something actually needs it. The previous CDN URL loaded `forms` and
`container-queries`; both were removed because the page has no form elements
and no container queries. `tailwind.config.js` currently declares
`plugins: []` for the same reason.

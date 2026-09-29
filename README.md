# renan.silva.dev

Source for the single-page portfolio. Static HTML, no framework, no JavaScript
at runtime. Tailwind is compiled to CSS ahead of time and the fonts are
self-hosted, so the page ships 8.5 KB of HTML, 4.7 KB of CSS and 81 KB of fonts
with no third-party requests.

The page itself argues for the two open source projects it links to. This
repository is the evidence, so the build stays boring on purpose: one HTML
file, one stylesheet, no package manager.

## Layout

```
index.html         the page, the only HTML file
src/input.css      @font-face rules, base styles, Tailwind directives
assets/output.css  GENERATED. Do not edit.
assets/fonts/      self-hosted Inter, JetBrains Mono, Material Symbols subset
tailwind.config.js Tailwind theme
tools/build.cmd    regenerates assets/output.css
tools/serve.mjs    dependency-free local preview server
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

## Adding a Tailwind plugin

Only if something actually needs it. The previous CDN URL loaded `forms` and
`container-queries`; both were removed because the page has no form elements
and no container queries. `tailwind.config.js` currently declares
`plugins: []` for the same reason.

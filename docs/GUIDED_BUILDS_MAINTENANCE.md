# Maintaining the guided builds

The public learning path lives in `site/guided-builds/`. It has three cumulative levels and a shared parts/pin reference. The levels teach reusable patterns, with less hand-holding in each level; they are not a comprehensive feature catalogue or an engine tune.

## Sources

- `site/guided-builds/index.md`: level chooser and learning intent.
- `basic.md`, `control.md`, `extend.md`: complete electrical/software/test walkthroughs.
- `parts.md`: selection examples and the cumulative S3 pin plan.
- `site/_data/build_wiring.yml`: wire-by-wire connection tables.
- `site/_includes/build-figure.html`, `guided-nav.html`, `build-flow.html`: shared visual/learning elements.
- `tools/generate_guided_build_diagrams.py`: source for the SVG drawings.
- `site/_includes/build-screen.html`: captioned, accessible UI walkthrough screenshots.
- `tools/capture_guided_build_screenshots.cjs`: isolated simulated inventories and software workflows captured from the actual ECU UI.
- `tools/audit_guided_builds.cjs`: built-site browser audit; deliberately outside the `ui_*.cjs` firmware audit discovery because it requires a built Jekyll site.

The drawings use terminal names, not physical connector pin order. The example pin plan is for the specified ESP32-S3 development-board arrangement. Required Start/Stop inputs are included at Level 1; they remain distinct from the independent energy-removing physical stop. Match the documented board, complete inventory, screenshots and UI pin validation when changing it.

## Regenerate and check

From the repository root:

```sh
python3 tools/generate_guided_build_diagrams.py
node tools/capture_guided_build_screenshots.cjs
python3 tools/generate_screenshot_dimensions.py
node tools/generate_site_config_reference.cjs
python3 tools/generate_documentation_index.py
node tools/generate_site_config_reference.cjs --check
python3 tools/generate_documentation_index.py --check
python3 tools/validate_public_content.py
```

Install Node dependencies with the repository lockfile and the needed Playwright browser. `OT_BROWSER_EXECUTABLE` optionally selects an already installed compatible Chromium binary for the guided screenshot and site-audit tools.

Use the site's Gemfile for the normal Jekyll build:

```sh
BUNDLE_GEMFILE=site/Gemfile bundle install
BUNDLE_GEMFILE=site/Gemfile bundle exec jekyll build --source site --destination _site --future
python3 tools/validate_public_content.py --built _site
node tools/audit_guided_builds.cjs
```

The Pages workflow performs the browser audit after the Jekyll build. Optional `OT_AUDIT_SHOTS=/absolute/output/folder` captures review images and additionally checks every diagram's text bounds. `OT_BUILT_SITE` selects another build output directory.

## Review each change

Keep diagrams, tables, parts, stable IDs, screenshots and UI labels in agreement. Do not import the simulator's exhaustive inventory into a beginner screenshot. The fixture starts with empty sequences and captures a separate complete dummy-load example; neither is a commissioned engine configuration. The capture tool rejects visible missing-pin/conflict warnings. Inspect every refreshed screenshot, especially subcards that could retain unrelated demo settings.

The SVGs are precise connection illustrations and functional maps, not a qualification of a physical installation. Manufacturer specifications ground the Hall, converter, OneWire and amplifier patterns; actual breakout designs, load drivers, protection, grounding and engine commissioning still require verification. Real RPM/temperature/pressure limits, fuel demands, timings and load ratings are not supplied by the learning guide.

Check light/dark appearance, phone and desktop layouts, wire-table readability, image enlargement/focus return, direct anchors, reduced motion, and reading with JavaScript disabled. Keep essential instructions outside screenshots.

## Initial implementation validation

Prepared against main commit `aec379d1e557521e3f168ca4d9868ef61a31366b` on 30 September 2026. The actual site was built locally with Jekyll 4.3.2, SEO and sitemap plugins; the existing GitHub Pages workflow remains the authoritative hosted build and dependency set.

Source and built-site public validation passed, including titles, descriptions, canonical URLs, sitemap entries, images, internal links and anchors. The focused browser audit passed at 320, 390, 768, 1024 and 1440 pixels in light and dark appearance, with keyboard image opening/closing and focus restoration, reduced motion, hint expansion, navigation, and no-JavaScript reading. All SVG text bounds were checked. The three UI fixtures were captured without visible pin-conflict/missing-pin warnings.

No physical ECU, sensor, driver or turbine was commissioned as part of this documentation change. Simulated UI captures and source/datasheet review are not physical hardware test evidence. GitHub deployment requires the changes to be reviewed/committed through the repository's normal process.

## Visual software walkthroughs

The guide embeds focused interface screenshots next to the applicable actions: controller overview/creation/default state/mapping/modes/validation/save, main-fuel ownership, idle choices, nested oil-feedback settings, protection discovery, fan hysteresis, calibration, manual-test settings, backup/restore, and sequence block selection/action/wait. Keep captions and display names in agreement with current UI behavior. Fresh generic controllers default to a fixed command and Running; the benign mapping lesson explicitly chooses its method and Standby. The Create panel and guide use output display names; stable IDs remain internal references.

The screenshot script operates solely on its loopback simulator. It disables unrelated inherited automatic relight and starter-assist features. The warning screenshot deliberately demonstrates conflicting simulated startup/running pressure defaults. The script acknowledges that warning only in the isolated simulator to capture the subsequent recap; the guide tells readers to resolve or deliberately justify actual warnings. Sequence screenshots include isolated editor operations and a complete dummy-load path, never a commissioned engine sequence. Focused cards are cropped to their actual bounds; full workflow captures use 1440 × 1250 and hardware inventories 1600 × 1100. Regenerate intrinsic image dimensions after captures. Check nested cards, readable selectors, sticky-header overlap, modal contents and visible bottom save controls.

## Shared documentation navigation

All `layout: document` pages use the shared outline in `_layouts/document.html`. Regenerate the documentation index after changing headings, front matter, or public pages. The finder combines these page/section entries with fields generated from the configuration schema; it needs no external search service. Preserve existing heading anchors when rewriting a section.

The field generator reads the editable `data_src/pages/config-schema.js`, not an assembled HTML copy. Public validation checks both generators with `--check` and fails if reference/search/outline data is stale. Run generation explicitly before validation; validators never rewrite those files.

Styles/script URLs are versioned with the Jekyll build timestamp. The finder requests a fresh search index on each visit, so an already-open browser does not retain obsolete fields after a documentation update.

The desktop sidebar becomes a collapsible outline on smaller screens. Walkthrough screenshots can be hidden with a remembered reading preference; wiring diagrams and instructions remain visible. Essential links, content, and navigation remain available with JavaScript disabled. The field filter and finder are enhancements and disappear when JavaScript is unavailable. Search results use the configured Pages base path, so check both project-site and local preview links after a base-path change.

See `DOCUMENTATION_REVIEW.md` for the latest review scope and verification status. The earlier validation above describes the initial guided-build version, not the later shared-layout revision.

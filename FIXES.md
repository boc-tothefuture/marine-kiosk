# Marine Kiosk — Fix Plan

Findings from a design/code review of this repo (a TV kiosk dashboard deployed via
ansible to a Raspberry Pi, served by `uv run marine-kiosk` and rendered in a
kiosk-mode browser). Each item below is self-contained: problem, evidence, exact
fix, and how to verify. Work through them in order — items 1 and 2 are visible
bugs affecting the deployed display; the rest are code-quality/robustness cleanup.

Run `uv run marine-kiosk` to serve the app locally at `http://localhost:8081` for
verification (it needs `web/tide_data.json` to exist; if missing, let the scraper
thread run once — it fetches on startup). Frontend source lives in `web/src/*.ts`
and is compiled with `cd web && npm run build` (outputs `web/app.js`, gitignored).
`index.html` loads the compiled `app.js`, not the TypeScript directly — always
rebuild after editing `web/src/`.

---

## 1. Critical: page content overflows the viewport and is unreachable

`html, body { overflow: hidden; cursor: none !important; }` in `web/style.css`
is intentional — this is a fullscreen kiosk with no scrollbars and no mouse. But
the layout doesn't reliably fit within one screen. Measured live in a real
browser window (1710×803 CSS px, i.e. *smaller* than a typical 1920×1080 TV):
total page content was 1058px tall against an 803px viewport. The entire
"Marine Wind & Seas" weather row and the footer (station ID + last-updated
timestamp) rendered **below the fold, completely invisible**, with no way to
reach them since scrolling is disabled.

**Root cause**: `.graph-instrument` (`web/style.css`) mixes a `55vh`-tall SVG
with several **fixed-pixel** blocks stacked below/around it:
- `.graph-instrument` padding: `72px 24px 24px 24px` (96px fixed vertical)
- `#currents-timeline-bar` height: `80px` (inline style in `web/index.html`)
- `#weather-timeline-bar` height: `60px` (inline style in `web/index.html`)
- `#currents-timeline-container` / `#weather-timeline-container` margins,
  padding, and header rows (~119–150px more, fixed)
- `#scrollable-timeline` gap: `16px` × 2 gaps

On a shorter or differently-proportioned screen than whatever this was designed
against, that fixed-pixel budget (~500px+) doesn't leave enough room, and
because none of these elements have `flex-shrink` or `min-height: 0` overrides,
they never compress — they just get cut off by `overflow: hidden`.

**Fix**:
- Replace the fixed-px heights/paddings called out above with `vh`-based or
  `clamp(min, preferred-vh, max)` values, so the whole stack (header + graph +
  currents row + weather row + footer) scales down together as viewport height
  shrinks, instead of the graph claiming a fixed `55vh` while everything else
  stays pixel-fixed.
- A reasonable approach: give `.tidelog-svg-wrapper` something like
  `height: clamp(280px, 48vh, 520px)` instead of a flat `55vh`, and convert the
  `80px` / `60px` fixed bar heights to `vh` equivalents (e.g. `9vh` / `7vh`) so
  they shrink too.
- After changing, verify by resizing the browser window down to something like
  1710×803 (or whatever the actual Pi/TV output resolution is — check the
  ansible playbook / kiosk browser launch flags for the real target resolution
  and test at that exact size) and confirm via JS that `document.body.scrollHeight
  <= window.innerHeight`:
  ```js
  document.body.scrollHeight <= window.innerHeight
  ```
  This must be `true`. Also visually confirm the footer and weather row are
  visible on screen, not just present in the DOM.

---

## 2. SVG text labels render visibly squished vs. everything else on the page

`web/index.html`:
```html
<svg id="tidelog-svg" viewBox="0 0 2000 400" preserveAspectRatio="none">
```
`preserveAspectRatio="none"` forces this SVG's 5:1 internal coordinate system
(`2000x400`) to stretch non-uniformly to fill whatever box `width:100%; height:
55vh` actually produces on screen — currently ~7.95:1, i.e. much wider relative
to its height than 5:1. That means everything drawn inside the SVG gets scaled
more horizontally than vertically. Measured live via `getScreenCTM()`:
`scaleX = 1.755`, `scaleY = 1.104` — horizontal scale is **59% greater** than
vertical scale. Any native SVG `<text>` element in there comes out visibly
flattened/condensed.

Confirmed empirically with `getBBox()` / `getBoundingClientRect()` on
`#sunrise-time-label` and a `.grid-time-label`: both have
`screenAspect / localAspect ≈ 1.589`, matching `scaleX/scaleY` exactly — i.e.
every text glyph in this SVG is stretched ~59% wider than it should be relative
to its height.

**Which labels are affected** (all native SVG `<text>`, all squished):
- Sunrise/sunset/moonrise/moonset stacked labels, both "day 1" and "day 2" sets
  — `web/index.html` roughly lines 97–161 (`#sunrise-text-label`,
  `#sunrise-time-label`, `#sunset-text-label`, `#sunset-time-label`,
  `#moonrise-*`, `#moonset-*`, and the `-2` day-2 variants)
- Hour grid labels ("12 AM", "NOON", etc.) — created in
  `web/src/renderers/tideGraph.ts`, function `drawTidelogGrid()`
- The moon phase emoji — `#moon-indicator-icon` in `web/index.html`

**Which labels are NOT affected** (rendered as plain HTML `<div>`s absolutely
positioned over the SVG, so they render with correct, undistorted typography):
- Tide high/low callouts — `renderTideOverlayLabels()` in
  `web/src/renderers/tideGraph.ts` (creates `document.createElement("div")`
  into `#tide-overlay-labels`)
- Currents flood/ebb/slack event labels — `renderCurrentsEventLabels()` in
  `web/src/renderers/currents.ts` (creates divs into `#currents-events-wrapper`)
- The "NOW" badge, header, footer, everything outside `<svg>`

This is directly visible side-by-side in the UI: the "+9.9 FT / 12:43 AM" tide
callout and the "Sunrise / 05:29 AM" label sit right next to each other, and the
sunrise label is noticeably flatter.

**Fix**: convert the sunrise/sunset/moonrise/moonset text labels (and ideally
the hour-grid labels) from SVG `<text>` to HTML overlay `<div>`s positioned by
percentage — the same pattern already used for tide callouts and currents event
labels. Concretely:
- In `web/src/renderers/astro.ts`, replace the functions that set attributes on
  SVG `<text>` elements (`setLabelPositionAndText`, the sunrise/sunset/moonrise/
  moonset text updates in `renderSunBackground()` and `updateLunarMarkersDOM()`)
  with logic that creates/positions HTML `<div>`s inside a new or existing HTML
  overlay container (e.g. reuse `#tide-overlay-labels` or add a sibling overlay
  div), following exactly how `renderTideOverlayLabels()` in `tideGraph.ts`
  computes `left`/`top` as percentages from `xPct`/`yPct`.
- Remove the now-unused SVG `<text>` elements for these labels from
  `web/index.html` (keep the SVG `<line>` elements for sunrise/sunset/moonrise/
  moonset — dashed vertical lines don't visibly deform the same way text does,
  so they can stay in the SVG).
- Do the same for the hour-grid labels in `drawTidelogGrid()`
  (`web/src/renderers/tideGraph.ts`): keep the `<line>` grid lines in SVG, move
  the `<text>` labels to an HTML overlay.
- Leave `#moon-indicator-icon` as-is or move it too if practical — lower
  priority since it's a single emoji per frame, not body text.
- After the change, re-measure with the same technique used to find the bug —
  confirm the moved labels no longer sit inside `<svg>`, and visually confirm
  in a screenshot that their proportions now match the tide callout text next
  to them.

---

## 3. Dead code: DOM elements/functions referencing IDs that don't exist in HTML

`web/src/app.ts`, `web/src/types.ts`, and `web/src/renderers/astro.ts` reference
several `elements.*` fields that are looked up via `document.getElementById(...)`
but have **no matching element anywhere in `web/index.html`**. They're always
`null`, always fail their `if (element)` guards, and are pure dead weight left
over from an earlier sidebar-widget design (before high/low callouts and sun/
moon times moved onto the graph itself). Confirmed by grepping all `id="..."` in
`index.html` against every `document.getElementById` call in `app.ts`.

Remove:
- In `web/src/app.ts`: the `extremesList` and `forecastList` element lookups,
  the `sunRiseTime`, `sunSetTime`, `daylightDuration`, `moonRiseTime`,
  `moonSetTime`, `moonPhaseName` element lookups, and the entire
  `renderExtremes()` function plus its call site in `updateUI()` and in
  `startAutoTransitionTimer()`'s `crossfadeUpdate(elements.extremesList, ...)`
  call.
  - Note: `weatherTimelineBar` is a **different**, real, actively-used element
    (`#weather-timeline-bar` exists in `index.html` and is populated by
    `renderForecast()`) — do not remove that one.
- In `web/src/types.ts`: remove the corresponding fields from the `Elements`
  interface (`extremesList`, `forecastList`, `sunRiseTime`, `sunSetTime`,
  `daylightDuration`, `moonRiseTime`, `moonSetTime`, `moonPhaseName`).
- In `web/src/renderers/astro.ts`: `updateAstronomicalDetails()` writes to
  `elements.sunRiseTime` / `sunSetTime` / `daylightDuration` / `moonRiseTime` /
  `moonSetTime` / `moonPhaseName` — remove those blocks (the real sunrise/
  sunset/moonrise/moonset display already happens via `renderSunBackground()`
  and `renderLunarTransit()`/`updateLunarMarkersDOM()` in the same file, which
  drive the on-graph labels — don't touch those).
- In `web/style.css`: remove the unused `.back-btn` rule and its `:hover`
  variant — there is no back button anywhere in `index.html`.

Verify: after removal, `cd web && npm run build` (esbuild) succeeds, and
`npx tsc --noEmit` reports no new errors (see item 5 for pre-existing ones).
Grep `web/src` afterward for `extremesList|forecastList|sunRiseTime|sunSetTime|
daylightDuration|moonRiseTime|moonSetTime|moonPhaseName|back-btn` to confirm
zero remaining references.

---

## 4. README describes a settings panel that no longer exists

`README.md` documents pressing the `S` key or clicking a gear icon to open a
settings panel with theme switching (Ocean Cyan / Cyberpunk Pink / Mono White /
Retro Amber), a Dynamic/Fixed vertical-scaling toggle, and a Live/Simulated
data-source toggle. None of this exists in the current code — confirmed via
`grep -rni "settings|gear|theme|cyberpunk|amber" web/src web/index.html
web/style.css`, which returns nothing except a comment header. There's no
keydown listener anywhere in `app.ts`, no settings markup in `index.html`, and
`cursor: none !important` is set globally in `style.css`, confirming the UI is
intentionally non-interactive now (kiosk-only, no mouse/keyboard use expected).

**Fix**: delete the "Screen Settings & Themes" section from `README.md`
(currently under the `## Screen Settings & Themes` heading). If a settings
panel is wanted back, that's a separate feature request — this task is just to
stop the README from documenting a UI that isn't there.

---

## 5. TypeScript type errors are never checked — `tsc --noEmit` fails

`web/package.json` has `lint` (Biome — does not type-check) but no `typecheck`
script, so `esbuild` (which strips types without validating them) is the only
thing run in practice. Running `npx tsc --noEmit` from `web/` reveals 3 real
errors:

```
src/renderers/astro.ts(374,23): error TS2339: Property 'pathD' does not exist on type '{ showMoon: boolean; mx: number; my: number; }'.
src/renderers/astro.ts(402,23): error TS2339: Property 'pathD' does not exist on type '{ showMoon: boolean; mx: number; my: number; }'.
src/utils.ts(25,14): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
```

**Fix**:
- `web/src/renderers/astro.ts`: `let lunarData1 = { showMoon: false, mx: 0, my:
  0 };` and `let lunarData2 = { ... }` declare a type without `pathD`, then get
  reassigned from `calculateLunarPathAndPosition(...)` (which returns
  `{ pathD, showMoon, mx, my }`), then `.pathD` is read off them. Give the
  initial declarations an explicit type that includes `pathD`, e.g.:
  ```ts
  let lunarData1: { pathD: string; showMoon: boolean; mx: number; my: number } =
    { pathD: "", showMoon: false, mx: 0, my: 0 };
  ```
  (same for `lunarData2`).
- `web/src/utils.ts` line 25, inside `interpolateValueAtTime()`: `if (!lower)
  return upper?.value;` — at this point `upper` is guaranteed non-null (the
  `if (!lower && !upper) return 0.0;` check above already excluded the both-null
  case), so change to `return upper.value;` (drop the `?.`) — or restructure
  with a non-null assertion if TS still can't narrow it.
- Add `"typecheck": "tsc --noEmit"` to the `scripts` block in
  `web/package.json`, and run it (in addition to `lint`) as part of whatever
  CI/pre-commit process exists for this repo.

Verify: `cd web && npx tsc --noEmit` exits with no errors.

---

## 6. `requests` is an undeclared transitive dependency

`src/marine_kiosk/scraper.py` does `import requests` directly and uses it for
several NOAA/NWS API calls, but `pyproject.toml` only declares `noaa-coops`,
`pandas`, `astral` as dependencies. It currently works only because
`noaa-coops` happens to pull in `requests` transitively (confirmed in
`uv.lock`). If a future `noaa-coops` release drops or changes that, `uv sync`
on the Pi after an ansible-triggered redeploy would fail or silently break the
scraper without `pyproject.toml` giving any indication why.

**Fix**: add `"requests"` to the `dependencies` list in `pyproject.toml`
(pin a minimum version consistent with what's already resolved in `uv.lock`,
e.g. `"requests>=2.31.0"`), then run `uv lock` to update the lockfile.

Verify: `uv sync` succeeds and `uv run marine-kiosk` still starts cleanly.

---

## 7. Scraper writes `tide_data.json` non-atomically

`src/marine_kiosk/scraper.py`, near the end of `fetch_tide_data()`:
```python
with open(output_path, "w") as f:
    json.dump(output_data, f, indent=2)
```
If the HTTP server handles a request for `tide_data.json` while this write is
in progress (or the process is killed mid-write, e.g. by a systemd
restart during an ansible deploy), a client can read a truncated/invalid JSON
file. The frontend (`fetchTideData()` in `web/src/app.ts`) does `fetch(...,
{cache: "no-store"})` every 10 minutes and will fail that poll cycle with a
console error if this happens — self-recovering, but avoidable.

**Fix**: write atomically — write to a temp file in the same directory as
`output_path`, then `os.replace()` it into place:
```python
tmp_path = output_path + ".tmp"
with open(tmp_path, "w") as f:
    json.dump(output_data, f, indent=2)
os.replace(tmp_path, output_path)
```
(`os.replace` is already atomic on POSIX, which covers the Raspberry Pi
deployment target.)

Verify: `uv run marine-kiosk`, confirm `web/tide_data.json` is still produced
correctly, and that no `.tmp` file is left behind after a successful run.

---

## 8. Slow recovery from a failed first scrape on boot

`src/marine_kiosk/main.py`, `scraper_worker()`:
```python
while True:
    try:
        fetch_tide_data(station_id, units, datum, config_path=config_path)
    except Exception as e:
        print(f"Scraper Worker Error: Scraper failed to fetch data: {e}")
    time.sleep(interval_hours * 3600)
```
On failure, it sleeps the full `update_interval_hours` (default 1 hour) before
retrying — same as the steady-state success case. On a Raspberry Pi that starts
this service on boot before Wi-Fi/DNS is fully up (a real race with systemd
`After=network.target`, which doesn't guarantee actual connectivity), the first
fetch can fail, leaving the kiosk showing empty `--` placeholders for up to an
hour after every reboot.

**Fix**: use a short retry delay specifically after a failure, separate from
the steady-state interval, e.g.:
```python
def scraper_worker(station_id, units, datum, interval_hours, config_path=None):
    print(f"Scraper Worker: Starting scraper thread (updates every {interval_hours} hour(s)).")
    retry_delay_sec = 60
    max_retry_delay_sec = 300
    while True:
        try:
            fetch_tide_data(station_id, units, datum, config_path=config_path)
            retry_delay_sec = 60  # reset backoff after success
            time.sleep(interval_hours * 3600)
        except Exception as e:
            print(f"Scraper Worker Error: Scraper failed to fetch data: {e}")
            time.sleep(retry_delay_sec)
            retry_delay_sec = min(retry_delay_sec * 2, max_retry_delay_sec)
```
Adjust exact numbers as you see fit — the point is: failures should retry in
under a few minutes, not wait a full hour.

Verify: temporarily point `station_id` at an invalid value, confirm the log
shows retries roughly a minute apart (not an hour apart), then revert.

---

## 9. Single-threaded blocking HTTP server

`src/marine_kiosk/server.py` uses `socketserver.TCPServer`, which handles one
request at a time. Low risk with a single kiosk client polling every 10
minutes, but a cheap, safe improvement.

**Fix**: swap to `http.server.ThreadingHTTPServer`:
```python
import http.server

def start_server(port):
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", port), Handler) as httpd:
        ...
```
(Remove the now-unused `socketserver` import if nothing else in the file needs
it.)

Verify: `uv run marine-kiosk` still serves `index.html` and `tide_data.json`
correctly over HTTP.

---

## 10. Placeholder contact email in NWS User-Agent header

`src/marine_kiosk/scraper.py`:
```python
nws_headers = {"User-Agent": "(marine-kiosk-dashboard, brian@example.com)"}
```
NWS's API asks for a real contact in the User-Agent per their API usage
guidance. `brian@example.com` is a placeholder.

**Fix**: replace with a real contact email (owner's choice), or make it
configurable via `tide_config.json` (consistent with how other station/coord
settings are already configurable there) if this is expected to be reused
across deployments.

---

## Suggested order of work

1. Item 1 (viewport overflow) — visibly broken on the deployed kiosk right now.
2. Item 2 (squished SVG text) — visibly broken, same severity class as #1.
3. Item 5 (TS errors + typecheck script) — quick, prevents regressions while
   doing the rest of this list.
4. Item 3 (dead code cleanup) — do this before or alongside item 2 since it
   touches the same files (`astro.ts`, `types.ts`, `app.ts`).
5. Items 6–10 — independent, low-risk, can be done in any order.
6. Item 4 (README) — do last, after confirming what's actually still true.

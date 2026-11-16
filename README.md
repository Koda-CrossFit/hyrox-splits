# Koda Split Analyzer for HYROX races

A free, public page for potential HYROX clients of Koda CrossFit Iron View. A racer picks Singles or Doubles and their division, enters their splits (in the same order the HYROX results apps show them: Run 1, Ski, Run 2, Sled Push … Run 8, Wall Balls, Roxzone, Overall) and gets a two-part race report (trimmed to these two parts on purpose, Nov 2026):

- **Strengths & weak spots** (first): every segment vs typical for their finish time (diverging bars, sortable by gap or race order), each with its rating. Running and Roxzone are one segment, **Run + Roxzone** (Runs 2–8 plus every transition), because venues split time between them differently; it's drawn per km (its gap ÷ 7) so its bar compares one km with one station, and the row also shows the whole gap ("+6:03 in all"). Its pop-up gives the two halves for context.
- **Path to a goal**: where the time to a goal usually comes from. The default goal is the next 5-minute mark when that's within a strong next race for their level, otherwise a strong next race to the nearest minute.
- Copy-link sharing and print/PDF (the printout carries Koda's address line).

Divisions: Singles — Men's and Women's Open and Pro; Doubles — Men's, Women's and Mixed, Men's and Women's Pro. Doubles starts with no division picked, so a team is never analysed in a division it didn't choose.

Splits can be typed, pasted as text, or read from **screenshots** (the results app or results website). Screenshots are read on the device with Tesseract.js, so nothing is uploaded. Nothing the visitor enters leaves the browser.

## Files

| File | What it is |
|---|---|
| `index.html` | Page markup and all styles (Koda HYROX look: charcoal, sand, electric yellow), method text; data credits are in the footer |
| `app.js` | Everything that runs: time parsing, the comparison model, screenshot/paste reading, the report |
| `benchmarks.js` | **Generated.** Typical splits, run-lap shapes, within-peer spreads and finish distributions for each division |
| `assets/` | Koda mark, link-preview image (`og-splits.jpg`) |
| `tools/build-benchmarks.js` | Builds `benchmarks.js` from `research/` |
| `tools/serve.js` | Local preview server: `node tools/serve.js` → http://localhost:8795 |
| `tools/og_image.js` | Re-renders `assets/og-splits.jpg` (numbers match the Men's Open "Try an example" race) |
| `tools/snap.js`, `tools/snap-parts.js` | Full-page / per-section screenshots of the local preview |
| `tools/test/` | **Not published** (in `.gitignore`). Mock-ups of results-app and results-site screenshots for testing the screenshot reader |
| `research/` | **Not published** (in `.gitignore`). The research syntheses, fact-checks, per-anchor laps and spread tables the benchmarks are built from, plus `roxpace_benchmarks.json` (rox-pace, MIT licence) |

## How the analysis works

1. **Typical splits.** For each division, `benchmarks.js` holds anchor rows every 5–15 minutes of finish time: the typical time for running (all 8 km), Roxzone and each station. Each row adds up exactly to its finish time. Singles rows are 2025/26 same-finish cohort medians (closed so they sum to the finish); doubles rows are team cohort means calibrated to RoxTimes medians.
2. **Your peers.** Peers are matched on what your splits add up to with a typical Run 1 (Tp), because the start lap is shorter or longer at many venues. Every typical split is interpolated linearly between the two nearest anchors; above the table each part keeps its own end slope, below it everything scales in proportion. Nothing changes in steps at 60 or 90 minutes. More than 5 minutes beyond either end of a division's table, splits are shown in seconds but not rated.
3. **Seconds.** Each segment's difference = your time − typical time. Running and Roxzone are compared together as **Run + Roxzone** = Runs 2–8 + Roxzone (Run 1 is never rated): US venues in particular log more of the race as running and less as Roxzone than the benchmark field, which made running look slow and Roxzone fast on their own (changed Nov 2026). The differences net to zero. The strengths chart draws Run + Roxzone per km (its gap ÷ 7) and sorts by what it draws; ratings are unchanged by that, since they compare ratios. (`analyze()` still computes "time on the table", the 10 s+ time-savers and pacing numbers; the report no longer shows them.)
4. **Ratings and percentiles.** Each split is placed among same-finish peers with a two-piece log-normal: `z = ln(you / peer median) / spread`, using the measured spread below or above the median. Peer medians sit slightly faster than the summed profile (`delta`). Sled push and sled pull spreads are widened 25% for venue differences; spreads have floors. Run + Roxzone's spread combines the running and Roxzone spreads, each weighted by its share of the pair's median time and taken as independent (Roxzone without its venue widening, since venue shifts between the two cancel in the pair). Ratings: z ≥ 1.28 big opportunity, ≥ 0.67 time to gain, middle half normal range, ≤ −0.67 strength, ≤ −1.28 big strength. The "faster/slower than X%" text (in each bar's tap/hover pop-up and its screen-reader label) only shows when it agrees with the seconds next to it. Doubles borrow the matching singles spreads at the same place in their field, and say so.
5. **Goal plan.** For goal G, take the typical splits at G. Any segment where you're already faster keeps your time; every other segment's target is λ × the typical split at G, with λ chosen (by bisection, always bracketed) so the targets add up to G. Run + Roxzone here is all 8 km plus every transition. A penalty (official time 15 s to 15 min above the splits; more is treated as a typo) is its own row; timing rounding and a venue's long or short first lap are carried as offsets, so they are never "time to cut". With a penalty, the suggested goal starts from the clean time (the splits). Goals are typed as h:mm:ss, and a short entry like 1:15 means 1:15:00.
6. **Finish level.** Your finish is placed on the division's finish-time distribution (interpolated in log-time / normal-quantile space): 2025/26 singles percentiles up to the median, rox-pace above it and for doubles. It sets the suggested goal's size, maps doubles onto singles spreads, and adds a "few racers finish in this time" caution at the extremes; it isn't shown as a "Top X%" line any more.

## Updating the benchmarks

1. Update the tables in `research/` (new season, new data).
2. `node tools/build-benchmarks.js` → rewrites `benchmarks.js` (checks that every row sums to its finish and every segment rises with finish time).
3. Bump the `?v=` on the two script tags in `index.html` so returning visitors get the new files.

## Tools

The screenshot and image scripts need Puppeteer: `npm i puppeteer` here, or point `PUPPETEER_MODULE` at an existing install.

## Deploying

GitHub Pages serves `main`; a push goes live in about a minute.

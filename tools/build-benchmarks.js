// Builds benchmarks.js from the research tables in research/ (not published).
//   node tools/build-benchmarks.js
// Singles: Season 2025/26 same-finish cohort medians, closed so each row sums to its finish
// (research/singles_synthesis.json), per-anchor run laps (anchors_s8_with_legs.csv) and
// within-peer spreads (within_peer_spread_s8.csv), with the fact-check fixes applied.
// Doubles: team tables from research/doubles_synthesis.json with the corrections in
// research/doubles_check.json applied (fast-end station/run shift, Roxzone share flattened at
// the slow end).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = f => path.join(ROOT, 'research', f);
const single = JSON.parse(fs.readFileSync(R('singles_synthesis.json'), 'utf8'));
const dbl = JSON.parse(fs.readFileSync(R('doubles_synthesis.json'), 'utf8'));
const dblCheck = JSON.parse(fs.readFileSync(R('doubles_check.json'), 'utf8'));
// rox-pace (MIT licence, github.com/pythongod/rox-pace): finish and per-run percentiles,
// seasons 7-9, 218 events, 1.54 million results (event-level percentiles weighted by results).
const roxpace = JSON.parse(fs.readFileSync(R('roxpace_benchmarks.json'), 'utf8'));
const RP = { 'men-open': 'men', 'women-open': 'women', 'men-pro': 'menPro', 'women-pro': 'womenPro', 'dbl-men': 'doublesMen', 'dbl-women': 'doublesWomen', 'dbl-mixed': 'doublesMixed', 'dbl-pro-men': 'doublesMenPro', 'dbl-pro-women': 'doublesWomenPro' };

const COLS = ['min', 'run', 'rox', 'ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'];
const SRC = { run: 'run_total_sec', rox: 'roxzone_sec', ski: 'skierg_sec', push: 'sled_push_sec', pull: 'sled_pull_sec', bbj: 'bbj_sec', row: 'row_sec', farm: 'farmers_sec', lunge: 'lunges_sec', wb: 'wallballs_sec' };
const SEG = COLS.slice(1);

function csv(file) {
  const [head, ...rows] = fs.readFileSync(R(file), 'utf8').trim().split(/\r?\n/);
  const h = head.split(',');
  return rows.map(r => { const v = r.split(','); const o = {}; h.forEach((k, i) => { o[k] = isNaN(+v[i]) ? v[i] : +v[i]; }); return o; });
}
const legsCsv = csv('anchors_s8_with_legs.csv');
const spreadCsv = csv('within_peer_spread_s8.csv');

// ── Division meta ──
const CATS = {
  'men-open': { label: "Men's Open", chip: 'Men Open', who: "men's Open athletes", group: 'singles', unit: 'athletes', src: ['men', 'open'], key: 'men_open' },
  'women-open': { label: "Women's Open", chip: 'Women Open', who: "women's Open athletes", group: 'singles', unit: 'athletes', src: ['women', 'open'], key: 'women_open' },
  'men-pro': { label: "Men's Pro", chip: 'Men Pro', who: "men's Pro athletes", group: 'singles', unit: 'athletes', src: ['men', 'pro'], key: 'men_pro' },
  'women-pro': { label: "Women's Pro", chip: 'Women Pro', who: "women's Pro athletes", group: 'singles', unit: 'athletes', src: ['women', 'pro'], key: 'women_pro' },
  'dbl-men': { label: "Men's Doubles", chip: 'Men', who: "men's Doubles teams", group: 'doubles', unit: 'teams', dsrc: 'doubles_men', spreadFrom: 'men-open' },
  'dbl-women': { label: "Women's Doubles", chip: 'Women', who: "women's Doubles teams", group: 'doubles', unit: 'teams', dsrc: 'doubles_women', spreadFrom: 'women-open' },
  'dbl-mixed': { label: 'Mixed Doubles', chip: 'Mixed', who: 'Mixed Doubles teams', group: 'doubles', unit: 'teams', dsrc: 'doubles_mixed', spreadFrom: 'men-open' },
  'dbl-pro-men': { label: "Men's Pro Doubles", chip: 'Pro Men', who: "men's Pro Doubles teams", group: 'doubles', unit: 'teams', dsrc: 'doubles_men_pro', spreadFrom: 'men-pro' },
  'dbl-pro-women': { label: "Women's Pro Doubles", chip: 'Pro Women', who: "women's Pro Doubles teams", group: 'doubles', unit: 'teams', dsrc: 'doubles_women_pro', spreadFrom: 'women-pro' },
};

// Finish-time distribution per division: [percentile finishing faster, seconds].
// Singles p1-p50: the Season 2025/26 field (athlete.tools public benchmark pages), the same season
// as the split tables; p75-p99: rox-pace. Doubles: rox-pace throughout.
const t = s => { const p = s.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
const rpFinish = (key, qs) => qs.map(q => [q, roxpace.divisions[RP[key]].finishPercentiles[String(q)]]);
const S8 = {
  'men-open': [[1, t('61:33')], [10, t('70:36')], [25, t('77:48')], [50, t('87:56')]],
  'women-open': [[1, t('68:49')], [10, t('78:39')], [25, t('86:02')], [50, t('96:20')]],
  'men-pro': [[1, t('57:46')], [10, t('65:27')], [25, t('71:49')], [50, t('80:54')]],
  'women-pro': [[1, t('62:48')], [10, t('70:39')], [25, t('77:16')], [50, t('86:53')]],
};
const FINISH = {};
Object.keys(S8).forEach(k => { FINISH[k] = S8[k].concat(rpFinish(k, [75, 90, 95, 99])); });
['dbl-men', 'dbl-women', 'dbl-mixed', 'dbl-pro-men', 'dbl-pro-women'].forEach(k => { FINISH[k] = rpFinish(k, [1, 5, 10, 25, 50, 75, 90, 95, 99]); });
Object.entries(FINISH).forEach(([k, pts]) => { for (let i = 1; i < pts.length; i++) if (!(pts[i][1] > pts[i - 1][1])) throw new Error('finish curve not rising: ' + k); });

// Closed profiles sit about delta minutes "slow" of the true per-segment medians
// (closed(F) ~ median(F + delta)); used only for percentiles and ratings.
const DELTA = {
  'men-open': [[55, 0.5], [60, 1.0], [100, 1.3], [110, 2.1], [120, 2.7], [135, 4.0], [150, 4.7]],
  'women-open': [[60, 0.5], [110, 1.0], [120, 1.8], [135, 2.5], [150, 3.6]],
  'men-pro': [[55, 0.6], [90, 1.2], [100, 1.8], [110, 2.4], [120, 3.1]],
  'women-pro': [[60, 0.5], [100, 0.9], [110, 1.4], [120, 2.3]],
};
const DELTA_DOUBLES = [[50, 0.7], [135, 0.7]]; // team tables are cohort means; runs sit ~30-40 s above medians

// Doubles run laps (rox-pace median of each run, seconds) at each division's median finish.
const DBL_LAPS = {};
['dbl-men', 'dbl-women', 'dbl-mixed', 'dbl-pro-men', 'dbl-pro-women'].forEach(k => {
  const sp = roxpace.divisions[RP[k]].stationPercentiles;
  DBL_LAPS[k] = [1, 2, 3, 4, 5, 6, 7, 8].map(n => sp['run-' + n]['50']);
});

const confOf = c => (c === 'low' ? 'l' : c === 'medium' ? 'm' : 'h');
const r1 = x => Math.round(x * 1000) / 1000;

function rowFrom(a) { return [a.finish_min].concat(SEG.map(k => a[SRC[k]])); }
function checkRows(name, rows) {
  rows.forEach(r => {
    const s = r.slice(1).reduce((x, y) => x + y, 0);
    if (Math.abs(s - r[0] * 60) > 2) throw new Error(name + ' ' + r[0] + ' sums to ' + s + ' not ' + r[0] * 60);
  });
  for (let i = 1; i < rows.length; i++) {
    SEG.forEach((k, j) => { if (rows[i][j + 1] < rows[i - 1][j + 1]) throw new Error(name + ' ' + k + ' falls from ' + rows[i - 1][0] + ' to ' + rows[i][0]); });
  }
}

const out = {};

// ── Singles ──
for (const [key, meta] of Object.entries(CATS).filter(([, m]) => m.group === 'singles')) {
  const tab = single.tables.find(x => x.gender === meta.src[0] && x.division === meta.src[1]);
  const anchors = tab.anchors.slice().sort((a, b) => a.finish_min - b.finish_min);
  const rows = anchors.map(rowFrom);
  if (key === 'men-pro') {
    // Fact-check: the 55-min Pro men's lunges and wall balls were extrapolated past every elite
    // reference (lunges 183-197 s, wall balls 235-261 s at 55-58 min). Extrapolate those two from
    // the 60-min row at half the slope and take the difference out of running so the row still closes.
    const [r55, r60] = [rows[0], rows[1]];
    let freed = 0;
    [9, 10].forEach(j => { const v = Math.round(r60[j] - 0.5 * (r60[j] - r55[j])); freed += v - r55[j]; r55[j] = v; });
    r55[1] -= freed;
  }
  checkRows(key, rows);
  const conf = anchors.map((a, i) => {
    let c = confOf(a.confidence);
    const moved = /(\d+) s moved/.exec(a.basis || '');
    if (moved && +moved[1] > 240 && c === 'h') c = 'm';      // big closure distance
    if (/guide only/i.test(a.basis || '')) c = 'l';           // research: "use as a guide only"
    if (i === 0) c = 'l';                                     // extrapolated fast end (fact-check)
    return c;
  }).join('');
  // Run laps per anchor as multiples of the average lap.
  const legs = rows.map(r => {
    const L = legsCsv.find(x => x.division === meta.key && x.finish_min === r[0]);
    const v = [1, 2, 3, 4, 5, 6, 7, 8].map(n => L['run_' + n + '_s']);
    const avg = v.reduce((x, y) => x + y, 0) / 8;
    return v.map(x => r1(x / avg));
  });
  // Within-peer spreads (two-piece log-normal: [below median, above median]) by cohort.
  const cohorts = Array.from(new Set(spreadCsv.filter(x => x.division === meta.key).map(x => x.cohort_center_min))).sort((a, b) => a - b);
  const SP = { ski: 'ski', push: 'sled_push', pull: 'sled_pull', bbj: 'burpees', row: 'row', farm: 'farmers_carry', lunge: 'lunges', wb: 'wall_balls', rox: 'roxzone' };
  const spread = { at: cohorts };
  const BLOCK = Math.sqrt((1 + 6 * 0.6) / 7); // 7 legs, inter-leg correlation ~0.6
  spread.run = cohorts.map(c => {
    const legsRows = [2, 3, 4, 5, 6, 7, 8].map(n => spreadCsv.find(x => x.division === meta.key && x.cohort_center_min === c && x.segment === 'run_' + n));
    const d = legsRows.reduce((s, x) => s + x.log_sd_down, 0) / 7, u = legsRows.reduce((s, x) => s + x.log_sd_up, 0) / 7;
    return [r1(d * BLOCK), r1(u * BLOCK)];
  });
  for (const [k, s] of Object.entries(SP)) {
    spread[k] = cohorts.map(c => { const x = spreadCsv.find(y => y.division === meta.key && y.cohort_center_min === c && y.segment === s); return [r1(x.log_sd_down), r1(x.log_sd_up)]; });
  }
  out[key] = { label: meta.label, chip: meta.chip, who: meta.who, group: meta.group, unit: meta.unit, anchors: rows, conf, legs, spread, delta: DELTA[key], finish: FINISH[key] };
}

// ── Doubles ──
const fixes = dblCheck.corrections.slice();
// Roxzone caps the fact-check asked for but gave only as totals (moved into running).
[['doubles_women_pro', 110, 596], ['doubles_women_pro', 120, 676], ['doubles_men_pro', 100, 563], ['doubles_men_pro', 110, 641], ['doubles_men_pro', 120, 721]].forEach(([division, m, rox]) => {
  fixes.push({ division, finish_min: m, segment: 'roxzone_sec', corrected_sec: rox, moveToRun: true });
});
for (const [key, meta] of Object.entries(CATS).filter(([, m]) => m.group === 'doubles')) {
  const tab = dbl.tables.find(x => x.division === meta.dsrc);
  const anchors = tab.anchors.map(a => Object.assign({}, a)).sort((a, b) => a.finish_min - b.finish_min);
  fixes.filter(f => f.division === meta.dsrc).forEach(f => {
    const a = anchors.find(x => x.finish_min === f.finish_min);
    if (!a) throw new Error('no anchor ' + f.division + ' ' + f.finish_min);
    if (f.moveToRun) { a.run_total_sec += a.roxzone_sec - f.corrected_sec; a.roxzone_sec = f.corrected_sec; }
    else a[f.segment] = f.corrected_sec;
    // Fact-check: the run/Roxzone split at 100+ min is modelled, so these rows are low confidence.
    if (f.segment === 'roxzone_sec' && f.finish_min >= 100) a.confidence = 'low';
  });
  if (meta.dsrc === 'doubles_men_pro') anchors.filter(a => a.finish_min >= 100).forEach(a => { a.confidence = 'low'; });
  const rows = anchors.map(rowFrom);
  checkRows(key, rows);
  const conf = anchors.map(a => confOf(a.confidence)).join('');
  const laps = DBL_LAPS[key], avg = laps.reduce((x, y) => x + y, 0) / 8;
  const medianFinish = FINISH[key].find(p => p[0] === 50)[1];
  out[key] = {
    label: meta.label, chip: meta.chip, who: meta.who, group: meta.group, unit: meta.unit, anchors: rows, conf,
    runShape: { at: medianFinish, p: laps.map(x => r1(x / avg)), k: 2 }, spreadFrom: meta.spreadFrom,
    delta: DELTA_DOUBLES, finish: FINISH[key],
  };
}

// ── Write ──
const order = Object.keys(CATS);
let js = '/* Koda HYROX Split Analyzer: typical splits by division and finish time.\n' +
  '   GENERATED by tools/build-benchmarks.js from the research tables. Edit those, not this file.\n' +
  '   anchors: [finish minutes, running (8 km), Roxzone, SkiErg, sled push, sled pull, burpee broad jumps,\n' +
  '             row, farmers carry, sandbag lunges, wall balls], seconds; each row sums to its finish time.\n' +
  '   conf: one letter per anchor (h high, m medium, l low).  legs/runShape: run 1-8 as multiples of the\n' +
  '   average lap.  spread: within-peer log-SD [below median, above median] by finish cohort.\n' +
  '   delta: minutes the closed profile sits slow of true medians.  finish: [% finishing faster, seconds]. */\n';
js += 'window.KODA_BENCH = {\n';
js += "  updated: 'November 2026',\n";
js += "  cols: " + JSON.stringify(COLS) + ',\n';
js += '  categories: {\n';
for (const k of order) {
  const c = out[k];
  js += '    ' + JSON.stringify(k) + ': {\n';
  for (const [f, v] of Object.entries(c)) {
    if (f === 'anchors' || f === 'legs') js += '      ' + f + ': [\n' + v.map(r => '        ' + JSON.stringify(r)).join(',\n') + '\n      ],\n';
    else if (f === 'spread') js += '      spread: {\n' + Object.entries(v).map(([sk, sv]) => '        ' + sk + ': ' + JSON.stringify(sv)).join(',\n') + '\n      },\n';
    else js += '      ' + f + ': ' + JSON.stringify(v) + ',\n';
  }
  js += '    },\n';
}
js += '  },\n};\n';
fs.writeFileSync(path.join(ROOT, 'benchmarks.js'), js);
console.log('wrote benchmarks.js:', order.map(k => k + ' ' + out[k].anchors.length).join(', '));

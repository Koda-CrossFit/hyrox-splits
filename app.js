/* Koda HYROX Split Analyzer
   Compares an athlete's splits with typical splits for athletes of the same division
   who finish in the same time (benchmarks.js), flags strengths and weak spots, ranks
   where time can be cut, and maps a goal time onto the segments. Runs entirely in
   the browser; screenshots are read on-device with Tesseract.js. */
(function () {
  'use strict';

  const B = window.KODA_BENCH;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ───────────────────────── Segments ─────────────────────────
  // Race order, exactly as the results apps list them.
  const ORDER = ['run1', 'ski', 'run2', 'push', 'run3', 'pull', 'run4', 'bbj', 'run5', 'row', 'run6', 'farm', 'run7', 'lunge', 'run8', 'wb'];
  const RUN_IDS = ['run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'run8'];
  const ST_IDS = ['ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb'];
  const ALL_IDS = ORDER.concat(['rox', 'overall']);
  const BLOCKS = ['run', 'ski', 'push', 'pull', 'bbj', 'row', 'farm', 'lunge', 'wb', 'rox'];

  // tip: singles coaching note; dtip: the doubles version.
  // name: as listed in the report; label: running carries its scope (Runs 2-8) wherever it's compared.
  const META = {
    run: { name: 'Running', label: 'Running (Runs 2–⁠8)', short: 'Runs 2–⁠8', spec: 'Runs 2–⁠8',
      tip: 'Running is the biggest single share of the time between finish levels (about 40–45% in Open, a little less in Pro). Build your aerobic base, practise running straight off the stations, and take Runs 1–⁠2 a little easier than feels right.',
      dtip: 'Running is the biggest gap between doubles teams. You run every kilometre together, so pace to the slower partner and give the stronger runner more of the station work.' },
    ski: { name: 'SkiErg', spec: '1,000 m',
      tip: 'Drive each pull with your hips and lats, not just your arms, and hold a pace you can sustain. It\'s a small source of seconds, so don\'t bury yourself here before Run 2.',
      dtip: 'Plan your swaps (for example every 250 m) and rehearse the changeover: the handles can\'t be passed, so let go cleanly and get your partner pulling fast.' },
    push: { name: 'Sled Push', spec: '50 m',
      tip: 'Low hips, long arms, short fast steps, and keep the sled moving, because restarts cost the most. Sled times also depend on each venue\'s floor, so small gaps here can be the venue.',
      dtip: 'Swap at the end of each 12.5 m length so you both push fresh, and keep the sled moving. Sled times also depend on each venue\'s floor.' },
    pull: { name: 'Sled Pull', spec: '50 m',
      tip: 'Sit into a low, wide stance and pull hand over hand with your back and hips, then reset fast. Grip and posterior-chain strength make the difference.',
      dtip: 'A pair still takes about two-thirds of a solo time here, so swap often and keep the rope moving. Grip and posterior-chain strength make the difference.' },
    bbj: { name: 'Burpee Broad Jumps', short: 'Burpee Broad Jump', spec: '80 m',
      tip: 'Find a rhythm you never break: step back and step up if it keeps you moving, and land each jump ready for the next rep. One of the biggest station gaps between finish levels.',
      dtip: 'Short turns keep you both moving fast. Find a swap distance you can hold without breaking rhythm, and land each jump ready for the next rep.' },
    row: { name: 'Row', spec: '1,000 m',
      tip: 'Long, strong strokes at a steady rate (legs, then back, then arms). Hold a split you can sustain and use it to bring your heart rate down for the second half.',
      dtip: 'Rowing changeovers are the slowest of the race because the handle can\'t be passed: it goes back in its holder before your partner takes it. Keep swaps few and rehearsed (for example every 250–500 m).' },
    farm: { name: 'Farmers Carry', spec: '200 m',
      tip: 'Short, quick steps and no drops. Grip endurance is usually the limiter, so carry heavy in training until 200 m unbroken feels routine.',
      dtip: 'Plan one or two handovers and make them quick (the kettlebells can\'t be passed forward); extra swaps and drops are where teams lose time. Grip endurance is usually the limiter.' },
    lunge: { name: 'Sandbag Lunges', short: 'Lunges', spec: '100 m',
      tip: 'Keep the bag high and tight, take consistent steps and avoid standing breaks. Lunges cost far more time at slower finish levels.',
      dtip: 'Fewer, longer turns usually beat lots of short ones, because every sandbag handover costs time (it can\'t be passed forward). Keep steps consistent and the bag high.' },
    wb: { name: 'Wall Balls', spec: '100 reps',
      tip: 'Plan your sets before you\'re forced to break (for example 25-20-20-20-15) with short rests, and let your legs drive the ball. No-reps are pure lost time. At most levels this is the biggest single station gap.',
      dtip: 'Split the 100 reps into short sets so each partner stays unbroken, and hand the ball over (or let it drop) quickly at each swap. No-reps are pure lost time.' },
    rox: { name: 'Roxzone', spec: 'Transitions',
      tip: 'Nearly free time: jog every transition, learn the floor layout, and know your plan for each station before you reach it.',
      dtip: 'Nearly free time: jog every transition together and agree who starts each station before you get there.' },
  };
  const tipFor = (key, cat) => (cat.group === 'doubles' && META[key].dtip) || META[key].tip;
  const labelOf = key => META[key].label || META[key].name;
  const FIELD = {};
  RUN_IDS.forEach((id, i) => { FIELD[id] = { label: 'Run ' + (i + 1), spec: '1 km', kind: 'run', min: 120, max: 1200 }; });
  Object.assign(FIELD, {
    ski: { label: 'SkiErg', spec: '1,000 m', kind: 'st', min: 150, max: 900 },
    push: { label: 'Sled Push', spec: '50 m', kind: 'st', min: 40, max: 1500 },
    pull: { label: 'Sled Pull', spec: '50 m', kind: 'st', min: 45, max: 1500 },
    bbj: { label: 'Burpee Broad Jump', spec: '80 m', kind: 'st', min: 60, max: 1800 },
    row: { label: 'Row', spec: '1,000 m', kind: 'st', min: 150, max: 900 },
    farm: { label: 'Farmers Carry', spec: '200 m', kind: 'st', min: 30, max: 900 },
    lunge: { label: 'Sandbag Lunge', spec: '100 m', kind: 'st', min: 60, max: 1800 },
    wb: { label: 'Wall Balls', spec: '100 reps', kind: 'st', min: 90, max: 1800 },
    rox: { label: 'Roxzone', spec: 'total', kind: 'rox', min: 45, max: 2400 },
    overall: { label: 'Overall', spec: 'finish', kind: 'overall', min: 2100, max: 18000 },
  });
  const AFTER = [null, 'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps', 'Row', 'Farmers Carry', 'Sandbag Lunges'];

  const CAT_CODES = { 'men-open': 'mo', 'women-open': 'wo', 'men-pro': 'mp', 'women-pro': 'wp', 'dbl-men': 'dm', 'dbl-women': 'dw', 'dbl-mixed': 'dx', 'dbl-pro-men': 'dpm', 'dbl-pro-women': 'dpw' };
  const CODE_CATS = Object.fromEntries(Object.entries(CAT_CODES).map(([k, v]) => [v, k]));
  const DBL_SPREAD = ' Typical splits come from doubles teams; how unusual each split is (the % figures) is estimated from singles racers, because team-to-team spreads aren\'t published.';
  const PRO_NOTE = 'Pro races heavier sleds, sandbag, kettlebells and wall ball, so your splits are compared with other Pro athletes.';
  const CAT_NOTES = {
    'men-open': '',
    'women-open': '',
    'men-pro': PRO_NOTE,
    'women-pro': PRO_NOTE,
    'dbl-men': 'Enter your team\'s splits; you\'re compared with other teams in your division.' + DBL_SPREAD,
    'dbl-women': 'Enter your team\'s splits; you\'re compared with other teams in your division.' + DBL_SPREAD,
    'dbl-mixed': 'Enter your team\'s splits. Mixed teams race the men\'s Open weights and are compared with other Mixed teams.' + DBL_SPREAD,
    'dbl-pro-men': 'Enter your team\'s splits. Pro Doubles race the Pro weights and are compared with other Pro Doubles teams.' + DBL_SPREAD,
    'dbl-pro-women': 'Enter your team\'s splits. Pro Doubles race the Pro weights and are compared with other Pro Doubles teams.' + DBL_SPREAD,
  };
  // A believable race per division for "Try an example" (finish minutes, a bit faster than the median).
  const EXAMPLE_MIN = { 'men-open': 82, 'women-open': 91, 'men-pro': 76, 'women-pro': 83, 'dbl-men': 72, 'dbl-women': 83, 'dbl-mixed': 78, 'dbl-pro-men': 66, 'dbl-pro-women': 76 };

  // ───────────────────────── Utilities ─────────────────────────
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => sum(a) / a.length;
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmt(sec) {
    if (sec == null || !isFinite(sec)) return '–';
    let s = Math.round(Math.abs(sec));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (sec < 0 ? '−' : '') + (h ? h + ':' + pad(m) + ':' + pad(r) : m + ':' + pad(r));
  }
  function fmtDelta(sec) {
    const r = Math.round(sec);
    if (r === 0) return '±0:00';
    return (r > 0 ? '+' : '−') + fmt(Math.abs(r));
  }
  function fmtPace(sec) { return fmt(sec); }

  // Accepts 4:08, 04:08, 0:04:08, 1:04:34, 4.08, 408, 10434. Returns seconds, null (empty) or NaN (invalid).
  function parseTime(input) {
    if (input == null) return null;
    let s = String(input).trim();
    if (!s) return null;
    s = s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[.,;'’\s]+/g, ':').replace(/:+/g, ':').replace(/^:|:$/g, '');
    if (/^\d+$/.test(s)) {
      if (s.length <= 2) return NaN;
      if (s.length <= 4) { const m = +s.slice(0, -2), r = +s.slice(-2); return r < 60 ? m * 60 + r : NaN; }
      if (s.length <= 6) { const h = +s.slice(0, -4), m = +s.slice(-4, -2), r = +s.slice(-2); return m < 60 && r < 60 ? h * 3600 + m * 60 + r : NaN; }
      return NaN;
    }
    const p = s.split(':');
    if (p.some(x => !/^\d+$/.test(x))) return NaN;
    if (p.length === 2) { if (p[1].length !== 2 || +p[1] >= 60) return NaN; return +p[0] * 60 + +p[1]; }
    if (p.length === 3) { if (p[1].length !== 2 || p[2].length !== 2 || +p[1] >= 60 || +p[2] >= 60) return NaN; return +p[0] * 3600 + +p[1] * 60 + +p[2]; }
    return NaN;
  }
  // Goal times: no HYROX finish is under 30 minutes, so a short entry like 1:15, 1.15 or 115 means
  // hours and minutes (1:15:00), not minutes and seconds.
  function parseGoal(input) {
    const t = parseTime(input);
    return t > 0 && t < 1800 ? t * 60 : t;
  }
  const GOAL_MIN = 2400; // 40:00, faster than any HYROX world record
  const PEN_MIN = 15;    // official time this much above the splits: a penalty (the smallest is 15 s)
  const PEN_MAX = 900;   // more than 15 min above the splits is a typo, not penalties (a missed lap is 3–7 min)
  const SUM_SLACK = 30;  // splits may add up to a little more than the official time (rounding)

  // Standard normal CDF (Abramowitz-Stegun 7.1.26).
  function phi(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }

  // ───────────────────────── Benchmark model ─────────────────────────
  // Typical splits come from anchor rows (benchmarks.js): for each division, the typical time on
  // every part of the race for athletes (or teams) finishing at that time. Everything slides
  // continuously with the exact finish time; the <60 / 60-90 / 90+ brackets are labels only.
  const KEYS = B.cols.slice(1); // run, rox, ski, ...
  Object.entries(B.categories).forEach(([key, cat]) => {
    cat.key = key;
    cat._a = cat.anchors.map((row, i) => {
      const seg = {};
      KEYS.forEach((k, j) => { seg[k] = row[j + 1]; });
      const t = row[0] * 60, total = sum(Object.values(seg)), f = t / total;
      KEYS.forEach(k => { seg[k] *= f; }); // each anchor sums exactly to its finish time
      return { t, seg, conf: (cat.conf || '')[i] || 'h', legs: cat.legs ? cat.legs[i] : null };
    }).sort((a, b) => a.t - b.t);
  });

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  // Linear interpolation over [[x, y], ...] (x ascending), clamped at the ends.
  function interp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (x <= pts[i + 1][0]) { const w = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] * (1 - w) + pts[i + 1][1] * w; }
    }
    return pts[pts.length - 1][1];
  }

  function scaleSeg(seg, f) { const o = {}; KEYS.forEach(k => { o[k] = seg[k] * f; }); return o; }
  // Typical segment times for a finish time T (seconds): linear between anchors; above the table each
  // part keeps rising at its own end slope (ergs barely, wall balls a lot); below it, proportional.
  // Every result adds up to T.
  function expectedBlocks(catKey, T) {
    const A = B.categories[catKey]._a;
    if (T <= A[0].t) return scaleSeg(A[0].seg, T / A[0].t);
    const last = A[A.length - 1];
    if (T >= last.t) {
      const prev = A[A.length - 2], o = {};
      KEYS.forEach(k => { o[k] = last.seg[k] + ((T - last.t) * (last.seg[k] - prev.seg[k])) / (last.t - prev.t); });
      return o;
    }
    for (let i = 0; i < A.length - 1; i++) {
      if (T <= A[i + 1].t) {
        const w = (T - A[i].t) / (A[i + 1].t - A[i].t), o = {};
        KEYS.forEach(k => { o[k] = A[i].seg[k] * (1 - w) + A[i + 1].seg[k] * w; });
        return o;
      }
    }
    return scaleSeg(last.seg, T / last.t);
  }
  // How much data sits behind the benchmark at T: 'h', 'm', 'l', or 'x' (outside the table).
  function confidenceAt(catKey, T) {
    const A = B.categories[catKey]._a;
    if (T < A[0].t - 300 || T > A[A.length - 1].t + 300) return 'x';
    let i = 0;
    while (i < A.length - 1 && A[i + 1].t < T) i++;
    const pair = [A[i], A[Math.min(i + 1, A.length - 1)]];
    const near = Math.abs(pair[0].t - T) <= Math.abs(pair[1].t - T) ? pair[0] : pair[1];
    return pair.some(a => a.conf === 'l') && near.conf !== 'h' ? 'l' : near.conf;
  }
  // Typical shape of runs 1-8 (mean = 1) for a finish time.
  function runProfileAt(catKey, T) {
    const cat = B.categories[catKey];
    let p;
    if (cat.runShape) {
      // Doubles: pooled lap shape at the division median; slower teams fade more, faster teams less.
      const k = clamp(Math.pow(T / cat.runShape.at, cat.runShape.k), 0.5, 2.5);
      p = cat.runShape.p.map(x => 1 + (x - 1) * k);
    } else {
      const A = cat._a;
      if (T <= A[0].t) p = A[0].legs;
      else if (T >= A[A.length - 1].t) p = A[A.length - 1].legs;
      else {
        for (let i = 0; i < A.length - 1; i++) {
          if (T <= A[i + 1].t) { const w = (T - A[i].t) / (A[i + 1].t - A[i].t); p = A[i].legs.map((x, j) => x * (1 - w) + A[i + 1].legs[j] * w); break; }
        }
      }
    }
    const avg = mean(p);
    return p.map(x => x / avg);
  }

  // ── Percentiles ──
  // Inverse standard normal CDF (Acklam's rational approximation).
  function probit(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    p = clamp(p, 1e-6, 1 - 1e-6);
    const lo = 0.02425;
    if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // Finish distribution as [ln seconds, probit] points; piecewise linear, extended at the ends.
  function finishCurve(cat) {
    if (!cat._fc) cat._fc = cat.finish.map(([pc, s]) => [Math.log(s), probit(pc / 100)]);
    return cat._fc;
  }
  function lineThrough(P, x, xi, yi) {
    let i = 0;
    while (i < P.length - 2 && x > P[i + 1][xi]) i++;
    const a = P[i], b = P[i + 1];
    return a[yi] + ((x - a[xi]) * (b[yi] - a[yi])) / (b[xi] - a[xi]);
  }
  // Share (%) of the division finishing faster than T.
  function pctFaster(catKey, T) { return clamp(phi(lineThrough(finishCurve(B.categories[catKey]), Math.log(T), 0, 1)) * 100, 0.05, 99.95); }
  // Finish time at which pc% of the division finish faster.
  function finishAtPct(catKey, pc) { return Math.exp(lineThrough(finishCurve(B.categories[catKey]), probit(clamp(pc, 0.05, 99.95) / 100), 1, 0)); }

  // ── Spreads ──
  // Within-peer log-SD of each part, below and above the median, among athletes who finish at T.
  // Doubles borrow the matching singles spreads at the same place in their own field.
  const SD_FLOOR = { ski: 0.04, row: 0.04, run: 0.06, rox: 0.15 };
  const VENUE_WIDEN = { push: 1.25, pull: 1.25, rox: 1.25 }; // sled floors and Roxzone layouts vary by venue
  function spreadAt(catKey, key, T) {
    let cat = B.categories[catKey], Ts = T;
    if (cat.spreadFrom) { Ts = finishAtPct(cat.spreadFrom, pctFaster(catKey, T)); cat = B.categories[cat.spreadFrom]; }
    const S = cat.spread, m = Ts / 60;
    const pts = j => S.at.map((c, i) => [c, S[key][i][j]]);
    const w = VENUE_WIDEN[key] || 1, f = SD_FLOOR[key] || 0.05;
    return [Math.max(interp(pts(0), m), f) * w, Math.max(interp(pts(1), m), f) * w];
  }
  // Closed profiles sit about delta minutes slow of the true per-segment medians.
  function deltaAt(cat, T) { return cat.delta ? interp(cat.delta, T / 60) * 60 : 0; }

  // Ratings by where the split sits among same-finish peers (z of the log-ratio to their median).
  function rate(z) {
    if (z >= 1.28) return { id: 'big', text: 'Big opportunity' };   // slower than ~90% of peers
    if (z >= 0.67) return { id: 'weak', text: 'Time to gain' };     // slower than ~75%
    if (z > -0.67) return { id: 'par', text: 'Normal range' };      // the middle half
    if (z > -1.28) return { id: 'solid', text: 'Strength' };        // faster than ~75%
    return { id: 'strong', text: 'Big strength' };                  // faster than ~90%
  }
  const NOT_RATED = { id: 'none', text: 'Not rated' };
  function bracketOf(sec) { const m = sec / 60; return m < 60 ? 'Under 60 min' : m < 90 ? '60–90 min' : '90+ min'; }

  // ───────────────────────── Analysis ─────────────────────────
  function analyze(catKey, v, goalSec) {
    const cat = B.categories[catKey];
    const runs = RUN_IDS.map(id => v[id]);
    const runTotal = sum(runs);
    const stTotal = sum(ST_IDS.map(id => v[id]));
    let rox = v.rox, roxInferred = false;
    if (rox == null) { rox = v.overall - runTotal - stTotal; roxInferred = true; }
    const T = runTotal + stTotal + rox;            // what the splits add up to
    const official = v.overall != null ? v.overall : T;
    // Run 1 isn't compared: the start lap is shorter or longer at many venues. Peers are the racers
    // whose splits add up like yours with a typical first lap, so a short or long start lap doesn't
    // shift who you're compared with.
    let Tp = T;
    for (let i = 0; i < 4; i++) { const e = expectedBlocks(catKey, Tp), p = runProfileAt(catKey, Tp); Tp = T - runs[0] + (e.run / 8) * p[0]; }
    const E = expectedBlocks(catKey, Tp);          // typical splits for your peers (they add up to Tp)
    const prof = runProfileAt(catKey, Tp);
    const run28 = runTotal - runs[0];
    const share28 = sum(prof.slice(1)) / 8;
    // Medians for the ratings: the closed profile sits a little slow of the true medians.
    const Tm = Tp - deltaAt(cat, Tp);
    const M = expectedBlocks(catKey, Tm), profM = runProfileAt(catKey, Tm);
    const actual = { run: run28, rox }, exp = { run: E.run * share28, rox: E.rox }, med = { run: M.run * sum(profM.slice(1)) / 8, rox: M.rox };
    ST_IDS.forEach(k => { actual[k] = v[k]; exp[k] = E[k]; med[k] = M[k]; });
    // Beyond our race data (more than 5 min past either end of the table) typicals are extrapolated:
    // show the seconds, but don't rate the splits or quote shares of peers.
    const outside = Tp < cat._a[0].t - 300 || Tp > cat._a[cat._a.length - 1].t + 300;

    const items = BLOCKS.map(key => {
      const a = actual[key], e = exp[key], d = a - e;
      const r = Math.log(a / med[key]);
      const sd = spreadAt(catKey, key, Tp);
      const z = r / (r < 0 ? sd[0] : sd[1]);
      return { key, name: META[key].name, label: labelOf(key), spec: META[key].spec, actual: a, exp: e, d, z, rating: outside ? NOT_RATED : rate(z), fasterShare: phi(z), noShare: outside };
    });
    // Time-savers: your biggest gaps in seconds (10 s or more), the way repeat racers' next-race
    // gains are best predicted. Each one also says where it sits among your peers.
    const leaks = items.filter(i => i.d >= 10).sort((a, b) => b.d - a.d);
    const onTable = sum(items.filter(i => i.d > 0).map(i => i.d));
    // Official times include penalties; splits don't. Small differences are timing rounding.
    const penalty = official - T > PEN_MIN ? official - T : 0;

    const expRuns = prof.map(p => (E.run / 8) * p);
    const avg28 = run28 / 7, expAvg28 = exp.run / 7;
    const own = run28 / sum(prof.slice(1));         // your own pace on the typical shape
    const runRows = runs.map((r, i) => ({ n: i + 1, actual: r, exp: expRuns[i], d: r - expRuns[i], shape: own * prof[i], after: AFTER[i] }));
    // Fade: runs 5-7 vs runs 2-4 (Run 1 and Run 8 lengths vary by venue).
    const fade = mean(runs.slice(4, 7)) - mean(runs.slice(1, 4));
    const typFade = own * (mean(prof.slice(4, 7)) - mean(prof.slice(1, 4)));

    const pct = pctFaster(catKey, official);
    const res = {
      catKey, cat, v, official, T, Tp, rox, roxInferred, penalty, runTotal, run28, stTotal, E, exp,
      items, leaks, onTable, projected: official - penalty - onTable, runs, runRows, avg: runTotal / 8, avg28, expAvg28, fade, typFade, prof,
      run1Gap: runs[0] - expRuns[0], pct, conf: outside ? 'x' : confidenceAt(catKey, Tp), outside,
    };
    // Goals are set from your clean time: with a penalty, from what your splits add up to.
    res.goalBase = penalty ? T : official;
    const goalOk = goalSec != null && !isNaN(goalSec) && goalSec >= GOAL_MIN && goalSec < official;
    res.goalTyped = goalSec != null ? goalSec : null;
    res.goalIgnored = goalSec != null && !goalOk;
    res.goal = goalOk ? goalSec : suggestGoal(catKey, res.goalBase);
    res.plan = planGoal(res, res.goal);
    return res;
  }

  // Next-race gains by level (share of finish time, typical / upper quartile), from repeat racers.
  const GAIN = [[10, 0.0005, 0.034], [25, 0.009, 0.048], [50, 0.017, 0.061], [75, 0.029, 0.081], [100, 0.057, 0.125]];
  function gainAt(catKey, base) { const p = pctFaster(catKey, base); return GAIN.find(g => p <= g[0]); }
  // Default goal: the next 5-minute mark (sub 60, sub 1:25 ...) when it's within a strong next race
  // for your level, otherwise that strong next race to the nearest minute; never less than 30 s
  // faster (the 5-minute mark still shows as a chip).
  function suggestGoal(catKey, base) {
    const stretch = base * (1 - gainAt(catKey, base)[2]);
    const mark = Math.floor((base - 1) / 300) * 300;
    let g = mark >= stretch - 1 ? mark : Math.round(stretch / 60) * 60;
    if (g > base - 30) g = Math.floor((base - 30) / 60) * 60;
    return Math.max(g, GOAL_MIN);
  }
  // Goal chips: the suggestion plus the next two 5-minute marks.
  function goalOptions(catKey, base) {
    const a = suggestGoal(catKey, base);
    const m1 = Math.floor((base - 1) / 300) * 300, m2 = m1 - 300;
    const opts = [a, m1];
    if (base - m2 <= base * 0.15) opts.push(m2);
    return Array.from(new Set(opts)).filter(x => x >= GOAL_MIN && x < base).sort((x, y) => y - x).slice(0, 3);
  }

  // Personal targets for a goal: a segment where you are already faster than goal pace keeps
  // your time; the rest are set to lambda x the goal-time typical split, with lambda chosen so
  // the targets add up exactly. Running here is all 8 km. Three things are carried as offsets, not
  // as time to cut: a penalty (its own row), a few seconds of timing rounding, and a venue's long
  // or short first lap (the plan assumes the same start lap next time).
  function planGoal(res, goal) {
    if (!(goal > 0) || goal >= res.official) return null;
    const pen = res.penalty, r1 = res.run1Gap;
    const base0 = res.T - r1;                                   // your splits with a typical first lap
    const gSum = goal + (res.T - res.official) + pen - r1;      // what those must add up to
    const act = { run: res.runTotal - r1, rox: res.rox };
    ST_IDS.forEach(k => { act[k] = res.v[k]; });
    const base = { goal, need: res.official - goal, penalty: pen, splitsSum: res.T, run1: r1, rows: [] };
    if (gSum >= base0 - 0.5) {
      // Your splits already add up to the goal: the penalty was the difference.
      base.splitsOk = true;
      const EG0 = expectedBlocks(res.catKey, goal);
      base.rows = BLOCKS.map(k => ({ key: k, name: META[k].name, actual: k === 'run' ? res.runTotal : act[k], target: k === 'run' ? res.runTotal : act[k], typicalAtGoal: EG0[k], cut: 0, keep: true }));
      return base;
    }
    const EG = expectedBlocks(res.catKey, gSum);
    const total = lam => sum(BLOCKS.map(k => Math.min(act[k], lam * EG[k])));
    // At hi every segment keeps its own time (total = T), so the answer is always bracketed.
    let lo = 0, hi = Math.max(5, ...BLOCKS.map(k => act[k] / EG[k])) + 0.01;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (total(mid) < gSum) lo = mid; else hi = mid; }
    const lam = (lo + hi) / 2;
    base.rows = BLOCKS.map(k => {
      const cut = act[k] - Math.min(act[k], lam * EG[k]);
      const shown = k === 'run' ? res.runTotal : act[k];        // what you actually ran
      return { key: k, name: META[k].name, actual: shown, target: shown - cut, typicalAtGoal: EG[k] + (k === 'run' ? r1 : 0), cut, keep: cut < 0.5 };
    }).sort((a, b) => b.cut - a.cut);
    return base;
  }

  // ───────────────────────── Input UI ─────────────────────────
  const state = { cat: 'men-open', goalTouched: false };
  const grid = $('#splitGrid');

  function fieldHTML(id) {
    const f = FIELD[id];
    const ph = id === 'overall' ? '1:15:00' : id === 'rox' ? '6:30' : f.kind === 'run' ? '4:45' : '4:30';
    return '<label class="sf" for="t-' + id + '"><span class="sl">' + esc(f.label) + ' <small>' + esc(f.spec) + '</small></span>' +
      '<input class="tin" id="t-' + id + '" data-id="' + id + '" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="' + ph + '" aria-describedby="m-' + id + '">' +
      '<span class="fmsg" id="m-' + id + '"></span></label>';
  }
  function buildGrid() {
    let h = '';
    for (let r = 0; r < 8; r++) {
      h += '<div class="round"><span class="rn" aria-hidden="true">' + pad(r + 1) + '</span>' + fieldHTML(RUN_IDS[r]) + fieldHTML(ST_IDS[r]) + '</div>';
    }
    h += '<div class="round extra"><span class="rn" aria-hidden="true"></span>' + fieldHTML('rox') + fieldHTML('overall') + '</div>';
    grid.innerHTML = h;
  }

  const inputOf = id => $('#t-' + id);
  function readValues() {
    const v = {}, bad = [];
    ALL_IDS.forEach(id => {
      const el = inputOf(id);
      const t = parseTime(el.value);
      if (t === null) v[id] = null;
      else if (isNaN(t)) { v[id] = null; bad.push(id); }
      else v[id] = t;
    });
    return { v, bad };
  }
  // src says where a value came from: 'sample', 'link' (a report link), 'import' (screenshot or
  // paste) or nothing (typed). A new import clears sample and link values so they can't mix in.
  function setValue(id, sec, auto, src) {
    const el = inputOf(id);
    if (!el) return;
    el.value = sec == null ? '' : fmt(sec);
    el.classList.toggle('auto', !!auto && sec != null);
    el.classList.remove('bad');
    if (src && sec != null) el.dataset.src = src; else delete el.dataset.src;
    $('#m-' + id).textContent = '';
  }

  function validateField(id, strict) {
    const el = inputOf(id), msg = $('#m-' + id), f = FIELD[id];
    const t = parseTime(el.value);
    let m = '';
    if (t !== null && isNaN(t)) m = id === 'overall' ? 'Use h:mm:ss, e.g. 1:15:00' : 'Use m:ss, e.g. 4:30';
    else if (t !== null && (t < f.min || t > f.max)) m = 'That looks off. Check this time.';
    else if (strict && t === null && id !== 'rox' && id !== 'overall') m = 'Needed';
    el.classList.toggle('bad', !!m);
    msg.textContent = m;
    return !m;
  }

  function refreshTotals() {
    const { v } = readValues();
    const runsOk = RUN_IDS.every(id => v[id] != null), stOk = ST_IDS.every(id => v[id] != null);
    const runTot = sum(RUN_IDS.map(id => v[id] || 0)), stTot = sum(ST_IDS.map(id => v[id] || 0));
    $('#totRun').textContent = runsOk ? fmt(runTot) : (runTot ? fmt(runTot) + '…' : '–');
    $('#totAvg').textContent = runsOk ? fmt(runTot / 8) : '–';
    $('#totSt').textContent = stOk ? fmt(stTot) : (stTot ? fmt(stTot) + '…' : '–');
    let rox = v.rox, roxEst = false;
    if (rox == null && v.overall != null && runsOk && stOk) { rox = v.overall - runTot - stTot; roxEst = true; }
    $('#totRox').textContent = rox == null ? '–' : (roxEst ? '≈' : '') + fmt(rox);
    const overall = v.overall != null ? v.overall : (runsOk && stOk && v.rox != null ? runTot + stTot + v.rox : null);
    $('#totAll').textContent = overall == null ? '–' : fmt(overall);

    const note = $('#sumNote');
    note.className = 'sum-note';
    note.textContent = '';
    let goalBase = overall;                      // goals come from the clean time (no penalty)
    if (runsOk && stOk && v.rox != null && v.overall != null) {
      const total = runTot + stTot + v.rox, off = v.overall - total;
      const warn = t => { note.className = 'sum-note warn'; note.textContent = t; };
      if (off < -SUM_SLACK) warn('Your splits and Roxzone add up to ' + fmt(total) + ', more than your overall ' + fmt(v.overall) + '. Check for a typo.');
      else if (off < -PEN_MIN) warn('Your splits add up to ' + fmt(total) + ', ' + fmt(-off) + ' more than your official time. That\'s more than timing rounding, so check for a typo.');
      else if (off > PEN_MAX) warn('Your overall is ' + fmt(off) + ' more than your splits and Roxzone add up to. That\'s more than penalties explain: check for a typo, or clear Overall.');
      else if (off > PEN_MIN) {
        warn('Your splits add up to ' + fmt(total) + ', ' + fmt(off) + ' less than your official time. That\'s usually a penalty' + (off >= 180 ? ' (a missed run lap costs 3–7 min)' : '') + '; if not, check for a typo. The analysis uses your splits.');
        goalBase = total;
      } else if (off !== 0) note.textContent = 'Your splits add up to ' + fmt(total) + '; a few seconds\' difference from your official time is normal timing rounding.';
    } else if (roxEst) {
      if (rox < 45) { note.className = 'sum-note warn'; note.textContent = 'Your overall time is less than (or barely more than) your runs plus stations. Check your splits.'; }
      else if (rox > FIELD.rox.max) { note.className = 'sum-note warn'; note.textContent = 'Your overall leaves ' + fmt(rox) + ' for Roxzone. Check for a typo, or enter your Roxzone time.'; }
      else note.textContent = 'Roxzone worked out from your overall time, so it includes any penalties.';
    }

    const filled = ORDER.filter(id => v[id] != null).length + (v.rox != null || v.overall != null ? 1 : 0);
    const pill = $('#filledPill');
    pill.textContent = filled + ' / 17';
    pill.classList.toggle('full', filled === 17);
    refreshGoalPresets(goalBase && runsOk && stOk ? goalBase : null);
    // Keep the goal field's message in step with the finish time it's checked against.
    if ($('#t-goal').value.trim()) checkGoal(overall && runsOk && stOk ? overall : null);
  }

  // Rebuild the Quick picks only when the options change, so a click that blurs a field (which
  // refreshes the totals) still lands on its button.
  function refreshGoalPresets(official) {
    const box = $('#goalPresets');
    if (!official) {
      if (box.dataset.key !== 'none') { box.dataset.key = 'none'; box.innerHTML = '<span class="hint">Enter your splits to see suggestions.</span>'; }
      return;
    }
    const opts = goalOptions(currentCat(), official), key = opts.join(',');
    if (box.dataset.key !== key) {
      box.dataset.key = key;
      box.innerHTML = opts.map(g => '<button type="button" data-g="' + g + '">Sub ' + fmt(g) + '</button>').join('');
    }
    const goalNow = parseGoal($('#t-goal').value);
    $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.g === goalNow)));
  }
  // Goal field: read it as a goal time and check it against the finish. Returns the goal in
  // seconds, or null when empty or unusable (with a message on the field).
  function checkGoal(official) {
    const el = $('#t-goal'), msg = $('#m-goal');
    const g = parseGoal(el.value);
    let m = '';
    if (g === null) m = '';
    else if (isNaN(g)) m = 'Use h:mm:ss, e.g. 1:15:00';
    else if (g < GOAL_MIN) m = 'That\'s faster than any HYROX finish. Use h:mm:ss, e.g. 1:15:00';
    else if (official && g >= official) m = 'Pick a goal faster than your ' + fmt(official) + ' finish';
    el.classList.toggle('bad', !!m);
    msg.textContent = m;
    return m || g === null || isNaN(g) ? null : g;
  }

  function currentCat() { const r = $('input[name="cat"]:checked'); return r ? r.value : 'men-open'; }
  function setCat(key) {
    const r = $('input[name="cat"][value="' + key + '"]');
    if (r) r.checked = true;
    state.cat = key;
    $('#catNote').textContent = CAT_NOTES[key] || '';
  }

  // ───────────────────────── Import: paste, screenshots, example ─────────────────────────
  const LABEL_DEFS = [
    ['avg', /\b(?:avg|average)\.?\s*(?:run|pace|lap)\b/gi],
    // Run 1-8. The reader often turns the number into a look-alike letter (Run 5 → "Runs",
    // Run 8 → "Rung"); a letter only counts as a number when a run-length time (under 20 min)
    // follows it on the same line, so a "Runs 49:39" total is never taken for Run 5.
    ['run', /\bru[nm]{1,2}(?:ing)?\s*#?\s*(?:([1-8lI|])(?![\d:])|([sSzZbBgG&])(?=\s+1?\d[:.]\d{2}(?![\d:])))/gi],
    ['runtotal', /\brun(?:ning)?\s*total\b|\btotal\s*run(?:ning)?\b|\brunning\b(?!\s*#?\s*[1-8lI|](?![\d:]))/gi],
    ['functional', /\bfunctional\b|\bwork\s*total\b|\bstations?\s*total\b|\btotal\s*work\b/gi],
    ['ski', /\bski\s*-?\s*erg\b|\bski\b/gi],
    ['push', /\bsled\s*-?\s*pu[s5]h\b|\bpu[s5]h\b/gi],
    ['pull', /\bsled\s*-?\s*pu[l1I|]{2}\b|\bpu[l1I|]{2}\b/gi],
    ['bbj', /\bburpees?(?:\s*broad\s*jumps?)?\b|\bbroad\s*jumps?\b|\bbbj\b/gi],
    ['row', /\brow(?:ing|erg)?\b/gi],
    ['farm', /\bfarmers?['’]?s?(?:\s*carry)?\b|\bcarry\b/gi],
    ['lunge', /\b(?:sandbag\s*)?lunges?\b|\bsandbag\b/gi],
    ['wb', /\bwall\s*-?\s*ba[l1I|]{2}s?\b|\bwallballs?\b/gi],
    ['rox', /\bro[xk]\w{0,2}\s*-?\s*z?[o0]ne\b|\btransitions?\b/gi],
    ['overall', /\b[o0]verall(?:\s*time)?\b|\bfinish(?:\s*time)?\b|\btotal\s*time\b|\bfinal\s*time\b|\bnet\s*time\b/gi],
  ];
  const IGNORE = { avg: 1, runtotal: 1, functional: 1 };

  function normLine(line) {
    // Fix common OCR slips inside time-like tokens that aren't glued to a word:
    // O→0, l/I/|→1, S→5, B→8, Z→2 (only in tokens that already contain a real digit).
    return line.replace(/(^|[^A-Za-z])([\dOoIl|SsBZz]{1,2}[:.][\dOoIl|SsBZz]{2}(?:[:.][\dOoIl|SsBZz]{2})?)(?![A-Za-z])/g, (all, pre, tok) =>
      /\d/.test(tok) ? pre + tok.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2') : all);
  }
  // Look-alike characters the reader puts in place of a run number.
  const RUN_LOOKALIKE = { l: '1', L: '1', I: '1', i: '1', '|': '1', z: '2', Z: '2', s: '5', S: '5', b: '6', G: '6', B: '8', g: '8', '&': '8' };
  function findLabels(line) {
    const hits = [];
    LABEL_DEFS.forEach(([id, re]) => {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        let key = id;
        if (id === 'run') { const c = m[1] || m[2]; key = 'run' + (/[1-8]/.test(c) ? c : RUN_LOOKALIKE[c]); }
        hits.push({ key, idx: m.index, end: m.index + m[0].length, len: m[0].length });
        if (m[0].length === 0) re.lastIndex++;
      }
    });
    hits.sort((a, b) => a.idx - b.idx || b.len - a.len);
    const out = [];
    hits.forEach(h => { if (!out.length || h.idx >= out[out.length - 1].end) out.push(h); });
    return out;
  }
  function findTimes(line) {
    const re = /(^|[^\d:.])(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?![\d:.])/g;
    const out = [];
    let m;
    while ((m = re.exec(line))) {
      const a = +m[2], b = +m[3], c = m[4] != null ? +m[4] : null;
      if (b >= 60 || (c != null && c >= 60)) continue;
      out.push({ sec: c != null ? a * 3600 + b * 60 + c : a * 60 + b, idx: m.index + m[1].length });
    }
    return out;
  }
  function parseSplitsText(text) {
    const lines = String(text || '').split(/\r?\n/).map(normLine).filter(l => l.trim());
    const got = {}, conflicts = [];
    const put = (key, sec) => {
      if (IGNORE[key] || !FIELD[key]) return;
      if (got[key] == null) got[key] = sec;
      else if (Math.abs(got[key] - sec) > 1) conflicts.push(key);
    };
    for (let i = 0; i < lines.length; i++) {
      const labels = findLabels(lines[i]);
      if (!labels.length) continue;
      const times = findTimes(lines[i]);
      if (times.length) {
        labels.forEach((lab, k) => {
          const next = labels[k + 1] ? labels[k + 1].idx : Infinity;
          const t = times.find(x => x.idx >= lab.end && x.idx < next);
          if (t) put(lab.key, t.sec);
        });
      } else {
        // Label row with the values on the next line (summary tiles, one-per-line layouts).
        for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
          if (findLabels(lines[j]).length) break;
          const t2 = findTimes(lines[j]);
          if (t2.length) {
            if (labels.length === 1) put(labels[0].key, t2[0].sec);
            else labels.forEach((lab, k) => { if (t2[k]) put(lab.key, t2[k].sec); });
            break;
          }
        }
      }
    }
    return { got, conflicts };
  }

  function applyParsed(parsed, sourceText) {
    const keys = Object.keys(parsed.got).filter(k => ALL_IDS.includes(k));
    const n = keys.length;
    if (!n) {
      showStatus('err', 'We couldn\'t find any splits in ' + sourceText + '. Make sure the split names and times are visible, or type them in below.');
      return;
    }
    // Start from a clean slate for this race: drop sample and report-link values, and earlier
    // screenshot values too when this import shows a different race (same split, new time).
    // Times you typed stay. A second screenshot of the same race only adds to the first.
    const newRace = keys.some(k => { const el = inputOf(k), cur = parseTime(el.value); return el.dataset.src === 'import' && cur != null && !isNaN(cur) && Math.abs(cur - parsed.got[k]) > 1; });
    ALL_IDS.forEach(id => { const s = inputOf(id).dataset.src; if (s === 'sample' || s === 'link' || (newRace && s === 'import')) setValue(id, null); });
    keys.forEach(k => setValue(k, parsed.got[k], true, 'import'));
    ALL_IDS.forEach(id => { if (inputOf(id).value) validateField(id, false); });
    // A report already on screen was for other numbers; take it down until Analyze is pressed.
    if (!$('#report').hidden) {
      $('#report').hidden = true;
      lastRes = null;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    }
    refreshTotals();
    const need = ORDER.filter(id => parseTime(inputOf(id).value) == null);
    const hasEnd = parseTime(inputOf('rox').value) != null || parseTime(inputOf('overall').value) != null;
    const missing = need.map(id => FIELD[id].label).concat(hasEnd ? [] : ['Roxzone or Overall']);
    const nTxt = n + (n === 1 ? ' time' : ' times');
    if (!missing.length) showStatus('ok', 'Read <b>' + nTxt + '</b> from ' + esc(sourceText) + '. Give them a quick check (filled fields are marked in yellow), then hit Analyze.');
    else if (!need.length) showStatus('warn', 'Read <b>' + nTxt + '</b> from ' + esc(sourceText) + ': all 16 splits are in. Now add your <b>Overall</b> time (or Roxzone) below and we\'ll work out the other.');
    else showStatus('warn', 'Read <b>' + nTxt + '</b> from ' + esc(sourceText) + '. Still missing: <b>' + esc(missing.join(', ')) + '</b>. Add another screenshot or type them in.');
    const conflicts = Array.from(new Set(parsed.conflicts));
    if (conflicts.length) {
      $('#importStatus div').insertAdjacentHTML('beforeend', '<br>Different times were found for ' + esc(conflicts.map(k => FIELD[k].label).join(', ')) + '; we kept the first. Please check.');
    }
  }

  function showStatus(kind, html, progress) {
    const st = $('#importStatus');
    st.hidden = false;
    st.className = 'import-status' + (kind === 'busy' ? ' busy' : kind === 'warn' ? ' warn' : kind === 'err' ? ' err' : '');
    st.innerHTML = '<span class="dot"></span><div>' + html + (progress != null ? '<div class="bar"><i style="width:' + Math.round(progress * 100) + '%"></i></div>' : '') + '</div>';
  }
  function setProgress(p) { const i = $('#importStatus .bar i'); if (i) i.style.width = Math.round(p * 100) + '%'; }

  const OCR_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let ocrLib = null;
  function loadOCR() {
    if (!ocrLib) {
      ocrLib = new Promise((resolve, reject) => {
        if (window.Tesseract) return resolve(window.Tesseract);
        const s = document.createElement('script');
        s.src = OCR_SRC; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = () => resolve(window.Tesseract);
        s.onerror = () => { ocrLib = null; reject(new Error('load')); };
        document.head.appendChild(s);
      });
    }
    return ocrLib;
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  // Turn a phone screenshot into clean black text on white. Dark-mode apps (white text on
  // charcoal and colored bars) keep only near-white pixels as text; light pages keep dark ones.
  function binarize(img) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const f = w0 < 1000 ? 2 : w0 > 1700 ? 1700 / w0 : 1;
    const w = Math.round(w0 * f), h = Math.round(h0 * f);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h), px = d.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) hist[(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) | 0]++;
    let acc = 0, median = 0;
    const half = (px.length / 4) / 2;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= half) { median = i; break; } }
    const dark = median < 110;
    for (let i = 0; i < px.length; i += 4) {
      const L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const ink = dark ? L >= 185 : L <= 140;
      const val = ink ? 0 : 255;
      px[i] = px[i + 1] = px[i + 2] = val; px[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }
  async function ocrImages(images, onStep) {
    const T = await loadOCR();
    let cur = 0;
    const worker = await T.createWorker('eng', 1, {
      logger: m => { if (m.status === 'recognizing text' && onStep) onStep(cur, m.progress || 0); },
    });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const texts = [];
    for (cur = 0; cur < images.length; cur++) {
      if (onStep) onStep(cur, 0);
      const { data } = await worker.recognize(binarize(images[cur]));
      texts.push(data.text);
    }
    await worker.terminate();
    return texts.join('\n');
  }
  async function readScreenshots(files) {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const label = list.length === 1 ? 'your screenshot' : 'your ' + list.length + ' screenshots';
    showStatus('busy', 'Loading the screenshot reader…', 0.02);
    try {
      const imgs = [];
      for (const f of list) imgs.push(await loadImage(f));
      const text = await ocrImages(imgs, (i, p) => {
        const msg = 'Reading ' + (list.length > 1 ? 'screenshot ' + (i + 1) + ' of ' + list.length : 'your screenshot') + '…';
        const st = $('#importStatus div');
        if (st && st.firstChild && st.firstChild.nodeType === 3) st.firstChild.nodeValue = msg;
        else showStatus('busy', msg, 0);
        setProgress((i + p) / list.length);
      });
      window.__lastOCR = text; // handy when checking a screenshot that didn't read well
      applyParsed(parseSplitsText(text), label);
    } catch (e) {
      showStatus('err', e && e.message === 'image'
        ? 'That file couldn\'t be opened as an image. Try a PNG or JPG screenshot.'
        : 'The screenshot reader couldn\'t load (check your connection). You can paste or type your splits instead.');
    }
  }

  function exampleFor(catKey) {
    const T = EXAMPLE_MIN[catKey] * 60;
    const E = expectedBlocks(catKey, T);
    const prof = runProfileAt(catKey, T);
    // A believable athlete: strong runner, slow on wall balls and the sled push, loose transitions.
    const tweak = { run: 0.935, rox: 1.15, ski: 0.99, push: 1.24, pull: 1.05, bbj: 0.96, row: 0.96, farm: 1.03, lunge: 1.07, wb: 1.27 };
    const v = {};
    const fadeShape = [0.985, 0.99, 1.0, 1.0, 1.01, 1.005, 1.0, 1.01];
    RUN_IDS.forEach((id, i) => { v[id] = Math.round((E.run * tweak.run / 8) * prof[i] * fadeShape[i]); });
    ST_IDS.forEach(k => { v[k] = Math.round(E[k] * tweak[k]); });
    v.rox = Math.round(E.rox * tweak.rox);
    v.overall = sum(ORDER.map(id => v[id])) + v.rox;
    return v;
  }
  // Fill a sample race for the division you picked (Men's Open by default, as on the hero card).
  // Any splits of your own (typed, pasted, read from a screenshot or a link) are only replaced on a yes.
  function fillExample() {
    const own = ALL_IDS.some(id => { const el = inputOf(id); return el.value.trim() && el.dataset.src !== 'sample'; });
    if (own && !window.confirm('Replace your splits with a sample race?')) return false;
    const v = exampleFor(currentCat());
    ALL_IDS.forEach(id => setValue(id, v[id], true, 'sample'));
    showStatus('ok', 'Filled in a <b>sample race</b> for ' + esc(B.categories[currentCat()].label) + '. Swap in your own splits any time.');
    refreshTotals();
    return true;
  }

  // ───────────────────────── Analyze + share ─────────────────────────
  function collect(strict) {
    const errors = [];
    let firstBad = null;
    ALL_IDS.forEach(id => {
      const ok = validateField(id, strict);
      if (!ok) { errors.push(id); if (!firstBad) firstBad = id; }
    });
    const { v } = readValues();
    if (strict && v.rox == null && v.overall == null) {
      errors.push('end');
      $('#m-rox').textContent = 'Add Roxzone or Overall';
      inputOf('rox').classList.add('bad');
      if (!firstBad) firstBad = 'rox';
    }
    if (!errors.length && v.rox == null) {
      const r = v.overall - sum(ORDER.map(id => v[id]));
      if (r < 45) { errors.push('sum'); firstBad = 'overall'; }
      else if (r > FIELD.rox.max) { errors.push('roxbig'); firstBad = 'overall'; }
    }
    if (!errors.length && v.rox != null && v.overall != null) {
      const total = sum(ORDER.map(id => v[id])) + v.rox;
      if (v.overall < total - SUM_SLACK) { errors.push('over'); firstBad = 'overall'; }
      else if (v.overall - total > PEN_MAX) { errors.push('under'); firstBad = 'overall'; }
    }
    return { v, errors, firstBad };
  }

  function runAnalysis(opts) {
    opts = opts || {};
    const { v, errors, firstBad } = collect(true);
    const fe = $('#formError');
    if (errors.length) {
      const missing = ORDER.filter(id => parseTime(inputOf(id).value) === null).length;
      let msg = 'Please fix the highlighted times.';
      if (errors.includes('sum')) msg = 'Your overall time is less than (or barely more than) your runs plus stations. Check your overall time and splits, or add your Roxzone time.';
      else if (errors.includes('over')) msg = 'Your splits and Roxzone add up to ' + fmt(sum(ORDER.map(id => v[id])) + v.rox) + ', more than your overall ' + fmt(v.overall) + '. Check for a typo.';
      else if (errors.includes('under')) msg = 'Your overall is ' + fmt(v.overall - sum(ORDER.map(id => v[id])) - v.rox) + ' more than your splits and Roxzone add up to. That\'s more than penalties explain: check for a typo, or clear Overall.';
      else if (errors.includes('roxbig')) msg = 'Your overall leaves ' + fmt(v.overall - sum(ORDER.map(id => v[id]))) + ' for Roxzone. Check for a typo, or enter your Roxzone time.';
      else if (missing) msg = missing + ' split' + (missing === 1 ? ' is' : 's are') + ' still empty. We need all 8 runs and all 8 stations.';
      else if (errors.includes('end')) msg = 'Add your Roxzone time or your overall finish time.';
      fe.textContent = msg;
      fe.classList.add('show');
      if (firstBad && !opts.silent) inputOf(firstBad).focus();
      return false;
    }
    fe.classList.remove('show');
    const official = v.overall != null ? v.overall : sum(ORDER.map(id => v[id])) + v.rox;
    checkGoal(official); // field message for a goal we can't use; analyze() then picks one and says so
    const gText = $('#t-goal').value.trim();
    const gRaw = parseGoal(gText);
    const res = analyze(currentCat(), v, gRaw == null ? null : gRaw);   // NaN = typed but unreadable
    res.goalText = gText;
    // Show the report before drawing it, so the run chart is measured at its real width.
    const rep = $('#report');
    rep.hidden = false;
    renderReport(res);
    writeHash(res);
    if (!opts.noScroll) setTimeout(() => rep.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 30);
    return true;
  }

  // Share links carry the division, the 18 times and the goal (only when it was used).
  function hashFor(res) {
    const vals = ALL_IDS.map(id => (res.v[id] == null ? '' : res.v[id])).join('.');
    const g = res.plan && res.goalTyped === res.goal ? res.goal : null;
    return '#r=' + CAT_CODES[res.catKey] + '~' + vals + (g ? '~' + g : '');
  }
  function writeHash(res) {
    try { history.replaceState(null, '', location.pathname + location.search + hashFor(res)); } catch (e) { /* file:// */ }
  }
  // Read a share link. Copes with messengers that percent-encode '~' or add a trailing '~'.
  function readHash() {
    let h = location.hash;
    try { h = decodeURIComponent(h); } catch (e) { /* keep as is */ }
    if (!/^#r=/i.test(h)) return false;
    // A valid link only has these characters; drop anything a messenger tacked on.
    h = h.replace(/[^#=a-z0-9.~]/gi, '').replace(/(~\d+)\.+$/, '$1').replace(/~+$/, '');
    const m = /^#r=([a-z]{2,3})~([\d.]+)(?:~(\d+))?$/i.exec(h);
    const code = m && m[1].toLowerCase();
    let parts = m ? m[2].split('.') : [];
    if (m && parts.length === ALL_IDS.length + 1 && parts[parts.length - 1] === '') parts = parts.slice(0, -1); // stray trailing '.'
    if (!m || !CODE_CATS[code] || parts.length !== ALL_IDS.length) {
      showStatus('warn', 'That report link couldn\'t be read. Enter your splits below, or ask for the link again.');
      return false;
    }
    setCat(CODE_CATS[code]);
    ALL_IDS.forEach((id, i) => setValue(id, parts[i] === '' ? null : +parts[i], true, 'link'));
    $('#t-goal').value = m[3] ? fmt(+m[3]) : '';
    refreshTotals();
    return true;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  // Copy the link for the report on screen (not whatever is in the address bar).
  function copyLink() {
    const url = lastRes ? location.origin + location.pathname + location.search + hashFor(lastRes) : location.href;
    const done = () => toast('Link copied. Anyone with it sees this report.');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link:', url));
    else window.prompt('Copy this link:', url);
  }

  // ───────────────────────── Report ─────────────────────────
  const TIPS = {};
  let tipSeq = 0;
  function tipAttr(title, rows, note) { const k = 't' + (++tipSeq); TIPS[k] = { title, rows, note }; return ' data-tip="' + k + '"'; }

  function deltaClass(d) { return Math.abs(d) < 0.5 ? 'delta-even' : d > 0 ? 'delta-gain' : 'delta-strong'; }
  function deltaWords(d) { const r = Math.round(d); if (r === 0) return 'right on typical'; return fmt(Math.abs(r)) + (r > 0 ? ' slower than typical' : ' faster than typical'); }
  // Where a split sits among athletes (or teams) who finished in about your time. The share only
  // shows when it agrees with the seconds next to it (typical adds up to your time; the peer middle
  // sits a touch faster). Doubles shares are estimates borrowed from singles spreads.
  function peerSide(i) {
    if (i.noShare || Math.round(i.d) === 0 || Math.sign(i.d) !== Math.sign(i.z) || Math.abs(i.z) < 0.15) return 0;
    return i.z > 0 ? 1 : -1;
  }
  function peerPct(i) { const f = Math.round(i.fasterShare * 100); return clamp(peerSide(i) > 0 ? f : 100 - f, 1, 99); }
  function peerLine(i, cat) {
    const who = cat.unit + ' who finished in about your time', side = peerSide(i);
    if (i.noShare) return 'Your time is beyond our race data, so this split isn\'t rated.';
    if (!side) return 'About the middle of ' + who + '.';
    return (side > 0 ? 'Slower' : 'Faster') + ' than about ' + peerPct(i) + '% of ' + who + (cat.group === 'doubles' ? ' (estimated from singles spreads).' : '.');
  }
  function peerShort(i, cat) {
    const who = cat.unit + ' at your time', side = peerSide(i), about = cat.group === 'doubles' ? 'about ' : '';
    if (i.noShare) return 'Outside our race data';
    if (!side) return 'About the middle of ' + who;
    return (side > 0 ? 'Slower' : 'Faster') + ' than ' + about + peerPct(i) + '% of ' + who;
  }
  // Finish level in the division, e.g. "Top 5% of Mixed Doubles teams". Left off past the 90th percentile.
  function levelText(res) {
    const p = res.pct, u = res.cat.label + (res.cat.unit === 'teams' ? ' teams' : ' athletes');
    if (p < 1) return 'Top 1% of ' + u;
    if (p <= 33) return 'Top ' + Math.round(p) + '% of ' + u;
    if (p <= 90) return 'Faster than ' + Math.round(100 - p) + '% of ' + u;
    return '';
  }
  // The finish time your peers are matched on: your official time unless your splits (with a
  // typical first lap) differ from it by more than a minute.
  function peerTime(res) { return Math.abs(res.Tp - res.official) <= 60 ? res.official : res.Tp; }
  // Doubles at 100+ min: the run/Roxzone split in the data is modelled, so read them together.
  function mixedNote(res, key) {
    return res.cat.group === 'doubles' && res.Tp >= 5700 && (key === 'run' || key === 'rox')
      ? ' At this level, running and transitions are hard to separate in the data, so read Running and Roxzone together.' : '';
  }

  function renderReport(res) {
    tipSeq = 0;
    Object.keys(TIPS).forEach(k => delete TIPS[k]);
    const cat = res.cat;
    const runItem = res.items.find(i => i.key === 'run');
    const roxItem = res.items.find(i => i.key === 'rox');
    const stE = sum(ST_IDS.map(k => res.E[k]));
    const dbl = cat.group === 'doubles';
    const unitWord = dbl ? 'team' : 'athlete';
    const notes = [];
    if (res.outside) notes.push('Your time is outside the range our race data covers, so the typical splits are extrapolated and your splits aren\'t rated. Treat the seconds as a rough guide.');
    else if (res.pct < 0.5 || res.pct > 98) notes.push('Few ' + cat.unit + ' finish in this time, so treat the numbers as a guide.');
    else if (res.conf === 'l') notes.push(dbl && res.Tp >= 5700 ? 'At this finish time the doubles data can\'t cleanly separate running from Roxzone, so read those two together and treat the numbers as a guide.' : 'Our race data is thinner at this finish time, so treat the numbers as a guide.');
    if (res.penalty) notes.push('Your official time is ' + fmt(res.penalty) + ' longer than your splits add up to, which usually means a penalty; the analysis uses your splits.');
    if (Math.abs(res.run1Gap) > 30) notes.push('Your Run 1 was ' + fmt(Math.abs(res.run1Gap)) + (res.run1Gap > 0 ? ' slower' : ' faster') + ' than a typical first lap (start laps vary by venue), so it isn\'t compared and your peers are matched on your other splits.');
    if (res.roxInferred) notes.push('Your Roxzone was worked out from your overall time, so any penalty is counted as Roxzone.' + (roxItem.z >= 0.67 ? ' If you had one, enter your Roxzone time from your results.' : ''));
    const pt = peerTime(res);

    let h = '';
    // Header
    h += '<div class="r-head"><div>' +
      '<span class="mono r-eyebrow">Your race report</span>' +
      '<h2 class="r-time" id="reportTitle">' + fmt(res.official) + '</h2>' +
      '<div class="r-tags"><span class="y">' + esc(cat.label) + '</span>' + (levelText(res) ? '<span>' + esc(levelText(res)) + '</span>' : '') + '<span>' + esc(bracketOf(res.official)) + '</span>' + (res.roxInferred ? '<span>Roxzone from overall</span>' : '') + '</div>' +
      '<p class="r-compare">Compared with <b>' + esc(cat.who) + ' who finish in about ' + fmt(pt) + '</b>: what a typical ' + unitWord + ' at your time does on each run and station.' + (notes.length ? ' ' + esc(notes.join(' ')) : '') + '</p>' +
      '</div><div class="r-actions">' +
      '<button class="btn btn-ghost" type="button" data-act="copy">Copy link</button>' +
      '<button class="btn btn-ghost" type="button" data-act="print">Print / PDF</button>' +
      '<button class="btn btn-ghost" type="button" data-act="edit">Edit splits</button>' +
      '</div></div>';

    // Time on the table + KPIs
    const onT = Math.round(res.onTable);
    h += '<div class="panel"><div class="table-hero"><div class="th-left">' +
      '<span class="mono">Time on the table</span>' +
      '<div class="th-big">' + fmt(onT) + '</div>' +
      '<p>If every split where you\'re slower than typical were simply <b>typical for your finish time</b>, and you kept your strengths, you\'d have crossed the line in about <b>' + fmt(res.projected) + '</b>' + (res.penalty ? ' (and without the penalty)' : '') + '.</p>' +
      '</div><div class="kpis">' +
      kpi('Running · 8 km', res.runTotal, res.runTotal - runItem.d, fmt(res.avg28) + '/km vs ' + fmt(res.expAvg28) + ' typical (Run 1 not compared)', ' on Runs 2–⁠8') +
      kpi('Stations · all 8', res.stTotal, stE, 'Typical ' + fmt(stE)) +
      kpi('Roxzone' + (res.roxInferred ? ' (from overall)' : ''), res.rox, res.E.rox, 'Typical ' + fmt(res.E.rox)) +
      '</div></div></div>';

    // Top time-savers
    const top = res.leaks.slice(0, 3);
    h += '<div class="panel keep"><div class="panel-h"><h3>Your biggest time-savers</h3><span class="mono">vs typical for ' + fmt(pt) + '</span></div>';
    if (top.length) {
      const topSum = sum(top.map(i => i.d));
      // When a card is in the normal range, say why that can happen for the cards actually shown.
      const par = top.filter(i => i.rating.id === 'par').map(i => i.key);
      const wide = par.filter(k => k === 'rox' || k === 'push' || k === 'pull');
      const why = !par.length ? ''
        : wide.length === par.length ? ' Roxzone and sleds vary a lot between racers, so even a big gap there can still be within the normal range.'
        : ' A gap can be big in seconds and still sit in the normal range for ' + cat.unit + ' at your time' + (par.includes('run') ? ' (running is the longest part of the race, so a minute there is only a few percent)' : '') + '.';
      h += '<p class="panel-sub">' + (top.length > 1 ? 'These ' + top.length + ' add up to <b style="color:#fff">' + fmt(topSum) + '</b>. ' : '') +
        'Start here: ' + (top.length > 1 ? 'they\'re' : 'it\'s') + ' your biggest gap' + (top.length > 1 ? 's' : '') + ' in seconds against ' + esc(cat.unit) + ' at your time.' + esc(why) + '</p>';
      h += '<div class="panel-b" style="padding-left:0;padding-right:0;padding-bottom:0"><div class="savers" style="--n:' + top.length + '">' + top.map((i, n) =>
        '<div class="saver"><div class="saver-top"><span class="saver-n">' + (n + 1) + '</span><h4>' + esc(i.label) + '</h4></div>' +
        '<div class="saver-amt">' + fmtDelta(i.d) + '<small>vs typical</small></div>' +
        '<div class="saver-cmp">You <b>' + fmt(i.actual) + '</b> · typical <b>' + fmt(i.exp) + '</b></div>' +
        '<div class="saver-rate"><span class="rating ' + i.rating.id + '">' + esc(i.rating.text) + '</span><small>' + esc(peerShort(i, cat)) + '</small></div>' +
        '<p>' + esc(tipFor(i.key, cat)) + '</p></div>').join('') + '</div></div>';
    } else {
      h += '<div class="savers-empty">No split is more than a few seconds slower than typical: a very balanced race. Your next minutes will come from getting fitter across the board, so check your goal plan below.</div>';
    }
    h += '</div>';

    // Split profile (diverging bars)
    h += '<div class="panel keep"><div class="panel-h"><h3>Strengths &amp; weak spots</h3>' +
      '<div class="seg-toggle" role="group" aria-label="Sort"><button type="button" data-sort="gap" aria-pressed="true">Biggest gap</button><button type="button" data-sort="race" aria-pressed="false">Race order</button></div></div>' +
      '<p class="panel-sub">Each bar is the difference between your split and the typical split for your finish time; the label under each name says where you sit among ' + esc(cat.unit) + ' at your time. Running is Runs 2–⁠8 together (Run 1\'s length varies by venue); each kilometre is broken out below.</p>' +
      '<div class="panel-b"><div class="dv-legend"><span><i class="sw-gain"></i>Slower than typical</span><span><i class="sw-strong"></i>Faster than typical</span></div>' +
      '<div class="dv" id="dvChart"></div>' +
      '<div class="dv-axis" aria-hidden="true"><span></span><div><span>◀ Faster</span><span>Typical</span><span>Slower ▶</span></div><span></span></div>' +
      '</div></div>';

    // Running
    h += '<div class="panel"><div class="panel-h"><h3>Your running, km by km</h3><span class="mono">' + fmt(res.runTotal) + ' total · ' + fmt(res.avg) + ' avg (all 8 runs)</span></div>' +
      '<div class="panel-b"><div class="run-grid"><div><div class="run-legend"><span><i style="background:var(--gain)"></i>You</span><span><i style="background:var(--typical)"></i>Typical at your finish time</span></div>' +
      '<div class="run-chart" id="runChart"></div></div>' +
      '<ul class="insights">' + runInsights(res).map(x => '<li class="' + x.c + '">' + x.h + '</li>').join('') + '</ul></div></div></div>';

    // Goal plan
    h += '<div class="panel" id="goalPanel">' + goalPanelHTML(res) + '</div>';

    // Every split (table view)
    h += '<div class="panel"><div class="panel-b"><details class="tblwrap"><summary>See every split as a table</summary><div class="tbl-scroll">' + splitTable(res) + '</div></details></div></div>';

    // CTA
    const names = res.leaks.slice(0, 2).map(i => i.name);
    const ctaLine = names.length === 2 ? 'Your report points at ' + names[0] + ' and ' + names[1] + '.'
      : names.length === 1 ? 'Your report points at ' + names[0] + '.' : 'Your race is balanced, so the next step is more engine everywhere.';
    h += '<div class="cta-band"><div><span class="mono">Train it at Koda</span><h3>Turn your gaps into a PR</h3>' +
      '<p>' + esc(ctaLine) + ' Koda CrossFit Iron View is an official HYROX affiliate gym in Louisville. Our HYROX classes train every station and the running in between, four days a week.</p>' +
      '<p class="print-only">kodacrossfitironview.com/hyrox · (630) 292-0725 · 740 S Pierce Ave #5, Louisville, CO</p></div>' +
      '<div class="cta-btns"><a class="btn btn-dark" href="https://www.kodacrossfitironview.com/hyrox" target="_blank" rel="noopener">See HYROX classes <span class="arr">→</span></a>' +
      '<a class="btn btn-line" href="https://www.kodacrossfitironview.com/Contact" target="_blank" rel="noopener">Talk to a coach</a></div></div>';

    h += '<p class="caveat">"Typical" is how ' + (dbl ? 'a team' : 'an athlete') + ' who finishes in your time usually splits the race (it adds up to your finish), Koda\'s estimate from published HYROX race statistics (<a href="#how">how it works</a>). One race is a snapshot: venue, judging and the day usually move a single split 20–60 seconds (more at some venues), and sleds and Roxzone vary most.</p>';

    $('#reportInner').innerHTML = h;
    renderDiverging(res, 'gap');
    renderRunChart(res);
    bindReport(res);
  }

  function kpi(label, val, exp, sub, suffix) {
    const d = val - exp;
    return '<div class="kpi"><span class="mono">' + esc(label) + '</span><span class="v">' + fmt(val) + '</span>' +
      '<span class="d ' + deltaClass(d) + '">' + (Math.abs(d) < 0.5 ? 'on typical' : fmt(Math.abs(d)) + (d > 0 ? ' slower' : ' faster')) + esc(suffix || '') + '</span>' +
      '<span class="t">' + esc(sub) + '</span></div>';
  }

  function renderDiverging(res, mode) {
    const items = res.items.slice();
    if (mode === 'gap') items.sort((a, b) => b.d - a.d);
    const maxAbs = Math.max(30, ...items.map(i => Math.abs(i.d)));
    $('#dvChart').innerHTML = items.map(i => {
      const w = Math.min(50, (Math.abs(i.d) / maxAbs) * 50);
      const cls = i.d >= 0 ? 'gain' : 'strong';
      const isRun = i.key === 'run';
      const note = i.rating.text + '. ' + peerLine(i, res.cat) +
        (isRun ? ' Run 1 isn\'t compared because its length depends on the venue\'s start.' + (venueRunNote(res) ? ' ' + venueRunNote(res) : '') : '') + mixedNote(res, i.key);
      const tip = tipAttr(i.label, [['You', fmt(i.actual)], ['Typical', fmt(i.exp)], ['Difference', fmtDelta(i.d)]], note);
      return '<div class="dv-row" tabindex="0"' + tip + ' aria-label="' + esc(i.label + ': you ' + fmt(i.actual) + ', typical ' + fmt(i.exp) + ', ' + deltaWords(i.d) + ', ' + i.rating.text) + '">' +
        '<div class="dv-name"><b>' + nameHTML(i.key) + '</b><small>' + esc(i.rating.text) + '</small></div>' +
        '<div class="dv-track"><span class="dv-bar ' + cls + '" style="width:' + w.toFixed(2) + '%"></span></div>' +
        '<div class="dv-val">' + fmtDelta(i.d) + '</div></div>';
    }).join('');
  }
  // Many US venues log a bit more of the race as running, so a small running gap can be the venue.
  function venueRunNote(res) {
    const run = res.items.find(i => i.key === 'run');
    return run.d > 0 && run.d < 0.08 * run.exp ? 'Many venues, including most in the US, log a bit more of the race as running (often a minute or two), so part of a running gap this size can be the venue.' : '';
  }

  function runInsights(res) {
    const out = [];
    const who = res.cat.unit;
    const run = res.items.find(i => i.key === 'run'), rid = run.rating.id;
    const perKm = res.avg28 - res.expAvg28;
    const pace = 'Runs 2–⁠8 your average kilometre was <b>' + fmt(res.avg28) + '</b>, about <b>' + Math.round(Math.abs(perKm)) + ' s ' + (perKm > 0 ? 'slower' : 'faster') + '</b> than typical for your finish time (' + fmt(res.expAvg28) + ')';
    if (Math.abs(perKm) < 2) out.push({ c: '', h: 'On Runs 2–⁠8 your average kilometre (<b>' + fmt(res.avg28) + '</b>) is right on typical for your finish time.' });
    else if (perKm > 0) {
      const lead = rid === 'weak' || rid === 'big' ? 'Running cost you time: on ' : 'On ';
      out.push({ c: rid === 'par' ? '' : 'g', h: lead + pace + '. Over those 7 km that\'s <b>' + fmt(perKm * 7) + '</b>.' + (venueRunNote(res) ? ' ' + venueRunNote(res) : '') });
    } else {
      const lead = rid === 'solid' || rid === 'strong' ? 'Running is a strength: on ' : perKm > -8 ? 'You ran a bit quicker than typical: on ' : 'You ran quicker than typical: on ';
      out.push({ c: 's', h: lead + pace + '.' });
    }

    // Fade from Runs 2-4 to Runs 5-7, flagged only beyond about one peer spread (lap-to-lap noise).
    const legSD = spreadAt(res.catKey, 'run', res.Tp)[1] / 0.81;
    const fadeSD = Math.max(6, (res.run28 / 7) * legSD * Math.sqrt((2 * 0.4) / 3));
    const extra = res.fade - res.typFade;
    const fr = Math.round(res.fade);
    const fadeTxt = fr === 0 ? 'held the same pace' : fr > 0 ? 'slowed about <b>' + fr + ' s per km</b>' : 'got about <b>' + (-fr) + ' s per km faster</b>';
    const typTxt = Math.max(0, Math.round(res.typFade)) + ' s per km';
    if (extra > fadeSD) out.push({ c: 'g', h: 'From Runs 2–⁠4 to Runs 5–⁠7 you ' + fadeTxt + '; ' + who + ' at your time slow about ' + typTxt + '. A bigger fade than usual: steadier early pacing and running straight off the stations are the fix.' });
    else if (extra < -fadeSD) out.push({ c: 's', h: 'Strong second half: from Runs 2–⁠4 to Runs 5–⁠7 you ' + fadeTxt + ', better than the ~' + typTxt + ' ' + who + ' at your time usually lose.' });
    else out.push({ c: '', h: 'Your pacing held up like a typical ' + (who === 'teams' ? 'team' : 'athlete') + ' at your time: from Runs 2–⁠4 to Runs 5–⁠7 you ' + fadeTxt + '.' });

    if (res.runs[0] < res.runRows[0].shape * 0.9) out.push({ c: '', h: 'Run 1 (<b>' + fmt(res.runs[0]) + '</b>) was quick next to your other runs. Some venues have a short first lap; if yours didn\'t, starting a little slower usually pays back later.' });

    let worst = 1;
    for (let i = 1; i < 7; i++) if (res.runs[i] - res.runRows[i].shape > res.runs[worst] - res.runRows[worst].shape) worst = i;
    // Flag a single lap only when it's well outside normal lap-to-lap variation (about 2 spreads of
    // a lap around your own pace), since lap lengths also vary by venue.
    const wGap = res.runs[worst] - res.runRows[worst].shape;
    if (wGap > Math.max(20, 2.2 * legSD * Math.sqrt(0.4) * res.avg28)) out.push({ c: '', h: '<b>Run ' + (worst + 1) + '</b> (' + fmt(res.runs[worst]) + ') was your slowest for your pace, right after the <b>' + esc(AFTER[worst]) + '</b>. Lap lengths vary by venue, but if it felt hard, practise running straight off that station.' });
    return out;
  }

  function renderRunChart(res) {
    const box = $('#runChart');
    if (!box) return;
    const W = Math.max(290, box.clientWidth || (box.parentElement && box.parentElement.clientWidth) || 600), H = 270;
    box.dataset.w = W;
    const gapX = (W - 58) / 7;                 // space between runs on the x axis
    const narrow = gapX < 72;
    const m = { l: 46, r: 12, t: 14, b: narrow ? 30 : 44 };
    const you = res.runs, typ = res.runRows.map(r => r.exp);
    let lo = Math.min(...you, ...typ), hi = Math.max(...you, ...typ);
    const span = Math.max(hi - lo, 30);
    const step = span > 150 ? 60 : span > 70 ? 30 : 15;
    lo = Math.floor((lo - span * 0.12) / step) * step;
    hi = Math.ceil((hi + span * 0.12) / step) * step;
    const x = i => m.l + (i * (W - m.l - m.r)) / 7;
    const y = s => m.t + ((hi - s) * (H - m.t - m.b)) / (hi - lo);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Run times for runs 1 to 8, yours and typical">';
    for (let t = lo; t <= hi + 0.1; t += step) {
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="rgba(223,213,195,0.12)" stroke-width="1"/>';
      if (t + step <= hi + 0.1) s += '<text x="' + (m.l - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end" fill="#9A938A" font-size="11" font-family="DM Mono, monospace">' + fmt(t) + '</text>';
    }
    s += '<text x="0" y="' + (y(hi) + 4) + '" text-anchor="start" fill="#DFD5C3" font-size="10" font-family="DM Mono, monospace">SLOWER ↑</text>';
    for (let i = 0; i < 8; i++) {
      s += '<text x="' + x(i) + '" y="' + (H - m.b + 18) + '" text-anchor="middle" fill="#DFD5C3" font-size="12" font-weight="600" font-family="Inter, sans-serif">' + (narrow ? 'R' : 'Run ') + (i + 1) + '</text>';
      if (!narrow) s += '<text x="' + x(i) + '" y="' + (H - m.b + 33) + '" text-anchor="middle" fill="#9A938A" font-size="9.5" font-family="DM Mono, monospace">' + esc(i === 0 ? 'START' : afterLabel(AFTER[i], gapX >= 82)) + '</text>';
    }
    const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    s += '<path d="' + path(typ) + '" fill="none" stroke="var(--typical)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s += '<path d="' + path(you) + '" fill="none" stroke="var(--gain)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    typ.forEach((v, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="var(--typical)" stroke="#222121" stroke-width="2"/>'; });
    you.forEach((v, i) => { s += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4.5" fill="var(--gain)" stroke="#222121" stroke-width="2"/>'; });
    s += '<line id="rcX" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1" visibility="hidden"/>';
    // hit areas, one per run
    for (let i = 0; i < 8; i++) {
      const x0 = i === 0 ? m.l - 10 : (x(i - 1) + x(i)) / 2, x1 = i === 7 ? W : (x(i) + x(i + 1)) / 2;
      const r = res.runRows[i];
      const tip = tipAttr('Run ' + (i + 1) + (r.after ? ' · after ' + r.after : ' · start'), [['You', fmt(r.actual), 'var(--gain)'], ['Typical', fmt(r.exp), 'var(--typical)'], ['Difference', fmtDelta(r.d)]],
        i === 0 ? 'The start lap is shorter or longer at many venues, so Run 1 isn\'t compared.' : i === 7 ? 'Some venues stretch Run 8 toward the wall balls.' : null);
      s += '<rect class="rc-hit" data-i="' + i + '" data-x="' + x(i) + '" x="' + x0 + '" y="' + m.t + '" width="' + (x1 - x0) + '" height="' + (H - m.t - m.b + 20) + '" fill="transparent" tabindex="0"' + tip + ' aria-label="Run ' + (i + 1) + ': you ' + fmt(r.actual) + ', typical ' + fmt(r.exp) + '"/>';
    }
    s += '</svg>';
    box.innerHTML = s;
  }
  function afterLabel(name, long) {
    const st = { 'SkiErg': 'SKI', 'Sled Push': 'PUSH', 'Sled Pull': 'PULL', 'Burpee Broad Jumps': 'BBJ', 'Row': 'ROW', 'Farmers Carry': 'CARRY', 'Sandbag Lunges': 'LUNGE' }[name] || '';
    return long ? 'AFTER ' + st : st;
  }

  function goalPanelHTML(res) {
    const plan = res.plan;
    const opts = goalOptions(res.catKey, res.goalBase);
    if (plan && !opts.includes(plan.goal)) opts.unshift(plan.goal);
    let h = '<div class="panel-h"><h3>Your path to ' + (plan ? 'sub ' + fmt(plan.goal) : 'your goal') + '</h3><span class="mono">' + (plan ? fmt(plan.need) + ' to find' : '') + '</span></div>';
    h += '<p class="panel-sub">Where the time usually comes from, based on how ' + esc(res.cat.unit) + ' who finish at your goal split their race. Segments where you\'re already at goal pace keep your current time.</p>';
    h += '<div class="panel-b"><div class="goal-top"><span class="mono">Goal</span><div class="goal-chips">' +
      opts.sort((a, b) => b - a).map(g => '<button type="button" data-goal="' + g + '" aria-pressed="' + (plan && plan.goal === g) + '">Sub ' + fmt(g) + '</button>').join('') + '</div></div>';
    const notes = [];
    if (res.goalIgnored && res.goalTyped != null) {
      notes.push(isNaN(res.goalTyped)
        ? 'We couldn\'t read your goal (' + esc(res.goalText || '') + '), so here\'s the path to sub ' + esc(fmt(res.goal)) + ' instead. Type it as h:mm:ss, e.g. 1:15:00.'
        : (res.goalTyped >= res.official
          ? 'Your goal (' + esc(fmt(res.goalTyped)) + ') isn\'t faster than this race (' + esc(fmt(res.official)) + ')'
          : 'Your goal (' + esc(fmt(res.goalTyped)) + ') is faster than any HYROX finish') + ', so here\'s the path to sub ' + esc(fmt(res.goal)) + ' instead.');
    }
    if (notes.length) h += '<p class="goal-note goal-lead">' + notes.join(' ') + '</p>';
    if (!plan) return h + '<p class="goal-note">Pick a goal faster than your finish time.</p></div>';
    if (plan.splitsOk) {
      return h + '<p class="goal-note">Your splits add up to <b>' + fmt(plan.splitsSum) + '</b>, ' + (plan.splitsSum < plan.goal - 0.5 ? 'already under ' : 'right on ') + fmt(plan.goal) + ': the ' + fmt(plan.penalty) + ' penalty was the difference. Race clean and you\'re there.</p></div>';
    }
    // The penalty is a row like any other, in order of the time it gives back.
    const rows = plan.rows.slice();
    if (plan.penalty) rows.push({ key: 'pen', name: 'the penalty', actual: plan.penalty, target: 0, cut: plan.penalty });
    rows.sort((a, b) => b.cut - a.cut);
    const maxCut = Math.max(1, ...rows.map(r => r.cut));
    const cutCell = c => '<div class="cut"><span class="trk"><i style="width:' + ((c / maxCut) * 100).toFixed(1) + '%"></i></span><b>' + fmtDelta(-c).replace('+', '') + '</b></div>';
    h += '<table class="gt"><thead><tr><th>Segment</th><th class="r">You</th><th class="r">Target</th><th class="cutcell">Time to cut</th></tr></thead><tbody>';
    rows.forEach(r => {
      if (r.key === 'pen') {
        const tip = tipAttr('Penalty', [['You', fmt(r.actual)], ['Target', '0:00']], 'Official times include penalties; race clean and this comes back for free.');
        h += '<tr tabindex="0"' + tip + '><td>Penalty</td><td class="r">' + fmt(r.actual) + '</td><td class="r">0:00</td><td class="cutcell">' + cutCell(r.cut) + '</td></tr>';
        return;
      }
      const keep = r.cut < 0.5;
      const tip = tipAttr(r.key === 'run' ? 'Running · all 8 km' : r.name, [['You', fmt(r.actual)], ['Target', fmt(r.target)], ['Typical at ' + fmt(plan.goal), fmt(r.typicalAtGoal)]], keep ? 'Already at goal pace: keep it there.' : null);
      h += '<tr class="' + (keep ? 'keep' : '') + '" tabindex="0"' + tip + '><td>' + nameHTML(r.key, true) + '</td><td class="r">' + fmt(r.actual) + '</td><td class="r">' + fmt(r.target) + '</td><td class="cutcell">' +
        (keep ? '<span style="color:var(--strong-text)">✓ Already at goal pace</span>' : cutCell(r.cut)) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr><td>Total</td><td class="r">' + fmt(res.official) + '</td><td class="r">' + fmt(plan.goal) + '</td><td class="cutcell"><div class="cut"><span></span><b>−' + fmt(plan.need) + '</b></div></td></tr></tfoot></table>';
    // Why the rows don't add up to the totals exactly: timing rounding, or a venue's start lap.
    const after = [];
    const rounding = res.official - (res.T + plan.penalty);
    if (Math.abs(rounding) >= 1) {
      after.push(Math.abs(rounding) <= PEN_MIN
        ? 'Your splits add up to ' + fmt(res.T) + '; the ' + Math.round(Math.abs(rounding)) + ' s difference from your official time is timing rounding, so the rows add up to a few seconds ' + (rounding > 0 ? 'less' : 'more') + ' than the totals.'
        : 'Your splits add up to ' + fmt(res.T) + '; the ' + Math.round(Math.abs(rounding)) + ' s difference from your official time is more than timing rounding usually explains, so check your splits for a typo.');
    }
    if (Math.abs(plan.run1) > 30) {
      after.push('Your Run 1 was ' + fmt(Math.abs(plan.run1)) + (plan.run1 > 0 ? ' longer' : ' shorter') + ' than a typical first lap (start laps vary by venue), so the plan assumes the same start lap next time and finds the time in the rest of your race.');
    }
    after.forEach(t => { h += '<p class="goal-note">' + esc(t) + '</p>'; });
    const top2 = rows.filter(r => r.cut >= 0.5).slice(0, 2);
    if (top2.length) {
      const share = Math.round((sum(top2.map(r => r.cut)) / plan.need) * 100);
      let names = top2.map(r => r.name).join(' and ');
      names = names.charAt(0).toUpperCase() + names.slice(1);
      h += '<p class="goal-note">' + (share >= 99 ? 'All of the time you need is in ' + esc(top2.map(r => r.name).join(' and ')) + '.' : esc(names) + (top2.length === 1 ? ' accounts' : ' account') + ' for about ' + share + '% of the time you need.') + '</p>';
    }
    return h + '</div>';
  }

  // Short names for narrow screens. Running is Runs 2-8 where it's compared, all 8 km in the goal plan.
  const SHORT = { ski: 'SkiErg', push: 'Sled Push', pull: 'Sled Pull', bbj: 'Burpee BJ', row: 'Row', farm: 'Farmers', lunge: 'Lunges', wb: 'Wall Balls', rox: 'Roxzone' };
  function nameHTML(key, plan) {
    const long = key === 'run' ? (plan ? 'Running (all 8 km)' : 'Running (Runs 2–⁠8)') : META[key].name;
    const short = key === 'run' ? (plan ? 'Running 8 km' : 'Runs 2–⁠8') : (SHORT[key] || long);
    return long === short ? esc(long) : '<span class="nm-l">' + esc(long) + '</span><span class="nm-s">' + esc(short) + '</span>';
  }

  function splitTable(res) {
    let h = '<table class="st"><thead><tr><th>Split</th><th class="r">You</th><th class="r">Typical</th><th class="r">Diff.</th><th>Rating</th></tr></thead><tbody>';
    const itemOf = k => res.items.find(i => i.key === k);
    const dbl = res.cat.group === 'doubles';
    const pctTxt = i => { const s = peerSide(i); return !s ? 'about the middle' : (s > 0 ? 'slower than ' : 'faster than ') + (dbl ? '~' : '') + peerPct(i) + '%'; };
    const rated = i => esc(i.rating.text) + ' <span class="muted">(' + pctTxt(i) + ')</span>';
    for (let r = 0; r < 8; r++) {
      const rr = res.runRows[r];
      h += '<tr><td class="run-row">Run ' + (r + 1) + '</td><td class="r">' + fmt(rr.actual) + '</td><td class="r">' + fmt(rr.exp) + '</td><td class="r">' + fmtDelta(rr.d) + '</td><td class="muted">' + (r === 0 ? 'Not compared (venue)' : 'Pacing only') + '</td></tr>';
      const i = itemOf(ST_IDS[r]);
      h += '<tr><td>' + esc(i.name) + '</td><td class="r">' + fmt(i.actual) + '</td><td class="r">' + fmt(i.exp) + '</td><td class="r">' + fmtDelta(i.d) + '</td><td>' + rated(i) + '</td></tr>';
    }
    const rox = itemOf('rox'), run = itemOf('run');
    const stE = sum(ST_IDS.map(k => res.E[k]));
    h += '<tr><td>Roxzone' + (res.roxInferred ? ' (from overall, incl. any penalties)' : '') + '</td><td class="r">' + fmt(rox.actual) + '</td><td class="r">' + fmt(rox.exp) + '</td><td class="r">' + fmtDelta(rox.d) + '</td><td>' + rated(rox) + '</td></tr>';
    h += '<tr class="sum"><td>Running, <span class="nw">Runs 2–⁠8</span></td><td class="r">' + fmt(run.actual) + '</td><td class="r">' + fmt(run.exp) + '</td><td class="r">' + fmtDelta(run.d) + '</td><td>' + rated(run) + '</td></tr>';
    h += '<tr class="sum"><td>Running, <span class="nw">all 8 km</span></td><td class="r">' + fmt(res.runTotal) + '</td><td class="r">' + fmt(res.E.run) + '</td><td class="r">' + fmtDelta(res.runTotal - res.E.run) + '</td><td></td></tr>';
    h += '<tr class="sum"><td>Stations total</td><td class="r">' + fmt(res.stTotal) + '</td><td class="r">' + fmt(stE) + '</td><td class="r">' + fmtDelta(res.stTotal - stE) + '</td><td></td></tr>';
    if (Math.round(res.official) !== Math.round(res.T)) h += '<tr class="sum"><td>Your splits add up to</td><td class="r">' + fmt(res.T) + '</td><td class="r">–</td><td class="r"></td><td></td></tr>';
    h += '<tr class="sum"><td>Overall (official)</td><td class="r">' + fmt(res.official) + '</td><td class="r">–</td><td class="r"></td><td>' + (res.penalty ? '<span class="muted">incl. ' + fmt(res.penalty) + ' penalty</span>' : '') + '</td></tr>';
    return h + '</tbody></table>';
  }

  function bindReport(res) {
    const root = $('#reportInner');
    root.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.sort) {
        $$('.seg-toggle button', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        renderDiverging(res, b.dataset.sort);
      } else if (b.dataset.goal) {
        const g = +b.dataset.goal;
        $('#t-goal').value = fmt(g);
        checkGoal(res.official);
        res.goal = g;
        res.goalTyped = g;
        res.goalIgnored = false;
        res.plan = planGoal(res, g);
        $('#goalPanel').innerHTML = goalPanelHTML(res);
        writeHash(res);
        refreshTotals();
      } else if (b.dataset.act === 'copy') copyLink();
      else if (b.dataset.act === 'print') window.print();
      else if (b.dataset.act === 'edit') $('#analyze').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    lastRes = res;
  }
  let lastRes = null;

  // ───────────────────────── Tooltip ─────────────────────────
  const tipEl = $('#tip');
  function showTip(target, x, y) {
    const t = TIPS[target.dataset.tip];
    if (!t) return;
    let h = '<div class="tt">' + esc(t.title) + '</div>';
    (t.rows || []).forEach(r => { h += '<div class="tr"><span>' + (r[2] ? '<i class="tk" style="background:' + r[2] + '"></i>' : '') + esc(r[0]) + '</span><b class="num">' + esc(r[1]) + '</b></div>'; });
    if (t.note) h += '<div style="margin-top:6px;color:#BDB6AC;font-size:0.8rem">' + esc(t.note) + '</div>';
    tipEl.innerHTML = h;
    tipEl.classList.add('show');
    const r = tipEl.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tipEl.style.left = Math.max(8, left) + 'px';
    tipEl.style.top = Math.max(8, top) + 'px';
    if (target.classList.contains('rc-hit')) {
      const line = $('#rcX');
      if (line) { line.setAttribute('x1', target.dataset.x); line.setAttribute('x2', target.dataset.x); line.setAttribute('visibility', 'visible'); }
    }
  }
  function hideTip() { tipEl.classList.remove('show'); const line = $('#rcX'); if (line) line.setAttribute('visibility', 'hidden'); }
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY); else hideTip();
  });
  document.addEventListener('focusin', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) { const r = t.getBoundingClientRect(); showTip(t, r.left + Math.min(r.width, 220) / 2, r.top + r.height / 2); } else hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  // ───────────────────────── Wire up ─────────────────────────
  function init() {
    buildGrid();
    setCat(currentCat());

    // Division change: refresh the Quick picks, and re-run a visible report. If the splits no longer
    // pass the checks, take the old report down rather than leave another division's numbers up.
    $$('input[name="cat"]').forEach(r => r.addEventListener('change', () => {
      setCat(r.value);
      refreshTotals();
      if (lastRes && !$('#report').hidden && !runAnalysis({ noScroll: true, silent: true })) {
        $('#report').hidden = true;
        lastRes = null;
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
        $('#formError').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }));
    grid.addEventListener('input', e => {
      if (!e.target.classList.contains('tin')) return;
      e.target.classList.remove('auto');
      delete e.target.dataset.src;          // typed now: yours
      if (e.target.classList.contains('bad')) validateField(e.target.dataset.id, false);
      refreshTotals();
    });
    grid.addEventListener('focusout', e => {
      if (!e.target.classList.contains('tin')) return;
      const id = e.target.dataset.id, t = parseTime(e.target.value);
      if (t != null && !isNaN(t)) e.target.value = fmt(t);
      validateField(id, false);
      refreshTotals();
    });
    grid.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.classList.contains('tin')) return;
      e.preventDefault();
      const order = ORDER.concat(['rox', 'overall']);
      const i = order.indexOf(e.target.dataset.id);
      if (i >= 0 && i < order.length - 1) inputOf(order[i + 1]).focus();
      else runAnalysis();
    });
    // Tab order follows race order (run, station, run, ...), which is also the DOM order.

    // The finish time the goal is checked against, when the splits give one.
    const officialNow = () => {
      const { v } = readValues();
      if (v.overall != null) return v.overall;
      return ORDER.every(id => v[id] != null) && v.rox != null ? sum(ORDER.map(id => v[id])) + v.rox : null;
    };
    $('#t-goal').addEventListener('focusout', e => {
      const g = parseGoal(e.target.value);
      if (g != null && !isNaN(g)) e.target.value = fmt(g); // shows how a short entry was read (1:15 → 1:15:00)
      checkGoal(officialNow());
      refreshTotals();
    });
    $('#t-goal').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runAnalysis(); } });
    // Keep focus where it is on mousedown so the field's blur can't rebuild the button mid-click.
    $('#goalPresets').addEventListener('mousedown', e => { if (e.target.closest('button[data-g]')) e.preventDefault(); });
    $('#goalPresets').addEventListener('click', e => {
      const b = e.target.closest('button[data-g]');
      if (!b) return;
      $('#t-goal').value = fmt(+b.dataset.g);
      checkGoal(officialNow());
      refreshTotals();
    });

    $('#btnShot').addEventListener('click', () => $('#fileShot').click());
    $('#fileShot').addEventListener('change', e => { readScreenshots(e.target.files); e.target.value = ''; });
    $('#btnPaste').addEventListener('click', () => { const pb = $('#pasteBox'); pb.hidden = !pb.hidden; if (!pb.hidden) $('#pasteText').focus(); });
    $('#btnPasteCancel').addEventListener('click', () => { $('#pasteBox').hidden = true; });
    $('#btnPasteFill').addEventListener('click', () => {
      const parsed = parseSplitsText($('#pasteText').value);
      applyParsed(parsed, 'your pasted text');
      if (Object.keys(parsed.got).length) $('#pasteBox').hidden = true;
    });
    $('#btnExample').addEventListener('click', () => fillExample());
    $('#heroExample').addEventListener('click', () => { if (fillExample()) runAnalysis(); });
    $('#btnAnalyze').addEventListener('click', () => runAnalysis());
    $('#btnClear').addEventListener('click', () => {
      ALL_IDS.forEach(id => setValue(id, null));
      $('#t-goal').value = '';
      $('#m-goal').textContent = '';
      $('#t-goal').classList.remove('bad');
      $('#pasteBox').hidden = true;
      $('#formError').classList.remove('show');
      $('#importStatus').hidden = true;
      $('#report').hidden = true;
      lastRes = null;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
      refreshTotals();
    });

    // In-page links scroll without replacing the report's share link in the address bar.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || /^#r=/.test(a.getAttribute('href'))) return;
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      if (target.tagName === 'SECTION' && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    // A different report link pasted into the same tab changes only the hash; load it.
    window.addEventListener('hashchange', loadFromHash);

    // Drop screenshots anywhere on the splits card.
    const card = grid.closest('.card');
    card.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); card.style.outline = '3px dashed #1A1818'; } });
    card.addEventListener('dragleave', () => { card.style.outline = ''; });
    card.addEventListener('drop', e => { e.preventDefault(); card.style.outline = ''; readScreenshots(e.dataTransfer.files); });
    // Paste an image (e.g. a screenshot on the clipboard) straight into the page.
    document.addEventListener('paste', e => {
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
      const files = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(f => /^image\//.test(f.type));
      if (files.length) { e.preventDefault(); readScreenshots(files); }
    });

    // Print the full split table too; put it back the way it was afterwards.
    let reopened = [];
    window.addEventListener('beforeprint', () => { reopened = $$('details.tblwrap:not([open])'); reopened.forEach(d => { d.open = true; }); });
    window.addEventListener('afterprint', () => { reopened.forEach(d => { d.open = false; }); reopened = []; });

    // Redraw the run chart whenever its width changes (rotation, resize, first layout).
    const redraw = () => {
      const box = $('#runChart');
      if (lastRes && box && !$('#report').hidden && Math.abs(Math.max(290, box.clientWidth) - (+box.dataset.w || 0)) > 2) renderRunChart(lastRes);
    };
    // (next frame, so redrawing never re-enters the same observer loop)
    if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(redraw)).observe($('#reportInner'));
    let rz;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(redraw, 150); });

    refreshTotals();
    loadFromHash();
  }
  // Open a report link (on load, or pasted into the same tab). If it can't be read or its splits
  // don't pass the checks, take down any report already on screen and show why.
  function loadFromHash() {
    let h = location.hash;
    try { h = decodeURIComponent(h); } catch (e) { /* keep as is */ }
    if (!/^#r=/i.test(h)) return;
    if (readHash() && runAnalysis({ silent: true })) return;
    $('#report').hidden = true;
    lastRes = null;
    const msg = $('#formError.show') || $('#importStatus:not([hidden])');
    if (msg) msg.scrollIntoView({ block: 'center' });
  }

  // Exposed for testing in the browser console.
  window.KodaSplits = { parseTime, parseGoal, parseSplitsText, analyze, expectedBlocks, runProfileAt, planGoal, suggestGoal, goalOptions, pctFaster, finishAtPct, spreadAt, confidenceAt, binarize, ocrImages, loadImage, fmt };
  init();
})();

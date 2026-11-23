// fitmatch.js
// Fit matcher: given where someone's saddle and handlebar sit now, work out
// what each size of each bike would need (stem length, stem angle, spacers,
// and seatpost setback) to put them in the same place.
//
// Coordinates match geometry.js and rider.js: BB at (0, 0), x forward, y up, mm.
// The saddle point is the seatpost clamp; the bar point is the centre of the
// stem's bar clamp. Bar shape isn't included.

import {DEFAULTS} from "./rider.js";

const rad = d => (d * Math.PI) / 180;

// Ranges used to judge each part
export const PART_RANGES = {
  stem: {usual: [60, 120], possible: [40, 140]},      // mm
  spacers: {usual: [0, 35], possible: [0, 50]},        // mm under the stem
  post: {usual: [-10, 30], possible: [-20, 45]},       // mm the clamp sits behind the seat tube line: post setback plus about 10 mm either way from sliding the saddle on its rails
  postShowing: 80                                       // mm of seatpost above the seat tube, minimum
};
// Stem angles tried, in order of preference
export const STEM_ANGLES = [-6, -10, 0, -17, 6, 17];

// Where the seatpost clamp has to be, from saddle height (BB to saddle top, a
// straight line) and setback (horizontal, BB to the clamp)
export function targetSeat(saddleHeight, setback, clampBelowSaddle = DEFAULTS.clampBelowSaddle) {
  const d = saddleHeight - clampBelowSaddle;
  return {x: -setback, y: Math.sqrt(Math.max(0, d * d - setback * setback))};
}

// Stem length and spacers that put the bar clamp at `bar`, for one stem angle
export function solveCockpit(g, bar, stemAngle, c = DEFAULTS) {
  const ha = rad(g.head_tube_angle);
  const up = {x: -Math.cos(ha), y: Math.sin(ha)};
  const perp = {x: Math.sin(ha), y: Math.cos(ha)};
  const a = rad(stemAngle);
  const dir = {x: perp.x * Math.cos(a) - perp.y * Math.sin(a), y: perp.x * Math.sin(a) + perp.y * Math.cos(a)};
  const base = {x: g.reach + up.x * (c.topCap + c.stemStack / 2), y: g.stack + up.y * (c.topCap + c.stemStack / 2)};
  const d = {x: bar.x - base.x, y: bar.y - base.y};
  const det = up.x * dir.y - up.y * dir.x;
  return {
    stemAngle,
    spacers: (d.x * dir.y - d.y * dir.x) / det,
    stem: (up.x * d.y - up.y * d.x) / det
  };
}

const outside = (v, [lo, hi]) => (v < lo ? lo - v : v > hi ? v - hi : 0);
const inside = (v, r) => outside(v, r) === 0;

// Everything one size needs to match a target, and how comfortable that is
export function matchSize(g, target) {
  const seat = target.seat, bar = target.bar;
  // seatpost: horizontal distance between the seat tube line and the clamp
  const sa = rad(g.seat_tube_angle);
  const post = -seat.y / Math.tan(sa) - seat.x;
  const alongSeatTube = seat.y / Math.sin(sa);
  const postShowing = g.seat_tube_length != null ? alongSeatTube - g.seat_tube_length : null;

  // try stem angles; keep the first that fits the usual ranges, else the closest
  const tries = STEM_ANGLES.map(a => {
    const s = solveCockpit(g, bar, a);
    // outside the usual range costs most; then distance from a middling 90 mm
    // stem on 15 mm of spacers, and from a -6 degree stem
    const penalty = outside(s.stem, PART_RANGES.stem.usual) / 10 + outside(s.spacers, PART_RANGES.spacers.usual) / 10
      + Math.abs(s.stem - 90) / 100 + Math.abs(s.spacers - 15) / 100 + Math.abs(a + 6) / 40;
    return {...s, penalty};
  });
  const cockpit = tries.find(t => inside(t.stem, PART_RANGES.stem.usual) && inside(t.spacers, PART_RANGES.spacers.usual))
    ?? [...tries].sort((p, q) => p.penalty - q.penalty)[0];

  const issues = [];
  let level = "match";
  const worsen = l => { if (l === "no" || (l === "unusual" && level === "match")) level = l; };

  if (cockpit.spacers < PART_RANGES.spacers.possible[0]) {
    worsen("no"); issues.push(`front end too tall: the bar would need to sit ${Math.abs(cockpit.spacers).toFixed(0)} mm below the lowest stem position`);
  } else if (cockpit.spacers > PART_RANGES.spacers.possible[1]) {
    worsen("no"); issues.push(`front end too low: needs ${cockpit.spacers.toFixed(0)} mm of spacers`);
  } else if (!inside(cockpit.spacers, PART_RANGES.spacers.usual)) {
    worsen("unusual"); issues.push(`${cockpit.spacers.toFixed(0)} mm of spacers`);
  }
  if (!inside(cockpit.stem, PART_RANGES.stem.possible)) {
    worsen("no"); issues.push(cockpit.stem < PART_RANGES.stem.possible[0] ? `frame too long: needs a ${cockpit.stem.toFixed(0)} mm stem` : `frame too short: needs a ${cockpit.stem.toFixed(0)} mm stem`);
  } else if (!inside(cockpit.stem, PART_RANGES.stem.usual)) {
    worsen("unusual"); issues.push(`${cockpit.stem < PART_RANGES.stem.usual[0] ? "short" : "long"} ${Math.round(cockpit.stem / 10) * 10} mm stem`);
  }
  if (cockpit.stemAngle !== -6 && level !== "no") issues.push(`${cockpit.stemAngle > 0 ? "+" : ""}${cockpit.stemAngle}° stem`);
  if (!inside(post, PART_RANGES.post.possible)) {
    worsen("no"); issues.push(post > 0 ? `saddle too far back for this seat angle (${post.toFixed(0)} mm of setback needed)` : `saddle too far forward for this seat angle (${Math.abs(post).toFixed(0)} mm forward of the seat tube line)`);
  } else if (!inside(post, PART_RANGES.post.usual)) {
    worsen("unusual"); issues.push(post > 0 ? `${post.toFixed(0)} mm of setback from post and rails` : `saddle ${Math.abs(post).toFixed(0)} mm forward of the seat tube line`);
  }
  if (postShowing != null && postShowing < PART_RANGES.postShowing) {
    worsen(postShowing < 30 ? "no" : "unusual");
    issues.push(postShowing < 30 ? "frame too tall for this saddle height" : `only about ${Math.max(0, postShowing).toFixed(0)} mm of seatpost showing`);
  }

  const score = cockpit.penalty + outside(post, PART_RANGES.post.usual) / 5 + Math.abs(post - 5) / 100 + (postShowing != null ? outside(postShowing, [PART_RANGES.postShowing, Infinity]) / 10 : 0);
  return {row: g, stem: cockpit.stem, stemAngle: cockpit.stemAngle, spacers: cockpit.spacers, post, postShowing, level, issues, score};
}

// Best size of each bike, plus every size
export function matchAll(rows, target) {
  const all = rows.map(g => matchSize(g, target));
  const byBike = new Map();
  for (const m of all) {
    const k = m.row.bike_id;
    if (!byBike.has(k)) byBike.set(k, []);
    byBike.get(k).push(m);
  }
  const rank = {match: 0, unusual: 1, no: 2};
  const best = [...byBike.values()].map(ms => [...ms].sort((a, b) => rank[a.level] - rank[b.level] || a.score - b.score)[0]);
  best.sort((a, b) => rank[a.level] - rank[b.level] || a.score - b.score);
  return {all, best};
}

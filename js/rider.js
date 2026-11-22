// rider.js
// Estimates where a rider's joints sit on a bike, from height (and optionally
// inseam) and the bike's geometry. Used by the Rider page, and later by the
// custom builder. Coordinates match geometry.js: bottom bracket (BB) at (0, 0),
// x forward, y up, millimetres.
//
// This is an estimate from average body proportions. It is not a bike fit.
//
// Sources (full references on the site's Data and methods page):
// - Segment lengths as fractions of height: Drillis and Contini (1966), as
//   tabulated in Winter, Biomechanics and Motor Control of Human Movement.
// - Inseam as a fraction of height: NIOSH Law Enforcement Anthropometry
//   (crotch height 841.0 / stature 1776.1 mm for men, 793.9 / 1651.1 mm for
//   women; about 0.475).
// - Saddle height: LeMond method, BB centre to top of saddle = 0.883 x inseam.
// - Target knee flexion at the bottom of the stroke: 25 to 35 degrees (Holmes
//   and colleagues; summarised in Holliday and Swart 2021).
// - Ankle about 13 degrees toes-down at the bottom of the stroke.

const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;
const add = (a, b) => ({x: a.x + b.x, y: a.y + b.y});
const sub = (a, b) => ({x: a.x - b.x, y: a.y - b.y});
const mul = (a, k) => ({x: a.x * k, y: a.y * k});
const len = a => Math.hypot(a.x, a.y);
const angleBetween = (u, v) => deg(Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (len(u) * len(v))))));

// Drillis and Contini proportions (fraction of standing height)
export const PROPORTIONS = {
  thigh: 0.245,          // hip joint to knee
  shank: 0.246,          // knee to ankle
  ankleHeight: 0.039,    // ankle joint above the floor
  footLength: 0.152,
  upperArm: 0.186,       // shoulder to elbow
  forearm: 0.146,        // elbow to wrist
  hand: 0.108,           // wrist to fingertip
  shoulderHeight: 0.818,
  hipHeight: 0.530       // greater trochanter
};
export const INSEAM_RATIO = 0.475;
export const LEMOND = 0.883;

// Defaults a rider can change on the page
export const DEFAULTS = {
  stemLength: null,      // mm; null means choose by rider height (defaultStem)
  stemAngle: -6,         // degrees from perpendicular to the steerer
  spacers: 20,           // mm of spacers under the stem
  topCap: 10,            // headset top cover above the head tube
  stemStack: 40,         // stem clamp height (the bar sits at its middle)
  hoodForward: 110,      // hands on the hoods: this far ahead of the bar clamp...
  hoodUp: 30,            // ...and this far above it
  elbowBend: 15,         // degrees of elbow flexion on the hoods
  shoeStack: 15,         // shoe sole and pedal, mm
  ankleToes: 13          // degrees toes-down at the bottom of the stroke
};

// Stem length by rider height: riders of different heights usually end up on
// different stems, so a fixed stem would flatter small frames for tall riders
export function defaultStem(heightMm) {
  if (heightMm < 1600) return 70;
  if (heightMm < 1700) return 80;
  if (heightMm < 1800) return 90;
  return 100;
}

// Crank length by height when the bike's chart doesn't say
export function defaultCrank(heightMm) {
  if (heightMm < 1600) return 165;
  if (heightMm < 1700) return 170;
  if (heightMm < 1850) return 172.5;
  return 175;
}

// Two-segment chain from a to b (lengths l1, l2). There are two possible
// positions for the middle joint; `pick` chooses one: "forward" (larger x),
// "up" (larger y), or "down" (smaller y). Returns null if the ends are too far
// apart (or too close) for the chain to connect them.
function twoLink(a, b, l1, l2, pick) {
  const d = len(sub(b, a));
  if (d > l1 + l2 || d < Math.abs(l1 - l2)) return null;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const u = mul(sub(b, a), 1 / d);
  const base = add(a, mul(u, along));
  const perp = {x: -u.y, y: u.x};
  const p1 = add(base, mul(perp, h)), p2 = add(base, mul(perp, -h));
  if (pick === "forward") return p1.x >= p2.x ? p1 : p2;
  if (pick === "up") return p1.y >= p2.y ? p1 : p2;
  return p1.y <= p2.y ? p1 : p2;
}

// Where the hands rest on the hoods, from the frame and cockpit settings
export function cockpit(g, c) {
  const ha = rad(g.head_tube_angle);
  const up = {x: -Math.cos(ha), y: Math.sin(ha)};           // up the steering axis
  const htTop = {x: g.reach, y: g.stack};
  const clamp = add(htTop, mul(up, c.topCap + c.spacers + c.stemStack / 2));
  // stem direction: perpendicular to the steerer (forward), rotated by the stem angle
  const perp = {x: Math.sin(ha), y: Math.cos(ha)};
  const a = rad(c.stemAngle);
  const stemDir = {x: perp.x * Math.cos(a) - perp.y * Math.sin(a), y: perp.x * Math.sin(a) + perp.y * Math.cos(a)};
  const bar = add(clamp, mul(stemDir, c.stemLength));
  const hoods = add(bar, {x: c.hoodForward, y: c.hoodUp});
  return {htTop, clamp, bar, hoods};
}

export function riderOnBike(g, rider, settings = {}) {
  const H = rider.height;
  const c = {...DEFAULTS, ...settings};
  if (c.stemLength == null) c.stemLength = defaultStem(H);
  const P = PROPORTIONS;
  const inseam = rider.inseam ?? INSEAM_RATIO * H;
  const crank = settings.crank ?? defaultCrank(H);

  // Body segment lengths
  const thigh = P.thigh * H, shank = P.shank * H;
  const torso = (P.shoulderHeight - P.hipHeight) * H;
  const upperArm = P.upperArm * H, forearmToPalm = (P.forearm + 0.4 * P.hand) * H;

  // Saddle: along the seat tube line, LeMond height from the BB
  const sa = rad(g.seat_tube_angle);
  const saddleHeight = LEMOND * inseam;
  const saddle = {x: -saddleHeight * Math.cos(sa), y: saddleHeight * Math.sin(sa)};
  // Hip joint sits a little above the saddle top. 0.033 x height puts the knee
  // at about 30 degrees at the LeMond saddle height, the middle of the 25 to 35
  // degree target, so the model agrees with the formula it borrows.
  const hip = add(saddle, {x: 0, y: 0.033 * H});

  // Foot geometry: ball of the foot over the pedal, ankle behind and above it
  const ballToAnkle = {x: -0.071 * H, y: 0.039 * H};
  const footLen = len(ballToAnkle);
  const footAngle = Math.atan2(ballToAnkle.y, -ballToAnkle.x) + rad(c.ankleToes);
  const ankleFrom = pedal => add(pedal, {x: -footLen * Math.cos(footAngle), y: footLen * Math.sin(footAngle) + c.shoeStack});

  // Bottom of the stroke (crank at 6 o'clock) and top (12 o'clock)
  const pedalBottom = {x: 0, y: -crank}, pedalTop = {x: 0, y: crank};
  const ankleBottom = ankleFrom(pedalBottom), ankleTop = ankleFrom(pedalTop);
  const kneeBottom = twoLink(hip, ankleBottom, thigh, shank, "forward");
  const kneeTop = twoLink(hip, ankleTop, thigh, shank, "forward");
  const kneeAngle = kneeBottom
    ? 180 - angleBetween(sub(hip, kneeBottom), sub(ankleBottom, kneeBottom))
    : 0;
  const legOverstretched = !kneeBottom;

  // Hands on the hoods; shoulder where torso and arms meet
  const cp = cockpit(g, c);
  const flex = rad(c.elbowBend);
  const armReach = Math.sqrt(upperArm ** 2 + forearmToPalm ** 2 + 2 * upperArm * forearmToPalm * Math.cos(flex));
  const hipToHoods = len(sub(cp.hoods, hip));
  let shoulder = twoLink(hip, cp.hoods, torso, armReach, "up");   // shoulder above the hip-hands line
  let cantReach = false;
  if (!shoulder) {
    // Too far even with arms fully stretched: lean the torso straight at the hoods
    cantReach = hipToHoods > torso + armReach;
    const u = mul(sub(cp.hoods, hip), 1 / hipToHoods);
    shoulder = add(hip, mul(u, torso));
  }
  // Elbow bends outward-down (behind and below the shoulder-hand line)
  const elbow = twoLink(shoulder, cp.hoods, upperArm, forearmToPalm, "down") ?? add(shoulder, mul(sub(cp.hoods, shoulder), upperArm / (upperArm + forearmToPalm)));
  const head = add(shoulder, mul(sub(shoulder, hip), 0.33));

  // Angles
  const torsoVec = sub(shoulder, hip);
  const torsoAngle = deg(Math.atan2(torsoVec.y, torsoVec.x));      // from horizontal
  const hipAngleTop = kneeTop ? angleBetween(torsoVec, sub(kneeTop, hip)) : null;
  const shoulderAngle = angleBetween(sub(hip, shoulder), sub(elbow, shoulder));

  // Distances riders and fitters quote
  const saddleToHoods = len(sub(cp.hoods, saddle));
  const hoodDrop = saddle.y - cp.hoods.y;
  const seatpostExposed = g.seat_tube_length != null ? saddleHeight - g.seat_tube_length - 50 : null;
  const standoverMargin = g.standover != null ? inseam + 25 - g.standover : null;

  return {
    inputs: {height: H, inseam, crank, ...c},
    points: {saddle, hip, kneeBottom, ankleBottom, pedalBottom, kneeTop, ankleTop, pedalTop, shoulder, elbow, hands: cp.hoods, head, ...cp},
    lengths: {thigh, shank, torso, upperArm, forearmToPalm},
    saddleHeight, kneeAngle, legOverstretched, torsoAngle, hipAngleTop, shoulderAngle,
    saddleToHoods, hoodDrop, seatpostExposed, standoverMargin, cantReach
  };
}

// Rules for flagging sizes that look clearly too small or too large.
// Calibrated against manufacturers' own rider height ranges for 48 sizes of 9
// bikes (Trek, Canyon x2, Devinci x2, Salsa x2, Lauf, BMC), and checked by
// leaving each bike out in turn. On the left-out bikes the rule flagged 7.4% of
// sizes the manufacturer recommends for that height, caught 86% of sizes at
// least 6 cm too small and 82% at least 6 cm too large, and never flagged in
// the wrong direction.
//
// Torso and shoulder angles barely change between sizes, because arms and
// torso adapt, so the rules use where the hands end up relative to the saddle,
// how much seatpost shows, and standover.
export const FIT_RULES = {
  dropTooSmall: 0.038,     // hoods more than 3.8% of height below the saddle
  dropSmallSide: 0.030,
  dropLargeSide: -0.045,
  dropTooLarge: -0.055,    // hoods more than 5.5% of height above the saddle
  reachTooLarge: 0.51,     // saddle to hoods more than 51% of height
  seatpostMin: 0.07,       // less than 7% of height of seatpost showing
  standoverMin: -20        // inseam + 25 mm of shoe, minus published standover
};

export function fitFlags(r, rules = FIT_RULES) {
  const H = r.inputs.height;
  const drop = r.hoodDrop / H;
  const mm = x => `${Math.abs(x).toFixed(0)} mm`;
  const big = [], small = [], lean = [];
  if (r.cantReach) big.push("can't reach the hoods with this cockpit");
  if (drop < rules.dropTooLarge) big.push(`hoods ${mm(r.hoodDrop)} above the saddle`);
  if (r.saddleToHoods / H > rules.reachTooLarge) big.push(`a long ${mm(r.saddleToHoods)} from saddle to hoods`);
  if (r.seatpostExposed != null && r.seatpostExposed / H < rules.seatpostMin) big.push(`only about ${mm(Math.max(0, r.seatpostExposed))} of seatpost showing`);
  if (r.standoverMargin != null && r.standoverMargin < rules.standoverMin) big.push("little or no standover clearance");
  if (drop > rules.dropTooSmall) small.push(`hoods ${mm(r.hoodDrop)} below the saddle`);
  let verdict;
  if (big.length && !small.length) verdict = "too large";
  else if (small.length && !big.length) verdict = "too small";
  else if (big.length && small.length) verdict = "mixed signals";
  else if (drop > rules.dropSmallSide) { verdict = "on the small side"; lean.push(`hoods ${mm(r.hoodDrop)} below the saddle`); }
  else if (drop < rules.dropLargeSide) { verdict = "on the large side"; lean.push(`hoods ${mm(r.hoodDrop)} above the saddle`); }
  else verdict = "fits";
  const reasons = [...big, ...small, ...lean];
  if (r.legOverstretched) reasons.push("leg can't reach the pedal at this saddle height");
  return {verdict, reasons, dropRatio: drop};
}

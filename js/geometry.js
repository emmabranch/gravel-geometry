// geometry.js
// Turns a row of published geometry into the x, y positions (in mm) of each
// point on the frame, so a bike can be drawn to scale. Shared by every page
// that draws a bike: Compare now, and the rider overlay and builder later.
//
// Coordinates: the bottom bracket (BB) is at (0, 0), x runs forward towards the
// front wheel, and y runs up. All lengths are in millimetres.

const rad = deg => (deg * Math.PI) / 180;

// Outer tyre radius: half the rim's bead seat diameter (622 mm for 700c and
// 29er, 584 mm for 650b) plus a tyre whose height is taken as equal to its width.
export const BSD = {"700c": 622, "29er": 622, "650b": 584};
export function wheelRadius(wheelSize, tyreWidth = 45) {
  return (BSD[wheelSize] ?? 622) / 2 + tyreWidth;
}

export function trail(headAngle, offset, radius) {
  const a = rad(headAngle);
  return (radius * Math.cos(a) - offset) / Math.sin(a);
}

// Some charts leave out head tube or seat tube length. For drawing only, fill
// them with typical relationships seen across the bikes that do publish them,
// and report which ones were filled so the page can say so.
function withFallbacks(g) {
  const filled = [];
  const out = {...g};
  if (out.head_tube_length == null) {
    out.head_tube_length = Math.max(80, out.stack - 434);
    filled.push("head tube length");
  }
  if (out.seat_tube_length == null) {
    out.seat_tube_length = 0.86 * out.stack;
    filled.push("seat tube length");
  }
  return {g: out, filled};
}

export function bikePoints(row, {tyreWidth = 45} = {}) {
  const {g, filled} = withFallbacks(row);
  const d = g.bb_drop;
  const ha = rad(g.head_tube_angle);
  const sa = rad(g.seat_tube_angle);
  const tyre = g.tyre_width ?? (g.wheel_size === "29er" ? 57 : tyreWidth);
  const R = wheelRadius(g.wheel_size, tyre);
  const rim = (BSD[g.wheel_size] ?? 622) / 2;

  // Unit vector pointing DOWN the steering axis (down and forward)
  const down = {x: Math.cos(ha), y: -Math.sin(ha)};

  const bb = {x: 0, y: 0};
  const rearAxle = {x: -Math.sqrt(g.chainstay ** 2 - d ** 2), y: d};
  const htTop = {x: g.reach, y: g.stack};
  const htBottom = {x: htTop.x + g.head_tube_length * down.x, y: htTop.y + g.head_tube_length * down.y};

  const offset = g.fork_offset_used ?? g.fork_offset ?? 50;
  const frontAxle = {x: g.reach + (g.stack - d) / Math.tan(ha) + offset / Math.sin(ha), y: d};

  // Seat tube runs up and back from the BB at the seat angle
  const stDir = {x: -Math.cos(sa), y: Math.sin(sa)};
  const stTop = {x: g.seat_tube_length * stDir.x, y: g.seat_tube_length * stDir.y};

  // Top tube joins just below the top of the head tube and just below the top
  // of the seat tube; the seat stays meet the seat tube a little lower still
  const ttFront = {x: htTop.x + 15 * down.x, y: htTop.y + 15 * down.y};
  const ttRear = {x: stTop.x - 20 * stDir.x, y: stTop.y - 20 * stDir.y};
  const ssTop = {x: stTop.x - 55 * stDir.x, y: stTop.y - 55 * stDir.y};

  return {
    bb, rearAxle, frontAxle, htTop, htBottom, stTop, ttFront, ttRear, ssTop,
    wheelRadius: R, rimRadius: rim, groundY: d - R,
    trail: trail(g.head_tube_angle, offset, R),
    filled
  };
}

// Line segments that make up the frame and fork, ready to draw
export function frameSegments(p) {
  return [
    {part: "head tube", a: p.htTop, b: p.htBottom, weight: 2.2},
    {part: "top tube", a: p.ttFront, b: p.ttRear, weight: 1.6},
    {part: "down tube", a: p.htBottom, b: p.bb, weight: 1.8},
    {part: "seat tube", a: p.bb, b: p.stTop, weight: 1.6},
    {part: "chainstay", a: p.bb, b: p.rearAxle, weight: 1.4},
    {part: "seat stay", a: p.rearAxle, b: p.ssTop, weight: 1.2},
    {part: "fork", a: p.htBottom, b: p.frontAxle, weight: 1.6}
  ];
}

// Build a full geometry row from the numbers a designer chooses. Returns the
// same fields as a row of the dataset, so the drawing, rider, and comparison
// code can treat a custom design exactly like a production bike.
//   d: {stack, reach, head_tube_angle, seat_tube_angle, bb_drop, chainstay,
//       fork_offset, fork_axle_crown, wheel_size, tyre_width, seat_tube_length}
export function designRow(d) {
  const rad = deg => (deg * Math.PI) / 180;
  const ha = rad(d.head_tube_angle);
  const R = wheelRadius(d.wheel_size, d.tyre_width);
  // The crown sits on the steering axis; measured along that axis from the
  // point level with the axle, it is about sqrt(A-C^2 - offset^2) up. On modern
  // frames the bottom of the head tube wraps down past the top of the crown
  // (integrated headset): across 10 bikes in the dataset that publish fork
  // length, by a median of 14 mm (range 11 to 19).
  const crownAlongAxis = Math.sqrt(Math.max(0, d.fork_axle_crown ** 2 - d.fork_offset ** 2));
  const headTubeBelowCrown = 14;
  const head_tube_length = (d.stack - d.bb_drop) / Math.sin(ha) - crownAlongAxis + headTubeBelowCrown;
  const cs_h = Math.sqrt(Math.max(0, d.chainstay ** 2 - d.bb_drop ** 2));
  const front_centre_calc = d.reach + (d.stack - d.bb_drop) / Math.tan(ha) + d.fork_offset / Math.sin(ha);
  const trail_calc = trail(d.head_tube_angle, d.fork_offset, R);
  const front_centre_direct = Math.hypot(front_centre_calc, d.bb_drop);
  const sa = rad(d.seat_tube_angle);
  return {
    ...d,
    bike_id: "custom", brand: "Your", model: "design", label: "Your design", size_label: "custom",
    category: "custom", config: "standard", is_default_config: true,
    fork_offset_used: d.fork_offset, offset_estimated: false,
    head_tube_length,
    top_tube_effective: d.reach + d.stack / Math.tan(sa),
    wheelbase: front_centre_calc + cs_h,
    front_centre_calc,
    trail_calc,
    mechanical_trail: trail_calc * Math.sin(ha),
    wheel_flop: trail_calc * Math.sin(ha) * Math.cos(ha),
    stack_reach_ratio: d.stack / d.reach,
    bb_height: R - d.bb_drop,
    wheel_radius: R,
    standover: null,
    tyre_clearance_mm: null
  };
}

// Checks for impossible or unusual combinations. Each has a level: "error"
// (can't be built as drawn), "warn" (possible, but unusual or risky), or
// "note" (worth knowing).
export function designChecks(r, {crank = 172.5} = {}) {
  const out = [];
  const add = (level, text) => out.push({level, text});
  if (r.trail_calc < 0) add("error", `Negative trail (${r.trail_calc.toFixed(0)} mm): the steering would want to flop sideways and not straighten itself. Reduce the fork offset or slacken the head angle.`);
  else if (r.trail_calc < 45) add("warn", `Very low trail (${r.trail_calc.toFixed(0)} mm): very quick, nervous steering. Production gravel bikes run about 54 to 90 mm.`);
  else if (r.trail_calc > 100) add("warn", `Very high trail (${r.trail_calc.toFixed(0)} mm): heavy, slow steering. Production gravel bikes run about 54 to 90 mm.`);
  if (r.head_tube_length < 0) add("error", `This stack is too low for this fork and head angle: the head tube would need to be ${r.head_tube_length.toFixed(0)} mm long. Raise the stack or use a shorter fork.`);
  else if (r.head_tube_length < 70) add("warn", `Very short head tube (${r.head_tube_length.toFixed(0)} mm). Production bikes go down to about 80 mm.`);
  const toe = Math.hypot(r.front_centre_calc, r.bb_drop) - r.wheel_radius - crank;
  if (toe < 0) add("error", `The front tyre overlaps the pedal circle by ${(-toe).toFixed(0)} mm: the pedal would hit the tyre when turning.`);
  else if (toe < 70) add("warn", `Toe overlap is likely: only ${toe.toFixed(0)} mm between the pedal axle and the tyre with ${crank} mm cranks. Most shoes reach 90 to 110 mm ahead of the pedal axle.`);
  if (r.chainstay < 405) add("warn", `Chainstays under 405 mm (${r.chainstay} mm) leave little room for wide tyres and a front chainring. Production gravel bikes here run 420 to 445 mm.`);
  else if (r.chainstay > 470) add("note", `Long chainstays (${r.chainstay} mm): very stable, but slow to turn and harder to lift the front wheel.`);
  if (r.bb_height < 260) add("warn", `Low bottom bracket (${r.bb_height.toFixed(0)} mm off the ground): pedals may strike rocks and roots when pedalling through corners.`);
  if (r.head_tube_angle < 66 || r.head_tube_angle > 75) add("warn", `A ${r.head_tube_angle}° head angle is well outside the 68 to 72.5° range of production gravel bikes.`);
  if (r.seat_tube_angle < 70 || r.seat_tube_angle > 78) add("warn", `A ${r.seat_tube_angle}° seat angle is outside the usual 72 to 76° range.`);
  if (r.stack_reach_ratio < 1.25 || r.stack_reach_ratio > 1.8) add("note", `Stack-to-reach ratio of ${r.stack_reach_ratio.toFixed(2)} is outside the 1.35 to 1.65 range of production gravel bikes.`);
  if (r.fork_offset > r.fork_axle_crown * 0.2) add("warn", "Fork offset is unusually large for this fork length.");
  if (r.tyre_width > 61) add("note", "Tyres over 61 mm are mountain bike territory; check frame and fork clearance.");
  return out;
}

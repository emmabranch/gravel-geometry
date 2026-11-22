// geometry.js
// Turns a row of published geometry into the x, y positions (in mm) of each
// point on the frame, so a bike can be drawn to scale. Shared by every page
// that draws a bike: Compare now, and the rider overlay and builder later.
//
// Coordinates: the bottom bracket (BB) is at (0, 0), x runs forward towards the
// front wheel, and y runs up. All lengths are in millimetres.

const rad = deg => (deg * Math.PI) / 180;

// Outer tyre radius: 622 mm bead seat diameter halved, plus a tyre whose
// height is taken as equal to its width.
export function wheelRadius(wheelSize, tyreWidth = 45) {
  return 311 + (wheelSize === "29er" ? 57 : tyreWidth);
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
  const R = wheelRadius(g.wheel_size, tyreWidth);
  const rim = 311;

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

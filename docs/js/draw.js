// draw.js
// Draws a bike, and optionally a stick-figure rider, as SVG markup.
// Uses the same coordinates as geometry.js and rider.js: BB at (0, 0),
// x forward, y up, millimetres. SVG's y runs down, so y is flipped here.

import {bikePoints, frameSegments} from "./geometry.js";

const f = n => Number(n).toFixed(1);

function line(a, b, colour, width, extra = "") {
  return `<line x1="${f(a.x)}" y1="${f(-a.y)}" x2="${f(b.x)}" y2="${f(-b.y)}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" vector-effect="non-scaling-stroke" ${extra}/>`;
}
function dot(p, r, fill, extra = "") {
  return `<circle cx="${f(p.x)}" cy="${f(-p.y)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
}

// The parts of the picture, in drawing order, for one bike and its rider
export function bikeRiderMarkup(row, rider, {colour = "#2340FF", riderColour = "#111111", showRider = true} = {}) {
  const p = bikePoints(row);
  let s = "";

  // ground
  s += line({x: p.rearAxle.x - p.wheelRadius - 40, y: p.groundY}, {x: p.frontAxle.x + p.wheelRadius + 40, y: p.groundY}, "#DCD4C4", 1.5);

  // wheels
  for (const c of [p.rearAxle, p.frontAxle]) {
    s += `<circle cx="${f(c.x)}" cy="${f(-c.y)}" r="${f(p.wheelRadius)}" fill="none" stroke="${colour}" stroke-opacity="0.5" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
    s += `<circle cx="${f(c.x)}" cy="${f(-c.y)}" r="${f(p.rimRadius)}" fill="none" stroke="${colour}" stroke-opacity="0.3" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }

  // frame and fork
  for (const sg of frameSegments(p)) s += line(sg.a, sg.b, colour, 1.4 + sg.weight);

  if (rider && showRider) {
    const q = rider.points;
    // cockpit: steerer spacers, stem, bar, hoods; saddle; cranks
    s += line(q.htTop, q.clamp, "#5A544A", 3);
    s += line(q.clamp, q.bar, "#5A544A", 3);
    s += line(q.bar, q.hands, "#5A544A", 2);
    s += line({x: q.saddle.x - 120, y: q.saddle.y}, {x: q.saddle.x + 150, y: q.saddle.y}, "#5A544A", 4);
    s += line(p.stTop, q.saddle, "#5A544A", 2);
    s += line(q.pedalTop, q.pedalBottom, "#5A544A", 2.5);

    // far leg (pedal at the top), drawn faint behind the frame
    if (q.kneeTop) {
      s += line(q.hip, q.kneeTop, riderColour, 4, `stroke-opacity="0.3"`);
      s += line(q.kneeTop, q.ankleTop, riderColour, 4, `stroke-opacity="0.3"`);
      s += line(q.ankleTop, q.pedalTop, riderColour, 3, `stroke-opacity="0.3"`);
    }
    // near leg (pedal at the bottom)
    if (q.kneeBottom) {
      s += line(q.hip, q.kneeBottom, riderColour, 5);
      s += line(q.kneeBottom, q.ankleBottom, riderColour, 5);
    } else {
      s += line(q.hip, q.ankleBottom, "#A3241A", 5, `stroke-dasharray="6,5"`);
    }
    s += line(q.ankleBottom, q.pedalBottom, riderColour, 3.5);

    // torso, arm, head
    s += line(q.hip, q.shoulder, riderColour, 6);
    s += line(q.shoulder, q.elbow, riderColour, 4.5);
    s += line(q.elbow, q.hands, riderColour, 4.5);
    const H = rider.inputs.height;
    s += dot(q.head, 0.062 * H, "#ffffff", `stroke="${riderColour}" stroke-width="3" vector-effect="non-scaling-stroke"`);
    for (const j of [q.hip, q.kneeBottom, q.shoulder, q.elbow].filter(Boolean)) s += dot(j, 14, riderColour);
  }

  // BB
  s += dot(p.bb, 16, "#ffffff", `stroke="${colour}" stroke-width="2" vector-effect="non-scaling-stroke"`);
  return {markup: s, points: p};
}

// A complete SVG for one bike (with rider), fitted to its own extents
export function bikeRiderSVG(row, rider, opts = {}) {
  const {markup, points: p} = bikeRiderMarkup(row, rider, opts);
  const ys = [p.groundY, p.htTop.y, p.stTop.y];
  if (rider && opts.showRider !== false) ys.push(rider.points.head.y + 0.07 * rider.inputs.height);
  const x0 = p.rearAxle.x - p.wheelRadius - 60, x1 = p.frontAxle.x + p.wheelRadius + 60;
  const y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 40;
  const label = opts.label ?? "Bike drawn to scale";
  return `<svg viewBox="${f(x0)} ${f(-y1)} ${f(x1 - x0)} ${f(y1 - y0)}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">${markup}</svg>`;
}

// Shared extents, so several drawings use exactly the same scale
export function sharedViewBox(items) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const {row, rider} of items) {
    const p = bikePoints(row);
    x0 = Math.min(x0, p.rearAxle.x - p.wheelRadius - 60);
    x1 = Math.max(x1, p.frontAxle.x + p.wheelRadius + 60);
    y0 = Math.min(y0, p.groundY - 40);
    y1 = Math.max(y1, p.htTop.y + 40, p.stTop.y + 40, rider ? rider.points.head.y + 0.07 * rider.inputs.height + 40 : -Infinity);
  }
  return {x0, x1, y0, y1, vb: `${f(x0)} ${f(-y1)} ${f(x1 - x0)} ${f(y1 - y0)}`};
}

// The fit measurements, drawn the way a frame engineer would: the bike, its
// stem and seatpost, and dash-dot lines from the BB to the seatpost clamp
// (the saddle point) and to the centre of the stem's bar clamp.
//   rider: a riderOnBike result (its fit numbers and points are used; the
//          rider isn't drawn)
export function fitDiagramSVG(row, rider, {colour = "#7a5c43", label = "Fit measurements"} = {}) {
  const {markup, points: p} = bikeRiderMarkup(row, rider, {colour, showRider: false});
  const q = rider.points, fit = rider.fit;
  const seat = q.seatClamp, bar = q.bar, g = p.groundY;
  const dim = "#5A544A", hi = "#111111";
  const dash = `stroke-dasharray="14,6,3,6"`;
  const txt = (x, y, s, attrs = "") => `<text x="${f(x)}" y="${f(-y)}" font-size="34" font-family="Bricolage Grotesque, sans-serif" fill="${hi}" ${attrs}>${s}</text>`;
  let s = markup;
  // the parts the fit depends on: spacers and stem, seatpost and saddle
  s += line(q.htTop, q.clamp, "#5A544A", 3) + line(q.clamp, bar, "#5A544A", 3);
  s += line(p.stTop, seat, "#5A544A", 2.5) + line({x: q.saddle.x - 120, y: q.saddle.y}, {x: q.saddle.x + 150, y: q.saddle.y}, "#5A544A", 4);
  // verticals to the ground, and the horizontal dimension along it
  for (const pt of [seat, {x: 0, y: 0}, bar]) s += line(pt, {x: pt.x, y: g}, dim, 1.2, dash);
  s += line({x: seat.x, y: g}, {x: bar.x, y: g}, dim, 1.2, dash);
  // straight lines: BB to bar, saddle to bar, BB to saddle
  s += line({x: 0, y: 0}, bar, "#E0431B", 2, dash) + line(seat, bar, "#2340FF", 2, dash) + line({x: 0, y: 0}, seat, "#7a5c43", 2, dash);
  for (const pt of [seat, bar]) s += dot(pt, 11, hi);
  // labels
  s += txt(seat.x - 10, seat.y + 40, "seatpost clamp", `text-anchor="end"`);
  s += txt(bar.x + 18, bar.y + 34, "bar clamp");
  s += txt((seat.x + bar.x) / 2, (seat.y + bar.y) / 2 + 26, `saddle to bar ${fit.saddleToBar.toFixed(0)}`, `text-anchor="middle" fill="#2340FF"`);
  s += txt(bar.x * 0.42 + 24, bar.y * 0.42, `BB to bar ${fit.bbToBar.toFixed(0)}`, `fill="#E0431B"`);
  s += txt(seat.x - 16, seat.y * 0.55, `BB to clamp ${fit.bbToClamp.toFixed(0)}`, `text-anchor="end" fill="#7a5c43"`);
  s += txt(seat.x / 2, g + 16, `setback ${fit.setback.toFixed(0)}`, `text-anchor="middle" fill="${dim}"`);
  s += txt(bar.x / 2, g + 16, `reach ${fit.barReach.toFixed(0)}`, `text-anchor="middle" fill="${dim}"`);
  s += txt(bar.x + 18, bar.y / 2, `stack ${fit.barStack.toFixed(0)}`, `fill="${dim}"`);
  s += line({x: bar.x + 6, y: 0}, {x: bar.x + 6, y: bar.y}, dim, 1, `stroke-dasharray="2,5"`);
  const x0 = Math.min(p.rearAxle.x - p.wheelRadius, seat.x - 380) - 40, x1 = p.frontAxle.x + p.wheelRadius + 60;
  const y1 = Math.max(seat.y, q.saddle.y, bar.y) + 80, y0 = g - 60;
  return `<svg viewBox="${f(x0)} ${f(-y1)} ${f(x1 - x0)} ${f(y1 - y0)}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">${s}</svg>`;
}

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
export function bikeRiderMarkup(row, rider, {colour = "#2563a8", riderColour = "#0b2233", showRider = true} = {}) {
  const p = bikePoints(row);
  let s = "";

  // ground
  s += line({x: p.rearAxle.x - p.wheelRadius - 40, y: p.groundY}, {x: p.frontAxle.x + p.wheelRadius + 40, y: p.groundY}, "#c9d6e0", 1.5);

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
    s += line(q.htTop, q.clamp, "#5b7083", 3);
    s += line(q.clamp, q.bar, "#5b7083", 3);
    s += line(q.bar, q.hands, "#5b7083", 2);
    s += line({x: q.saddle.x - 120, y: q.saddle.y}, {x: q.saddle.x + 150, y: q.saddle.y}, "#5b7083", 4);
    s += line(p.stTop, q.saddle, "#5b7083", 2);
    s += line(q.pedalTop, q.pedalBottom, "#5b7083", 2.5);

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
      s += line(q.hip, q.ankleBottom, "#c0392b", 5, `stroke-dasharray="6,5"`);
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

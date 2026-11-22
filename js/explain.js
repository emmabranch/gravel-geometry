// explain.js
// "Explain this bike": a plain-language summary of one size of one bike,
// comparing each number with every production size on the site.

// Mid-rank percentile, so a value shared by many sizes lands in the middle of them
const pct = (vals, v) => Math.round(100 * (vals.filter(x => x < v).length + 0.5 * vals.filter(x => x === v).length) / vals.length);

// Turn a percentile into words. `more` and `less` describe the direction,
// for example "trail" -> "more trail than most".
function rank(p, more, less) {
  if (p >= 85) return `among the ${more.top}`;
  if (p >= 65) return `${more.word} than most`;
  if (p > 35) return "about average";
  if (p > 15) return `${less.word} than most`;
  return `among the ${less.top}`;
}

// Sizes with a similar reach, so a 61 cm bike isn't called "long" just for
// being big.
function similarSizes(row, population) {
  for (const w of [12, 20, 30]) {
    const near = population.filter(d => Math.abs(d.reach - row.reach) <= w);
    if (near.length >= 12) return {near, w};
  }
  return {near: population, w: null};
}


// row:        one row of gravel_geometry_derived.csv
// population: rows to compare against (default setting, every size)
export function explainBike(row, population) {
  const all = k => population.map(d => d[k]).filter(v => v != null && !Number.isNaN(v));
  const {near, w} = similarSizes(row, population);
  const nearVals = k => near.map(d => d[k]).filter(v => v != null);

  const pRatio = pct(all("stack_reach_ratio"), row.stack_reach_ratio);
  const pTrail = pct(all("trail_calc"), row.trail_calc);
  const pHta = pct(all("head_tube_angle"), row.head_tube_angle);
  const pWb = pct(nearVals("wheelbase"), row.wheelbase);
  const pCs = pct(all("chainstay"), row.chainstay);
  const pTyre = row.tyre_clearance_mm != null ? pct(all("tyre_clearance_mm"), row.tyre_clearance_mm) : null;

  // The overall character, from steering and length
  const steady = (pTrail + pWb) / 2;
  const character = steady >= 65
    ? "a calm, stable bike, suited to long days, loose descents, and carrying a load"
    : steady <= 35
      ? "a quick, lively bike, suited to racing and twisty roads"
      : "a middle-of-the-road all-rounder";
  const posture = pRatio >= 65 ? "with an upright riding position" : pRatio <= 35 ? "with a long, low riding position" : "with a moderate riding position";

  const bullets = [];

  // Fit
  bullets.push({
    title: pRatio >= 65 ? "Upright" : pRatio <= 35 ? "Long and low" : "Moderate position",
    text: `Compared with all sizes, a stack-to-reach ratio of ${row.stack_reach_ratio.toFixed(2)} (${row.stack} mm stack, ${row.reach} mm reach) is ${rank(pRatio, {word: "more upright", top: "most upright"}, {word: "lower and longer", top: "longest and lowest"})}.` +
      ` ${pRatio >= 65 ? "Expect a more upright back, easier on the neck and hands over long days." : pRatio <= 35 ? "Expect a longer, lower back, more aerodynamic and more weight on the hands." : ""}`.trimEnd()
  });

  // Steering
  const steerWord = pTrail >= 65 ? "Steady steering" : pTrail <= 35 ? "Quick steering" : "Neutral steering";
  const hta = pHta <= 35 ? "slack" : pHta >= 65 ? "steep" : "middling";
  bullets.push({
    title: steerWord,
    text: `${row.trail_calc.toFixed(0)} mm of trail on a 700 × 45 tyre is ${rank(pTrail, {word: "more", top: "highest"}, {word: "less", top: "lowest"})}, from a ${hta} ${row.head_tube_angle}° head angle and ${row.fork_offset_used} mm of fork offset${row.offset_estimated ? " (offset estimated, as the chart doesn't give it)" : ""}.`
  });

  // Length
  bullets.push({
    title: pWb >= 65 ? "Long for its size" : pWb <= 35 ? "Short for its size" : "Average length",
    text: `Compared with sizes of a similar reach, a ${row.wheelbase} mm wheelbase is ${rank(pWb, {word: "longer", top: "longest"}, {word: "shorter", top: "shortest"})}. ${pWb >= 65 ? "Expect calm handling at speed and less pitching over bumps." : pWb <= 35 ? "Expect tighter turning and a livelier feel." : ""}`.trim()
  });

  // Height and rear end
  // BB drop clusters tightly (most bikes are 70 to 80 mm), so judge it in millimetres from the median
  const medDrop = all("bb_drop").sort((a, b) => a - b)[Math.floor(all("bb_drop").length / 2)];
  const low = row.bb_drop >= medDrop + 4 ? "sits you low between the wheels" : row.bb_drop <= medDrop - 4 ? "sits you higher, on top of the bike" : "sits you at a typical height";
  bullets.push({
    title: "Height and rear end",
    text: `${row.bb_drop} mm of BB drop ${low}, and ${row.chainstay} mm chainstays are ${rank(pCs, {word: "longer", top: "longest"}, {word: "shorter", top: "shortest"})}.`
  });

  // Tyres and toe overlap
  const extras = [];
  if (pTyre != null) extras.push(`room for ${row.tyre_clearance_mm} mm tyres (${rank(pTyre, {word: "more", top: "roomiest"}, {word: "less", top: "tightest"})})`);
  if (row.toe_clearance != null) extras.push(row.toe_clearance < 90
    ? `toe overlap is likely in slow, tight turns (${row.toe_clearance.toFixed(0)} mm from pedal axle to tyre, less than a typical shoe)`
    : `toe overlap is unlikely (${row.toe_clearance.toFixed(0)} mm from pedal axle to tyre)`);
  if (extras.length) bullets.push({title: "Tyres and toes", text: extras.map((e, i) => i === 0 ? e[0].toUpperCase() + e.slice(1) : e).join("; ") + "."});

  return {
    headline: `${character}, ${posture}.`,
    bullets,
    basis: `Compared with all ${population.length} production sizes on this site${w ? `; length is compared with the ${near.length} sizes whose reach is within ${w} mm of this one` : ""}.`
  };
}

// The same, as an HTML card
export function explainCard(row, population, options = {}) {
  const e = explainBike(row, population);
  const el = document.createElement("div");
  el.className = "explain-card";
  const head = options.heading ?? `${row.label}, size ${row.size_label}${row.config && row.config !== "standard" ? ` (${row.config})` : ""}`;
  el.innerHTML = `<div class="explain-head">${head}</div>
    <p class="explain-lede">In short: ${e.headline}</p>
    <ul>${e.bullets.map(b => `<li><strong>${b.title}.</strong> ${b.text}</li>`).join("")}</ul>
    <p class="explain-basis">${e.basis}</p>`;
  return el;
}

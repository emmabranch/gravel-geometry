// eb_charts.js
// Shared chart settings for Observable Plot and D3 on Emma Branch's portfolio sites.
// Master copy lives in _brand-kit/js/. Copy it to a project's js/ folder, never edit it there first.
// Same colours and rules as R/theme_eb.R. Fonts come from the page (loaded by _brand.yml).
//
// Observable Plot, in a Quarto {ojs} cell:
//   import {eb, ebPlot, ebAccent} from "./js/eb_charts.js"
//   ebPlot(Plot, {marks: [Plot.barY(data, {x: "year", y: "area", fill: ebAccent("bc-wildfire-bigquery"), stroke: eb.ink})]})
//
// D3, after drawing an axis:
//   svg.append("g").call(d3.axisBottom(x)).call(ebAxis)

export const eb = {
  ink: "#111111", paper: "#F3EEE3", white: "#FFFFFF", muted: "#5A544A",
  cobalt: "#2340FF", tomato: "#FF5A36", sunflower: "#FFD23F", kelp: "#00B386",
  hotpink: "#FF6FB0", lilac: "#B9A4FF",
  grid: "#DCD4C4",      // faint gridlines on paper
  context: "#C9C1B3",   // "everything else" when one series is highlighted
  sans: '"Bricolage Grotesque", system-ui, sans-serif',
  mono: '"Space Mono", ui-monospace, monospace'
};

// Category FILLS (bars, areas, points): bright inks, always with stroke: eb.ink.
// Hot pink is sixth (closest to kelp and tomato for colourblind readers); it is also the
// go-to highlight on top of a project accent (eb.hotpink).
export const ebCatFill = [eb.cobalt, eb.tomato, eb.sunflower, eb.kelp, eb.lilac, eb.hotpink];

// Category LINES: deeper inks that pass 3:1 on paper and white. Four at most; label directly.
export const ebCatLine = ["#2340FF", "#E0431B", "#00664B", "#111111"];

// Diverging (below / above a reference): red to blue, paper in the middle
export const ebDiv = ["#A3241A", "#E08A6E", "#F3EEE3", "#8A9BEA", "#1F33B5"];

// Project accents, from the kit README: [accent, accent-2, accent-light]
export const ebProjects = {
  "redcap-starter-kit":         ["#6b4c9a", "#a07cc5", "#c9b2ea"],
  "bc-housing-indicators":      ["#3b3fc4", "#7b80f2", "#aab0ff"],
  "bc-fish-stock-status":       ["#0f7f66", "#3fbf9a", "#7fe0c4"],
  "bc-lightstation-qc":         ["#1f5f99", "#4aa3df", "#8ccaf2"],
  "bc-wildfire-bigquery":       ["#b33a0e", "#f4a259", "#ffb347"],
  "vch-climate-equity-profile": ["#3f7d2c", "#8cc152", "#b5e08a"],
  "ontario-claims-caribou":     ["#94661a", "#d9a441", "#f0c674"],
  "bc-salmon-explorer":         ["#c2415e", "#f08aa0", "#ffb0c0"],
  "salish-sea-whales":          ["#8a4a72", "#cf86ae", "#f0bcd8"],
  "bike-recall-surveillance":   ["#6b5f00", "#e3c600", "#ffe94d"],
  "gravel-geometry":            ["#7a5c43", "#c19a6b", "#e2c9a6"]
};

// n = 1 main highlight, 2 second tone, 3 light tone
export function ebAccent(project, n = 1) {
  const p = ebProjects[project];
  return p ? p[n - 1] : eb.cobalt;
}

// Sequential ramp for a project: paper to accent-light to accent to ink
export function ebSeq(project) {
  return [eb.paper, ebAccent(project, 3), ebAccent(project, 1), eb.ink];
}

// ---- Observable Plot -------------------------------------------------------
// Plot draws on a transparent background, so it sits on paper or white as the page does.
export const ebPlotStyle = {
  fontFamily: eb.sans, fontSize: "12px", color: eb.ink, background: "transparent", overflow: "visible"
};

// Wraps Plot.plot with the shared look. Anything you pass wins over the defaults.
// Axis tick labels use Space Mono via the CSS in brand.scss (.eb-plot).
// Pass Plot in as the first argument, because imported files can't see Observable's Plot.
export function ebPlot(P, options = {}) {
  const opts = {
    marginTop: 24, marginRight: 20, marginBottom: 36, marginLeft: 48,
    insetTop: 4,
    ...options,
    style: {...ebPlotStyle, ...(options.style || {})},
    x: {tickSize: 4, ...(options.x || {})},
    y: {grid: true, tickSize: 0, ...(options.y || {})},
    color: {...(options.color || {})}
  };
  const el = P.plot(opts);
  el.classList.add("eb-plot");
  return el;
}

// ---- D3 --------------------------------------------------------------------
// Call on an axis group: svg.append("g").call(d3.axisLeft(y)).call(ebAxis)
export function ebAxis(g, {domain = true, grid = false, width = 0} = {}) {
  g.selectAll("text").attr("font-family", eb.mono).attr("font-size", 10).attr("fill", eb.ink);
  g.selectAll("line").attr("stroke", eb.ink);
  g.select(".domain").attr("stroke", eb.ink).attr("stroke-width", 1.2).attr("display", domain ? null : "none");
  if (grid && width) {
    g.selectAll(".tick line").attr("x2", width).attr("stroke", eb.grid);
  }
  return g;
}

// Text helpers for D3 labels: selection.call(ebLabel) or .call(ebSmall)
export function ebLabel(sel) {
  return sel.attr("font-family", eb.sans).attr("font-size", 12).attr("fill", eb.ink);
}
export function ebSmall(sel) {
  return sel.attr("font-family", eb.mono).attr("font-size", 10).attr("fill", eb.muted);
}

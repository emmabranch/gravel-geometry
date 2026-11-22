// export.js
// Save a drawing as a PNG image, or print the page (which also saves as PDF).
//
// The image is a card: a title, a key to the colours, the drawing itself, and
// a footer saying where it came from. It's built as one SVG, drawn onto a
// canvas, and downloaded as a PNG.

const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

// Build the card as SVG markup.
//   drawing: an <svg> element (with a viewBox), or a list of
//            {svg, caption} panels to set side by side
//   title:   one line at the top
//   key:     [{colour, text}] shown under the title
//   note:    optional small line under the drawing
//   source:  what the footer says the drawing is based on
function cardMarkup(drawing, {title, key = [], note = "", source = "drawn to scale from manufacturers' published geometry"}) {
  const W = 1600, pad = 56, gap = 40;
  const panels = (Array.isArray(drawing) ? drawing : [{svg: drawing}]).map(p => ({
    ...p, vb: p.svg.getAttribute("viewBox").split(/[ ,]+/).map(Number)
  }));
  const drawW = W - 2 * pad;
  const panelW = (drawW - gap * (panels.length - 1)) / panels.length;
  const capH = panels.some(p => p.caption) ? 36 : 0;
  // tall drawings are capped so the card stays a sensible shape
  const drawH = Math.min(820, Math.round(Math.max(...panels.map(p => panelW * p.vb[3] / p.vb[2]))));

  // Key items flow left to right, wrapping when a row is full
  const keyRows = [[]];
  let x = 0;
  for (const k of key) {
    const w = 34 + k.text.length * 11.5;
    if (x + w > drawW && keyRows.at(-1).length) { keyRows.push([]); x = 0; }
    keyRows.at(-1).push({...k, x});
    x += w + 28;
  }
  const titleY = pad + 30;
  const keyY0 = titleY + 52;
  const drawY = keyY0 + (key.length ? keyRows.length * 36 : 0) + 12;
  const noteY = drawY + capH + drawH + 34;
  const footY = noteY + (note ? 40 : 6);
  const H = footY + pad - 10;
  const today = new Date().toISOString().slice(0, 10);

  let keyMarkup = "";
  keyRows.forEach((row, i) => row.forEach(k => {
    const y = keyY0 + i * 36;
    keyMarkup += `<rect x="${pad + k.x}" y="${y - 6}" width="22" height="6" rx="3" fill="${k.colour}"/>`;
    keyMarkup += `<text x="${pad + k.x + 32}" y="${y}" font-size="20" fill="#1f2a33">${esc(k.text)}</text>`;
  }));

  const panelMarkup = panels.map((p, i) => {
    const px = pad + i * (panelW + gap);
    const cap = p.caption ? `<text x="${px}" y="${drawY + 22}" font-size="20" font-weight="600" fill="${p.captionColour ?? "#1f2a33"}">${esc(p.caption)}</text>` : "";
    return `${cap}<svg x="${px}" y="${drawY + capH}" width="${panelW}" height="${drawH}" viewBox="${p.vb.join(" ")}" preserveAspectRatio="xMidYMax meet">${p.svg.innerHTML}</svg>`;
  }).join("");

  return {W, H, markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="8" fill="#0b2233"/>
  <text x="${pad}" y="${titleY}" font-size="32" font-weight="700" fill="#0b2233">${esc(title)}</text>
  ${keyMarkup}
  ${panelMarkup}
  ${note ? `<text x="${pad}" y="${noteY}" font-size="18" fill="#5b7083">${esc(note)}</text>` : ""}
  <line x1="${pad}" x2="${W - pad}" y1="${footY - 30}" y2="${footY - 30}" stroke="#e2c9a6"/>
  <text x="${pad}" y="${footY}" font-size="18" fill="#5b7083">Gravel geometry explorer · emmabranch.github.io/gravel-geometry · ${esc(source)} · ${today}</text>
</svg>`};
}

// Download the card as a PNG.
export async function downloadPng(drawing, options, filename = "gravel-geometry.png") {
  const {W, H, markup} = cardMarkup(drawing, options);
  const url = URL.createObjectURL(new Blob([markup], {type: "image/svg+xml;charset=utf-8"}));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    canvas.getContext("2d").drawImage(img, 0, 0, W, H);
    const blob = await new Promise(ok => canvas.toBlob(ok, "image/png"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A file name from a list of parts: "Specialized Crux 5" -> "specialized-crux-5"
export function fileName(...parts) {
  return parts.join(" ").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 80) + ".png";
}

// Two buttons: save the drawing as an image, and print (or save as PDF).
//   getSvg: a function returning the drawing (see cardMarkup)
export function exportButtons(getSvg, options, filename) {
  const wrap = document.createElement("div");
  wrap.className = "export-row";
  const png = document.createElement("button");
  png.type = "button";
  png.className = "share-button";
  png.textContent = "Save the drawing as an image";
  const pdf = document.createElement("button");
  pdf.type = "button";
  pdf.className = "share-button";
  pdf.textContent = "Print or save as PDF";
  const msg = document.createElement("span");
  msg.className = "share-msg";
  msg.setAttribute("role", "status");
  png.onclick = async () => {
    msg.textContent = "Making the image…";
    try {
      await downloadPng(getSvg(), options, filename);
      msg.textContent = "Saved.";
    } catch (e) {
      msg.textContent = "Sorry, this browser couldn't make the image. Try Print or save as PDF instead.";
    }
    setTimeout(() => { if (msg.textContent === "Saved.") msg.textContent = ""; }, 3000);
  };
  pdf.onclick = () => window.print();
  wrap.append(png, pdf, msg);
  return wrap;
}

// When the page is printed (from the button or the browser menu), add a line
// at the top saying where it came from, including the link back to these
// exact settings.
if (typeof window !== "undefined" && !window.__ggPrintHook) {
  window.__ggPrintHook = true;
  window.addEventListener("beforeprint", () => {
    const main = document.querySelector("main") ?? document.body;
    let el = document.querySelector(".print-source");
    if (!el) { el = document.createElement("div"); el.className = "print-source"; main.prepend(el); }
    el.textContent = `Gravel geometry explorer, printed ${new Date().toISOString().slice(0, 10)}. Open these settings again: ${window.location.href}`;
  });
}

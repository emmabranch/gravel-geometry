// share.js
// Shareable links. Each page reads its starting settings from the address
// (?a=...&b=...), keeps the address up to date as the controls change, and
// offers a "Copy link" button.
//
// A value in the address is only used the first time a control is built.
// After that, the page behaves as normal: picking a new bike still resets its
// size, and so on.

const params = new URLSearchParams(window.location.search);
const used = new Set();

// The address value for `key`, if it is present, valid, and not used yet;
// otherwise `fallback`.
//   options: a list of allowed values (compared as strings)
//   min, max: numeric limits (the value is a number when either is given)
//   bool: true for on/off values, written as 1 and 0
export function fromUrl(key, fallback, {options, min, max, bool} = {}) {
  if (!params.has(key) || used.has(key)) return fallback;
  used.add(key);
  const raw = params.get(key);
  if (bool) return raw === "1" ? true : raw === "0" ? false : fallback;
  if (options) {
    const hit = options.find(o => String(o) === raw);
    return hit === undefined ? fallback : hit;
  }
  if (min !== undefined || max !== undefined) {
    const v = Number(raw);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  }
  return raw;
}

// The full address for a set of settings. Empty values are left out.
export function shareUrl(state) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v === null || v === undefined || v === "") continue;
    q.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  const s = q.toString();
  return `${window.location.origin}${window.location.pathname}${s ? "?" + s : ""}`;
}

// Keep the address bar in step with the settings, without adding to the
// back-button history.
export function syncUrl(state) {
  const url = shareUrl(state);
  try { window.history.replaceState(window.history.state, "", url); } catch (e) { /* some previews block this */ }
  return url;
}

// A "Copy link" button. Falls back to showing the link in a box to copy by
// hand if the clipboard isn't available.
export function shareButton(state, label = "Copy a link to these settings") {
  const url = syncUrl(state);
  const wrap = document.createElement("div");
  wrap.className = "share-row";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "share-button";
  btn.textContent = label;
  const msg = document.createElement("span");
  msg.className = "share-msg";
  msg.setAttribute("role", "status");
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      msg.textContent = "Link copied.";
    } catch (e) {
      msg.innerHTML = "";
      const box = document.createElement("input");
      box.type = "text"; box.readOnly = true; box.value = url; box.className = "share-box";
      box.setAttribute("aria-label", "Link to these settings");
      msg.append(box);
      box.select();
    }
    setTimeout(() => { if (msg.textContent === "Link copied.") msg.textContent = ""; }, 3000);
  };
  wrap.append(btn, msg);
  return wrap;
}

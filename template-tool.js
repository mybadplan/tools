// Template Tool — minimal starter. Copy this file to my-tool.js, rename `name`, and implement render.
// See README.md for full contract. This template is ready to appear in catalog.json and be installed via Discover.

const name = "Template Tool";
const description = "Minimal starter template — copy this to build your own tool";
const version = "0.2.0";

function cooldown() {
  return 60; // seconds before Home can show this card again
}

function install(ctx) {
  // called on first install & on update/re-install
  if (!ctx.data) ctx.data = {};
  if (typeof ctx.data.count !== "number") ctx.data.count = 0;
  if (typeof data !== "undefined" && typeof data.count !== "number") data.count = 0;
}

function uninstall(ctx) {
  console.log("[template-tool] uninstalled for", ctx.userId);
}

async function render(ctx, container, submit) {
  const store = ctx.data || (typeof data !== "undefined" ? data : {}) || {};
  if (typeof store.count !== "number") store.count = 0;
  ctx.data = store;
  if (typeof data !== "undefined") data.count = store.count;

  container.innerHTML = "";
  container.style.cssText =
    "height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:white;text-align:center;font-family:system-ui";

  const badge = document.createElement("div");
  badge.textContent = "★";
  badge.style.cssText =
    "width:56px;height:56px;border-radius:9999px;border:3px solid #111;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px";
  container.appendChild(badge);

  const h = document.createElement("h2");
  h.textContent = name;
  h.style.cssText = "font-size:18px;font-weight:600";
  container.appendChild(h);

  const p = document.createElement("p");
  p.textContent = description;
  p.style.cssText = "margin-top:6px;font-size:13px;color:#71717a;max-width:280px";
  container.appendChild(p);

  const counter = document.createElement("p");
  counter.style.cssText = "margin-top:8px;font-size:12px;color:#111";
  function refresh() {
    counter.textContent = "Count: " + store.count;
  }
  refresh();
  container.appendChild(counter);

  const btn = document.createElement("button");
  btn.textContent = "Increment";
  btn.style.cssText =
    "margin-top:16px;padding:10px 20px;border-radius:9999px;background:#111;color:white;font-size:14px;font-weight:600;border:none;cursor:pointer";
  container.appendChild(btn);

  btn.onclick = async () => {
    store.count += 1;
    if (typeof data !== "undefined") data.count = store.count;
    refresh();
    try {
      await submit({ count: store.count });
    } catch {}
  };

  // optional cleanup
  return () => {};
}

function submit(ctx, payload) {
  const store = ctx.data || (typeof data !== "undefined" ? data : {}) || {};
  if (typeof payload.count === "number") store.count = payload.count;
  ctx.data = store;
  if (typeof data !== "undefined") data.count = store.count;
  return { ok: true, count: store.count };
}

module.exports = { name, description, version, cooldown, install, uninstall, render, submit };

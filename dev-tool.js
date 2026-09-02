// Dev Tool — install tools from pasted JS (local dev & private tools)
// This is the user-installable "Dev tool" that replaces the former
// Advanced: install from pasted JS section on /web/tools.
// Install this tool and use its card (Home swipe or Tools widget) to paste any tool JS.
// It writes directly to IndexedDB (+ OPFS when available) using the same shape as toolsStore.
//
// Also provides a widget() that renders inline at the top of /web/tools.

const name = "Dev Tool";
const description = "Install tools from pasted JS — paste any tool source and add it locally (IndexedDB + OPFS)";
const version = "1.0.0";

function cooldown() {
  return 300; // 5 minutes before Home shows again
}

function install(ctx) {
  if (!ctx.data) ctx.data = {};
  if (typeof ctx.data.installCount !== "number") ctx.data.installCount = 0;
  if (typeof data !== "undefined" && typeof data.installCount !== "number") data.installCount = 0;
}

function uninstall(ctx) {
  console.log("[dev-tool] uninstalled for", ctx.userId);
}

// --- DB helpers (standalone, no imports) ---
function genId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
}

function sanitize(code) {
  return code
    .replace(/^\s*export\s+default\s+/gm, "module.exports.default = ")
    .replace(/^\s*export\s+(async\s+)?function\s+/gm, "$1function ")
    .replace(/^\s*export\s+(const|let|var)\s+/gm, "$1 ")
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, "");
}

function quickMeta(code) {
  const nameM = code.match(/(?:const|let|var)\s+name\s*=\s*["'`]([^"'`]+)["'`]/);
  const descM = code.match(/(?:const|let|var)\s+description\s*=\s*["'`]([^"'`]+)["'`]/);
  const verM = code.match(/(?:const|let|var)\s+version\s*=\s*["'`]([^"'`]+)["'`]/);
  const cdM = code.match(/function\s+cooldown\s*\([^)]*\)\s*\{\s*return\s+(\d+)/);
  const cdConstM = code.match(/(?:const|let|var)\s+cooldown\s*=\s*(\d+)/);
  let cd = null;
  if (cdM) cd = parseInt(cdM[1], 10);
  else if (cdConstM) cd = parseInt(cdConstM[1], 10);
  return {
    name: nameM ? nameM[1].trim() : null,
    description: descM ? descM[1].trim() : null,
    version: verM ? verM[1].trim().slice(0, 32) : null,
    cooldownSeconds: cd,
  };
}

function validateToolCode(code) {
  const sanitized = sanitize(code);
  const wrapper = `
  const module = { exports: {} };
  const exports = module.exports;
  let data = {};
  ${sanitized}
  const __get = (typeof get !== 'undefined' && typeof get === 'function') ? get : (module.exports.get || (module.exports.default && module.exports.default.get));
  const __render = (typeof render !== 'undefined' && typeof render === 'function') ? render : (module.exports.render || (module.exports.default && module.exports.default.render));
  const __widget = (typeof widget !== 'undefined' && typeof widget === 'function') ? widget : (module.exports.widget || (module.exports.default && module.exports.default.widget));
  const __inst = (typeof install !== 'undefined' && typeof install === 'function') ? install : (module.exports.install || (module.exports.default && module.exports.default.install));
  const __cd = (typeof cooldown !== 'undefined' ? cooldown : (module.exports.cooldown || (module.exports.default && module.exports.default.cooldown) || null));
  return { get: __get, render: __render, widget: __widget, install: __inst, cooldown: __cd };
  `;
  try {
    const fn = new Function(wrapper);
    const ex = fn();
    return ex;
  } catch (e) {
    throw new Error("Tool syntax error: " + (e && e.message ? e.message : String(e)));
  }
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("planner-web-offline", 2);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("tools")) db.createObjectStore("tools", { keyPath: "id" });
      if (!db.objectStoreNames.contains("todos")) {
        const s = db.createObjectStore("todos", { keyPath: "id" });
        try { s.createIndex("createdAt", "createdAt", { unique: false }); } catch {}
        try { s.createIndex("status", "status", { unique: false }); } catch {}
      }
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
    };
  });
}

async function dbGetAllTools(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tools", "readonly");
    const st = tx.objectStore("tools");
    const req = st.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPutTool(db, rec) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tools", "readwrite");
    tx.objectStore("tools").put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function opfsWriteTool(id, code) {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) return false;
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("tools", { create: true });
    const fh = await dir.getFileHandle(id + ".js", { create: true });
    const w = await fh.createWritable();
    await w.write(code);
    await w.close();
    return true;
  } catch { return false; }
}

const DEFAULT_EXAMPLE = `const name = "Happy Check";
const description = "Ask how much you are happy — 1 to 5 rating card with weekly heatmap (full render)";
const version = "1.0.0";
function cooldown() {
  return 60;
}
function install(ctx) {
  if (!ctx.data) ctx.data = {};
  if (!ctx.data.answers) ctx.data.answers = [];
}
async function render(ctx, container, submit) {
  container.innerHTML = '<h2 style="padding:16px">Hello from My Tool</h2>';
}
function submit(ctx, payload) { return { ok: true }; }
module.exports = { name, description, version, cooldown, install, render, submit };
`;

// widget() renders inline on /web/tools (above Discover) — opens dedicated /web/dev page like Camera Demo → /web/camera
function widget(ctx, container) {
  container.innerHTML = "";
  container.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:12px";

  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px";
  const badge = document.createElement("div");
  badge.textContent = "🛠️";
  badge.style.cssText = "width:32px;height:32px;border-radius:9999px;background:#f4f4f5;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0";
  head.appendChild(badge);
  const titleBox = document.createElement("div");
  titleBox.style.cssText = "min-width:0;flex:1";
  const t = document.createElement("div");
  t.textContent = "Dev Tool";
  t.style.cssText = "font-size:13px;font-weight:600;line-height:1";
  titleBox.appendChild(t);
  const sub = document.createElement("div");
  sub.textContent = "Widget → dev page (install from pasted JS)";
  sub.style.cssText = "font-size:11px;color:#71717a;margin-top:2px";
  titleBox.appendChild(sub);
  head.appendChild(titleBox);
  container.appendChild(head);

  const hint = document.createElement("p");
  hint.textContent = "Tap to open live dev installer. Pasted JS is installed locally to IndexedDB + OPFS (no server).";
  hint.style.cssText = "font-size:11px;color:#71717a;line-height:1.4";
  container.appendChild(hint);

  const btn = document.createElement("button");
  btn.textContent = "Open Dev";
  btn.style.cssText = "margin-top:2px;width:100%;height:36px;border-radius:8px;background:#111;color:white;font-size:13px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px";
  const icon = document.createElement("span");
  icon.textContent = "⟡";
  icon.style.cssText = "font-size:14px";
  btn.prepend(icon);
  container.appendChild(btn);

  const note = document.createElement("p");
  note.textContent = "Opens /web/dev — standalone install page (like Camera → /web/camera).";
  note.style.cssText = "font-size:10px;color:#a1a1aa;text-align:center";
  container.appendChild(note);

  btn.onclick = () => {
    try {
      if (typeof window !== "undefined" && window.history && typeof window.history.pushState === "function") {
        const target = "/web/dev";
        window.history.pushState({}, "", target);
        try { window.dispatchEvent(new Event("locationchange")); } catch {}
        try { window.dispatchEvent(new PopStateEvent("popstate")); } catch {}
        setTimeout(() => {
          if (window.location.pathname !== target) {
            window.location.href = target;
          }
        }, 150);
        return;
      }
    } catch {}
    window.location.href = "/web/dev";
  };

  return () => {};
}

async function render(ctx, container, submit) {
  const store = ctx.data || (typeof data !== "undefined" ? data : {}) || {};
  if (typeof store.installCount !== "number") store.installCount = 0;
  ctx.data = store;
  if (typeof data !== "undefined") data.installCount = store.installCount;

  container.innerHTML = "";
  container.style.cssText = "height:100%;display:flex;flex-direction:column;padding:16px;overflow-y:auto;background:var(--card);font-family:system-ui;gap:12px";

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";
  const title = document.createElement("h2");
  title.textContent = "Dev — Install from JS";
  title.style.cssText = "font-size:16px;font-weight:700";
  header.appendChild(title);
  const badge = document.createElement("span");
  badge.textContent = "local";
  badge.style.cssText = "font-size:10px;padding:2px 6px;border-radius:9999px;background:#f4f4f5;color:#71717a";
  header.appendChild(badge);
  container.appendChild(header);

  const hint = document.createElement("p");
  hint.style.cssText = "font-size:11px;color:#71717a;line-height:1.5";
  hint.innerHTML = 'Paste JS source below. Props <code style="background:#f4f4f5;padding:1px 4px;border-radius:4px">name</code>, <code style="background:#f4f4f5;padding:1px 4px;border-radius:4px">description</code>, <code style="background:#f4f4f5;padding:1px 4px;border-radius:4px">version</code> and <code style="background:#f4f4f5;padding:1px 4px;border-radius:4px">cooldown()</code> are read from the file. Stored offline (IndexedDB + OPFS).';
  container.appendChild(hint);

  const metaRow = document.createElement("div");
  metaRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";
  const countEl = document.createElement("span");
  countEl.style.cssText = "font-size:11px;color:#71717a";
  countEl.textContent = "Installed via Dev: " + store.installCount;
  metaRow.appendChild(countEl);
  container.appendChild(metaRow);

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:8px;align-items:center";
  const label = document.createElement("span");
  label.textContent = "JS source";
  label.style.cssText = "font-size:12px;font-weight:600";
  toolbar.appendChild(label);
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy example";
  copyBtn.style.cssText = "margin-left:auto;padding:6px 10px;border-radius:8px;border:1px solid #e4e4e7;background:white;font-size:11px;cursor:pointer";
  toolbar.appendChild(copyBtn);
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.style.cssText = "padding:6px 10px;border-radius:8px;border:1px solid #e4e4e7;background:white;font-size:11px;cursor:pointer";
  toolbar.appendChild(clearBtn);
  container.appendChild(toolbar);

  const ta = document.createElement("textarea");
  ta.value = DEFAULT_EXAMPLE;
  ta.rows = 10;
  ta.placeholder = 'const name = "My Tool"\nconst description = "Does X"\nconst version = "1.0.0"\nfunction cooldown(){ return 60 }\nasync function render(ctx, container, submit){ container.innerHTML="<h1>Hello</h1>" }';
  ta.style.cssText = "width:100%;min-height:180px;max-height:42dvh;border:1px solid #e4e4e7;border-radius:8px;padding:10px;font-size:11px;font-family:ui-monospace,monospace;line-height:1.5;background:white;resize:vertical";
  container.appendChild(ta);

  const status = document.createElement("div");
  status.style.cssText = "min-height:18px;font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-word";
  container.appendChild(status);
  function setStatus(msg, isError) {
    status.textContent = msg || "";
    status.style.color = isError ? "#e11d48" : "#059669";
  }

  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText(DEFAULT_EXAMPLE); setStatus("Example copied to clipboard", false); setTimeout(()=> setStatus("", false), 1800); }
    catch { ta.value = DEFAULT_EXAMPLE; setStatus("Example loaded into editor", false); }
  };
  clearBtn.onclick = () => { ta.value = ""; ta.focus(); setStatus("", false); };

  const installBtn = document.createElement("button");
  installBtn.textContent = "Install pasted tool";
  installBtn.style.cssText = "width:100%;padding:12px;border-radius:9999px;background:#111;color:white;font-size:13px;font-weight:600;border:none;cursor:pointer";
  container.appendChild(installBtn);

  const foot = document.createElement("p");
  foot.style.cssText = "font-size:10px;color:#71717a;line-height:1.4;text-align:center";
  foot.textContent = "Tip: installed tools appear in Tools → Installed and as swipe cards on Home when cooldown passes.";
  container.appendChild(foot);

  const widgetHint = document.createElement("div");
  widgetHint.style.cssText = "display:flex;gap:8px;justify-content:center;flex-wrap:wrap";
  const toTools = document.createElement("a");
  toTools.href = "/web/tools";
  toTools.textContent = "Manage in Tools";
  toTools.style.cssText = "font-size:11px;color:#71717a;text-decoration:underline;underline-offset:2px";
  widgetHint.appendChild(toTools);
  const toHome = document.createElement("a");
  toHome.href = "/web";
  toHome.textContent = "Go to Home deck";
  toHome.style.cssText = "font-size:11px;color:#71717a;text-decoration:underline;underline-offset:2px";
  widgetHint.appendChild(toHome);
  container.appendChild(widgetHint);

  installBtn.onclick = async () => {
    const code = ta.value.trim();
    if (!code) { setStatus("Paste JS source first.", true); return; }
    if (code.length < 10 || code.length > 200000) { setStatus("Code length must be 10..200000", true); return; }
    installBtn.disabled = true;
    const prevText = installBtn.textContent;
    installBtn.textContent = "Installing…";
    installBtn.style.opacity = "0.7";
    setStatus("", false);
    try {
      const ex = validateToolCode(code);
      if (!ex.render && !ex.get && !ex.widget) throw new Error("Tool must define a `render` or `widget` function (ctx, container, submit/widget)");
      const qm = quickMeta(code);
      // try to get accurate meta via sandbox if possible
      let metaName = qm.name;
      let metaDesc = qm.description || "";
      let metaVer = qm.version;
      let cdSec = qm.cooldownSeconds;
      // if cooldown is function that returns number, try evaluating safely
      if (cdSec == null && ex.cooldown) {
        if (typeof ex.cooldown === "number" && Number.isFinite(ex.cooldown)) cdSec = Math.floor(ex.cooldown);
        else if (typeof ex.cooldown === "function") {
          try {
            const v = ex.cooldown({ userId: "local", toolId: "tmp", toolName: metaName || "tmp", data: {} });
            const maybe = v instanceof Promise ? await v : v;
            if (typeof maybe === "number" && Number.isFinite(maybe)) cdSec = Math.floor(maybe);
          } catch {}
        }
      }
      cdSec = cdSec != null ? Math.max(0, Math.min(cdSec, 2592000)) : 0;
      const nameVal = (metaName && String(metaName).trim() ? String(metaName).trim() : "tool-" + Date.now()).slice(0, 80);
      const descVal = (metaDesc ? String(metaDesc).trim() : "").slice(0, 300);
      const verVal = metaVer ? String(metaVer).trim().slice(0, 32) : null;

      const db = await openDb();
      const all = await dbGetAllTools(db);
      if (all.find(t => t.name === nameVal)) throw new Error('Tool name "' + nameVal + '" already exists');

      // try to run install() of the new tool to init its data
      let dataInit = {};
      if (ex.install) {
        try {
          // create isolated data passing through Function evaluation
          const ctxInit = { userId: "local", toolId: "tmp", toolName: nameVal, data: {} };
          // we can't easily run install in this outer scope without duplicating sandbox queue logic;
          // at least attempt simple call if it doesn't need queue
          const maybe = ex.install(ctxInit);
          if (maybe instanceof Promise) await maybe;
          if (ctxInit.data && typeof ctxInit.data === "object") dataInit = ctxInit.data;
          // also handle global `data` mutation: not accessible here, skip
        } catch (e) {
          throw new Error("install() failed: " + (e && e.message ? e.message : String(e)));
        }
      }

      const id = genId();
      const now = Date.now();
      const rec = {
        id,
        name: nameVal,
        description: descVal,
        version: verVal,
        code,
        installed: true,
        cooldownSeconds: cdSec,
        lastRunAt: null,
        data: dataInit,
        createdAt: now,
        updatedAt: now,
      };
      await dbPutTool(db, rec);
      await opfsWriteTool(id, code);
      try { db.close(); } catch {}

      store.installCount = (store.installCount || 0) + 1;
      ctx.data = store;
      if (typeof data !== "undefined") data.installCount = store.installCount;
      try { await submit({ installedToolId: id, name: nameVal }); } catch {}
      countEl.textContent = "Installed via Dev: " + store.installCount;
      setStatus('Installed "' + nameVal + '"' + (verVal ? ' v' + verVal : '') + ' — find it in Tools → Installed. Paste another or check Home.', false);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setStatus(msg, true);
    } finally {
      installBtn.disabled = false;
      installBtn.textContent = prevText;
      installBtn.style.opacity = "1";
    }
  };
}

function submit(ctx, payload) {
  const store = ctx.data || (typeof data !== "undefined" ? data : {}) || {};
  if (typeof payload.installedToolId === "string") {
    store.lastInstalledId = payload.installedToolId;
    store.lastInstalledName = payload.name || "";
  }
  if (typeof store.installCount !== "number") store.installCount = 0;
  ctx.data = store;
  if (typeof data !== "undefined") { data.installCount = store.installCount; data.lastInstalledId = store.lastInstalledId; }
  return { ok: true, payload };
}

module.exports = { name, description, version, cooldown, install, uninstall, widget, render, submit };

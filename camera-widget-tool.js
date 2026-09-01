// Camera Widget — demo tool with a Tools-page widget
// Copy-paste this file content into the Tools page textarea and click Install.
// This tool is special: it defines BOTH render() (home card) and widget() (tools page widget).
// The widget renders a button that opens /web/camera — a standalone camera page
// where you can take a photo. Photo is NOT saved or uploaded (demo only).

const name = "Camera Demo";
const description = "Widget demo — open camera page to take a photo (not saved)";
const version = "0.9.0";

function cooldown() {
  return 30;
}

function install(ctx) {
  console.log("[camera-widget] installed for", ctx.userId);
}

function uninstall(ctx) {
  console.log("[camera-widget] uninstalled for", ctx.userId);
}

// Tools page widget — rendered inline at the top of /web/tools.
// Signature: widget(ctx, container) where ctx = { userId, toolId, toolName, data }
function widget(ctx, container) {
  container.innerHTML = "";
  // keep widget compact: card-like but inline
  container.style.cssText = "display:flex;flex-direction:column;gap:8px;padding:12px";

  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px";
  const badge = document.createElement("div");
  badge.textContent = "📷";
  badge.style.cssText = "width:32px;height:32px;border-radius:9999px;background:#f4f4f5;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0";
  head.appendChild(badge);
  const titleBox = document.createElement("div");
  titleBox.style.cssText = "min-width:0;flex:1";
  const t = document.createElement("div");
  t.textContent = "Camera Demo";
  t.style.cssText = "font-size:13px;font-weight:600;line-height:1";
  titleBox.appendChild(t);
  const sub = document.createElement("div");
  sub.textContent = "Widget → camera page (demo, no storage)";
  sub.style.cssText = "font-size:11px;color:#71717a;margin-top:2px";
  titleBox.appendChild(sub);
  head.appendChild(titleBox);
  container.appendChild(head);

  const hint = document.createElement("p");
  hint.textContent = "Tap to open live camera. Captured frame stays in memory and is discarded on close.";
  hint.style.cssText = "font-size:11px;color:#71717a;line-height:1.4";
  container.appendChild(hint);

  const btn = document.createElement("button");
  btn.textContent = "Open camera";
  btn.style.cssText = "margin-top:2px;width:100%;height:36px;border-radius:8px;background:#111;color:white;font-size:13px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px";
  // add simple camera icon via text
  const icon = document.createElement("span");
  icon.textContent = "◎";
  icon.style.cssText = "font-size:14px";
  btn.prepend(icon);
  container.appendChild(btn);

  const note = document.createElement("p");
  note.textContent = "No photo is saved or uploaded — demo only.";
  note.style.cssText = "font-size:10px;color:#a1a1aa;text-align:center";
  container.appendChild(note);

  // Keep widget private state
  let overlay = null;
  let stream = null;

  btn.onclick = () => {
    // Prefer navigation to dedicated camera page (/web/camera).
    // If router exists, use history.pushState for SPA navigation; fallback to location.href.
    try {
      // Try SPA push — NukeJS router watches history, so this triggers client navigation without reload
      if (typeof window !== "undefined" && window.history && typeof window.history.pushState === "function") {
        const target = "/web/camera";
        // dispatch locationchange so NukeJS picks it up if needed, but pushState alone is watched via TabBar's useRequest? NukeJS uses locationchange event.
        window.history.pushState({}, "", target);
        try { window.dispatchEvent(new Event("locationchange")); } catch {}
        // also try popstate for compatibility
        try { window.dispatchEvent(new PopStateEvent("popstate")); } catch {}
        // if navigation didn't happen (still on /web/tools), fallback to href after short delay check
        setTimeout(() => {
          if (window.location.pathname !== target) {
            window.location.href = target;
          }
        }, 150);
        return;
      }
    } catch {}
    window.location.href = "/web/camera";
  };

  // Optional cleanup: nothing to clean since we just navigate. Return cleanup for WidgetFrame lifecycle.
  return () => {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { if (overlay && overlay.parentNode) overlay.remove(); } catch {}
  };
}

// Home card (optional) — also shows camera widget inline on swipe deck, but main demo is via Tools widget + /web/camera.
async function render(ctx, container, submit) {
  container.innerHTML = "";
  container.style.cssText = "height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:white;text-align:center;font-family:system-ui";

  const badge = document.createElement("div");
  badge.textContent = "📷";
  badge.style.cssText = "width:56px;height:56px;border-radius:9999px;border:3px solid #111;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px";
  container.appendChild(badge);

  const h = document.createElement("h2");
  h.textContent = "Camera Demo";
  h.style.cssText = "font-size:18px;font-weight:600";
  container.appendChild(h);

  const p = document.createElement("p");
  p.textContent = "This tool has a special widget on the Tools page. Open Tools → Camera Demo widget → Open camera. Card here is just a placeholder — try the widget!";
  p.style.cssText = "margin-top:8px;font-size:13px;color:#71717a;max-width:280px";
  container.appendChild(p);

  const btn = document.createElement("button");
  btn.textContent = "Go to Tools widgets";
  btn.style.cssText = "margin-top:16px;padding:10px 20px;border-radius:9999px;background:#111;color:white;font-size:14px;font-weight:600;border:none;cursor:pointer";
  btn.onclick = () => {
    window.location.href = "/web/tools";
  };
  container.appendChild(btn);

  const meta = document.createElement("p");
  meta.textContent = "Tip: Widgets render at the top of /web/tools — above Discover.";
  meta.style.cssText = "margin-top:8px;font-size:11px;color:#a1a1aa";
  container.appendChild(meta);
}

function submit(ctx, payload) {
  return { ok: true };
}

module.exports = { name, description, version, cooldown, install, uninstall, render, widget, submit };

// Time-tool — full-render version: tool owns the card DOM
// Copy-paste this file content into the Tools page textarea and click Install.

const name = "Current Time";
const description = "Shows the current time — updates each time cooldown expires (render owns DOM)";
function cooldown() {
  return 10; // seconds before Home can call render() again
}

function install(ctx) {
  console.log(`[time-tool] installed for user ${ctx.userId} (tool ${ctx.toolId})`);
}

function uninstall(ctx) {
  console.log(`[time-tool] uninstalled for user ${ctx.userId}`);
}

async function render(ctx, container, submit) {
  const now = new Date();
  const timeString = now.toLocaleString();
  const isoString = now.toISOString();

  container.innerHTML = '';
  container.style.cssText = 'height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:white;text-align:center';

  const badge = document.createElement('div');
  badge.textContent = 'T';
  badge.style.cssText = 'width:56px;height:56px;border-radius:9999px;border:3px solid #06b6d4;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#06b6d4;margin-bottom:16px';
  container.appendChild(badge);

  const h = document.createElement('h2');
  h.textContent = 'Current Time';
  h.style.cssText = 'font-size:18px;font-weight:600';
  container.appendChild(h);

  const p = document.createElement('p');
  p.textContent = "It's " + timeString;
  p.style.cssText = 'margin-top:8px;font-size:14px;color:#333';
  container.appendChild(p);

  const iso = document.createElement('p');
  iso.textContent = isoString;
  iso.style.cssText = 'margin-top:4px;font-size:11px;color:#71717a;font-family:monospace';
  container.appendChild(iso);

  const sub = document.createElement('p');
  sub.textContent = 'This card re-appears after cooldown (10s from seen). Tool rendered it directly.';
  sub.style.cssText = 'margin-top:12px;font-size:11px;color:#71717a';
  container.appendChild(sub);

  // live ticking example — cleanup returned
  const tick = document.createElement('p');
  tick.style.cssText = 'margin-top:8px;font-size:12px;color:#06b6d4;font-family:monospace';
  container.appendChild(tick);
  let id = setInterval(() => {
    tick.textContent = new Date().toLocaleTimeString();
  }, 1000);
  // return cleanup so ToolFrame cancels it on unmount / next card
  return () => clearInterval(id);
}

module.exports = { name, description, cooldown, install, uninstall, render };

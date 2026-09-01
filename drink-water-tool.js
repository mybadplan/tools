// Drink Water — generates a random "Drink Water" task due in 5 minutes
// Copy-paste this file content into the Tools page textarea and click Install.
// Then a "Drink Water" card will appear on Home; clicking the button creates a todo in the Todo tab.
// Todo dueAt = now + 5 minutes. If not started before dueAt, it auto-removes; if started, it stays until Done.

const name = "Drink Water";
const description = "Generate a random Drink Water reminder — due in 5 minutes (Todo)";

function cooldown() {
  return 30; // seconds before Home can show the card again (from seen time)
}

function install(ctx) {
  console.log("[drink-water] installed for", ctx.userId);
}

function uninstall(ctx) {
  console.log("[drink-water] uninstalled for", ctx.userId);
}

// Client: owns full card DOM. Button creates a todo via global createTodo/addTodo or via submit fallback.
async function render(ctx, container, submit) {
  container.innerHTML = "";
  container.style.cssText = "height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:white;text-align:center;font-family:system-ui";

  const badge = document.createElement("div");
  badge.textContent = "💧";
  badge.style.cssText = "width:56px;height:56px;border-radius:9999px;border:3px solid #0ea5e9;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:16px";
  container.appendChild(badge);

  const h = document.createElement("h2");
  h.textContent = "Drink Water";
  h.style.cssText = "font-size:18px;font-weight:600";
  container.appendChild(h);

  const p = document.createElement("p");
  p.textContent = "Tap to create a random hydration task due in 5 minutes. Check the Todo tab.";
  p.style.cssText = "margin-top:8px;font-size:13px;color:#71717a;max-width:280px";
  container.appendChild(p);

  const meta = document.createElement("p");
  meta.style.cssText = "margin-top:4px;font-size:11px;color:#71717a";
  function refreshMeta() {
    const due = new Date(Date.now() + 5 * 60 * 1000);
    meta.textContent = "Due at: " + due.toLocaleTimeString() + " (in 5m)";
  }
  refreshMeta();
  container.appendChild(meta);

  const btn = document.createElement("button");
  btn.textContent = "Generate task";
  btn.style.cssText = "margin-top:16px;padding:10px 20px;border-radius:9999px;background:#0ea5e9;color:white;font-size:14px;font-weight:600;border:none;cursor:pointer";
  container.appendChild(btn);

  const status = document.createElement("div");
  status.style.cssText = "margin-top:12px;font-size:12px;color:#0ea5e9;min-height:16px";
  container.appendChild(status);

  let busy = false;
  btn.onclick = async () => {
    if (busy) return;
    busy = true;
    btn.style.opacity = "0.6";
    btn.textContent = "Creating…";
    status.textContent = "";
    try {
      // randomize description to make each task feel random
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const title = "Drink Water";
      const description = "Random hydration reminder #" + rand;
      const dueAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

      // Preferred: client global helper (ToolFrame injects createTodo/addTodo -> orpc.todos.create)
      if (typeof createTodo === "function") {
        await createTodo({ title, description, dueAt });
      } else if (typeof addTodo === "function") {
        await addTodo({ title, description, dueAt });
      } else {
        // Fallback: go through server submit -> ctx.createTodo in engine
        await submit({ create: true, title, description, dueAt });
      }

      status.textContent = "✓ Task created — due in 5 minutes (see Todo)";
      status.style.color = "#059669";
      btn.textContent = "Generate another";
    } catch (e) {
      status.textContent = "Failed: " + (e && e.message ? e.message : String(e));
      status.style.color = "#e11d48";
      btn.textContent = "Try again";
    } finally {
      busy = false;
      btn.style.opacity = "1";
      refreshMeta();
      setTimeout(() => { status.textContent = ""; status.style.color = "#0ea5e9"; }, 2500);
    }
  };
}

// Server: handles submit payload and creates todo via ctx.createTodo (engine queue -> Todo model)
function submit(ctx, payload) {
  if (!payload || !payload.create) return { ok: false };
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim().slice(0, 200) : "Drink Water";
  const description = typeof payload.description === "string" ? payload.description.slice(0, 500) : "";
  let dueAt = Date.now() + 5 * 60 * 1000;
  if (typeof payload.dueAt === "number" && Number.isFinite(payload.dueAt)) dueAt = Math.floor(payload.dueAt);
  // engine exposes ctx.createTodo / ctx.addTodo which queues a Todo for this user/tool
  if (typeof ctx.createTodo === "function") ctx.createTodo({ title, description, dueAt });
  else if (typeof ctx.addTodo === "function") ctx.addTodo({ title, description, dueAt });
  else if (typeof createTodo === "function") createTodo({ title, description, dueAt });
  return { ok: true, title, dueAt };
}

module.exports = { name, description, cooldown, install, uninstall, render, submit };

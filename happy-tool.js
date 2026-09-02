// Happy-tool — full-render version (tool owns entire card DOM)
// Copy-paste this file content into the Tools page textarea and click Install.
//
// Properties: name, description, cooldown() -> seconds
// Lifecycle: install(ctx), uninstall(ctx), render(ctx, container, submit, next), submit(ctx, payload)
//   render(ctx, container, submit, next) owns the whole card: use DOM/canvas/threejs, dynamic import, etc.
//   `next` (and ctx.next / ctx.goNext) advances Home to the next card — call after saving reaction.
//   data = {} persisted per tool per user (ctx.data and global data are same cloned object)

const name = "Happy Check";
const description = "Ask how much you are happy — 1 to 5 rating with weekly heatmap (render owns DOM)";
const version = "1.3.0";
function cooldown() {
  return 60; // seconds before Home can show this card again (from seen time)
}

function install(ctx) {
  if (!ctx.data) ctx.data = {};
  if (!ctx.data.answers) ctx.data.answers = [];
  if (typeof data !== 'undefined' && !data.answers) data.answers = [];
  console.log(`[happy-tool] installed for user ${ctx.userId}`);
}

function uninstall(ctx) {
  console.log(`[happy-tool] uninstalled for user ${ctx.userId}`);
}

async function render(ctx, container, submit, next) {
  const goNext = next || ctx.next || ctx.goNext || ctx.nextCard || null;
  const store = ctx.data || (typeof data !== 'undefined' ? data : {}) || {};
  if (!store.answers) store.answers = [];
  if (typeof data !== 'undefined') data.answers = store.answers;
  ctx.data = store;

  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayAnswers = store.answers.filter((a) => a.ts >= dayStart && a.ts < dayEnd);
    const count = dayAnswers.length;
    const avg = count ? dayAnswers.reduce((s, a) => s + a.answer, 0) / count : null;
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      count,
      avg: avg !== null ? Math.round(avg * 10) / 10 : null,
    });
  }

  // --- full DOM rendering ---
  container.innerHTML = '';
  container.style.cssText = 'height:100%;display:flex;flex-direction:column;padding:16px;overflow-y:auto;background:white;position:relative;font-family:system-ui';

  const badge = document.createElement('div');
  badge.textContent = 'H';
  badge.style.cssText = 'position:absolute;top:16px;right:16px;width:48px;height:48px;border-radius:9999px;border:3px solid #8b5cf6;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#8b5cf6';
  container.appendChild(badge);

  const main = document.createElement('div');
  main.style.cssText = 'flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:64px';
  const h = document.createElement('h2');
  h.textContent = 'How much are you happy?';
  h.style.cssText = 'font-size:18px;font-weight:600';
  main.appendChild(h);
  const desc = document.createElement('p');
  desc.textContent = 'Rate 1 (not at all) to 5 (very happy). Answers saved in data.';
  desc.style.cssText = 'margin-top:4px;font-size:13px;color:#71717a';
  main.appendChild(desc);
  const total = document.createElement('p');
  total.textContent = 'Total answers: ' + store.answers.length;
  total.style.cssText = 'margin-top:4px;font-size:11px;color:#71717a';
  main.appendChild(total);
  container.appendChild(main);

  const footer = document.createElement('div');
  footer.style.cssText = 'padding-top:12px';
  const label = document.createElement('p');
  label.textContent = 'How would you rate this?';
  label.style.cssText = 'font-size:11px;color:#71717a;margin-bottom:8px';
  footer.appendChild(label);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:4px';
  for (let v = 1; v <= 5; v++) {
    const btn = document.createElement('button');
    btn.textContent = String(v);
    btn.style.cssText = 'width:28px;height:28px;border-radius:9999px;border:1px solid #e4e4e7;color:#7c3aed;font-size:11px;font-weight:600;background:white;cursor:pointer';
    btn.onclick = async () => {
      btn.style.background = '#8b5cf6';
      btn.style.color = 'white';
      btn.style.borderColor = '#8b5cf6';
      try { await submit({ answer: v }); } catch(e) {}
      store.answers.push({ answer: v, ts: Date.now() });
      if (typeof data !== 'undefined') data.answers = store.answers;
      const toast = document.createElement('div');
      toast.textContent = 'Logged ' + v + '/5';
      toast.style.cssText = 'margin-top:8px;text-align:center;font-size:11px;color:#7c3aed';
      footer.appendChild(toast);
      setTimeout(()=> toast.remove(), 1500);
      total.textContent = 'Total answers: ' + store.answers.length;
      // reactions saved — advance to next activity/card
      // prefers the injected `next` arg, falls back to ctx.next or window event
      try {
        if (typeof goNext === 'function') goNext();
        else if (typeof next === 'function') next();
        else if (ctx && typeof ctx.next === 'function') ctx.next();
        else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tool:next', { detail: { toolId: ctx.toolId } }));
          container.dispatchEvent(new CustomEvent('next'));
        }
      } catch {}
    };
    row.appendChild(btn);
  }
  footer.appendChild(row);

  const heatTitle = document.createElement('p');
  heatTitle.textContent = 'Last 7 days';
  heatTitle.style.cssText = 'margin-top:12px;font-size:11px;color:#71717a';
  footer.appendChild(heatTitle);
  const heatRow = document.createElement('div');
  heatRow.style.cssText = 'display:flex;gap:4px;margin-top:4px';
  function colorFor(avg, count) {
    if (count===0 || avg===null) return '#f4f4f5';
    if (avg>=4.5) return '#059669';
    if (avg>=3.5) return '#10b981';
    if (avg>=2.5) return '#fbbf24';
    if (avg>=1.5) return '#fb923c';
    return '#f87171';
  }
  for (const d of days) {
    const col = document.createElement('div');
    col.style.cssText = 'flex:1;text-align:center';
    const box = document.createElement('div');
    box.title = d.date + ': ' + d.count + ' answers' + (d.avg!==null ? ', avg '+d.avg : '');
    box.textContent = d.count>0 ? String(d.avg) : '·';
    box.style.cssText = 'height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:'+(d.count===0?'#71717a':'white')+';background:'+colorFor(d.avg,d.count);
    col.appendChild(box);
    const lab = document.createElement('div');
    lab.textContent = d.label.slice(0,2);
    lab.style.cssText = 'margin-top:4px;font-size:10px;color:#71717a';
    col.appendChild(lab);
    const cnt = document.createElement('div');
    cnt.textContent = String(d.count);
    cnt.style.cssText = 'font-size:9px;color:#71717a';
    col.appendChild(cnt);
    heatRow.appendChild(col);
  }
  footer.appendChild(heatRow);
  container.appendChild(footer);
}

function submit(ctx, payload) {
  const store = ctx.data || (typeof data !== 'undefined' ? data : {}) || {};
  if (!store.answers) store.answers = [];
  store.answers.push({ answer: payload.answer, ts: Date.now() });
  ctx.data = store;
  if (typeof data !== 'undefined') data.answers = store.answers;
  console.log(`[happy-tool] saved answer`, payload, `total`, store.answers.length);
  return { ok: true, received: payload, totalAnswers: store.answers.length };
}

module.exports = { name, description, version, cooldown, install, uninstall, render, submit };

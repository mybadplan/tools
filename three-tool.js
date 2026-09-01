// Three-tool — three.js game card example (tool fully owns rendering)
// Copy-paste this file content into the Tools page textarea and click Install.
// Demonstrates: render(ctx, container, submit) can dynamic-import threejs and run WebGL.
// Requires network to fetch https://esm.sh/three@0.160.0 (or use https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js)

const name = "Three Cube";
const description = "Spinning three.js cube — tool renders a WebGL game in the card";
const version = "1.0.0";
function cooldown() { return 30; }

function install(ctx) { console.log("[three-tool] install", ctx.toolId); }
function uninstall(ctx) { console.log("[three-tool] uninstall", ctx.toolId); }

async function render(ctx, container, submit) {
  container.innerHTML = '';
  container.style.cssText = 'height:100%;display:flex;flex-direction:column;background:#0a0a0a;color:white;overflow:hidden';

  const header = document.createElement('div');
  header.style.cssText = 'padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #222';
  header.innerHTML = '<span style="font-weight:600">Three Cube</span><span style="font-size:11px;color:#888">drag to rotate · click to score</span>';
  container.appendChild(header);

  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = 'padding:8px 16px;font-size:12px;color:#a78bfa';
  let score = (ctx.data && ctx.data.score) || 0;
  if (typeof data !== 'undefined') score = data.score || score;
  function updateScore() { scoreEl.textContent = 'Score: ' + score; }
  updateScore();
  container.appendChild(scoreEl);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;position:relative;min-height:0';
  container.appendChild(wrap);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  wrap.appendChild(canvas);

  // dynamic import threejs (esm.sh is CORS-friendly)
  let THREE;
  try {
    THREE = await import('https://esm.sh/three@0.160.0');
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = 'Failed to load three.js: ' + (e.message || e);
    err.style.cssText = 'padding:16px;color:#f87171;font-size:12px';
    wrap.appendChild(err);
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  function resize() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    renderer.setSize(w, h, false);
  }
  resize();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / Math.max(1, wrap.clientHeight), 0.1, 100);
  camera.position.set(2.5, 1.8, 4);
  camera.lookAt(0,0,0);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(3,5,2);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.4, metalness: 0.1 });
  const cube = new THREE.Mesh(geo, mat);
  scene.add(cube);

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(6,6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  plane.rotation.x = -Math.PI/2;
  plane.position.y = -1.2;
  scene.add(plane);

  let dragging = false;
  let lastX = 0;
  let autoSpin = 0.008;
  let manualY = 0;

  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    manualY += dx * 0.01;
    lastX = e.clientX;
  });
  canvas.addEventListener('pointerup', (e) => { dragging = false; try{ canvas.releasePointerCapture(e.pointerId);}catch{} });
  canvas.addEventListener('click', async () => {
    score += 1;
    updateScore();
    // persist via submit
    try { await submit({ score }); } catch {}
    // also update local data
    if (!ctx.data) ctx.data = {};
    ctx.data.score = score;
    if (typeof data !== 'undefined') data.score = score;
    cube.scale.set(1.2,1.2,1.2);
    setTimeout(()=> cube.scale.set(1,1,1), 150);
  });

  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  const onWinResize = () => resize();
  window.addEventListener('resize', onWinResize);

  let raf = 0;
  let alive = true;
  function animate() {
    if (!alive) return;
    raf = requestAnimationFrame(animate);
    if (!dragging) cube.rotation.y += autoSpin;
    cube.rotation.y += (manualY - cube.rotation.y) * 0.05; // smooth drag
    cube.rotation.x += 0.005;
    renderer.render(scene, camera);
  }
  animate();

  // cleanup: called by ToolFrame on unmount
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('resize', onWinResize);
    try { geo.dispose(); mat.dispose(); renderer.dispose(); } catch {}
  };
}

function submit(ctx, payload) {
  if (!ctx.data) ctx.data = {};
  if (typeof payload.score === 'number') ctx.data.score = payload.score;
  if (typeof data !== 'undefined') {
    if (!data.score) data.score = 0;
    if (typeof payload.score === 'number') data.score = payload.score;
  }
  return { ok: true, score: ctx.data.score };
}

module.exports = { name, description, version, cooldown, install, uninstall, render, submit };

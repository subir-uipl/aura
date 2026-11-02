import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- renderer / scene ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.1, 8);

const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(4, 5, 6); scene.add(key);
const rim = new THREE.DirectionalLight(0x8fb8ff, 2.4); rim.position.set(-5, 2, -4); scene.add(rim);
const warm = new THREE.PointLight(0xd8b27a, 10, 12); warm.position.set(2, -2, 3); scene.add(warm);

/* ---------- materials ---------- */
const M = {
  shell: new THREE.MeshPhysicalMaterial({ color: 0x1d1f24, metalness: 0.1, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5 }),   // soft-touch housing
  metal: new THREE.MeshPhysicalMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.32 }),                                             // satin aluminium
  accent: new THREE.MeshPhysicalMaterial({ color: 0xd8b27a, metalness: 1, roughness: 0.22 }),
  leather: new THREE.MeshPhysicalMaterial({ color: 0x17181c, roughness: 0.7, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x4a505c) }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 1 }),
  driver: new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.3, clearcoat: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 }),
  led: new THREE.MeshBasicMaterial({ color: 0x7ef0a6 }),
  wave: new THREE.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
};

/* ---------- geometry helpers ---------- */
// rounded-rectangle cross-section, counter-clockwise in (u, v)
function rrect(w, h, r, seg = 6) {
  const pts = [], c = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
  for (const [cx, cy, q] of c) for (let i = 0; i <= seg; i++) {
    const a = (q + i / seg) * Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}
// sweep a closed profile along a curve; u follows the in-plane normal, v follows `binormal`
function sweep(curve, profile, segs, binormal, taper = () => 1) {
  const pos = [], idx = [], n = profile.length, p = new THREE.Vector3(), t = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = i / segs, k = taper(s);
    curve.getPointAt(s, p); curve.getTangentAt(s, t);
    nn.crossVectors(binormal, t).normalize();
    for (const [u, v] of profile) pos.push(p.x + (nn.x * u + binormal.x * v) * k, p.y + (nn.y * u + binormal.y * v) * k, p.z + (nn.z * u + binormal.z * v) * k);
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + j, d = (i + 1) * n + (j + 1) % n;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// headband arc: slightly squared-off ellipse so the sides fall vertically into the hinges
function bandCurve(rx, ry, y0, t0 = 0, t1 = Math.PI, z = 0) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = t0 + (t1 - t0) * i / 60;
    pts.push(new THREE.Vector3(Math.cos(t) * rx, y0 + Math.pow(Math.sin(t), 0.8) * ry, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}
const along = g => g.rotateZ(-Math.PI / 2);   // lathe/cylinder Y axis -> +X
const lathe = (pts, seg = 96) => along(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg));
const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
const pillow = s => Math.pow(Math.min(1, s * 9, (1 - s) * 9), 0.45);   // rounds off padded ends

/* ---------- model ---------- */
const headphones = new THREE.Group();
scene.add(headphones);
const CUP_X = 1.0, CUP_Y = -0.62, YOKE_R = 0.74, BAND_Y = 0.4;

// headband: painted aluminium spine with a padded leather cushion underneath
const band = new THREE.Mesh(sweep(bandCurve(CUP_X, 1.12, BAND_Y), rrect(0.05, 0.32, 0.022), 180, Z), M.shell);
const padCurve = bandCurve(CUP_X - 0.085, 1.03, BAND_Y + 0.02, 0.2, Math.PI - 0.2);
const pad = new THREE.Mesh(sweep(padCurve, rrect(0.1, 0.27, 0.045, 8), 160, Z, pillow), M.leather);
headphones.add(band, pad);

const cups = [];
function makeSide(side) {
  const sideGroup = new THREE.Group();
  sideGroup.position.x = side * CUP_X;
  headphones.add(sideGroup);

  // hinge block, telescopic slider with size ticks, yoke fork
  const hinge = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.15, 0.34, 4, 0.035), M.shell);
  hinge.position.y = BAND_Y - 0.02;
  const slider = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.26, 0.07, 2, 0.012), M.metal);
  slider.position.y = BAND_Y - 0.2;
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.03), M.dark);
    tick.position.set(0, BAND_Y - 0.13 - i * 0.04, 0);
    sideGroup.add(tick);
  }
  const hub = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.12, 3, 0.02), M.metal);
  hub.position.y = CUP_Y + YOKE_R;
  const yokeCurve = new THREE.CatmullRomCurve3(Array.from({ length: 49 }, (_, i) => {
    const a = Math.PI * i / 48;
    return new THREE.Vector3(0, CUP_Y + Math.sin(a) * YOKE_R, Math.cos(a) * YOKE_R);
  }));
  const yoke = new THREE.Mesh(sweep(yokeCurve, rrect(0.034, 0.075, 0.014), 120, X), M.metal);
  sideGroup.add(hinge, slider, hub, yoke);
  for (const zz of [YOKE_R, -YOKE_R]) {
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 32), M.accent);
    pivot.rotation.x = Math.PI / 2; pivot.position.set(0, CUP_Y, zz * 0.985);
    sideGroup.add(pivot);
  }

  // ear cup — local +x points away from the head; mirrored for the left side
  const cup = new THREE.Group();
  cup.position.y = CUP_Y;
  cup.rotation.y = side * 0.05;
  cup.scale.set(side, 1.2, 1);
  sideGroup.add(cup);
  const parts = {};

  parts.shell = new THREE.Group();
  parts.shell.add(new THREE.Mesh(lathe([[0.5, -0.13], [0.56, -0.115], [0.588, -0.05], [0.592, 0.04], [0.574, 0.12], [0.525, 0.172], [0.45, 0.196], [0, 0.202]]), M.shell));
  // microphone ports around the rim
  const holeGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12);
  for (const a of [0.58, 0.66, 0.74, -0.2, -0.12]) {
    const ang = a * Math.PI, dir = new THREE.Vector3(0, Math.sin(ang), Math.cos(ang));
    const h = new THREE.Mesh(holeGeo, M.dark);
    h.position.copy(dir).multiplyScalar(0.585); h.position.x = 0.05;
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    parts.shell.add(h);
  }
  if (side > 0) {   // controls live on the right cup
    const place = (mesh, ang, x = 0.0) => {
      const dir = new THREE.Vector3(0, Math.sin(ang), Math.cos(ang));
      mesh.position.copy(dir).multiplyScalar(0.592); mesh.position.x = x;
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      parts.shell.add(mesh);
    };
    place(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.02, 0.09, 2, 0.008), M.dark), -Math.PI / 2, 0.02);          // USB-C
    place(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.025, 0.1, 2, 0.01), M.metal), -0.72 * Math.PI, 0.03);       // power
    place(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.025, 0.07, 2, 0.01), M.metal), -0.86 * Math.PI, 0.03);      // ANC
    place(new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), M.led), -0.34 * Math.PI, 0.06);                    // status LED
  }

  parts.cap = new THREE.Group();
  parts.cap.add(new THREE.Mesh(lathe([[0, 0.232], [0.2, 0.229], [0.36, 0.219], [0.42, 0.205], [0.43, 0.192]]), M.metal));
  const logo = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 12, 64, Math.PI), M.accent);
  logo.rotation.y = Math.PI / 2; logo.position.set(0.235, -0.03, 0);
  const logoL = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.06, 0.025, 2, 0.004), M.accent); logoL.position.set(0.235, -0.05, 0.085);
  const logoR = logoL.clone(); logoR.position.z = -0.085;
  parts.cap.add(logo, logoL, logoR);

  parts.ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.011, 16, 140), M.accent);
  parts.ring.rotation.y = Math.PI / 2; parts.ring.position.x = 0.195;

  parts.driver = new THREE.Group();
  const chassis = new THREE.Mesh(along(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 96)), M.driver); chassis.position.x = -0.07;
  const cone = new THREE.Mesh(lathe([[0.02, -0.08], [0.14, -0.095], [0.3, -0.125], [0.37, -0.135], [0.39, -0.125]]), M.metal);
  const surround = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.016, 12, 96), M.driver); surround.rotation.y = Math.PI / 2; surround.position.x = -0.125;
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 12, 80), M.accent); coil.rotation.y = Math.PI / 2; coil.position.x = -0.1;
  const magnet = new THREE.Mesh(along(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 48)), M.driver); magnet.position.x = -0.02;
  parts.driver.add(chassis, cone, surround, coil, magnet);

  parts.cushion = new THREE.Group();
  const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.15, 40, 140), M.leather);
  cushion.rotation.y = Math.PI / 2; cushion.scale.z = 0.72; cushion.position.x = -0.2;
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(0.33, 64), M.fabric);
  cloth.rotation.y = -Math.PI / 2; cloth.position.x = -0.15;
  parts.cushion.add(cushion, cloth);

  // exploded offsets along local x (the far cup opens less to keep the view readable)
  const k = side > 0 ? 1 : 0.45;
  const layout = { cushion: -1.15 * k, driver: -0.55 * k, shell: 0, cap: 0.6 * k, ring: 1.05 * k };
  for (const name in layout) cup.add(parts[name]);

  const waves = [];
  if (side < 0) {   // ANC rings radiate from the left cup, away from the copy
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.008, 8, 120), M.wave.clone());
      w.rotation.y = Math.PI / 2;
      cup.add(w); waves.push(w);
    }
  }
  cups.push({ side, parts, layout, waves });
}
makeSide(1);
makeSide(-1);

// soft contact shadow
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

/* ---------- exploded-view labels ---------- */
const LABELS = [
  ['cushion', 'Protein-leather cushion', 'Memory foam, pressure-balanced', 0.62],
  ['driver', '40 mm driver', 'Beryllium-coated dome', -0.62],
  ['shell', 'Acoustic chamber', 'Sealed, damped polymer', 1.05],
  ['cap', 'Aluminium cap', 'CNC machined, anodised', -0.62],
  ['ring', 'Touch ring', 'Swipe for volume', 0.62]
];
const labelsEl = document.getElementById('labels');
const labelNodes = LABELS.map(([part, title, sub, dy]) => {
  const el = document.createElement('div');
  el.className = 'label' + (dy < 0 ? ' down' : '');
  el.innerHTML = `<span>${title}<small>${sub}</small></span>`;
  labelsEl.appendChild(el);
  return { part, el, dy };
});

/* ---------- finishes ---------- */
const FINISHES = [
  { name: 'Midnight', shell: 0x1d1f24, leather: 0x17181c, metal: 0xc9ccd2, accent: 0xd8b27a, swatch: '#25272d' },
  { name: 'Sandstone', shell: 0xcdbca2, leather: 0x8f7e69, metal: 0xe6dfd2, accent: 0xc9a46b, swatch: '#cbb9a0' },
  { name: 'Sage', shell: 0x7f9180, leather: 0x4c5a4f, metal: 0xd4d8cf, accent: 0xd8c59a, swatch: '#8a9a86' },
  { name: 'Ocean', shell: 0x2e4a6b, leather: 0x1c2a3d, metal: 0xc3cad6, accent: 0xe2c08a, swatch: '#36577d' }
];
const colorTarget = {};
for (const k of ['shell', 'leather', 'metal', 'accent']) colorTarget[k] = new THREE.Color(FINISHES[0][k]);
const swWrap = document.getElementById('swatches');
FINISHES.forEach((f, i) => {
  const b = document.createElement('button');
  b.className = 'sw' + (i === 0 ? ' active' : '');
  b.style.setProperty('--c', f.swatch);
  b.setAttribute('aria-label', f.name);
  b.onclick = () => setFinish(i);
  swWrap.appendChild(b);
});
function setFinish(i) {
  for (const k in colorTarget) colorTarget[k].set(FINISHES[i][k]);
  [...swWrap.children].forEach((b, j) => b.classList.toggle('active', j === i));
  document.getElementById('swName').textContent = FINISHES[i].name;
}

/* ---------- scroll choreography ---------- */
// one keyframe per section: model offset, rotation, scale, exploded amount, ANC waves
const KEYS = [
  { x: 1.25, y: 0.05, rx: 0.12, ry: -0.55, rz: 0.06, s: 1.0, explode: 0, waves: 0 },   // hero
  { x: -1.3, y: 0.05, rx: 0.05, ry: -1.45, rz: 0, s: 1.05, explode: 0, waves: 0 },     // design (side profile)
  { x: 0.95, y: 0.05, rx: 0.16, ry: -0.62, rz: 0, s: 0.8, explode: 1, waves: 0 },      // inside (exploded)
  { x: -1.05, y: 0.05, rx: 0.1, ry: 0.5, rz: -0.05, s: 0.92, explode: 0, waves: 1 },   // ANC
  { x: 1.2, y: 0.05, rx: -0.25, ry: -0.2, rz: 0.1, s: 1.0, explode: 0, waves: 0 },     // battery
  { x: -1.8, y: 0.05, rx: 0.22, ry: 0.95, rz: 0.05, s: 0.8, explode: 0, waves: 0 },    // features
  { x: 1.15, y: 0.05, rx: 0.08, ry: -0.35, rz: 0, s: 1.05, explode: 0, waves: 0 },     // finishes
  { x: 1.2, y: 0.05, rx: 0.28, ry: 0.5, rz: -0.04, s: 1.1, explode: 0, waves: 0 }      // every angle
];
const mobile = () => innerWidth < 820;
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const sections = [...document.querySelectorAll('main section')];

function targetAt(f) {
  const i = Math.min(Math.floor(f), KEYS.length - 2);
  const t = ease(Math.min(Math.max(f - i, 0), 1));
  const a = KEYS[i], b = KEYS[i + 1], out = {};
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * t;
  if (mobile()) { out.x = 0; out.y += 0.6; out.s *= 0.72; }
  return out;
}
let scrollP = 0, stageF = 0;
const cur = { ...KEYS[0] };
const nav = document.getElementById('nav'), dotsEl = document.getElementById('dots');
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollP = max > 0 ? Math.min(scrollY / max, 1) : 0;
  document.getElementById('bar').style.width = scrollP * 100 + '%';
  nav.classList.toggle('scrolled', scrollY > 30);
  document.getElementById('cue').style.opacity = Math.max(0, 1 - scrollY / 160);
  // once the last section ends, let the 3D layer scroll away with the page instead of sitting under the footer
  const lastSec = sections[sections.length - 1];
  const overflow = Math.max(0, scrollY + innerHeight - (lastSec.offsetTop + lastSec.offsetHeight));
  canvas.style.transform = labelsEl.style.transform = overflow ? `translate3d(0,${-overflow}px,0)` : '';
  dotsEl.classList.toggle('off', overflow > 40);
  // fractional stage: 2.5 = halfway between section 2 and 3
  const tops = sections.map(s => s.offsetTop);
  let i = 0;
  while (i < tops.length - 2 && scrollY >= tops[i + 1]) i++;
  stageF = Math.min(Math.max(i + (scrollY - tops[i]) / (tops[i + 1] - tops[i]), 0), KEYS.length - 1);
}
addEventListener('scroll', onScroll, { passive: true });

// section reveal, nav state, battery counter
const dots = document.getElementById('dots');
const DOT_NAMES = ['Overview', 'Design', 'Inside', 'Noise Cancelling', 'Battery', 'Features', 'Finishes', 'Every angle'];
sections.forEach((s, i) => {
  const a = document.createElement('a');
  a.href = '#' + s.id; a.setAttribute('aria-label', DOT_NAMES[i]);
  a.innerHTML = `<span><b>0${i + 1}</b>${DOT_NAMES[i]}</span><i></i>`;
  dots.appendChild(a);
});
const subLinks = [...document.querySelectorAll('.nav-links a')];
let batteryDone = false;
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  const idx = sections.indexOf(e.target);
  [...dots.children].forEach((d, j) => d.classList.toggle('active', j === idx));
  subLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
  document.getElementById('bgGlow').style.setProperty('--gx', KEYS[idx].x < 0 ? '32%' : '68%');
  if (e.target.id === 'battery' && !batteryDone) { batteryDone = true; countHours(); }
}), { threshold: 0.45 });
sections.forEach(s => io.observe(s));
function countHours() {
  const el = document.getElementById('hours'), fill = document.getElementById('fill'), t0 = performance.now();
  (function step(now) {
    const t = Math.min((now - t0) / 1800, 1), e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(60 * e);
    fill.style.width = e * 100 + '%';
    if (t < 1) requestAnimationFrame(step); else document.getElementById('cell').classList.add('full');
  })(t0);
}

/* ---------- pointer: parallax everywhere, free rotation on the last stage ---------- */
const mouse = { x: 0, y: 0 };
const dragQ = new THREE.Quaternion(), spin = { x: 0, y: 0 };
let dragging = false, last = null;
const studioActive = () => stageF > KEYS.length - 1.35;
const qTmp = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), RIGHT = new THREE.Vector3(1, 0, 0);
function applySpin(dx, dy) {
  // rotate about the camera's axes so dragging feels like turning the object in your hand
  dragQ.premultiply(qTmp.setFromAxisAngle(UP, dx));
  dragQ.premultiply(qTmp.setFromAxisAngle(RIGHT, dy));
}
addEventListener('pointermove', e => {
  mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5;
  if (!dragging) return;
  const dx = (e.clientX - last.x) * 0.009, dy = (e.clientY - last.y) * 0.009;
  last = { x: e.clientX, y: e.clientY };
  spin.x = dx; spin.y = dy;
  applySpin(dx, dy);
});
addEventListener('pointerdown', e => {
  if (!studioActive() || e.button !== 0 || e.target.closest('a,button,input,form,.nav,.progress,.trust,footer,.panel')) return;
  dragging = true; last = { x: e.clientX, y: e.clientY }; spin.x = spin.y = 0;
  document.documentElement.classList.add('dragging');
});
addEventListener('pointerup', () => { dragging = false; document.documentElement.classList.remove('dragging'); });
document.getElementById('resetView').onclick = () => { resetting = true; spin.x = spin.y = 0; };
let resetting = false;

/* ---------- loop ---------- */
const tmp = new THREE.Vector3(), euler = new THREE.Euler(), IDENT = new THREE.Quaternion();
const clock = new THREE.Clock();
const SNAP = new URLSearchParams(location.search).has('snap');
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), time = clock.elapsedTime;
  const tgt = targetAt(stageF);
  // frame-rate independent smoothing; ?snap jumps straight to the target (handy for screenshots)
  const damp = SNAP ? 1 : 1 - Math.exp(-dt * 4.5);
  for (const k in cur) cur[k] += (tgt[k] - cur[k]) * damp;

  const studio = studioActive();
  document.documentElement.classList.toggle('can-drag', studio);
  if (!dragging && studio && !resetting) {   // inertia after release
    spin.x *= Math.pow(0.04, dt); spin.y *= Math.pow(0.04, dt);
    if (Math.abs(spin.x) + Math.abs(spin.y) > 1e-4) applySpin(spin.x, spin.y);
  }
  if (!studio || resetting) {
    dragQ.slerp(IDENT, SNAP ? 1 : 1 - Math.exp(-dt * 5));
    if (resetting && dragQ.angleTo(IDENT) < 0.01) resetting = false;
  }

  const bob = studio ? 0 : Math.sin(time * 1.2) * 0.04;
  headphones.position.set(cur.x, cur.y + bob, 0);
  euler.set(cur.rx + mouse.y * (studio ? 0 : 0.12), cur.ry + (studio ? 0 : mouse.x * 0.25 + Math.sin(time * 0.5) * 0.05), cur.rz);
  headphones.quaternion.setFromEuler(euler).premultiply(dragQ);
  headphones.scale.setScalar(cur.s);

  shadow.position.set(cur.x, -1.75 * cur.s + cur.y, 0);
  shadow.scale.setScalar(cur.s * (1 - bob * 2));
  shadow.material.opacity = 0.9 - cur.explode * 0.4;

  for (const c of cups) {
    for (const name in c.layout) c.parts[name].position.x = c.layout[name] * cur.explode;
    c.waves.forEach((w, i) => {
      const phase = (time * 0.45 + i / c.waves.length) % 1;
      w.scale.setScalar(1 + phase * 2.4);
      w.position.x = 0.3 + phase * 0.6;
      w.material.opacity = cur.waves * (1 - phase) * 0.85;
    });
  }
  for (const k in colorTarget) M[k].color.lerp(colorTarget[k], damp);

  // exploded-view labels track the right cup's parts
  const right = cups.find(c => c.side > 0);
  headphones.updateMatrixWorld();
  labelNodes.forEach(({ part, el, dy }) => {
    right.parts[part].getWorldPosition(tmp);
    tmp.y += dy * cur.s; tmp.project(camera);
    el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px)`;
    el.style.opacity = Math.max(0, (cur.explode - 0.7) / 0.3);
  });

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  onScroll();
});
onScroll();
frame();
requestAnimationFrame(() => document.getElementById('loader').classList.add('done'));

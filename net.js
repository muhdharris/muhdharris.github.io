// Hero scene: the homelab as a 3D schematic.
// Two Proxmox nodes, their VMs and LXCs, and the 16 containers on the Docker VM.
// Drag to turn it. Falls back to nothing (the page is complete without it).

import * as THREE from "./vendor/three.module.min.js";

const canvas = document.getElementById("net");
const note = document.getElementById("net-note");
if (!canvas) throw new Error("no canvas");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
} catch (e) {
    canvas.remove();
    throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.6, 17);

const world = new THREE.Group();   // what the user turns
scene.add(world);

/* ---------- colours follow the page ---------- */

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const mats = { line: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 }),
               lineDim: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 }),
               ink: new THREE.LineBasicMaterial({}),
               accent: new THREE.LineBasicMaterial({}),
               dot: new THREE.MeshBasicMaterial({}),
               accentDot: new THREE.MeshBasicMaterial({}),
               pulse: new THREE.MeshBasicMaterial({}) };
function applyColours() {
    const ink = new THREE.Color(css("--ink") || "#16140f");
    const acc = new THREE.Color(css("--accent") || "#c4361a");
    const dim = new THREE.Color(css("--dim") || "#5c574b");
    mats.line.color.copy(dim);
    mats.lineDim.color.copy(dim);
    mats.ink.color.copy(ink);
    mats.accent.color.copy(acc);
    mats.dot.color.copy(ink);
    mats.accentDot.color.copy(acc);
    mats.pulse.color.copy(acc);
}
applyColours();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyColours(); dirty = true; });

/* ---------- topology ---------- */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pts = {};                       // name -> position
const edges = [];                     // [a, b, dim?]
const labels = [];                    // { name, text, el }

function wire(geom, mat, pos, scale = 1) {
    const m = new THREE.LineSegments(new THREE.EdgesGeometry(geom), mat);
    m.position.copy(pos); m.scale.setScalar(scale);
    world.add(m);
    return m;
}
function dot(pos, r, mat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.copy(pos);
    world.add(m);
    return m;
}

// two Proxmox nodes
pts.pve  = V(-3.6,  0.2,  0);
pts.pve2 = V( 4.4, -0.6, -0.8);
wire(new THREE.IcosahedronGeometry(1, 0), mats.accent, pts.pve, 0.95);
wire(new THREE.IcosahedronGeometry(1, 0), mats.accent, pts.pve2, 0.7);

// VMs and LXCs (cubes = VMs, octahedra = LXCs)
pts.docker = V(-1.0,  2.3,  1.2);
pts.nas    = V(-1.6, -2.5,  0.6);
pts.ubuntu = V(-5.6, -0.4, -0.9);       // stopped
pts.ts     = V(-5.8,  2.0, -1.2);       // Tailscale LXC, stopped
pts.agent  = V( 3.4,  1.8,  0.4);       // hermesagent LXC

wire(new THREE.BoxGeometry(1, 1, 1), mats.ink, pts.docker, 0.78);
wire(new THREE.BoxGeometry(1, 1, 1), mats.ink, pts.nas, 0.62);
wire(new THREE.BoxGeometry(1, 1, 1), mats.lineDim, pts.ubuntu, 0.46);
wire(new THREE.OctahedronGeometry(1, 0), mats.lineDim, pts.ts, 0.4);
wire(new THREE.OctahedronGeometry(1, 0), mats.ink, pts.agent, 0.4);

// the 16 containers, on a loose shell round the Docker VM (golden-angle spiral)
const N = 16;
for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const incl = Math.acos(1 - 2 * t);
    const az = i * Math.PI * (1 + Math.sqrt(5));
    const R = 1.55 + (i % 3) * 0.12;
    const p = V(Math.sin(incl) * Math.cos(az), Math.cos(incl), Math.sin(incl) * Math.sin(az))
        .multiplyScalar(R).add(pts.docker);
    pts["c" + i] = p;
    dot(p, 0.075, mats.dot);
    edges.push(["docker", "c" + i, true]);
}

// hosting links
edges.push(["pve", "docker"], ["pve", "nas"], ["pve", "ubuntu", true], ["pve", "ts", true], ["pve2", "agent"]);
// storage: Docker host reaches the NAS over NFS/SMB
edges.push(["docker", "nas"]);
// cluster link between the two nodes
edges.push(["pve", "pve2"]);

for (const [a, b, dim] of edges) {
    const g = new THREE.BufferGeometry().setFromPoints([pts[a], pts[b]]);
    world.add(new THREE.Line(g, dim ? mats.lineDim : mats.line));
}

// Tailscale overlay: a dashed arc joining both nodes, drawn apart from the cluster link
{
    const mid = pts.pve.clone().add(pts.pve2).multiplyScalar(0.5).add(V(0, 3.4, -1.5));
    const curve = new THREE.QuadraticBezierCurve3(pts.pve, mid, pts.pve2);
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
    const m = new THREE.LineDashedMaterial({ dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.7 });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    world.add(l);
    mats.dash = m;
}
{ const c = () => mats.dash && mats.dash.color.copy(mats.accent.color); c(); matchMedia("(prefers-color-scheme: dark)").addEventListener("change", c); }

// a few packets travelling the links
const packets = [];
const routes = [["pve", "docker"], ["docker", "nas"], ["pve", "pve2"], ["pve2", "agent"], ["docker", "c3"], ["docker", "c11"]];
routes.forEach(([a, b], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mats.pulse);
    world.add(m);
    packets.push({ m, a: pts[a], b: pts[b], t: (i * 0.37) % 1, s: 0.18 + (i % 3) * 0.05 });
});

/* ---------- labels (DOM, projected) ---------- */

const host = canvas.parentElement;
function label(name, text, accent, dy = -30, left = false, ox = 6) {
    const el = document.createElement("span");
    el.textContent = text;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;left:0;top:0;z-index:1;pointer-events:none;white-space:nowrap;" +
        "font:500 11px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.04em;text-transform:uppercase;" +
        "color:" + (accent ? "var(--accent)" : "var(--dim)") + ";will-change:transform";
    host.appendChild(el);
    labels.push({ name, el, dy, left, ox });
}
label("pve", "pve · OptiPlex 5090", true, -74, true, 60);
label("pve2", "pve2 · laptop, 10Gb", true, 48, true, 64);
label("docker", "VM 100 · Docker, 16 ctrs", false, -6, false, 112);
label("nas", "VM 102 · NAS (OMV)", false, -38);
label("agent", "LXC 104", false, -34);
label("ubuntu", "VM 103 · stopped", false, 14, true, 20);
label("ts", "LXC 101 · stopped", false, -26, true, -4);

/* ---------- sizing: keep the scene clear of the text ---------- */

let W = 1, H = 1;
function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // wide: scene top-right, text bottom-left. narrow: scene above the text, scaled to fit.
    if (W > 900)      { world.scale.setScalar(0.8);  world.position.set(2.7, 1.6, 0); camera.position.z = 19; }
    else if (W > 560) { world.scale.setScalar(0.62); world.position.set(0.3, 3.0, 0); camera.position.z = 22; }
    else              { world.scale.setScalar(0.56); world.position.set(0, 4.3, 0);   camera.position.z = 24; }
    camera.updateProjectionMatrix();
    for (const l of labels) l.el.style.display = W < 700 ? "none" : "";
    if (note) note.hidden = W < 861;
    dirty = true;
}
new ResizeObserver(resize).observe(host);

/* ---------- interaction ---------- */

let yaw = -0.35, pitch = 0.18;                  // user-controlled rotation
let velYaw = 0;
let dragging = false, lx = 0, ly = 0;
let px = 0, py = 0;                            // pointer parallax
let dirty = true;

canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; velYaw = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5);
    py = ((e.clientY - r.top) / r.height - 0.5);
    if (!dragging) { dirty = true; return; }
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    yaw += dx * 0.006; velYaw = dx * 0.006;
    pitch = Math.max(-0.7, Math.min(0.7, pitch + dy * 0.004));
    dirty = true;
});
const end = () => { dragging = false; };
canvas.addEventListener("pointerup", end);
canvas.addEventListener("pointercancel", end);
canvas.addEventListener("pointerleave", () => { px = 0; py = 0; dirty = true; });

/* ---------- loop ---------- */

let visible = true, hidden = false;
new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(host);
document.addEventListener("visibilitychange", () => { hidden = document.hidden; });

const clock = new THREE.Clock();
const tmp = new THREE.Vector3();

function project() {
    for (const l of labels) {
        tmp.copy(pts[l.name]).applyMatrix4(world.matrixWorld).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * W, y = (-tmp.y * 0.5 + 0.5) * H;
        const ox = l.left ? -(l.el.offsetWidth - l.ox) : l.ox;
        l.el.style.transform = `translate(${(x + ox).toFixed(1)}px, ${(y + l.dy).toFixed(1)}px)`;
    }
}

function frame() {
    requestAnimationFrame(frame);
    if (!visible || hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);

    if (!reduced) {
        if (!dragging) { yaw += velYaw; velYaw *= 0.94; yaw += dt * 0.07; }   // slow drift
        for (const p of packets) {
            p.t += dt * p.s; if (p.t > 1) p.t -= 1;
            p.m.position.lerpVectors(p.a, p.b, p.t);
        }
        dirty = true;
    }
    if (!dirty) return;
    dirty = false;

    world.rotation.y = yaw + px * 0.25;
    world.rotation.x = pitch + py * 0.15;
    world.updateMatrixWorld(true);
    renderer.render(scene, camera);
    project();
}

resize();
frame();

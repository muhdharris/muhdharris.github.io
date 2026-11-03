// Hero scene: the homelab as a 3D schematic.
// Two Proxmox nodes, their VMs and LXCs, and the 20 containers on the Docker VM.
// Drag to turn it. Falls back to nothing (the page is complete without it).

import * as THREE from "three";
import { reduced } from "./lib.js";

const canvas = document.getElementById("net");
const note = document.getElementById("net-note");
if (!canvas) throw new Error("no canvas");

// phones get a lighter scene: fewer pixels, simpler spheres
const small = innerWidth < 700;

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
} catch (e) {
    canvas.remove();
    throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
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
               pulse: new THREE.MeshBasicMaterial({}),
               fillAcc: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.10, depthWrite: false }),
               fillInk: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.05, depthWrite: false }),
               ring: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 }),
               floor: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.12 }),
               trail: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35 }),
               ripple: new THREE.LineBasicMaterial({ transparent: true, opacity: 0 }) };
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
    mats.fillAcc.color.copy(acc);
    mats.fillInk.color.copy(ink);
    mats.ring.color.copy(acc);
    mats.floor.color.copy(dim);
    mats.trail.color.copy(acc);
    mats.ripple.color.copy(acc);
}
applyColours();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyColours(); dirty = true; });

/* ---------- topology ---------- */

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pts = {};                       // name -> position
const edges = [];                     // [a, b, dim?]
const labels = [];                    // { name, text, el }

const grow = [];                      // objects that scale in on load
function wire(geom, mat, pos, scale = 1, fill = null) {
    const g = new THREE.Group();
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom), mat));
    if (fill) g.add(new THREE.Mesh(geom, fill));   // faint solid body for depth
    g.position.copy(pos); g.userData.s = scale; g.scale.setScalar(scale);
    world.add(g); grow.push(g);
    return g;
}
function dot(pos, r, mat) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, small ? 6 : 10, small ? 5 : 8), mat);
    m.position.copy(pos);
    world.add(m);
    return m;
}

// two Proxmox nodes
pts.pve  = V(-3.6,  0.2,  0);
pts.pve2 = V( 4.4, -0.6, -0.8);
wire(new THREE.IcosahedronGeometry(1, 0), mats.accent, pts.pve, 0.95, mats.fillAcc);
wire(new THREE.IcosahedronGeometry(1, 0), mats.accent, pts.pve2, 0.7, mats.fillAcc);

// a tilted orbit ring round each node, turning slowly: the hypervisor "running"
const orbits = [];
function orbit(pos, r, tilt) {
    const pts2 = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts2.push(V(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), mats.ring);
    const g = new THREE.Group(); g.add(l);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.accentDot);
    bead.position.set(r, 0, 0); g.add(bead);
    g.position.copy(pos); g.rotation.x = tilt; g.rotation.z = tilt * 0.6;
    world.add(g); orbits.push(g);
}
orbit(pts.pve, 1.45, 0.5);
orbit(pts.pve2, 1.1, -0.6);

// a faint polar floor so the scene sits on something
{
    const fl = new THREE.Group();
    for (const r of [2.2, 3.6, 5]) {
        const ring = [];
        for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; ring.push(V(Math.cos(a) * r, 0, Math.sin(a) * r)); }
        fl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), mats.floor));
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        fl.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2), V(Math.cos(a) * 5, 0, Math.sin(a) * 5)]), mats.floor));
    }
    fl.position.set(0.4, -3.8, 0);
    world.add(fl);
}

// VMs and LXCs (cubes = VMs, octahedra = LXCs)
pts.docker = V(-1.0,  2.3,  1.2);
pts.nas    = V(-1.6, -2.5,  0.6);
pts.ubuntu = V(-5.6, -0.4, -0.9);       // stopped
pts.ts     = V(-5.8,  2.0, -1.2);       // Tailscale LXC, stopped
pts.agent  = V( 3.4,  1.8,  0.4);       // hermesagent LXC

wire(new THREE.BoxGeometry(1, 1, 1), mats.ink, pts.docker, 0.78, mats.fillInk);
// the NAS as a stack of three disks
{
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
        const c = new THREE.CylinderGeometry(0.5, 0.5, 0.22, small ? 14 : 24);
        const d = new THREE.LineSegments(new THREE.EdgesGeometry(c, 30), mats.ink);
        d.position.y = (i - 1) * 0.3; g.add(d);
        const f = new THREE.Mesh(c, mats.fillInk); f.position.y = d.position.y; g.add(f);
    }
    g.position.copy(pts.nas); g.userData.s = 0.95; g.scale.setScalar(0.95);
    world.add(g); grow.push(g);
}
wire(new THREE.BoxGeometry(1, 1, 1), mats.lineDim, pts.ubuntu, 0.46);
wire(new THREE.OctahedronGeometry(1, 0), mats.lineDim, pts.ts, 0.4);
wire(new THREE.OctahedronGeometry(1, 0), mats.ink, pts.agent, 0.4);

// the 20 containers, on a loose shell round the Docker VM (golden-angle spiral)
const N = 20;
const ctrs = [];
for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const incl = Math.acos(1 - 2 * t);
    const az = i * Math.PI * (1 + Math.sqrt(5));
    const R = 1.55 + (i % 3) * 0.12;
    const p = V(Math.sin(incl) * Math.cos(az), Math.cos(incl), Math.sin(incl) * Math.sin(az))
        .multiplyScalar(R).add(pts.docker);
    pts["c" + i] = p;
    ctrs.push(dot(p, 0.075, mats.dot));
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
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(small ? 32 : 60));
    const m = new THREE.LineDashedMaterial({ dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.7 });
    const l = new THREE.Line(g, m);
    l.computeLineDistances();
    world.add(l);
    mats.dash = m;
}
{ const c = () => mats.dash && mats.dash.color.copy(mats.accent.color); c(); matchMedia("(prefers-color-scheme: dark)").addEventListener("change", c); }

// a few packets travelling the links
const packets = [];
const routes = [["pve", "docker"], ["docker", "nas"], ["pve", "pve2"], ["pve2", "agent"], ["docker", "c3"], ["docker", "c11"], ["nas", "docker"], ["docker", "c17"]];
const ripples = [];
function ripple() {                     // a ring that expands where a packet lands
    const r = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI * 2; r.push(V(Math.cos(a), Math.sin(a), 0)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(r), mats.ripple.clone());
    l.visible = false; world.add(l); return { l, t: 1 };
}
routes.forEach(([a, b], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, small ? 5 : 8, small ? 4 : 6), mats.pulse);
    world.add(m);
    const trail = [];                   // two fading ghosts behind each packet
    for (let k = 1; k <= 2; k++) {
        const g = new THREE.Mesh(new THREE.SphereGeometry(0.05 - k * 0.012, 6, 4), mats.trail);
        world.add(g); trail.push(g);
    }
    packets.push({ m, trail, rp: ripple(), a: pts[a], b: pts[b], t: (i * 0.37) % 1, s: 0.18 + (i % 3) * 0.05 });
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
label("docker", "VM 100 · Docker, 20 ctrs", false, -6, false, 112);
label("nas", "VM 102 · NAS (OMV)", false, -38);
label("agent", "LXC 104", false, 34, false, 22);
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
    else              { world.scale.setScalar(0.5);  world.position.set(0.2, 4.6, 0); camera.position.z = 24; }
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
// the pointer is tracked on the whole hero, not the canvas: the links sit on top of the
// canvas, so listening on the canvas made moving onto a link look like leaving it
let tpx = 0, tpy = 0;                          // target tilt; px/py ease toward it
host.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    tpx = ((e.clientX - r.left) / r.width - 0.5);
    tpy = ((e.clientY - r.top) / r.height - 0.5);
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
host.addEventListener("pointerleave", () => { tpx = 0; tpy = 0; dirty = true; });

/* ---------- scroll drives the scene ---------- */

let lastY = scrollY, boost = 0, scrollYaw = 0;
addEventListener("scroll", () => {
    const d = scrollY - lastY; lastY = scrollY;
    if (reduced) return;
    scrollYaw += d * 0.0022;                     // the scene turns as you scroll
    boost = Math.min(5, boost + Math.abs(d) * 0.02);  // traffic speeds up with scroll speed
    dirty = true;
}, { passive: true });

/* ---------- loop ---------- */

let visible = true, hidden = false;
new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(host);
document.addEventListener("visibilitychange", () => { hidden = document.hidden; });

const clock = new THREE.Clock();
let clockT = 0, buildT = reduced ? 9 : 0;
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
        boost *= 0.95;
        for (const p of packets) {
            p.t += dt * p.s * (1 + boost);
            if (p.t > 1) {                       // arrived: drop a ripple at the far end
                p.t -= 1;
                p.rp.t = 0; p.rp.l.visible = true; p.rp.l.position.copy(p.b);
            }
            p.m.position.lerpVectors(p.a, p.b, p.t);
            p.trail.forEach((g, k) => g.position.lerpVectors(p.a, p.b, Math.max(0, p.t - (k + 1) * 0.035)));
            if (p.rp.l.visible) {
                p.rp.t += dt * 1.6;
                const s = 0.12 + p.rp.t * 0.55;
                p.rp.l.scale.setScalar(s);
                p.rp.l.quaternion.copy(world.quaternion).invert().multiply(camera.quaternion);   // face the viewer
                p.rp.l.material.opacity = Math.max(0, 0.6 * (1 - p.rp.t));
                if (p.rp.t >= 1) p.rp.l.visible = false;
            }
        }
        for (const o of orbits) o.rotation.y += dt * 0.6;
        // containers blink like status lights, gently and out of step
        clockT += dt;
        ctrs.forEach((c, i) => c.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(clockT * 1.3 + i * 2.1)) ** 8));
        // build-in on load: each shape scales up in turn
        if (buildT < 1.6) {
            buildT += dt;
            grow.forEach((g, i) => {
                const k = Math.min(1, Math.max(0, (buildT - i * 0.12) / 0.5));
                g.scale.setScalar(g.userData.s * (1 - (1 - k) ** 3));
            });
        }
        dirty = true;
    }
    if (!reduced) {                              // ease the tilt so it can never jump
        px += (tpx - px) * 0.08; py += (tpy - py) * 0.08;
        if (Math.abs(tpx - px) + Math.abs(tpy - py) > 0.0004) dirty = true;
    }
    if (!dirty) return;
    dirty = false;

    world.rotation.y = yaw + scrollYaw + px * 0.25;
    world.rotation.x = pitch + py * 0.15;
    world.updateMatrixWorld(true);
    renderer.render(scene, camera);
    project();
}

resize();
frame();

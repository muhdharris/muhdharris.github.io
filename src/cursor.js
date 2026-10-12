// Traceroute cursor: a small ring that trails the pointer, grows over things you can
// click and names them, and leaves a few fading dots behind when you move fast.
// The real cursor is never hidden. Mouse only; off for touch and for reduced motion.

import { reduced, fine, $ } from "./lib.js";

if (fine && !reduced) {
    const ring = document.createElement("div");
    ring.className = "cur";
    ring.setAttribute("aria-hidden", "true");
    const tag = document.createElement("span");
    ring.appendChild(tag);

    const TRAIL = 7;
    const trail = Array.from({ length: TRAIL }, () => {
        const d = document.createElement("i");
        d.className = "cur-dot";
        d.setAttribute("aria-hidden", "true");
        return d;
    });
    document.body.append(ring, ...trail);

    const life = new Float32Array(TRAIL);
    let tx = -100, ty = -100, x = tx, y = ty, lx = tx, ly = ty;
    let next = 0, running = false, last = 0, shown = false;

    function labelFor(el) {
        if (!el || !el.closest) return null;
        if (el.closest("#net")) return "drag";
        if (el.closest("#storm")) return "unplug";
        const a = el.closest("a[href]");
        if (a) {
            if (a.hasAttribute("download")) return "download";
            const h = a.getAttribute("href");
            if (h.startsWith("mailto:")) return "email";
            if (h.startsWith("#")) return "jump";
            return a.hostname && a.hostname !== location.hostname ? "open \u2197" : "open";
        }
        return el.closest("button") ? "" : null;      // buttons grow the ring but carry no label
    }

    function loop(now) {
        const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
        last = now;
        x += (tx - x) * 0.22; y += (ty - y) * 0.22;
        ring.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;

        // a dot drops where the pointer is whenever it is moving quickly
        if (Math.hypot(tx - lx, ty - ly) > 16) {
            const d = trail[next], i = next;
            next = (next + 1) % TRAIL;
            d.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
            life[i] = 1; lx = tx; ly = ty;
        }
        let alive = false;
        for (let i = 0; i < TRAIL; i++) {
            if (life[i] <= 0) continue;
            life[i] = Math.max(0, life[i] - dt * 2.2);
            trail[i].style.opacity = (life[i] * 0.5).toFixed(2);
            alive = alive || life[i] > 0;
        }
        // sleep once the ring has caught up and every dot has faded
        if (alive || Math.abs(tx - x) + Math.abs(ty - y) > 0.3) requestAnimationFrame(loop);
        else running = false;
    }
    const wake = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };

    addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        tx = e.clientX; ty = e.clientY;
        if (!shown) { shown = true; x = tx; y = ty; lx = tx; ly = ty; ring.classList.add("on"); }
        wake();
    }, { passive: true });

    document.addEventListener("pointerover", (e) => {
        const l = labelFor(e.target);
        ring.classList.toggle("hot", l !== null);
        if (l !== null) tag.textContent = l;
    }, { passive: true });
    document.addEventListener("pointerdown", () => ring.classList.add("press"), { passive: true });
    addEventListener("pointerup", () => ring.classList.remove("press"), { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { shown = false; ring.classList.remove("on", "hot"); });
}

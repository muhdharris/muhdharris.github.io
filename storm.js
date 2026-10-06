// Illustration of the STP loop incident: while a loop exists, flooded frames never drain.
// Unplug switches one at a time, the way the fault was found on site.
// Not the real topology: six switches, a firewall on the first, one stray cable.

const cv = document.getElementById("storm");
if (cv) {
    const fig = cv.closest("figure");
    const ctl = document.getElementById("storm-ctl");
    const stateEl = document.getElementById("storm-state");
    const ctx = cv.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const N = 6, FW = 6, CAP = 260, RMAX = 70, SPEED = 260;
    // sw1..sw6, then the firewall (fractions of the canvas)
    const POS = [[.20, .55], [.36, .55], [.54, .74], [.76, .74], [.76, .26], [.54, .26], [.07, .55]];
    const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [6, 0]];
    const LOOP = [2, 3, 4, 5];

    const off = new Set();
    let pkts = [], plugged = false, delay = 0.8, spawn = 0, fwDown = false;
    let rate = new Array(7).fill(0), arr = new Array(7).fill(0);
    let W = 1, H = 1, last = 0, visible = false, textAt = 0, lastText = "";

    const isStray = (a, b) => (a === 5 && b === 2) || (a === 2 && b === 5);
    const edgeOk = (a, b) => !off.has(a) && !off.has(b) && (!isStray(a, b) || plugged);
    const nb = (n) => {
        const o = [];
        for (const [a, b] of EDGES) {
            if (!edgeOk(a, b)) continue;
            if (a === n) o.push(b); else if (b === n) o.push(a);
        }
        return o;
    };
    const PAD = 44, X0 = 0.07, X1 = 0.76;
    const fwW = () => (W < 600 ? 54 : 70);
    // fit every node, including the wide firewall box, inside the canvas at any width
    const xy = (n) => [PAD + ((POS[n][0] - X0) / (X1 - X0)) * Math.max(1, W - 2 * PAD), POS[n][1] * H];
    const dist = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return Math.hypot(x2 - x1, y2 - y1) || 1; };

    function step(dt) {
        if (delay > 0) { delay -= dt; if (delay <= 0) plugged = true; }
        // hosts broadcast constantly; a broadcast is flooded out of every port
        spawn -= dt;
        while (spawn <= 0) {
            spawn += 0.05;
            const n = (Math.random() * N) | 0;
            if (off.has(n)) continue;
            for (const m of nb(n)) if (pkts.length < CAP) pkts.push({ a: n, b: m, t: 0 });
        }
        for (const p of pkts) p.t += dt * (W * 0.36) / dist(p.a, p.b);
        const next = [];
        for (const p of pkts) {
            if (!edgeOk(p.a, p.b)) continue;
            if (p.t < 1) { next.push(p); continue; }
            arr[p.b]++;
            for (const m of nb(p.b)) if (m !== p.a && next.length < CAP) next.push({ a: p.b, b: m, t: p.t - 1 });
        }
        pkts = next;
        for (let i = 0; i < 7; i++) {
            rate[i] += (arr[i] / dt - rate[i]) * Math.min(1, dt * 3);
            arr[i] = 0;
        }
        const fl = Math.min(1, rate[FW] / RMAX);
        if (fl > 0.9) fwDown = true; else if (fl < 0.35) fwDown = false;
    }

    function colours() {
        const cs = getComputedStyle(document.documentElement);
        const g = (v) => cs.getPropertyValue(v).trim();
        return { ink: g("--ink"), dim: g("--dim"), acc: g("--accent"), paper: g("--paper"), rule: g("--rule") };
    }

    // drawn like a printed diagram: dot grid, ruled links, boxed devices with port ticks
    function draw() {
        const c = colours();
        ctx.clearRect(0, 0, W, H);
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        ctx.textAlign = "center";

        // dot grid
        ctx.fillStyle = c.rule; ctx.globalAlpha = 0.9;
        for (let x = 14; x < W; x += 22) for (let y = 14; y < H; y += 22) ctx.fillRect(x, y, 1.5, 1.5);
        ctx.globalAlpha = 1;

        // the loop, shaded as a region while it exists
        const looping = plugged && LOOP.every((i) => !off.has(i));
        if (looping) {
            ctx.beginPath();
            LOOP.forEach((n, k) => { const [x, y] = xy(n); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.closePath();
            ctx.globalAlpha = 0.07; ctx.fillStyle = c.acc; ctx.fill();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = c.acc; ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = 1; ctx.fillStyle = c.acc;
            const cx = (xy(2)[0] + xy(3)[0] + xy(4)[0] + xy(5)[0]) / 4;
            ctx.fillText("LOOP", (cx + xy(5)[0]) / 2 + 4, H / 2 - 12);
        }

        // links
        for (const [a, b] of EDGES) {
            if (off.has(a) || off.has(b)) continue;
            const [x1, y1] = xy(a), [x2, y2] = xy(b);
            const stray = isStray(a, b);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.globalAlpha = 1;
            ctx.lineWidth = stray && plugged ? 1.6 : 1.1;
            ctx.setLineDash(stray ? [6, 4] : []);
            ctx.strokeStyle = stray && plugged ? c.acc : c.ink;
            ctx.stroke(); ctx.setLineDash([]);
            if (stray && plugged) {
                ctx.fillStyle = c.acc; ctx.textAlign = "left";
                ctx.fillText("stray cable", x1 + 8, (y1 + y2) / 2 + 8);
                ctx.textAlign = "center";
            }
        }

        // frames in flight: short dashes along the link, not dots
        ctx.strokeStyle = c.acc; ctx.lineWidth = 2; ctx.lineCap = "round";
        for (const p of pkts) {
            const [x1, y1] = xy(p.a), [x2, y2] = xy(p.b);
            const t = Math.min(1, p.t), d = Math.hypot(x2 - x1, y2 - y1) || 1;
            const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
            const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
            ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.moveTo(x - ux * 5, y - uy * 5); ctx.lineTo(x, y); ctx.stroke();
        }
        ctx.lineCap = "butt"; ctx.globalAlpha = 1;

        // devices
        for (let i = 0; i < 7; i++) {
            const [x, y] = xy(i);
            const isFw = i === FW;
            const w = isFw ? fwW() : (W < 600 ? 32 : 38), h = isFw ? 44 : 26;
            const left = x - w / 2, top = y - h / 2;
            const load = Math.min(1, rate[i] / RMAX);
            ctx.lineWidth = 1.4;
            if (off.has(i)) {
                ctx.fillStyle = c.paper; ctx.fillRect(left, top, w, h);
                ctx.setLineDash([3, 3]); ctx.strokeStyle = c.dim;
                ctx.strokeRect(left, top, w, h); ctx.setLineDash([]);
                ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7);
                ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke();
            } else {
                ctx.globalAlpha = 1; ctx.fillStyle = c.paper; ctx.fillRect(left, top, w, h);
                // load shown as ink rising from the bottom of the box
                ctx.fillStyle = c.acc;
                ctx.globalAlpha = isFw && fwDown ? 1 : 0.18 + load * 0.62;
                const fh = isFw && fwDown ? h : h * load;
                ctx.fillRect(left, top + h - fh, w, fh);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = c.ink; ctx.strokeRect(left, top, w, h);
                if (isFw) {
                    // firewall: brick courses
                    ctx.strokeStyle = fwDown ? c.paper : c.dim; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
                    for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(left, top + r * h / 4); ctx.lineTo(left + w, top + r * h / 4); ctx.stroke(); }
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = fwDown ? c.paper : c.ink;
                    ctx.font = '600 11px "IBM Plex Mono", ui-monospace, monospace';
                    ctx.fillStyle = c.paper; ctx.fillRect(x - 17, y - 8, 34, 16);
                    ctx.fillStyle = fwDown ? c.acc : c.ink;
                    ctx.fillText(fwDown ? "DOWN" : "up", x, y + 4);
                    ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
                } else {
                    // port ticks along the front of a switch
                    ctx.fillStyle = c.ink;
                    for (let k = 0; k < 4; k++) ctx.fillRect(left + 5 + k * (w < 36 ? 6 : 8), top + h - 8, 4, 4);
                }
            }
            ctx.fillStyle = c.dim;
            ctx.fillText(isFw ? "firewall" : "sw" + (i + 1), x, y + h / 2 + 15);
        }
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }

    function message() {
        const loop = plugged && LOOP.every((i) => !off.has(i));
        if (!plugged) return "Normal traffic.";
        if (loop) {
            let m = fwDown ? "Loop formed. Frames keep multiplying and the firewall is overloaded."
                : pkts.length > 150 ? "Loop formed. The storm is building." : "Loop formed.";
            if (off.size) m += " Still looping — the offender is somewhere else.";
            return m;
        }
        return pkts.length > 60 ? "Loop broken. The storm is draining." : "Loop broken. Traffic is back to normal.";
    }
    function say(force) {
        const m = message();
        if (m !== lastText && (force || performance.now() - textAt > 900)) {
            lastText = m; textAt = performance.now(); stateEl.textContent = m;
        }
    }

    function settle() {
        delay = 0; plugged = true;
        for (let i = 0; i < 260; i++) step(0.05);
        draw(); say(true);
    }

    /* controls: buttons mirror clicking a switch, so it works from the keyboard too */
    const btns = [];
    function press(i) {
        if (off.has(i)) off.delete(i); else off.add(i);
        btns[i].setAttribute("aria-pressed", String(off.has(i)));
        pkts = pkts.filter((p) => edgeOk(p.a, p.b));
        if (reduced) settle();
    }
    for (let i = 0; i < N; i++) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = "unplug sw" + (i + 1);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => press(i));
        ctl.appendChild(b); btns.push(b);
    }
    const rs = document.createElement("button");
    rs.type = "button"; rs.textContent = "reset"; rs.className = "reset";
    rs.addEventListener("click", () => {
        off.clear(); btns.forEach((b) => b.setAttribute("aria-pressed", "false"));
        plugged = false; delay = 0.8; pkts = []; fwDown = false;
        rate.fill(0); arr.fill(0);
        if (reduced) settle(); else { draw(); say(true); }
    });
    ctl.appendChild(rs);

    cv.addEventListener("pointerdown", (e) => {
        const r = cv.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        for (let i = 0; i < N; i++) {
            const [x, y] = xy(i);
            if (Math.abs(mx - x) < 24 && Math.abs(my - y) < 24) { press(i); break; }
        }
    });

    function size() {
        const r = cv.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (reduced) settle(); else draw();
    }

    fig.classList.add("ready");
    new ResizeObserver(size).observe(cv);
    size();
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);

    if (!reduced) {
        const frame = (now) => {
            requestAnimationFrame(frame);
            const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
            last = now;
            if (!visible || document.hidden) return;
            step(dt); draw(); say(false);
        };
        requestAnimationFrame(frame);
    }
}

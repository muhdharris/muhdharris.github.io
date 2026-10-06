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
        return { ink: g("--ink"), dim: g("--dim"), acc: g("--accent"), paper: g("--paper") };
    }

    function draw() {
        const c = colours();
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 1;
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        ctx.textAlign = "center";

        for (const [a, b] of EDGES) {
            if (off.has(a) || off.has(b)) continue;
            const [x1, y1] = xy(a), [x2, y2] = xy(b);
            const stray = isStray(a, b);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.globalAlpha = 0.75;
            ctx.setLineDash(stray ? [5, 4] : []);
            ctx.strokeStyle = stray && plugged ? c.acc : c.dim;
            ctx.stroke();
            ctx.setLineDash([]);
            if (stray && plugged) {
                ctx.globalAlpha = 1; ctx.fillStyle = c.acc; ctx.textAlign = "left";
                ctx.fillText("stray cable", x1 + 10, (y1 + y2) / 2);
                ctx.textAlign = "center";
            }
        }

        ctx.fillStyle = c.acc;
        for (const p of pkts) {
            const [x1, y1] = xy(p.a), [x2, y2] = xy(p.b);
            const t = Math.min(1, p.t);
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2.2, 0, 6.2832);
            ctx.fill();
        }

        for (let i = 0; i < 7; i++) {
            const [x, y] = xy(i);
            const w = i === FW ? fwW() : 30, h = 30;
            const load = Math.min(1, rate[i] / RMAX);
            ctx.globalAlpha = 1;
            if (off.has(i)) {
                ctx.setLineDash([3, 3]); ctx.strokeStyle = c.dim;
                ctx.strokeRect(x - w / 2, y - h / 2, w, h);
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7);
                ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke();
            } else {
                ctx.fillStyle = c.acc;
                ctx.globalAlpha = i === FW && fwDown ? 1 : load * 0.85;
                ctx.fillRect(x - w / 2, y - h / 2, w, h);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = c.ink;
                ctx.strokeRect(x - w / 2, y - h / 2, w, h);
                if (i === FW) {
                    ctx.fillStyle = fwDown ? c.paper : c.ink;
                    ctx.fillText(fwDown ? "DOWN" : "up", x, y + 4);
                }
            }
            ctx.fillStyle = c.dim;
            ctx.fillText(i === FW ? "firewall" : "sw" + (i + 1), x, y + h / 2 + 15);
        }
        ctx.globalAlpha = 1;
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
            if (Math.abs(mx - x) < 22 && Math.abs(my - y) < 22) { press(i); break; }
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

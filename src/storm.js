// "Find the loop": an illustration of the STP loop incident, played as a short puzzle.
// A stray cable closes a loop somewhere, in a different place each round. Read the clues a
// real network gives you (how busy each switch is, the switch log, the firewall) and unplug
// switches one at a time until the firewall recovers. Then add the protections and plug
// everything back in. Not the real topology.

import { reduced } from "./lib.js";

const cv = document.getElementById("storm");
if (cv) {
    const fig = cv.closest("figure");
    const ctl = document.getElementById("storm-ctl");
    const stateEl = document.getElementById("storm-state");
    const ctx = cv.getContext("2d");
    const logEl = document.createElement("pre");
    logEl.className = "storm-log";
    logEl.setAttribute("aria-hidden", "true");
    cv.after(logEl);

    const N = 6, FW = 6, CAP = 260, RMAX = 70;
    // sw1..sw6, then the firewall (fractions of the canvas)
    const POS = [[.20, .55], [.36, .55], [.54, .74], [.76, .74], [.76, .26], [.54, .26], [.07, .55]];
    // the cabling as designed: a tree, so no loops
    const TREE = [[6, 0], [0, 1], [1, 2], [2, 3], [1, 5], [5, 4]];
    // places a stray cable can close a loop
    const STRAYS = [[3, 4], [2, 5], [2, 4], [3, 5], [0, 2]];
    const name = (i) => (i === FW ? "firewall" : "sw" + (i + 1));

    const off = new Set();
    let stray = STRAYS[0], EDGES = [], cycle = [];
    let pkts = [], plugged = false, delay = 0.8, spawn = 0, fwDown = false, guarded = false;
    let rate = new Array(7).fill(0), arr = new Array(7).fill(0);
    let clock = 0, outage = 0, moves = 0, solved = null, wasLoop = false, flapT = 0, lines = [];
    let W = 1, H = 1, last = 0, visible = false, textAt = 0, lastText = "";

    const isStray = (a, b) => (a === stray[0] && b === stray[1]) || (a === stray[1] && b === stray[0]);
    const edgeOk = (a, b) => !off.has(a) && !off.has(b) && (!isStray(a, b) || (plugged && !guarded));
    const nb = (n) => {
        const o = [];
        for (const [a, b] of EDGES) {
            if (!edgeOk(a, b)) continue;
            if (a === n) o.push(b); else if (b === n) o.push(a);
        }
        return o;
    };
    // path between two switches over the designed cabling, skipping unplugged ones
    function treePath(s, t, useOff) {
        const prev = new Map([[s, -1]]), q = [s];
        while (q.length) {
            const n = q.shift();
            if (n === t) break;
            for (const [a, b] of TREE) {
                const m = a === n ? b : b === n ? a : -1;
                if (m < 0 || prev.has(m) || (useOff && off.has(m))) continue;
                prev.set(m, n); q.push(m);
            }
        }
        if (!prev.has(t)) return null;
        const p = []; for (let n = t; n !== -1; n = prev.get(n)) p.push(n);
        return p;
    }
    const looping = () => plugged && !guarded && !off.has(stray[0]) && !off.has(stray[1]) && treePath(stray[0], stray[1], true) !== null;
    function cutOff() {                  // live switches the firewall can no longer reach
        const seen = new Set([FW]), q = [FW];
        while (q.length) { const n = q.shift(); for (const m of nb(n)) if (!seen.has(m)) { seen.add(m); q.push(m); } }
        let k = 0; for (let i = 0; i < N; i++) if (!off.has(i) && !seen.has(i)) k++;
        return k;
    }

    const PAD = 44, X0 = 0.07, X1 = 0.76;
    const fwW = () => (W < 600 ? 54 : 70);
    // fit every node, including the wide firewall box, inside the canvas at any width
    const xy = (n) => [PAD + ((POS[n][0] - X0) / (X1 - X0)) * Math.max(1, W - 2 * PAD), POS[n][1] * H];
    const dist = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return Math.hypot(x2 - x1, y2 - y1) || 1; };

    const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + (s % 60).toFixed(1).padStart(4, "0");
    function log(t) {
        lines.push(mmss(clock) + "  " + t);
        if (lines.length > 5) lines.shift();
        logEl.textContent = lines.join("\n");
    }

    function step(dt) {
        clock += dt;
        if (delay > 0) {
            delay -= dt;
            if (delay <= 0) { plugged = true; log("new link on an access port"); }
        }
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
        const fl = Math.min(1, rate[FW] / RMAX), was = fwDown;
        if (fl > 0.9) fwDown = true; else if (fl < 0.35) fwDown = false;
        if (fwDown && !was) log("firewall: CPU 99%, dropping sessions");
        if (!fwDown && was) log("firewall: load back to normal");
        if (fwDown) outage += dt;

        const L = looping();
        if (L) {
            flapT -= dt;
            if (flapT <= 0) {           // the switch log points at the loop, if you read it
                flapT = 1.7;
                // usually an end of the stray cable reports it, sometimes a switch further round
                const ends = stray.filter((i) => !off.has(i));
                const ring = cycle.filter((i) => !off.has(i));
                const hot = Math.random() < 0.7 ? ends[(Math.random() * ends.length) | 0] : ring[(Math.random() * ring.length) | 0];
                log(name(hot) + ": MAC flapping between ports " + (1 + ((Math.random() * 3) | 0)) + " and " + (5 + ((Math.random() * 3) | 0)));
            }
        }
        const atEnd = off.has(stray[0]) || off.has(stray[1]);
        if (wasLoop && !L && !guarded && !solved && atEnd) {
            solved = { moves, outage };
            log("loop broken: stray cable " + name(stray[0]) + " to " + name(stray[1]));
            hb.hidden = false;
        }
        wasLoop = L;
    }

    function colours() {
        const cs = getComputedStyle(document.documentElement);
        const g = (v) => cs.getPropertyValue(v).trim();
        return { ink: g("--ink"), dim: g("--dim"), acc: g("--accent"), paper: g("--paper"), rule: g("--rule") };
    }

    // drawn like a printed diagram: dot grid, ruled links, boxed devices with port ticks
    function draw() {
        const c = colours();
        const mono = (w) => (ctx.font = w + ' 11px "IBM Plex Mono", ui-monospace, monospace');
        ctx.clearRect(0, 0, W, H);
        mono(500); ctx.textAlign = "center";

        // dot grid
        ctx.fillStyle = c.rule; ctx.globalAlpha = 0.9;
        for (let x = 14; x < W; x += 22) for (let y = 14; y < H; y += 22) ctx.fillRect(x, y, 1.5, 1.5);
        ctx.globalAlpha = 1;

        // once found, the loop is outlined where it was
        if (solved && !guarded) {
            ctx.beginPath();
            cycle.forEach((n, k) => { const [x, y] = xy(n); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.closePath();
            ctx.globalAlpha = looping() ? 0.09 : 0.04; ctx.fillStyle = c.acc; ctx.fill();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = c.acc; ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        // links. The stray cable looks like any other until you find it.
        for (const [a, b] of EDGES) {
            const s = isStray(a, b);
            if ((off.has(a) || off.has(b)) && !(s && solved)) continue;   // a found stray cable stays drawn
            if (s && !plugged) continue;
            const [x1, y1] = xy(a), [x2, y2] = xy(b);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            ctx.lineWidth = 1.1; ctx.strokeStyle = c.ink; ctx.setLineDash([]);
            if (s && guarded) { ctx.strokeStyle = c.dim; ctx.setLineDash([3, 4]); }
            else if (s && solved) { ctx.strokeStyle = c.acc; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]); }
            ctx.stroke(); ctx.setLineDash([]);
            if (s && (solved || guarded)) {
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                const t = guarded ? "port shut down" : "stray cable";
                const tw = ctx.measureText(t).width;
                ctx.fillStyle = c.paper; ctx.fillRect(mx - tw / 2 - 4, my - 9, tw + 8, 15);
                ctx.fillStyle = guarded ? c.dim : c.acc; ctx.fillText(t, mx, my + 3);
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

        // devices; an overloaded switch shudders
        for (let i = 0; i < 7; i++) {
            let [x, y] = xy(i);
            const isFw = i === FW;
            const w = isFw ? fwW() : (W < 600 ? 32 : 38), h = isFw ? 44 : 26;
            const load = Math.min(1, rate[i] / RMAX);
            if (!reduced && !off.has(i) && load > 0.7) { x += (Math.random() - 0.5) * 3 * load; y += (Math.random() - 0.5) * 2 * load; }
            const left = x - w / 2, top = y - h / 2;
            ctx.lineWidth = 1.4;
            if (off.has(i)) {
                ctx.fillStyle = c.paper; ctx.fillRect(left, top, w, h);
                ctx.setLineDash([3, 3]); ctx.strokeStyle = c.dim;
                ctx.strokeRect(left, top, w, h); ctx.setLineDash([]);
                ctx.beginPath(); ctx.moveTo(x - 7, y - 7); ctx.lineTo(x + 7, y + 7);
                ctx.moveTo(x + 7, y - 7); ctx.lineTo(x - 7, y + 7); ctx.stroke();
            } else {
                ctx.fillStyle = c.paper; ctx.fillRect(left, top, w, h);
                // load shown as ink rising from the bottom of the box
                ctx.fillStyle = c.acc;
                ctx.globalAlpha = isFw && fwDown ? 1 : 0.18 + load * 0.62;
                const fh = isFw && fwDown ? h : h * load;
                ctx.fillRect(left, top + h - fh, w, fh);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = c.ink; ctx.strokeRect(left, top, w, h);
                if (isFw) {
                    ctx.strokeStyle = fwDown ? c.paper : c.dim; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
                    for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(left, top + r * h / 4); ctx.lineTo(left + w, top + r * h / 4); ctx.stroke(); }
                    ctx.globalAlpha = 1;
                    mono(600);
                    ctx.fillStyle = c.paper; ctx.fillRect(x - 17, y - 8, 34, 16);
                    // a dead firewall blinks
                    const blink = fwDown && !reduced && Math.floor(clock * 3) % 2;
                    ctx.fillStyle = fwDown ? c.acc : c.ink;
                    if (!blink) ctx.fillText(fwDown ? "DOWN" : "up", x, y + 4);
                    mono(500);
                } else {
                    // port ticks; they light up as the switch gets busy
                    for (let k = 0; k < 4; k++) {
                        const lit = !reduced && load > 0.25 && Math.random() < load;
                        ctx.fillStyle = lit ? c.acc : c.ink;
                        ctx.fillRect(left + 5 + k * (w < 36 ? 6 : 8), top + h - 8, 4, 4);
                    }
                }
            }
            ctx.fillStyle = c.dim;
            ctx.fillText(name(i), x, y + h / 2 + 15);
        }

        // readout, like a monitoring screen
        const total = rate.slice(0, N).reduce((s, v) => s + v, 0);
        const cpu = Math.min(99, Math.round(6 + Math.min(1, rate[FW] / RMAX) * 93));
        ctx.textAlign = "left"; mono(500);
        const parts = [["frames/s " + Math.round(total * 10), false], ["fw cpu " + cpu + "%", cpu > 85], ["outage " + mmss(outage), fwDown]];
        let x = 14, y = 22;
        for (const [t, hot] of parts) {
            const tw = ctx.measureText(t).width;
            if (x + tw > W - 14) { x = 14; y += 15; }
            ctx.fillStyle = hot ? c.acc : c.dim; ctx.fillText(t, x, y);
            x += tw + 18;
        }
        ctx.textAlign = "center"; ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }

    function message() {
        if (guarded) return "Protections on and everything plugged back in. The stray cable is still there, but its port shut itself down, so the loop cannot form again.";
        if (!plugged) return "Normal traffic. Somebody is about to plug in a cable…";
        if (looping()) {
            const cut = cutOff();
            if (solved) return "The loop is back. Unplug a switch on it again, or add the protections first.";
            if (!fwDown && cut) return "The firewall looks fine, but only because " + cut + " switch" + (cut > 1 ? "es are" : " is") + " cut off from it. The loop is still running. Plug back in and keep looking.";
            let m = fwDown ? "The firewall is down and frames keep multiplying. The busiest switches and the log are your clues."
                : "Something was plugged in and the storm is building.";
            if (off.size) m += " Still looping, so the fault is somewhere else.";
            return m;
        }
        if (plugged && !solved && !guarded && off.size) {
            const mid = cycle.filter((n) => off.has(n) && !stray.includes(n));
            if (mid.length) return "The storm stopped, but " + mid.map(name).join(" and ") + " sits in the middle of the loop, so everyone on it is now offline. The stray cable plugs in somewhere else. Plug it back in and check the log.";
            return "No loop right now. Plug everything back in to check.";
        }
        if (solved) return "Found it in " + solved.moves + " unplug" + (solved.moves === 1 ? "" : "s") + (solved.outage >= 1 ? ", after " + Math.round(solved.outage) + "s of outage" : "") + ". The stray cable ran " + name(stray[0]) + " to " + name(stray[1]) + ". On site, finding it took hours. Now add the protections and plug everything back in.";
        return "No loop. Traffic is back to normal.";
    }
    function say(force) {
        const m = message();
        if (m !== lastText && (force || performance.now() - textAt > 900)) {
            lastText = m; textAt = performance.now(); stateEl.textContent = m;
        }
    }

    function settle() {
        if (delay > 0) { delay = 0.001; }
        for (let i = 0; i < 260; i++) step(0.05);
        draw(); say(true);
    }

    /* controls: buttons mirror clicking a switch, so it works from the keyboard too */
    const btns = [];
    function press(i) {
        if (off.has(i)) { off.delete(i); log(name(i) + ": plugged back in"); }
        else { off.add(i); moves++; log(name(i) + ": unplugged"); }
        btns[i].setAttribute("aria-pressed", String(off.has(i)));
        pkts = pkts.filter((p) => edgeOk(p.a, p.b));
        if (reduced) settle(); else say(true);
    }
    for (let i = 0; i < N; i++) {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = "unplug sw" + (i + 1);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => press(i));
        ctl.appendChild(b); btns.push(b);
    }
    const hb = document.createElement("button");
    hb.type = "button"; hb.className = "harden"; hb.hidden = true;
    hb.textContent = "add protections, plug back in";
    hb.addEventListener("click", () => {
        guarded = true; off.clear(); btns.forEach((b) => b.setAttribute("aria-pressed", "false"));
        hb.hidden = true;
        log("protections on: BPDU filter, edge ports, link-flap recovery");
        log(name(stray[0]) + ": port 7 flapping, shut down by link-flap protection");
        if (reduced) settle(); else say(true);
    });
    ctl.appendChild(hb);
    const rs = document.createElement("button");
    rs.type = "button"; rs.textContent = "new round"; rs.className = "reset";
    rs.addEventListener("click", () => { newRound(); if (reduced) settle(); else { draw(); say(true); } });
    ctl.appendChild(rs);

    function newRound() {
        let s;
        do { s = STRAYS[(Math.random() * STRAYS.length) | 0]; } while (s === stray && EDGES.length);
        stray = s;
        EDGES = TREE.concat([stray]);
        cycle = treePath(stray[0], stray[1], false);
        off.clear(); btns.forEach((b) => b.setAttribute("aria-pressed", "false"));
        pkts = []; plugged = false; delay = 0.8; spawn = 0; fwDown = false; guarded = false;
        rate.fill(0); arr.fill(0);
        clock = 0; outage = 0; moves = 0; solved = null; wasLoop = false; flapT = 0.6;
        hb.hidden = true; lines = []; log("all links up, traffic normal");
    }

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

    newRound();
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

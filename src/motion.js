// Page motion: scroll-linked behaviour, no dependencies.
// The page reads as a traceroute: every section is a hop, TTL drops as you go.
// Everything here is decoration; the page is complete without it.

import { reduced, $, $$, clamp, onFrame, schedule, view } from "./lib.js";

// On the first visit of a session a short boot screen covers the hero; hold the hero
// animations back until it has gone.
const base = document.documentElement.classList.contains("boot") ? 0.95 : 0;

/* ---------- name: letters rise one at a time ---------- */

const h1 = $("h1");
if (h1) {
    if (!reduced) {
        const text = h1.textContent.trim();
        h1.setAttribute("aria-label", text);
        h1.textContent = "";
        [...text].forEach((c, i) => {
            const w = document.createElement("span");
            w.className = "ch";
            w.setAttribute("aria-hidden", "true");
            const s = document.createElement("span");
            s.textContent = c === " " ? "\u00a0" : c;
            s.style.animationDelay = (base + 0.15 + i * 0.05) + "s";
            w.appendChild(s);
            h1.appendChild(w);
        });
    }
    h1.classList.add("split");
}

/* ---------- section labels decode like a packet ---------- */

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789/:._-";
function scramble(el) {
    if (reduced || el.dataset.done) return;
    el.dataset.done = "1";
    const final = el.textContent;
    el.setAttribute("aria-label", final);
    const n = final.length, t0 = performance.now(), dur = 520 + n * 20;
    (function tick(now) {
        const p = clamp((now - t0) / dur);
        let out = "";
        for (let i = 0; i < n; i++) {
            out += (final[i] === " " || i < p * n * 1.15) ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
}

/* ---------- sections: ghost numerals, rule that draws in, decode on entry ---------- */

const sections = $$("section.section");
// hop 01 is the top of the page; the rail and the hop badge both read this list
export const marks = [{ id: "home", label: "home" }];
sections.forEach((s, i) => {
    const title = $(".section-title", s);
    marks.push({ id: s.id, label: (title ? title.textContent : s.id).trim().toLowerCase() });
    const g = document.createElement("span");
    g.className = "ghost";
    g.setAttribute("aria-hidden", "true");
    g.textContent = String(i + 1).padStart(2, "0");
    s.prepend(g);
    s._g = g;
});

const secIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in-sec");
    const t = $(".section-title", e.target);
    if (t) scramble(t);
    secIO.unobserve(e.target);
}), { rootMargin: "0px 0px -18% 0px" });
sections.forEach((s) => secIO.observe(s));

/* ---------- children arrive one after another ---------- */

$$(".role-points li, .practice-list li, .stack-card, .learn-card, tbody tr, .project-facts li").forEach((el) => {
    if (!el.closest(".reveal")) return;
    el.classList.add("stag");
    el.style.setProperty("--i", Math.min([...el.parentElement.children].indexOf(el), 10));
});

/* ---------- the numbers count up ---------- */

$$(".facts-line b").forEach((b) => {
    if (!/^\d+$/.test(b.textContent.trim())) return;
    b.dataset.v = b.textContent.trim();
    if (!reduced) b.textContent = "0";
});
const factIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    factIO.unobserve(e.target);
    $$("b[data-v]", e.target).forEach((b) => {
        const v = +b.dataset.v, t0 = performance.now();
        (function tick(now) {
            const p = clamp((now - t0) / 1000);
            b.textContent = Math.round(v * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
        })(t0);
    });
}), { threshold: 0.6 });
$$(".facts-line").forEach((f) => factIO.observe(f));

/* ---------- progress bar, hop counter, parallax ---------- */

const header = $("header");
const bar = document.createElement("div");
bar.className = "bar";
header.appendChild(bar);

const hop = document.createElement("div");
hop.className = "hop";
hop.setAttribute("aria-hidden", "true");
document.body.appendChild(hop);

// faint dot grid fixed behind the page; it drifts slower than the text
const dots = document.createElement("div");
dots.className = "dots";
dots.setAttribute("aria-hidden", "true");
document.body.prepend(dots);

const home = $("#home"), homeInner = $(".home-content");
const timelines = $$(".fl");

// Layout is measured once and again when the page changes size, never on scroll.
// The old version asked every section for its rectangle on every scroll tick, and
// wrote styles in between, which forced a layout each time.
let tops = [], secTop = [], docH = 0, homeH = 1, flGeo = [];
function measure() {
    const sy = scrollY;
    tops = marks.map((m) => { const el = document.getElementById(m.id); return el ? el.getBoundingClientRect().top + sy : 0; });
    secTop = sections.map((s) => s.getBoundingClientRect().top + sy);
    docH = document.documentElement.scrollHeight;
    homeH = Math.max(1, home.offsetHeight);
    flGeo = timelines.map((el) => ({ el, top: el.getBoundingClientRect().top + sy, dots: $$("li", el) }));
    schedule();
}
new ResizeObserver(measure).observe(document.body);   // fonts, the STP demo appearing, rotation
addEventListener("load", measure);
if (document.fonts) document.fonts.ready.then(measure);

let lastIdx = -1, hopOff = null;

function update() {
    // reads
    const y = scrollY, vh = innerHeight;
    const max = Math.max(0, docH - vh);
    const p = max > 0 ? clamp(y / max) : 0;
    let idx = 0;
    for (let i = 0; i < tops.length; i++) if (tops[i] - y <= vh * 0.4) idx = i;
    const span = (tops[idx + 1] || docH) - tops[idx];
    const frac = clamp((y + vh * 0.4 - tops[idx]) / Math.max(1, span));
    view.y = y; view.vh = vh; view.p = p; view.idx = idx; view.frac = frac;

    // writes
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (idx !== lastIdx) {
        lastIdx = idx;
        hop.textContent = `hop ${String(idx + 1).padStart(2, "0")}/${String(marks.length).padStart(2, "0")} · ${marks[idx].label} · ttl ${64 - idx}`;
    }
    const off = p > 0.985 || y < 80;
    if (off !== hopOff) { hopOff = off; hop.classList.toggle("off", off); }

    if (!reduced) {
        const hp = clamp(y / homeH);
        homeInner.style.transform = `translate3d(0,${(hp * 56).toFixed(1)}px,0)`;
        homeInner.style.opacity = (1 - hp * 0.9).toFixed(3);
        dots.style.transform = `translate3d(0,${(-(y * 0.18) % 24).toFixed(1)}px,0)`;

        for (let i = 0; i < sections.length; i++) {
            const top = secTop[i];
            if (top - y > vh + 200 || (secTop[i + 1] || docH) - y < -200) continue;
            sections[i]._g.style.transform = `translate3d(0,${Math.max(0, y - top) * 0.14}px,0)`;   // drift down only, never above the section
        }
    }

    for (const g of flGeo) {
        const fp = reduced ? 1 : clamp((vh * 0.88 - (g.top - y)) / (vh * 0.5));
        g.el.style.setProperty("--p", fp.toFixed(3));
        const n = g.dots.length - 1;
        g.dots.forEach((d, i) => d.classList.toggle("on", fp >= i / n - 0.001));
    }
}
onFrame(update);
measure();

/* ---------- footer: a real round trip, measured now ---------- */

const foot = $("footer");
if (foot) {
    const p = document.createElement("p");
    foot.appendChild(p);
    const t0 = performance.now();
    fetch(location.pathname + "?ping=" + Date.now(), { method: "HEAD", cache: "no-store" })
        .then(() => { p.textContent = `This page answered in ${Math.round(performance.now() - t0)} ms (measured just now, from your browser).`; })
        .catch(() => {});
}

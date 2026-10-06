// Page motion: scroll-linked behaviour, no dependencies.
// The page reads as a traceroute: every section is a hop, TTL drops as you go.
// Everything here is decoration; the page is complete without it.

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

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
            s.style.animationDelay = (0.15 + i * 0.05) + "s";
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
            const c = final[i];
            out += (c === " " || i < p * n * 1.15) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
}

/* ---------- sections: ghost numerals, rule that draws in, decode on entry ---------- */

const sections = $$("section.section");
const marks = [["home", "home"]];
sections.forEach((s, i) => {
    const title = $(".section-title", s);
    marks.push([s.id, (title ? title.textContent : s.id).trim().toLowerCase()]);
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
    const sibs = [...el.parentElement.children];
    el.classList.add("stag");
    el.style.setProperty("--i", Math.min(sibs.indexOf(el), 10));
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

/* ---------- progress bar and hop counter ---------- */

const header = $("header");
const bar = document.createElement("div");
bar.className = "bar";
header.appendChild(bar);

const hop = document.createElement("div");
hop.className = "hop";
hop.setAttribute("aria-hidden", "true");
document.body.appendChild(hop);

const home = $("#home"), homeInner = $(".home-content");
let lastIdx = -1;

function update() {
    const y = scrollY, vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? clamp(y / max) : 0;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;

    let idx = 0;
    marks.forEach(([id], i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= vh * 0.4) idx = i;
    });
    if (idx !== lastIdx) {
        lastIdx = idx;
        hop.textContent = `hop ${String(idx + 1).padStart(2, "0")}/${String(marks.length).padStart(2, "0")} · ${marks[idx][1]} · ttl ${64 - idx}`;
    }
    hop.classList.toggle("off", p > 0.985 || y < 80);

    if (!reduced) {
        const hp = clamp(y / Math.max(1, home.offsetHeight));
        homeInner.style.transform = `translate3d(0,${(hp * 56).toFixed(1)}px,0)`;
        homeInner.style.opacity = (1 - hp * 0.9).toFixed(3);

        for (const s of sections) {
            const r = s.getBoundingClientRect();
            if (r.bottom < -200 || r.top > vh + 200) continue;
            s._g.style.transform = `translate3d(0,${(-r.top * 0.14).toFixed(1)}px,0)`;
        }
    }

    for (const el of $$(".fl")) {
        const r = el.getBoundingClientRect();
        const fp = reduced ? 1 : clamp((vh * 0.88 - r.top) / (vh * 0.5));
        el.style.setProperty("--p", fp.toFixed(3));
        const dots = el._d || (el._d = $$("li", el));
        dots.forEach((d, i) => d.classList.toggle("on", fp >= i / (dots.length - 1) - 0.001));
    }
}

let queued = false;
const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();

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

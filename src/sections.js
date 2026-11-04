// One entrance per section, each borrowed from the thing the section is about.
// About: words ink in as you read. Experience: bullets come up like links.
// What I run: a scan line passes over the table. Learning: each module "loads".
// Portfolio: titles get marked. Stack: port lights come on in sequence.
// Background: a traceroute, one hop at a time, with latencies. Contact: the address types out.
// Everything is decoration over a page that is complete without it.

import { reduced, $, $$, clamp, onFrame, schedule } from "./lib.js";

const once = (els, fn, opts = { rootMargin: "0px 0px -15% 0px" }) => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target); fn(e.target);
    }), opts);
    els.forEach((el) => io.observe(el));
};

/* ---------- About: words go from faint to full ink as the paragraph passes ---------- */

const about = $$("#about .prose p");
const words = [];
if (!reduced) {
    for (const p of about) {
        const parts = p.textContent.trim().split(/\s+/);
        p.setAttribute("aria-label", parts.join(" "));
        p.textContent = "";
        parts.forEach((w, i) => {
            const s = document.createElement("span");
            s.className = "wd"; s.textContent = w; s.setAttribute("aria-hidden", "true");
            p.appendChild(s);
            if (i < parts.length - 1) p.appendChild(document.createTextNode(" "));
            words.push(s);
        });
    }
    let wTop = [];
    const measure = () => { const y = scrollY; wTop = words.map((w) => w.getBoundingClientRect().top + y); schedule(); };
    new ResizeObserver(measure).observe(document.body);
    addEventListener("load", measure);
    let lit = -1;
    onFrame(() => {
        const line = scrollY + innerHeight * 0.72;
        let n = 0; while (n < wTop.length && wTop[n] < line) n++;
        if (n === lit) return;
        words.forEach((w, i) => w.classList.toggle("on", i < n));
        lit = n;
    });
    measure();
}

/* ---------- Experience: each bullet comes up like a link, dash first ---------- */

$$("#experience .role-points").forEach((ul) => ul.classList.add("linkup"));
once($$("#experience .role-points"), (ul) => ul.classList.add("up"));

/* ---------- What I run: a scan line sweeps the table, rows settle under it ---------- */

once($$("#infra .table-wrap"), (t) => t.classList.add("scanned"));
once($$("#infra .diagram"), (d) => d.classList.add("drawn"));

/* ---------- Learning: each course loads, then its badge settles ---------- */

$$("#learning .learn-card").forEach((c, i) => {
    const bar = document.createElement("span");
    bar.className = "load"; bar.setAttribute("aria-hidden", "true");
    bar.style.setProperty("--d", i * 0.22 + "s");
    $(".cert-badge", c).after(bar);
});
once($$("#learning .learn-grid"), (g) => g.classList.add("loaded"));

/* ---------- Portfolio: a marker passes behind each project title ---------- */

$$("#projects .project h3").forEach((h) => h.classList.add("mark"));
once($$("#projects .project h3"), (h) => h.classList.add("on"));

/* ---------- Stack: one status light per item, lit in sequence card by card ---------- */

$$("#stack .stack-card").forEach((card, ci) => {
    $$("li", card).forEach((li, i) => li.style.setProperty("--d", (ci * 0.12 + i * 0.09).toFixed(2) + "s"));
    card.classList.add("leds");
});
once($$("#stack .stack-grid"), (g) => g.classList.add("lit"));

/* ---------- Background: traceroute. Hops answer in order, latency counts up ---------- */

$$(".route li").forEach((li, i) => {
    const ms = document.createElement("span");
    ms.className = "r-ms"; ms.setAttribute("aria-hidden", "true");
    ms.dataset.v = (1.2 + i * i * 2.7 + i * 1.9).toFixed(1);
    ms.textContent = reduced ? ms.dataset.v + " ms" : "* * *";
    $(".r-when", li).after(ms);
});
// the hop dots are lit by motion.js (the .fl timeline); here we fill in the latency as each one lights
if (!reduced) {
    const seen = new Set();
    onFrame(() => {
        $$(".route li.on").forEach((li) => {
            if (seen.has(li)) return; seen.add(li);
            const el = $(".r-ms", li), v = +el.dataset.v, t0 = performance.now();
            setTimeout(() => (function tick(now) {
                const p = clamp((now - t0 - 250) / 500);
                el.textContent = (v * p).toFixed(1) + " ms";
                if (p < 1) requestAnimationFrame(tick);
            })(performance.now()), 250);
        });
    });
}

/* ---------- Contact: the address types itself, with a cursor ---------- */

const mail = $("#contact .contact-mail");
if (mail && !reduced) {
    const text = mail.textContent;
    mail.setAttribute("aria-label", text);
    const out = document.createElement("span"); out.setAttribute("aria-hidden", "true");
    const ghost = document.createElement("span"); ghost.className = "ghost-text"; ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = text;                          // keeps the width so nothing jumps
    mail.textContent = ""; mail.append(out, ghost); mail.classList.add("typing");
    once([mail], () => {
        let i = 0;
        const t = setInterval(() => {
            i++; out.textContent = text.slice(0, i); ghost.textContent = text.slice(i);
            if (i >= text.length) { clearInterval(t); mail.classList.add("typed"); }
        }, 45);
    });
    $$("#contact .contact-cards a").forEach((a, i) => a.style.setProperty("--d", 0.9 + i * 0.12 + "s"));
    once($$("#contact .contact-cards"), (c) => c.classList.add("in"));
}

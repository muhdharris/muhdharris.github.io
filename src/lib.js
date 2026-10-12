// Shared helpers and one scroll scheduler for every module on the page.
// Everything that follows the scroll position subscribes here, so a scroll
// event costs one requestAnimationFrame no matter how many effects are on.

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Idle-time start for work that is not needed for the first paint.
export const idle = (fn, timeout = 1500) =>
    "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200);

// What the scroll modules share. motion.js fills it in before the others run.
export const view = { y: 0, vh: 0, p: 0, idx: 0, frac: 0 };

const subs = [];
let queued = false;
export const onFrame = (fn) => subs.push(fn);
export const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; for (const f of subs) f(); });
};

addEventListener("scroll", schedule, { passive: true });
addEventListener("resize", schedule);

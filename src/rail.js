// Section rail: a thin line down the left edge with one tick per hop.
// The red fill follows the scroll; a tick lights when its section is current and jumps there when clicked.

import { $, onFrame, view } from "./lib.js";
import { marks } from "./motion.js";

const nav = document.createElement("nav");
nav.className = "rail";
nav.setAttribute("aria-label", "Sections");
const fill = document.createElement("div");
fill.className = "rail-fill";
const ul = document.createElement("ul");
const n = marks.length;

const ticks = marks.map((m, i) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + m.id;
    a.style.top = (i / (n - 1) * 100).toFixed(2) + "%";
    a.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b> <span></span>`;
    a.lastChild.textContent = m.label;
    li.appendChild(a);
    ul.appendChild(li);
    return a;
});
nav.append(fill, ul);
document.body.appendChild(nav);

let cur = -1, lastF = -1;
onFrame(() => {
    const f = Math.min(1, (view.idx + view.frac) / (n - 1));
    if (Math.abs(f - lastF) > 0.001) { lastF = f; fill.style.transform = `scaleY(${f.toFixed(4)})`; }
    if (view.idx !== cur) {
        if (cur >= 0) { ticks[cur].classList.remove("now"); ticks[cur].removeAttribute("aria-current"); }
        cur = view.idx;
        ticks[cur].classList.add("now");
        ticks[cur].setAttribute("aria-current", "true");
    }
});

// Entry point. The page is complete without any of this; each piece only adds to it.
// The 3D scene (and with it three.js) and the STP demo are separate chunks, fetched
// after the page's own scripts, so the text and the scroll effects never wait for them.

import { idle } from "./lib.js";
import "./motion.js";
import "./cursor.js";
import "./rail.js";

import("./net.js").catch(() => {});
idle(() => import("./storm.js").catch(() => {}), 2500);

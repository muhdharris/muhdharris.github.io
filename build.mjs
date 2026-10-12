// Build: bundle and minify src/ into dist/, which is what the page serves.
//   npm install && npm run build
// three.js comes from node_modules and is tree-shaken to the classes net.js uses,
// and it lands in its own chunk so the rest of the page does not wait for it.
import { build } from "esbuild";
import { rmSync, statSync, readdirSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

const common = { outdir: "dist", bundle: true, minify: true, legalComments: "none", target: ["es2020"], logLevel: "warning" };

await build({ ...common, entryPoints: ["src/main.js"], format: "esm", splitting: true, entryNames: "[name]", chunkNames: "[name]-[hash]" });
// fonts stay as separate files in /fonts, so the css keeps pointing at them
await build({ ...common, entryPoints: ["src/styles.css"], external: ["*.woff2"] });

let total = 0;
for (const f of readdirSync("dist").sort()) {
    const s = statSync("dist/" + f).size; total += s;
    console.log(f.padEnd(28), (s / 1024).toFixed(1).padStart(7), "KB");
}
console.log("total".padEnd(28), (total / 1024).toFixed(1).padStart(7), "KB");

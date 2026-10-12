import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = [
  "src/core/slot-map.js",
  "src/core/captured-inventory.js",
  "src/core/file-validation.js",
  "src/core/ir-conversion.js",
  "src/core/capture-store.js",
  "src/core/preset-store.js",
  "src/core/effect-types.js",
  "src/protocol/sysex.js",
  "src/protocol/midi-events.js",
  "src/transports/simulated-mosaic.js",
  "src/transports/hardware-midi.js",
  "src/main.js"
];

const pieces = [];
for (const file of files) {
  let source = await readFile(file, "utf8");
  source = source
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
    .replace(/^export /gm, "");
  pieces.push(`// ${file}\n${source}`);
}

await mkdir("dist", { recursive: true });
await writeFile("dist/app.bundle.js", `(function(){\n${pieces.join("\n\n")}\n})();\n`);
const html = (await readFile("index.html", "utf8"))
  .replace('<link rel="stylesheet" href="./src/styles.css" />', '<link rel="stylesheet" href="./styles.css" />')
  .replace('  <link rel="stylesheet" href="./src/effects.css" />\n', "")
  .replace('<script type="module" src="./src/main.js"></script>', '<script defer src="./app.bundle.js"></script>');
await writeFile("dist/index.html", html);
const styles = await readFile("src/styles.css", "utf8");
const effectStyles = await readFile("src/effects.css", "utf8");
await writeFile("dist/styles.css", `${styles}\n${effectStyles}`);
console.log("Built dependency-free web bundle in dist/");

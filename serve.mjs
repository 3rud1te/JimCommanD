import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  try {
    const requested = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const path = normalize(join(root, requested));
    if (!path.startsWith(root)) throw new Error("Invalid path");
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not found");
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("JimCommanD: http://127.0.0.1:4173"));

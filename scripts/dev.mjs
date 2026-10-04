import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const args = process.argv.slice(2);
const value = (key) => {
  const i = args.indexOf(key);
  return i >= 0 ? args[i + 1] : undefined;
};
const port = Number(value("--port") || process.env.PORT || 4173);
const host = value("--host") || "0.0.0.0";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const base = pathname.startsWith("/__qa/")
      ? path.resolve(root, "../tests")
      : root;
    const name = pathname.startsWith("/__qa/")
      ? pathname.slice("/__qa".length)
      : pathname === "/"
        ? "/index.html"
        : pathname;
    const file = path.resolve(base, "." + name);
    if (!file.startsWith(base + path.sep)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const data = await fs.readFile(file);
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain",
    });
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
});
server.listen(port, host, () =>
  process.stdout.write(
    `Windows 3.1 development server listening on http://${host}:${port}\n`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));

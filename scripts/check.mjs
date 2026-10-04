import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve("dist");
const walk = async (dir) =>
  (
    await Promise.all(
      (await fs.readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name),
      ),
    )
  ).flat();
const files = await walk(root);
let failures = 0;
for (const file of files.filter((f) => f.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status) {
    process.stderr.write(result.stderr);
    failures++;
  }
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(
    /(?:from\s*|import\s*)['"]([^'"]+)['"]/g,
  )) {
    if (!match[1].startsWith(".")) continue;
    try {
      await fs.access(path.resolve(path.dirname(file), match[1]));
    } catch {
      console.error("Missing module:", file, match[1]);
      failures++;
    }
  }
}
for (const file of files.filter((f) => f.endsWith(".css"))) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    if (/^(data:|https?:)/.test(match[1])) continue;
    try {
      await fs.access(path.resolve(path.dirname(file), match[1]));
    } catch {
      console.error("Missing CSS asset:", file, match[1]);
      failures++;
    }
  }
}
console.log(
  JSON.stringify({
    javascriptModules: files.filter((f) => f.endsWith(".js")).length,
    files: files.length,
    failures,
  }),
);
process.exitCode = failures ? 1 : 0;

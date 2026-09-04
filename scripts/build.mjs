import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const securityHeaders = JSON.parse(readFileSync(join(SRC, "config", "security-headers.json"), "utf8"));
const staticCsp = String(securityHeaders?.staticProfile?.contentSecurityPolicy || "").trim();
if (!staticCsp || /frame-ancestors/i.test(staticCsp)) {
  throw new Error("Statická CSP pro meta tag chybí nebo obsahuje nepodporované frame-ancestors.");
}
const TOKENS = {
  css: "/*==SORTIO_STYLES==*/",
  body: "<!--==SORTIO_BODY==-->",
};

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(SRC, DIST, { recursive: true });
for (const rel of ["manual/index.html", "tests/index.html"]) {
  const file = join(DIST, rel);
  const text = readFileSync(file, "utf8").replaceAll("__STATIC_CSP__", staticCsp);
  if (text.includes("__STATIC_CSP__")) throw new Error(`CSP token zůstal v ${rel}.`);
  writeFileSync(file, text);
}

const tpl = readFileSync(join(DIST, "index.template.html"), "utf8");
const css = readFileSync(join(DIST, "styles.css"), "utf8");
const body = readFileSync(join(DIST, "body.html"), "utf8");
const jsFiles = readdirSync(join(DIST, "js"))
  .filter((name) => name.endsWith(".js"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const functionDeclarations = new Map();
for (const name of jsFiles) {
  const source = readFileSync(join(DIST, "js", name), "utf8");
  for (const match of source.matchAll(/(?:^|[;}\s])(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
    const functionName = match[1];
    if (functionDeclarations.has(functionName)) {
      throw new Error(
        `Duplicitní deklarace ${functionName}: ${functionDeclarations.get(functionName)} × ${name}`,
      );
    }
    functionDeclarations.set(functionName, name);
  }
}
const js = jsFiles
  .map((name) => readFileSync(join(DIST, "js", name), "utf8"))
  .join("\n;\n");

let html = tpl
  .replace(TOKENS.css, () => css)
  .replace(TOKENS.body, () => body)
  .replaceAll("__STATIC_CSP__", staticCsp)
  .replaceAll("__APP_VERSION__", pkg.version)
  .replaceAll("__BUILD_TIME__", new Date().toISOString());
if (Object.values(TOKENS).some((token) => html.includes(token)) || html.includes("__STATIC_CSP__")) {
  throw new Error("Build token zůstal ve výstupu.");
}
writeFileSync(join(DIST, "index.html"), html);
writeFileSync(join(DIST, "app.js"), `${js}\n`);
for (const name of ["index.template.html", "styles.css", "body.html"]) {
  rmSync(join(DIST, name));
}
rmSync(join(DIST, "js"), { recursive: true });

const studioManifest = JSON.parse(
  readFileSync(join(DIST, "studio-manifest.template.json"), "utf8")
    .replaceAll("__APP_VERSION__", pkg.version)
    .replaceAll("__BUILD_TIME__", new Date().toISOString()),
);
writeFileSync(
  join(DIST, "studio-manifest.json"),
  `${JSON.stringify(studioManifest, null, 2)}\n`,
);
rmSync(join(DIST, "studio-manifest.template.json"));

const sw = readFileSync(join(DIST, "sw.js"), "utf8").replaceAll(
  "__APP_VERSION__",
  pkg.version,
);
writeFileSync(join(DIST, "sw.js"), sw);
writeFileSync(join(DIST, ".nojekyll"), "");

if (!existsSync(join(DIST, "manual", "index.html"))) {
  throw new Error("Chybí manuál.");
}
if (!existsSync(join(DIST, "tests", "index.html"))) {
  throw new Error("Chybí interní testovací centrum.");
}
console.log(
  `[build] SORTIO ${pkg.version}: ${jsFiles.length} JS modulů, dist připraven.`,
);

// P2: canonical cross-application platform post-processing.
await import("./apply-ghrab-platform.mjs");

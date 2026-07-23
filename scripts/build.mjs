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
const TOKENS = {
  css: "/*==SORTIO_STYLES==*/",
  body: "<!--==SORTIO_BODY==-->",
  js: "/*==SORTIO_JS==*/",
};

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(SRC, DIST, { recursive: true });

const tpl = readFileSync(join(DIST, "index.template.html"), "utf8");
const css = readFileSync(join(DIST, "styles.css"), "utf8");
const body = readFileSync(join(DIST, "body.html"), "utf8");
const jsFiles = readdirSync(join(DIST, "js"))
  .filter((name) => name.endsWith(".js"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const js = jsFiles
  .map((name) => readFileSync(join(DIST, "js", name), "utf8"))
  .join("\n;\n");

let html = tpl
  .replace(TOKENS.css, () => css)
  .replace(TOKENS.body, () => body)
  .replace(TOKENS.js, () => js)
  .replaceAll("__APP_VERSION__", pkg.version)
  .replaceAll("__BUILD_TIME__", new Date().toISOString());
if (Object.values(TOKENS).some((token) => html.includes(token))) {
  throw new Error("Build token zůstal ve výstupu.");
}
writeFileSync(join(DIST, "index.html"), html);
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

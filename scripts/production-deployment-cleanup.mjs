import fs from "node:fs";
import path from "node:path";

export function cleanProductionDeployment(targetDist) {
  const testsDir = path.join(targetDist, "tests");
  fs.rmSync(testsDir, { recursive: true, force: true });
  const indexPath = path.join(targetDist, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const start = "<!-- SORTIO_INTERNAL_TEST_CENTER_START -->";
  const end = "<!-- SORTIO_INTERNAL_TEST_CENTER_END -->";
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error("Chybí deployment markery interního testovacího centra.");
  html = html.slice(0, a) + html.slice(b + end.length);
  if (/href=["']\.\/tests\//i.test(html)) throw new Error("Produkční index stále odkazuje na ./tests/.");
  fs.writeFileSync(indexPath, html);
  if (fs.existsSync(testsDir)) throw new Error("Produkční deployment stále obsahuje tests/.");
}

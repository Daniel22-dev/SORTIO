import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Etapa D: source-contract + negative/positive access smoke.
// The Unicode PDF implementation is shipped by AI Studio, not in this app.
// Never assert that a local src/manual/pdf-export.js exists.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(root, file), "utf8");
const html = read("src/manual/index.html");
const actionPath = "src/manual/pdf-download.js";
const action = read(actionPath);
execFileSync(process.execPath, ["--check", path.join(root, actionPath)], { stdio: "pipe" });

assert(html.includes('data-ghrab-access="checking"'), "Manual must start inaccessible");
assert(html.includes('src="./pdf-download.js"'), "Manual PDF button script is not loaded");
assert(html.includes("protectApp("), "Existing app permit check must remain active");
assert(action.includes('ghrabAccess==="granted"'), "Download must be gated on the explicit grant");
assert(action.includes("MutationObserver"), "Download must wait for the access transition");
assert(action.includes("manualy/pdf-export.js"), "PDF must import the common Unicode exporter");
assert(action.includes("downloadManualPdf"), "PDF handler must call the exporter");
assert(!/https?:\/\/(?:cdn|unpkg|jsdelivr)\./i.test(action), "Unpinned CDN dependency");

function simulate(initial, updated) {
  let button = null;
  let observer = null;
  const rootNode = { dataset: { ghrabAccess: initial, ghrabAppId: "sortio" } };
  const main = { prepend(...nodes) { button = nodes.find(node => node.id === "manual-pdf") || button; } };
  const document = {
    documentElement: rootNode,
    querySelector(selector) {
      if (selector === "main") return main;
      if (selector === "#manual-pdf") return button;
      return null;
    },
    createElement(tag) {
      return {
        tagName: tag.toUpperCase(),
        setAttribute(name, value) { this[name] = value; }
      };
    }
  };
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() { this.observing = true; }
    disconnect() { this.observing = false; }
  }
  runInNewContext(action, {
    document, MutationObserver: FakeMutationObserver,
    window: {}, URL, location: { href: "https://daniel22-dev.github.io/SORTIO/" }
  }, { filename: actionPath });
  const before = !!button;
  if (updated) {
    rootNode.dataset.ghrabAccess = updated;
    if (observer?.observing) observer.callback();
  }
  return { before, after: !!button, label: button?.textContent, button };
}
const denied = simulate("denied");
assert.equal(denied.before, false, "Denied users must never see the download control");
const checking = simulate("checking", "denied");
assert.equal(checking.after, false, "Denied transition must not mount the control");
const approved = simulate("checking", "granted");
assert.equal(approved.before, false, "Control appeared before permit confirmation");
assert.equal(approved.after, true, "Approved user should see the download control");
assert.match(approved.label, /PDF/i, "Mounted control must identify PDF export");

console.log("[MANUAL PDF] PASS: module syntax, shared Unicode exporter, fail-closed grant/deny states");
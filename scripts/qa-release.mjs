import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import {
  ROOT,
  OUT_DIR,
  loadManifest,
  loadState,
  saveState,
  runCommand,
  finding,
  gateResult,
  saveGate,
  ensureOutput,
} from "./qa-core.mjs";

const REQUIRED_GATES = [
  "technical",
  "security",
  "pwa",
  "combinatorial",
  "visual",
  "critical",
];

await rm(OUT_DIR, { recursive: true, force: true });
await ensureOutput();
const manifest = await loadManifest();
const buildRoot = path.resolve(ROOT, manifest.buildRoot || "dist");
if (
  buildRoot === ROOT ||
  !buildRoot.startsWith(`${path.resolve(ROOT)}${path.sep}`)
) {
  throw new Error(`Nebezpečný buildRoot v QA manifestu: ${buildRoot}`);
}
await rm(buildRoot, { recursive: true, force: true });
await saveState({
  gates: {},
  commands: [],
  startedAt: new Date().toISOString(),
  skipped: [],
});

const commands = [];
const projectFindings = [];
for (const [label, command] of [
  ["project-install", manifest.installCommand || "npm ci --no-fund"],
  ["project-tests", manifest.testCommand],
  ["project-headless", manifest.headlessCommand],
  ["project-build", manifest.buildCommand],
]) {
  if (!command) {
    const state = await loadState();
    state.skipped.push({
      check: label,
      reason: "Příkaz není pro tento projekt definován.",
    });
    await saveState(state);
    continue;
  }
  const result = await runCommand(command, label);
  commands.push(result);
  if (result.code !== 0) {
    projectFindings.push(
      finding(
        "project",
        "BLOCKER",
        "COMMAND_FAILED",
        `${label} selhal: ${command}`,
        result.log,
      ),
    );
  }
}

const auditCommand = manifest.auditCommand || "npm audit --audit-level=high";
if (auditCommand) {
  const audit = await runCommand(auditCommand, "project-audit");
  commands.push(audit);
  if (audit.code !== 0) {
    const logText = await readFile(path.join(ROOT, audit.log), "utf8");
    if (
      /endpoint returned an error|Bad Gateway|Failed to fetch audit report|requires an existing lockfile|ECONNRESET|ENETUNREACH|EAI_AGAIN/i.test(
        logText,
      )
    ) {
      const state = await loadState();
      state.skipped.push({
        check: "project-audit",
        reason:
          "npm audit endpoint nebyl dostupný; log je zachován a audit musí být zopakován v GitHub Actions.",
      });
      await saveState(state);
    } else {
      projectFindings.push(
        finding(
          "project",
          "MAJOR",
          "AUDIT_FAILED",
          `project-audit selhal: ${auditCommand}`,
          audit.log,
        ),
      );
    }
  }
}
await saveGate(gateResult("project", projectFindings, { commands }));

for (const gate of REQUIRED_GATES) {
  const script = `qa-${gate}.mjs`;
  const result = await runCommand(`node scripts/${script}`, `qa-${gate}`);
  commands.push(result);
  const state = await loadState();
  const recorded = state.gates?.[gate];
  if (!recorded) {
    await saveGate(
      gateResult(gate, [
        finding(
          gate,
          "BLOCKER",
          "QA_GATE_NO_RESULT",
          `Brána ${gate} nevytvořila nový výsledek. Proces skončil kódem ${result.code}.`,
          result.log,
        ),
      ]),
    );
  } else if (result.code !== 0 && recorded.status !== "FAIL") {
    await saveGate(
      gateResult(
        gate,
        [
          ...(recorded.findings || []),
          finding(
            gate,
            "BLOCKER",
            "QA_GATE_PROCESS_FAILED",
            `Brána ${gate} skončila kódem ${result.code}, přestože její uložený stav nebyl FAIL.`,
            result.log,
          ),
        ],
        recorded.details || {},
      ),
    );
  }
}

let state = await loadState();
state.commands = commands;
state.finishedAt = new Date().toISOString();
await saveState(state);

const reportRun = await runCommand("node scripts/qa-report.mjs", "qa-report");
if (reportRun.code !== 0) {
  console.error("GHRAB QA REPORT FAILED");
  process.exit(1);
}
const verdict = (
  await readFile(path.join(OUT_DIR, "release-verdict.txt"), "utf8")
).trim();
console.log(`GHRAB QA RELEASE VERDICT: ${verdict}`);
process.exit(verdict === "NOT_READY" ? 1 : 0);

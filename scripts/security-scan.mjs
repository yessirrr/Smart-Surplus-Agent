#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PATTERNS = [
  { name: "sk-", regex: /sk-[A-Za-z0-9_-]{12,}/g },
  { name: "BEGIN PRIVATE KEY", regex: /BEGIN PRIVATE KEY/g },
  { name: "API_KEY", regex: /API_KEY/g },
  { name: "SECRET", regex: /SECRET/g },
  { name: "TOKEN", regex: /TOKEN/g },
];

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  ".env.example",
  "scripts/security-scan.mjs",
]);

function listTrackedFiles() {
  const output = execSync("git ls-files", { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !EXCLUDED_FILES.has(path));
}

function scan() {
  const findings = [];
  const files = listTrackedFiles();

  for (const relPath of files) {
    const absPath = join(process.cwd(), relPath);
    const content = readFileSync(absPath, "utf8");

    PATTERNS.forEach((pattern) => {
      const matches = content.match(pattern.regex);
      if (!matches || matches.length === 0) {
        return;
      }

      const unique = [...new Set(matches)];
      unique.forEach((match) => {
        findings.push({ file: relPath, pattern: pattern.name, match });
      });
    });
  }

  if (findings.length === 0) {
    process.stdout.write("Secret scan passed.\n");
    return;
  }

  process.stderr.write("Secret scan failed. Potential sensitive markers found:\n");
  findings.forEach((finding) => {
    process.stderr.write(
      `- ${finding.file}: matched ${finding.pattern} (${finding.match})\n`
    );
  });

  process.exit(1);
}

scan();

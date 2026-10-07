import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ignored = new Set([
  ".git", "node_modules", ".next", "coverage", "dist", "secrets", "certs", "runtime-data",
  ".terraform", ".planfiles", ".local", "local-inputs", "local_inputs", "localinputs",
]);
const allowed = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|tf|hcl|tfvars(?:\.example)?|md|css|html|sh)$/i;
const ignoredArtifact = /(?:\.tfstate(?:\..*)?|\.(?:tfplan|plan)(?:\.json)?|(?:\.auto)?\.tfvars(?:\.(?:local|json))?)$/i;
const rules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["openai-style-token", /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ["personal-absolute-path", /\/Users\/[^/\s]+\//],
];

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    if (entry.name.startsWith(".env") && entry.name !== ".env.example") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (entry.isFile() && !ignoredArtifact.test(entry.name) && allowed.test(entry.name)) files.push(absolute);
  }
  return files;
}

const files = await walk(root);
let findings = 0;
for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const [name, pattern] of rules) {
    if (pattern.test(contents)) {
      findings += 1;
      console.error(`${path.relative(root, file)}: ${name} detected; value omitted`);
    }
  }
}
if (findings > 0) process.exitCode = 1;
else console.log(`secret-scan: scanned ${files.length} files; 0 findings`);

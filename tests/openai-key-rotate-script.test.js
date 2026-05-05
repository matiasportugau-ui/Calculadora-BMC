import fs from "node:fs";

function assert(name, condition, actual, expected) {
  if (!condition) {
    console.error(`✗ ${name}`);
    console.error("  actual:  ", actual);
    console.error("  expected:", expected);
    process.exit(1);
  }
  console.log(`✓ ${name}`);
}

const script = fs.readFileSync("scripts/openai-key-rotate.sh", "utf8");

assert(
  "Cloud Run rotation updates only OPENAI_API_KEY secret",
  script.includes("--update-secrets=OPENAI_API_KEY="),
  "missing --update-secrets=OPENAI_API_KEY",
  "uses --update-secrets for additive secret changes"
);

assert(
  "Cloud Run rotation does not replace all service secrets",
  !script.includes("--set-secrets=OPENAI_API_KEY="),
  "found destructive --set-secrets=OPENAI_API_KEY",
  "must not use --set-secrets for one-key rotation"
);


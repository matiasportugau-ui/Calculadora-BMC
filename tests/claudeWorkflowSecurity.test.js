import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const interactiveWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/claude.yml"),
  "utf8",
);
const reviewWorkflow = fs.readFileSync(
  path.join(repoRoot, ".github/workflows/claude-code-review.yml"),
  "utf8",
);

const trustedAssociations = ["OWNER", "MEMBER", "COLLABORATOR"];

function assertTrustedAssociationGate(workflow, contextPath) {
  for (const association of trustedAssociations) {
    assert.match(
      workflow,
      new RegExp(`${contextPath.replaceAll(".", "\\.")} == '${association}'`),
      `${contextPath} must allow trusted ${association} actors`,
    );
  }
}

function assertNoNonWriteBypass(workflow, workflowName) {
  assert.doesNotMatch(
    workflow,
    /allowed_non_write_users\s*:/,
    `${workflowName} must not bypass claude-code-action write-access checks`,
  );
}

assertNoNonWriteBypass(interactiveWorkflow, "claude.yml");
assertNoNonWriteBypass(reviewWorkflow, "claude-code-review.yml");

assertTrustedAssociationGate(interactiveWorkflow, "github.event.comment.author_association");
assertTrustedAssociationGate(interactiveWorkflow, "github.event.review.author_association");
assertTrustedAssociationGate(interactiveWorkflow, "github.event.issue.author_association");
assertTrustedAssociationGate(reviewWorkflow, "github.event.pull_request.author_association");

console.log("claude workflow security policy ok");

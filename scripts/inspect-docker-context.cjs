#!/usr/bin/env node
/**
 * BMC Docker Build Context Inspector (Finanzas-focused)
 *
 * This script simulates what files Docker would actually send to the daemon
 * when building with Dockerfile.bmc-dashboard, respecting .dockerignore rules.
 *
 * It does NOT require Docker to be running.
 *
 * Usage:
 *   node scripts/inspect-docker-context.js
 *
 * Output: Clear verdict on whether docs/bmc-dashboard-modernization/dashboard
 *         will be present inside the final image.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCKERIGNORE = path.join(REPO_ROOT, '.dockerignore');
const TARGET = 'docs/bmc-dashboard-modernization/dashboard';
const DASHBOARD_INDEX = path.join(REPO_ROOT, TARGET, 'index.html');

console.log('=== BMC Docker Context Inspector (Finanzas 404) ===\n');

// -----------------------------------------------------------------------------
// Very small but practical .dockerignore parser
// Supports: comments, negation (!), simple globs (*), and directory rules
// -----------------------------------------------------------------------------
function parseDockerignore(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const rules = [];

  for (const line of lines) {
    let negation = false;
    let pattern = line;

    if (pattern.startsWith('!')) {
      negation = true;
      pattern = pattern.slice(1);
    }

    // Normalize: remove leading ./ and trailing /
    pattern = pattern.replace(/^\.\//, '').replace(/\/$/, '');

    rules.push({ negation, pattern });
  }
  return rules;
}

// Improved matcher for current .dockerignore style (docs/* + targeted ! negations)
function matchesPattern(filePath, pattern) {
  const norm = filePath.replace(/\\/g, '/');

  if (norm === pattern) return true;

  // Handle docs/* style exclusion
  if (pattern === 'docs/*') {
    return norm.startsWith('docs/');
  }

  // Handle explicit negation targets like !docs/bmc-dashboard-modernization/dashboard
  if (norm === pattern || norm.startsWith(pattern + '/')) return true;

  // Wildcard at end
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    if (norm.startsWith(prefix)) return true;
  }

  return false;
}

function shouldInclude(filePath, rules) {
  let included = true;

  for (const rule of rules) {
    if (matchesPattern(filePath, rule.pattern)) {
      included = !rule.negation;
    }
  }
  return included;
}

// -----------------------------------------------------------------------------
// Walk the repo and check the critical path
// -----------------------------------------------------------------------------
console.log('Parsing .dockerignore...');
const rules = parseDockerignore(DOCKERIGNORE);
console.log(`Loaded ${rules.length} rules.\n`);

console.log('Checking whether the Finanzas dashboard files would be included in a Docker build context...\n');

const criticalFiles = [
  path.join(TARGET, 'index.html'),
  path.join(TARGET, 'app.js'),
  path.join(TARGET, 'styles.css'),
];

let allIncluded = true;
const results = [];

for (const rel of criticalFiles) {
  const full = path.join(REPO_ROOT, rel);
  const exists = fs.existsSync(full);
  const wouldBeIncluded = exists && shouldInclude(rel, rules);

  results.push({ rel, exists, wouldBeIncluded });

  const status = wouldBeIncluded
    ? '✅ INCLUDED'
    : exists
      ? '❌ EXCLUDED by .dockerignore'
      : '❌ MISSING ON DISK';

  console.log(`${status.padEnd(28)} ${rel}`);

  if (!wouldBeIncluded) allIncluded = false;
}

console.log('\n' + '='.repeat(70));

if (allIncluded) {
  console.log('✅ VERDICT: All three dashboard files SHOULD be present in the image.');
  console.log('   If you are still seeing 404 in prod, the problem is almost certainly:');
  console.log('   - Old Cloud Run revision still serving traffic');
  console.log('   - You need to force a new revision with the current source');
} else {
  console.log('❌ VERDICT: At least one dashboard file will be MISSING from the Docker image.');
  console.log('');
  console.log('This is the root cause of:');
  console.log('   {"ok":false,"error":"Not found","path":"/finanzas"}');
  console.log('');
  console.log('The fragile negation rules in .dockerignore are dropping the folder.');
  console.log('Fix is in Phase 2A of the plan (simplify the .dockerignore block).');
}

console.log('\n' + '='.repeat(70));
console.log('Next: Run the real Docker repro for final confirmation:');
console.log('   ./scripts/repro-finanzas-404.sh');
console.log('\nThen paste BOTH outputs (this one + the .sh log) back to the agent.');

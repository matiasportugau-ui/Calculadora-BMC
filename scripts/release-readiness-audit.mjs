#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const strictMode = args.has('--strict');
const noFetch = args.has('--no-fetch');

function runGit(gitArgs, { allowFail = false } = {}) {
  try {
    return execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFail) {
      return '';
    }
    throw error;
  }
}

function lines(text) {
  return text ? text.split('\n').map((line) => line.trimEnd()).filter(Boolean) : [];
}

function parseAheadBehind(raw) {
  const [behind = '0', ahead = '0'] = raw.trim().split(/\s+/);
  return {
    ahead: Number(ahead) || 0,
    behind: Number(behind) || 0,
  };
}

function parseGitHubRepo(originUrl) {
  const httpsMatch = originUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  const sshMatch = originUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  return null;
}

async function fetchPullRequests(owner, repo, state) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=8`;
  const response = await fetch(url, { headers: { 'User-Agent': 'calculadora-bmc-release-audit' } });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    updatedAt: String(pr.updated_at || '').slice(0, 10),
    head: pr.head?.ref || 'unknown',
    base: pr.base?.ref || 'unknown',
    state: pr.state || state,
  }));
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printList(items, emptyText = '(none)') {
  if (!items.length) {
    console.log(emptyText);
    return;
  }
  for (const item of items) console.log(item);
}

async function main() {
  runGit(['rev-parse', '--is-inside-work-tree']);

  if (!noFetch) {
    runGit(['fetch', '--all', '--prune', '--quiet'], { allowFail: true });
  }

  const now = new Date().toISOString();
  const repoRoot = runGit(['rev-parse', '--show-toplevel']);
  const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const originUrl = runGit(['remote', 'get-url', 'origin'], { allowFail: true });
  const statusShortBranch = runGit(['status', '--short', '--branch'], { allowFail: true });
  const statusPorcelain = lines(runGit(['status', '--porcelain=v1'], { allowFail: true }));
  const aheadBehindRaw = runGit(['rev-list', '--left-right', '--count', 'origin/main...HEAD'], { allowFail: true });
  const aheadBehind = aheadBehindRaw ? parseAheadBehind(aheadBehindRaw) : { ahead: 0, behind: 0 };

  const localOnlyMain = lines(runGit(['log', '--oneline', '--decorate', 'origin/main..HEAD'], { allowFail: true })).slice(0, 20);
  const remoteOnlyMain = lines(runGit(['log', '--oneline', '--decorate', 'HEAD..origin/main'], { allowFail: true })).slice(0, 20);
  const stashList = lines(runGit(['stash', 'list'], { allowFail: true }));
  const unmergedBranches = lines(runGit(['branch', '--no-merged', 'main'], { allowFail: true }))
    .map((line) => line.replace(/^[* ]+/, ''))
    .filter(Boolean)
    .slice(0, 30);

  const branches = lines(runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { allowFail: true }));
  const branchDivergence = [];
  for (const branch of branches) {
    const raw = runGit(['rev-list', '--left-right', '--count', `origin/main...${branch}`], { allowFail: true });
    if (!raw) continue;
    const delta = parseAheadBehind(raw);
    if (delta.ahead || delta.behind) {
      branchDivergence.push({ branch, ...delta });
    }
  }
  branchDivergence.sort((a, b) => b.ahead - a.ahead || a.behind - b.behind);

  const blockers = [];
  if (currentBranch !== 'main') blockers.push(`Current branch is "${currentBranch}" (not main).`);
  if (statusPorcelain.length > 0) blockers.push(`Working tree has ${statusPorcelain.length} uncommitted change(s).`);
  if (aheadBehind.behind > 0) blockers.push(`Local branch is behind origin/main by ${aheadBehind.behind} commit(s).`);
  if (currentBranch === 'main' && aheadBehind.ahead > 0) blockers.push(`Local main has ${aheadBehind.ahead} commit(s) not in origin/main.`);

  const risk = blockers.length ? 'HIGH' : (stashList.length || unmergedBranches.length ? 'MEDIUM' : 'LOW');

  console.log('Release Readiness Audit');
  console.log(`Generated: ${now}`);
  console.log(`Repo: ${repoRoot}`);
  console.log(`Risk: ${risk}`);

  printSection('Current Branch & Status');
  console.log(`branch: ${currentBranch}`);
  console.log(statusShortBranch || '(clean)');

  printSection('Main Divergence (origin/main...HEAD)');
  console.log(`ahead: ${aheadBehind.ahead} | behind: ${aheadBehind.behind}`);

  printSection('Blockers');
  printList(blockers, '(no hard blockers detected)');

  printSection('Local-only commits vs origin/main');
  printList(localOnlyMain, '(none)');

  printSection('Remote-only commits missing locally');
  printList(remoteOnlyMain, '(none)');

  printSection('Top branch divergence vs origin/main');
  printList(
    branchDivergence.slice(0, 20).map((entry) => `${entry.branch} | ahead:${entry.ahead} behind:${entry.behind}`),
    '(none)',
  );

  printSection('Unmerged local branches (top 30)');
  printList(unmergedBranches, '(none)');

  printSection('Stash entries (top 20)');
  printList(stashList.slice(0, 20), '(none)');

  const ghRepo = originUrl ? parseGitHubRepo(originUrl) : null;
  if (ghRepo) {
    const [openPrs, closedPrs] = await Promise.all([
      fetchPullRequests(ghRepo.owner, ghRepo.repo, 'open'),
      fetchPullRequests(ghRepo.owner, ghRepo.repo, 'closed'),
    ]);

    printSection('Latest Open PRs');
    printList(
      openPrs.map((pr) => `#${pr.number} | ${pr.updatedAt} | ${pr.head} -> ${pr.base} | ${pr.title}`),
      '(none or unavailable)',
    );

    printSection('Latest Closed PRs');
    printList(
      closedPrs.map((pr) => `#${pr.number} | ${pr.updatedAt} | ${pr.head} -> ${pr.base} | ${pr.title}`),
      '(none or unavailable)',
    );
  } else {
    printSection('Latest PRs');
    console.log('Origin is not a GitHub URL; PR fetch skipped.');
  }

  printSection('Recommended Safe Sequence');
  console.log('1. Create rescue branch from current state and push it.');
  console.log('2. Create integration branch from fresh origin/main.');
  console.log('3. Integrate only verified branches/PRs in small batches.');
  console.log('4. Run npm run gate:local:full after each batch.');
  console.log('5. Run npm run smoke:prod before final merge/deploy.');

  if (strictMode && blockers.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('release-readiness-audit failed:', error.message);
  process.exitCode = 1;
});

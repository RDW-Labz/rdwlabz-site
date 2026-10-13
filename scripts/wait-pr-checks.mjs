// Waits for a PR's checks (e.g. the Cloudflare Pages preview) to finish before auto-merge.
// Usage: node scripts/wait-pr-checks.mjs <pr-or-branch> [failed-names-file]   (needs gh + GH_TOKEN/GH_REPO)
// Exit 0 = no check failed (merge). Exit 1 = a check failed; names go to the file, if given.
// Only the "fail" bucket blocks. Cancelled runs (superseded by a force-push) and checks still
// pending at the deadline don't: they say nothing about whether the change is broken.
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = { timeoutMs: 10 * 60_000, graceMs: 2 * 60_000, intervalMs: 20_000 };

/**
 * @param {{
 *   list: () => Promise<{ name: string, bucket: string }[]>,
 *   now?: () => number,
 *   sleep?: (ms: number) => Promise<void>,
 *   log?: (msg: string) => void,
 *   timeoutMs?: number,
 *   graceMs?: number,
 *   intervalMs?: number,
 * }} opts `list` returns the current checks on the PR head
 * @returns {Promise<{ result: 'pass' | 'fail' | 'none' | 'timeout', failed: string[], pending: string[] }>}
 *   `fail` also covers never being able to read the checks at all.
 */
export async function waitForChecks({
  list,
  now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = () => {},
  timeoutMs = DEFAULTS.timeoutMs,
  graceMs = DEFAULTS.graceMs,
  intervalMs = DEFAULTS.intervalMs,
}) {
  const start = now();
  let readOnce = false;
  let lastError = '';
  for (;;) {
    let checks = [];
    try {
      checks = await list();
      readOnce = true;
    } catch (err) {
      lastError = err.message;
      log(`checks lookup failed, retrying: ${lastError}`);
    }
    const names = (b) => checks.filter((c) => c.bucket === b).map((c) => c.name);
    const failed = names('fail');
    const pending = names('pending');
    if (failed.length) return { result: 'fail', failed, pending };
    // Integrations like Cloudflare Pages register their check a little after the push.
    if (checks.length && !pending.length) return { result: 'pass', failed, pending };
    const waited = now() - start;
    if (!checks.length && waited >= graceMs) {
      // Never reading the checks is not the same as "there are none".
      if (!readOnce)
        return { result: 'fail', failed: [`checks unreadable: ${lastError}`], pending };
      return { result: 'none', failed, pending };
    }
    if (waited >= timeoutMs) return { result: 'timeout', failed, pending };
    log(checks.length ? `waiting for: ${pending.join(', ')}` : 'no checks reported yet');
    await sleep(intervalMs);
  }
}

/** `gh pr checks --json` exits 8 while checks are pending and 1 when none exist yet. */
function ghChecks(pr) {
  return new Promise((resolve, reject) => {
    execFile('gh', ['pr', 'checks', pr, '--json', 'name,bucket'], (err, stdout, stderr) => {
      if (/no checks reported/i.test(stderr)) return resolve([]);
      if (stdout.trim().startsWith('[')) return resolve(JSON.parse(stdout));
      reject(new Error((stderr || err?.message || 'no output').trim()));
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const pr = process.argv[2];
  if (!pr) {
    console.error('usage: node scripts/wait-pr-checks.mjs <pr-or-branch> [failed-names-file]');
    process.exit(2);
  }
  const log = (m) => console.error(`[checks] ${m}`);
  const r = await waitForChecks({ list: () => ghChecks(pr), log });
  if (r.result === 'timeout') {
    console.log(
      `::warning::Checks still pending after 10 min, merging anyway: ${r.pending.join(', ')}`,
    );
  }
  log(`result: ${r.result}`);
  if (r.result === 'fail') {
    log(`failed: ${r.failed.join(', ')}`);
    if (process.argv[3]) writeFileSync(process.argv[3], r.failed.join(', '));
    process.exit(1);
  }
}

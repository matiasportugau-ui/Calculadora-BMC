/**
 * Exact Chrome --user-data-dir profile matching.
 *
 * Prefix match on PROFILE=/…/chrome-wa-profile incorrectly hits
 * /…/chrome-wa-profile-personal-1 (documented sibling layout).
 */

/** ERE for pgrep/pkill -f (macOS + GNU). */
export function profileProcPattern(profileDir) {
  const dir = String(profileDir || "");
  return `user-data-dir=${dir}( |$)`;
}

/**
 * True when cmdline binds exactly this user-data-dir (space or end after path).
 * @param {string} cmdline
 * @param {string} profileDir
 */
export function cmdlineMatchesProfile(cmdline, profileDir) {
  const dir = String(profileDir || "");
  if (!dir) return false;
  const needle = `user-data-dir=${dir}`;
  const text = String(cmdline || "");
  let from = 0;
  while (from <= text.length) {
    const idx = text.indexOf(needle, from);
    if (idx < 0) return false;
    const after = text.slice(idx + needle.length);
    if (after.length === 0 || after[0] === " " || after[0] === "\t") return true;
    from = idx + 1;
  }
  return false;
}

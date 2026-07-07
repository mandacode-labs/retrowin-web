/**
 * Generates a Windows-XP-style unique folder name within a list of existing names.
 *
 * XP behavior:
 * - If "New Folder" is unused → use "New Folder"
 * - Otherwise use the smallest unused "New Folder (N)" for N >= 2
 *
 * Comparison is case-insensitive (Windows file systems are case-insensitive).
 */
export function uniqueFolderName(existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));

  if (!taken.has("new folder")) {
    return "New Folder";
  }

  let n = 2;
  while (taken.has(`new folder (${n})`)) {
    n += 1;
  }
  return `New Folder (${n})`;
}
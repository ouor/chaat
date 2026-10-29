// Local-time formatting shared by the live room, the archive viewer and the CSV export.

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" in local time. */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

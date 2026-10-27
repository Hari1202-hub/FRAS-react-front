/** Daily aggregates contain punches stored on this date, not a linked overnight shift. */
export function formatDailyPunch(reportDate: string, time: string | null): string {
  if (!time) return "—";
  const [year, month, day] = reportDate.split("-");
  return `${day}/${month}/${year} ${time.substring(0, 5)}`;
}

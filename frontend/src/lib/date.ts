/** Ports app.js's localISO(): YYYY-MM-DD in the browser's LOCAL timezone (toISOString() is UTC, which shifts the date for anyone ahead of UTC). */
export function localISO(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

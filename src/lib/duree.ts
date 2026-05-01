/** Formate un nombre de minutes en chaîne lisible. Ex : 90 → "1h30" */
export function formatDuree(minutes: number): string {
  if (minutes <= 0) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/** Minutes écoulées depuis un timestamp ISO (arrondi à la minute). */
export function getElapsedMinutes(startedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60_000))
}

/** Durée réelle entre deux timestamps ISO, en minutes. */
export function getDureeReelle(startedAt: string, finishedAt: string): number {
  return Math.max(0, Math.round(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60_000
  ))
}

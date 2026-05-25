/** Palette de couleurs distinctives pour identifier les chantiers visuellement */
export const CHANTIER_PALETTE: Array<{ bg: string; text: string; border: string; color: string }> = [
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    color: '#60a5fa' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', color: '#34d399' },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  color: '#c084fc' },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    color: '#fb7185' },
  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  color: '#818cf8' },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    color: '#2dd4bf' },
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200',    color: '#22d3ee' },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    color: '#f472b6' },
  { bg: 'bg-lime-50',    text: 'text-lime-700',    border: 'border-lime-200',    color: '#a3e635' },
  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     color: '#38bdf8' },
]

/** Retourne la couleur associée à un chantier par son index dans la liste */
export function getChantierColorByIndex(index: number) {
  return CHANTIER_PALETTE[Math.max(0, index) % CHANTIER_PALETTE.length]
}

/** Retourne la couleur associée à un chantier par son id dans une liste d'ids */
export function getChantierColor(chantierId: string, chantierIds: string[]) {
  const idx = chantierIds.indexOf(chantierId)
  return getChantierColorByIndex(idx < 0 ? 0 : idx)
}

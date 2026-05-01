import { AnomalieGravite } from '@/types'

const config: Record<AnomalieGravite, { label: string; classes: string }> = {
  haute:   { label: 'Haute',   classes: 'bg-red-100 text-red-700' },
  moyenne: { label: 'Moyenne', classes: 'bg-orange-100 text-orange-700' },
  basse:   { label: 'Basse',   classes: 'bg-yellow-100 text-yellow-700' },
}

export default function GraviteBadge({ gravite }: { gravite: AnomalieGravite }) {
  const { label, classes } = config[gravite]
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${classes}`}>
      {label}
    </span>
  )
}

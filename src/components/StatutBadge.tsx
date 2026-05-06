import { ChantierStatut } from '@/types'

const config: Record<ChantierStatut, { label: string; classes: string }> = {
  planifie:   { label: 'Planifié',    classes: 'bg-purple-100 text-purple-700' },
  en_attente: { label: 'En attente',  classes: 'bg-gray-100 text-gray-600' },
  en_cours:   { label: 'En cours',    classes: 'bg-blue-100 text-blue-700' },
  termine:    { label: 'Terminé',     classes: 'bg-green-100 text-green-700' },
  bloque:     { label: 'Bloqué',      classes: 'bg-red-100 text-red-700' },
}

export default function StatutBadge({ statut }: { statut: ChantierStatut }) {
  const { label, classes } = config[statut]
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${classes}`}>
      {label}
    </span>
  )
}

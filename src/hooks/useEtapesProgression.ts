import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Progression {
  chantier_id: string
  total: number
  faites: number
  pct: number
  /** Nom de l'étape en cours, ou de la prochaine étape non_fait. Null si tout est terminé. */
  etapeActive: string | null
}

export function useEtapesProgression(chantierIds: string[]) {
  const [progression, setProgression] = useState<Record<string, Progression>>({})

  useEffect(() => {
    if (chantierIds.length === 0) return

    supabase
      .from('etapes')
      .select('chantier_id, statut, nom, ordre')
      .in('chantier_id', chantierIds)
      .then(({ data }) => {
        if (!data) return

        const groups: Record<string, typeof data> = {}
        for (const e of data) {
          if (!groups[e.chantier_id]) groups[e.chantier_id] = []
          groups[e.chantier_id].push(e)
        }

        const result: Record<string, Progression> = {}
        for (const id of Object.keys(groups)) {
          const etapes = groups[id]
          const total  = etapes.length
          const faites = etapes.filter(e => e.statut === 'fait').length
          const pct    = total === 0 ? 0 : Math.round((faites / total) * 100)

          const enCours = etapes.find(e => e.statut === 'en_cours')
          const prochaine = etapes
            .filter(e => e.statut === 'non_fait')
            .sort((a, b) => a.ordre - b.ordre)[0]

          result[id] = {
            chantier_id: id,
            total,
            faites,
            pct,
            etapeActive: enCours?.nom ?? prochaine?.nom ?? null,
          }
        }

        setProgression(result)
      })
  }, [chantierIds.join(',')])

  return progression
}

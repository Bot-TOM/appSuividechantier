import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Progression {
  chantier_id: string
  total: number
  faites: number
  pct: number
}

// Récupère la progression (% étapes faites) pour une liste de chantiers en une seule requête
export function useEtapesProgression(chantierIds: string[]) {
  const [progression, setProgression] = useState<Record<string, Progression>>({})

  useEffect(() => {
    if (chantierIds.length === 0) return

    supabase
      .from('etapes')
      .select('chantier_id, statut')
      .in('chantier_id', chantierIds)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, Progression> = {}
        for (const e of data) {
          if (!map[e.chantier_id]) map[e.chantier_id] = { chantier_id: e.chantier_id, total: 0, faites: 0, pct: 0 }
          map[e.chantier_id].total++
          if (e.statut === 'fait') map[e.chantier_id].faites++
        }
        for (const id of Object.keys(map)) {
          const p = map[id]
          p.pct = p.total === 0 ? 0 : Math.round((p.faites / p.total) * 100)
        }
        setProgression(map)
      })
  }, [chantierIds.join(',')])

  return progression
}

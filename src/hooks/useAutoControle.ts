import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { AutoControle, AutoControleCheck } from '@/types'

export const CHECKS_DEFAUT: Omit<AutoControleCheck, 'checked' | 'commentaire'>[] = [
  // Électrique
  { id: 'elec_tension',     categorie: 'Électrique',           label: 'Tension DC / AC conforme' },
  { id: 'elec_continuite',  categorie: 'Électrique',           label: 'Continuité des câbles vérifiée' },
  { id: 'elec_terre',       categorie: 'Électrique',           label: 'Mise à la terre réalisée' },
  { id: 'elec_protection',  categorie: 'Électrique',           label: 'Disjoncteurs / protections OK' },
  // Structure
  { id: 'struct_fixations', categorie: 'Structure',            label: 'Fixations panneaux serrées' },
  { id: 'struct_rails',     categorie: 'Structure',            label: 'Rails / structure solide' },
  { id: 'struct_etanche',   categorie: 'Structure',            label: 'Étanchéité toiture vérifiée' },
  { id: 'struct_panneaux',  categorie: 'Structure',            label: 'Panneaux sans dommages visibles' },
  // Câblage
  { id: 'cable_fixe',       categorie: 'Câblage',              label: 'Câblage propre et fixé' },
  { id: 'cable_mc4',        categorie: 'Câblage',              label: 'Connecteurs MC4 bien clipsés' },
  { id: 'cable_reperage',   categorie: 'Câblage',              label: 'Repérage / étiquetage effectué' },
  { id: 'cable_uv',         categorie: 'Câblage',              label: 'Protection UV câbles OK' },
  // Mise en service
  { id: 'mes_onduleur',     categorie: 'Mise en service',      label: 'Onduleur démarré et configuré' },
  { id: 'mes_production',   categorie: 'Mise en service',      label: 'Production vérifiée' },
  { id: 'mes_client',       categorie: 'Mise en service',      label: 'Client informé et formé' },
  { id: 'mes_docs',         categorie: 'Mise en service',      label: 'Documents remis au client' },
]

export function initChecks(): AutoControleCheck[] {
  return CHECKS_DEFAUT.map(c => ({ ...c, checked: false, commentaire: '' }))
}

export function useAutoControle(chantierId: string) {
  const [autocontrole, setAutocontrole] = useState<AutoControle | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from('autocontrole')
      .select('*')
      .eq('chantier_id', chantierId)
      .maybeSingle()
    setAutocontrole(data)
    setLoading(false)
  }, [chantierId])

  useEffect(() => { fetch() }, [fetch])

  async function save(checks: AutoControleCheck[], commentaire: string, technicienId: string) {
    if (autocontrole) {
      await supabase
        .from('autocontrole')
        .update({ checks, commentaire, updated_at: new Date().toISOString() })
        .eq('id', autocontrole.id)
    } else {
      await supabase
        .from('autocontrole')
        .insert({ chantier_id: chantierId, technicien_id: technicienId, checks, commentaire })
    }
    await fetch()
  }

  async function signer(checks: AutoControleCheck[], commentaire: string, technicienId: string) {
    const now = new Date().toISOString()
    if (autocontrole) {
      await supabase
        .from('autocontrole')
        .update({ checks, commentaire, signe_le: now, updated_at: now })
        .eq('id', autocontrole.id)
    } else {
      await supabase
        .from('autocontrole')
        .insert({ chantier_id: chantierId, technicien_id: technicienId, checks, commentaire, signe_le: now })
    }
    await fetch()
  }

  return { autocontrole, loading, save, signer, refetch: fetch }
}

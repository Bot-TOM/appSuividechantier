import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface BugReport {
  id: string
  user_id: string | null
  entreprise_id: string | null
  page_url: string | null
  description: string
  severite: 'mineur' | 'bloquant'
  statut: 'ouvert' | 'en_cours' | 'resolu'
  created_at: string
  profiles?: { full_name?: string; email?: string } | null
  entreprises?: { nom?: string } | null
}

const STATUT_CONFIG = {
  ouvert:   { label: 'Ouvert',   bg: 'bg-red-100',    text: 'text-red-700',    next: 'en_cours' },
  en_cours: { label: 'En cours', bg: 'bg-orange-100',  text: 'text-orange-700', next: 'resolu'   },
  resolu:   { label: 'Résolu',   bg: 'bg-green-100',   text: 'text-green-700',  next: 'ouvert'   },
}

export default function AdminBugReportsTab() {
  const [reports, setReports]     = useState<BugReport[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState<'tous' | 'ouvert' | 'en_cours' | 'resolu'>('tous')

  async function fetchReports() {
    const { data } = await supabase
      .from('bug_reports')
      .select('*, profiles(full_name, email), entreprises(nom)')
      .order('created_at', { ascending: false })
    setReports((data as BugReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [])

  async function updateStatut(id: string, statut: BugReport['statut']) {
    setReports(prev => prev.map(r => r.id === id ? { ...r, statut } : r))
    await supabase.from('bug_reports').update({ statut }).eq('id', id)
  }

  const filtered = filter === 'tous' ? reports : reports.filter(r => r.statut === filter)
  const nbOuverts = reports.filter(r => r.statut === 'ouvert').length
  const nbBloquants = reports.filter(r => r.severite === 'bloquant' && r.statut !== 'resolu').length

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Chargement…</div>
  )

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Signalements de bugs</h2>
          <p className="text-sm text-gray-500">
            {nbOuverts} ouvert{nbOuverts !== 1 ? 's' : ''}
            {nbBloquants > 0 && (
              <span className="ml-2 text-red-600 font-semibold">· {nbBloquants} bloquant{nbBloquants !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {([
          { value: 'tous',     label: `Tous (${reports.length})` },
          { value: 'ouvert',   label: `Ouverts (${reports.filter(r => r.statut === 'ouvert').length})` },
          { value: 'en_cours', label: `En cours (${reports.filter(r => r.statut === 'en_cours').length})` },
          { value: 'resolu',   label: `Résolus (${reports.filter(r => r.statut === 'resolu').length})` },
        ] as const).map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-sm px-4 py-2 rounded-xl font-medium transition-all ${
              filter === f.value ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={filter === f.value ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          {filter === 'tous' ? '🎉 Aucun signalement pour l\'instant' : 'Aucun signalement dans cette catégorie'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const s = STATUT_CONFIG[r.statut]
            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl p-5 border-l-4 ${r.severite === 'bloquant' ? 'border-l-red-500' : 'border-l-yellow-400'}`}
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.severite === 'bloquant' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.severite === 'bloquant' ? '🔴 Bloquant' : '🟡 Mineur'}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>
                        {s.label}
                      </span>
                      {r.page_url && (
                        <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-lg">
                          {r.page_url}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-800 leading-relaxed">{r.description}</p>

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>
                        {r.profiles?.full_name ?? r.profiles?.email ?? 'Utilisateur inconnu'}
                      </span>
                      {r.entreprises?.nom && (
                        <>
                          <span>·</span>
                          <span className="text-orange-500 font-medium">{r.entreprises.nom}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>
                        {new Date(r.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Action statut */}
                  <button
                    onClick={() => updateStatut(r.id, s.next as BugReport['statut'])}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors hover:opacity-80 ${s.bg} ${s.text}`}
                  >
                    {r.statut === 'ouvert' ? 'Prendre en charge →' : r.statut === 'en_cours' ? 'Marquer résolu ✓' : 'Rouvrir'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

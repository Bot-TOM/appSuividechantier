import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAnomalies } from '@/hooks/useAnomalies'
import GraviteBadge from '@/components/anomalies/GraviteBadge'
import { AnomalieGravite, AnomalieStatut, isManagerRole } from '@/types'

const TYPES_ANOMALIE = ['Électrique', 'Structure', 'Étanchéité', 'Matériel défectueux', 'Câblage', 'Autre']

const STATUT_CONFIG: Record<AnomalieStatut, { label: string; next: AnomalieStatut; dot: string; bg: string }> = {
  ouvert:   { label: 'Ouvert',   next: 'en_cours', dot: 'bg-red-500',    bg: 'bg-red-50 text-red-700' },
  en_cours: { label: 'En cours', next: 'resolu',   dot: 'bg-orange-500', bg: 'bg-orange-50 text-orange-700' },
  resolu:   { label: 'Résolu',   next: 'ouvert',   dot: 'bg-green-500',  bg: 'bg-green-50 text-green-700' },
}

type FilterStatut = AnomalieStatut | 'tous'

type AnomalieWithProfile = {
  id: string
  chantier_id: string
  technicien_id: string
  type: string
  description: string
  gravite: AnomalieGravite
  statut: AnomalieStatut
  photo_url?: string
  created_at: string
  updated_at: string
  resolved_at?: string | null
  profiles?: { full_name?: string } | null
}

export default function AnomaliesChantier() {
  const { id: chantierId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { anomalies, loading, updateStatut, updateStatutBulk, deleteAnomalies } = useAnomalies(chantierId)

  const [showForm, setShowForm]         = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('tous')

  const [selectMode, setSelectMode]   = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [form, setForm] = useState({
    type: TYPES_ANOMALIE[0],
    description: '',
    gravite: 'haute' as AnomalieGravite,
  })

  const isManager = isManagerRole(profile?.role)

  // ── Filtrage ────────────────────────────────────────────────────────────────
  const anomaliesFiltrees = (filterStatut === 'tous'
    ? anomalies
    : anomalies.filter(a => a.statut === filterStatut)
  ) as AnomalieWithProfile[]

  const counts = {
    tous:     anomalies.length,
    ouvert:   anomalies.filter(a => a.statut === 'ouvert').length,
    en_cours: anomalies.filter(a => a.statut === 'en_cours').length,
    resolu:   anomalies.filter(a => a.statut === 'resolu').length,
  }

  // ── Sélection ───────────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()) }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === anomaliesFiltrees.length
      ? new Set()
      : new Set(anomaliesFiltrees.map(a => a.id))
    )
  }
  async function handleBulkStatut(statut: AnomalieStatut) {
    if (!selectedIds.size) return
    await updateStatutBulk(Array.from(selectedIds), statut)
    exitSelectMode()
  }
  async function handleBulkDelete() {
    if (!selectedIds.size) return
    await deleteAnomalies(Array.from(selectedIds))
    exitSelectMode()
  }

  // ── Photo ───────────────────────────────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  // ── Soumission ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.description.trim() || !profile || !chantierId) return
    setSubmitting(true)

    let photo_url: string | undefined
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${chantierId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('anomalies').upload(path, photoFile)
      if (!error) {
        const { data } = supabase.storage.from('anomalies').getPublicUrl(path)
        photo_url = data.publicUrl
      }
    }

    await supabase.from('anomalies').insert({
      chantier_id:  chantierId,
      technicien_id: profile.id,
      type:         form.type,
      description:  form.description.trim(),
      gravite:      form.gravite,
      statut:       'ouvert',
      photo_url,
    })

    setForm({ type: TYPES_ANOMALIE[0], description: '', gravite: 'haute' })
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowForm(false)
    setSubmitting(false)
  }

  const ouvertes = counts.ouvert + counts.en_cours

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Lightbox photo ───────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none">✕</button>
          <img
            src={lightboxUrl}
            alt="Anomalie"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl md:max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => selectMode ? exitSelectMode() : navigate(`/chantier/${chantierId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >←</button>

          <div className="flex-1 min-w-0">
            {selectMode ? (
              <div className="flex items-center gap-2">
                <button onClick={toggleSelectAll} className="text-sm font-semibold text-orange-600">
                  {selectedIds.size === anomaliesFiltrees.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <span className="text-xs text-gray-400">({selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''})</span>
              </div>
            ) : (
              <>
                <h1 className="text-lg font-bold text-gray-900">Anomalies</h1>
                {ouvertes > 0 && (
                  <p className="text-xs text-red-500 font-medium">{ouvertes} ouverte{ouvertes > 1 ? 's' : ''}</p>
                )}
              </>
            )}
          </div>

          {selectMode ? (
            <button onClick={exitSelectMode} className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors">
              Annuler
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {!showForm && anomalies.length > 0 && (
                <button onClick={() => setSelectMode(true)}
                  className="text-gray-500 text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  Sélectionner
                </button>
              )}
              {!showForm && (
                <button onClick={() => setShowForm(true)}
                  className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                  + Signaler
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filtres statut */}
        {!showForm && !selectMode && anomalies.length > 0 && (
          <div className="max-w-2xl md:max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            {([
              { value: 'tous',     label: 'Toutes',    count: counts.tous },
              { value: 'ouvert',   label: 'Ouvertes',  count: counts.ouvert },
              { value: 'en_cours', label: 'En cours',  count: counts.en_cours },
              { value: 'resolu',   label: 'Résolues',  count: counts.resolu },
            ] as { value: FilterStatut; label: string; count: number }[]).map(f => (
              <button key={f.value} onClick={() => setFilterStatut(f.value)}
                className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
                  filterStatut === f.value
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={filterStatut === f.value ? { background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)' } : undefined}
              >
                {f.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  filterStatut === f.value ? 'bg-white/30 text-white' : 'bg-white text-gray-500'
                }`}>{f.count}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-2xl md:max-w-5xl mx-auto px-4 py-5 space-y-4"
        style={{ paddingBottom: selectMode ? '8rem' : 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}>

        {/* ── Formulaire ─────────────────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Déclarer une anomalie</h2>
              <button onClick={() => { setShowForm(false); setPhotoFile(null); setPhotoPreview(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">×</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d'anomalie</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent">
                {TYPES_ANOMALIE.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gravité</label>
              <div className="grid grid-cols-3 gap-2">
                {(['haute', 'moyenne', 'basse'] as AnomalieGravite[]).map(g => (
                  <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gravite: g }))}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.gravite === g
                        ? g === 'haute'   ? 'bg-red-500 border-red-500 text-white shadow-sm'
                        : g === 'moyenne' ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                        :                  'bg-yellow-400 border-yellow-400 text-white shadow-sm'
                        : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                    }`}>
                    {g === 'haute' ? '🔴' : g === 'moyenne' ? '🟠' : '🟡'} {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez le problème en détail..." rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none" />
            </div>

            <div>
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={photoPreview} alt="Photo anomalie" className="w-full h-40 object-cover" />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/70 transition-colors">✕</button>
                </div>
              ) : (
                <label className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <input type="file" accept="image/*" className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none" tabIndex={-1} onChange={handlePhotoChange} />
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Ajouter une photo (optionnel)</span>
                </label>
              )}
            </div>

            <button onClick={handleSubmit} disabled={!form.description.trim() || submitting}
              className="w-full text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm"
              style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
              {submitting ? 'Envoi en cours...' : "⚠️ Signaler l'anomalie"}
            </button>
          </div>
        )}

        {/* ── Liste ──────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : anomalies.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div className="text-5xl mb-4">✅</div>
            <p className="font-semibold text-gray-700 mb-1">Aucune anomalie signalée</p>
            <p className="text-sm text-gray-400">Ce chantier ne présente aucun problème</p>
          </div>
        ) : anomaliesFiltrees.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p className="text-gray-400 text-sm">Aucune anomalie dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-3">
            {anomaliesFiltrees.map(anomalie => {
              const statut     = STATUT_CONFIG[anomalie.statut]
              const isSelected = selectedIds.has(anomalie.id)
              const techName   = anomalie.profiles?.full_name

              return (
                <div key={anomalie.id}
                  onClick={() => selectMode && toggleSelect(anomalie.id)}
                  className={`bg-white rounded-2xl overflow-hidden transition-all ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-red-400' : ''}`}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                >
                  {/* Photo cliquable → lightbox */}
                  {anomalie.photo_url && (
                    <div className="relative">
                      <img
                        src={anomalie.photo_url} alt="Anomalie"
                        className="w-full h-44 object-cover cursor-zoom-in"
                        onClick={e => { e.stopPropagation(); setLightboxUrl(anomalie.photo_url!) }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); setLightboxUrl(anomalie.photo_url!) }}
                        className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectMode && (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                            {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-gray-800">{anomalie.type}</span>
                        <GraviteBadge gravite={anomalie.gravite} />
                      </div>
                      {!selectMode && (
                        <button onClick={() => updateStatut(anomalie.id, statut.next)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-80 ${statut.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
                          {statut.label} →
                        </button>
                      )}
                    </div>

                    <p className="text-gray-700 text-sm leading-relaxed mb-3">{anomalie.description}</p>

                    {/* Métadonnées */}
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                      {techName && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {techName}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(anomalie.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {anomalie.resolved_at && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Résolue le {new Date(anomalie.resolved_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Barre d'actions sélection ─────────────────────────────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 py-4"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <p className="text-xs text-gray-400 text-center mb-3 font-medium">
            {selectedIds.size} anomalie{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2 max-w-2xl md:max-w-5xl mx-auto">
            <button onClick={() => handleBulkStatut('en_cours')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">En cours</button>
            <button onClick={() => handleBulkStatut('resolu')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">Résoudre</button>
            <button onClick={() => handleBulkStatut('ouvert')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">Rouvrir</button>
            {isManager && (
              <button onClick={handleBulkDelete} className="py-3 px-4 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

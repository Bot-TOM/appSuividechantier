import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAnomalies } from '@/hooks/useAnomalies'
import GraviteBadge from '@/components/anomalies/GraviteBadge'
import { AnomalieGravite, AnomalieStatut } from '@/types'

const TYPES_ANOMALIE = ['Électrique', 'Structure', 'Étanchéité', 'Matériel défectueux', 'Câblage', 'Autre']

const STATUT_CONFIG: Record<AnomalieStatut, { label: string; next: AnomalieStatut; dot: string; bg: string }> = {
  ouvert:   { label: 'Ouvert',   next: 'en_cours', dot: 'bg-red-500',    bg: 'bg-red-50 text-red-700' },
  en_cours: { label: 'En cours', next: 'resolu',   dot: 'bg-orange-500', bg: 'bg-orange-50 text-orange-700' },
  resolu:   { label: 'Résolu',   next: 'ouvert',   dot: 'bg-green-500',  bg: 'bg-green-50 text-green-700' },
}

export default function AnomaliesChantier() {
  const { id: chantierId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { anomalies, loading, updateStatut } = useAnomalies(chantierId)

  const [showForm, setShowForm]       = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    type: TYPES_ANOMALIE[0],
    description: '',
    gravite: 'haute' as AnomalieGravite,
  })

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

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
      chantier_id: chantierId,
      technicien_id: profile.id,
      type: form.type,
      description: form.description.trim(),
      gravite: form.gravite,
      statut: 'ouvert',
      photo_url,
    })

    setForm({ type: TYPES_ANOMALIE[0], description: '', gravite: 'haute' })
    setPhotoFile(null)
    setPhotoPreview(null)
    setShowForm(false)
    setSubmitting(false)
  }

  const ouvertes = anomalies.filter(a => a.statut !== 'resolu').length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chantier/${chantierId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Anomalies</h1>
            {ouvertes > 0 && (
              <p className="text-xs text-red-500 font-medium">{ouvertes} ouverte{ouvertes > 1 ? 's' : ''}</p>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
            >
              + Signaler
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}>

        {/* ── Formulaire déclaration ────────────────────────────────────────── */}
        {showForm && (
          <div className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Déclarer une anomalie</h2>
              <button
                onClick={() => { setShowForm(false); setPhotoFile(null); setPhotoPreview(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                ×
              </button>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d'anomalie</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              >
                {TYPES_ANOMALIE.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Gravité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gravité</label>
              <div className="grid grid-cols-3 gap-2">
                {(['haute', 'moyenne', 'basse'] as AnomalieGravite[]).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gravite: g }))}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.gravite === g
                        ? g === 'haute'   ? 'bg-red-500 border-red-500 text-white shadow-sm'
                        : g === 'moyenne' ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                        :                  'bg-yellow-400 border-yellow-400 text-white shadow-sm'
                        : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                    }`}
                  >
                    {g === 'haute' ? '🔴' : g === 'moyenne' ? '🟠' : '🟡'} {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez le problème en détail..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Photo */}
            <div>
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={photoPreview} alt="Photo anomalie" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/70 transition-colors"
                  >✕</button>
                </div>
              ) : (
                <label className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <input type="file" accept="image/*" multiple onChange={handlePhotoChange}
                    className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none" tabIndex={-1} />
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Ajouter une photo (optionnel)</span>
                </label>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.description.trim() || submitting}
              className="w-full text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm"
              style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
            >
              {submitting ? 'Envoi en cours...' : "⚠️ Signaler l'anomalie"}
            </button>
          </div>
        )}

        {/* ── Liste anomalies ───────────────────────────────────────────────── */}
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
        ) : (
          <div className="space-y-3">
            {anomalies.map(anomalie => {
              const statut = STATUT_CONFIG[anomalie.statut]
              return (
                <div key={anomalie.id} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {anomalie.photo_url && (
                    <div className="relative">
                      <img src={anomalie.photo_url} alt="Anomalie" className="w-full h-44 object-cover" />
                      <button
                        onClick={async () => {
                          const res  = await fetch(anomalie.photo_url!)
                          const blob = await res.blob()
                          const a    = document.createElement('a')
                          a.href     = URL.createObjectURL(blob)
                          a.download = `anomalie_${Date.now()}.jpg`
                          a.click()
                          URL.revokeObjectURL(a.href)
                        }}
                        className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                        title="Télécharger"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">{anomalie.type}</span>
                        <GraviteBadge gravite={anomalie.gravite} />
                      </div>
                      <button
                        onClick={() => updateStatut(anomalie.id, statut.next)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-80 ${statut.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
                        {statut.label} →
                      </button>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed">{anomalie.description}</p>
                    <p className="text-xs text-gray-400 mt-2.5">
                      {new Date(anomalie.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

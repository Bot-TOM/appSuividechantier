import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useAnomalies } from '@/hooks/useAnomalies'
import GraviteBadge from '@/components/anomalies/GraviteBadge'
import { AnomalieGravite, AnomalieStatut, isManagerRole } from '@/types'
import {
  AlignLeft,
  Camera,
  X,
  ChevronDown,
  User,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from 'lucide-react'

const TYPES_ANOMALIE = ['Électrique', 'Structure', 'Étanchéité', 'Matériel défectueux', 'Câblage', 'Autre']

const STATUT_CONFIG: Record<AnomalieStatut, { label: string; next: AnomalieStatut; dot: string; bg: string }> = {
  ouvert:   { label: 'Ouvert',   next: 'en_cours', dot: 'bg-red-500',    bg: 'bg-red-50 text-red-700' },
  en_cours: { label: 'En cours', next: 'resolu',   dot: 'bg-orange-500', bg: 'bg-orange-50 text-orange-700' },
  resolu:   { label: 'Résolu',   next: 'ouvert',   dot: 'bg-green-500',  bg: 'bg-green-50 text-green-700' },
}

export default function AnomaliesTabContent({ chantierId, canResolve = true }: { chantierId: string; canResolve?: boolean }) {
  const { profile } = useAuth()
  const { anomalies, loading, updateStatut, updateStatutBulk, deleteAnomalies } = useAnomalies(chantierId)

  const [showForm, setShowForm]         = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [photoFile, setPhotoFile]       = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectMode, setSelectMode]     = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [form, setForm] = useState({
    titre: '',
    type: TYPES_ANOMALIE[0],
    description: '',
    gravite: 'haute' as AnomalieGravite,
  })

  const isManager = isManagerRole(profile?.role)

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()) }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === anomalies.length ? new Set() : new Set(anomalies.map(a => a.id)))
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
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }
  function closeForm() {
    setShowForm(false)
    setPhotoFile(null)
    setPhotoPreview(null)
  }
  async function handleSubmit() {
    if (!form.description.trim() || !profile) return
    setSubmitting(true)
    let photo_url: string | undefined
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${chantierId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('anomalies').upload(path, photoFile)
      if (!error) photo_url = supabase.storage.from('anomalies').getPublicUrl(path).data.publicUrl
    }
    const fullDescription = form.titre.trim()
      ? `${form.titre.trim()}\n\n${form.description.trim()}`
      : form.description.trim()
    await supabase.from('anomalies').insert({
      chantier_id: chantierId, technicien_id: profile.id,
      type: form.type, description: fullDescription,
      gravite: form.gravite, statut: 'ouvert', photo_url,
    })
    setForm({ titre: '', type: TYPES_ANOMALIE[0], description: '', gravite: 'haute' })
    setPhotoFile(null); setPhotoPreview(null); setShowForm(false); setSubmitting(false)
  }

  const ouvertes = anomalies.filter(a => a.statut !== 'resolu').length

  return (
    <div style={{ paddingBottom: selectMode && selectedIds.size > 0 ? '8rem' : undefined }}>

      {/* ── En-tête (hors formulaire) ── */}
      {!showForm && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-slate-800 text-base tracking-tight">Anomalies</h2>
            {ouvertes > 0 && (
              <p className="text-xs text-rose-500 font-semibold mt-0.5">
                {ouvertes} ouverte{ouvertes > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button onClick={toggleSelectAll} className="text-xs font-semibold text-orange-600">
                  {selectedIds.size === anomalies.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                <button onClick={exitSelectMode}
                  className="text-xs font-semibold text-slate-500 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                  Annuler
                </button>
              </>
            ) : (
              <>
                {anomalies.length > 0 && (
                  <button onClick={() => setSelectMode(true)}
                    className="text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                    Sélectionner
                  </button>
                )}
                <button onClick={() => setShowForm(true)}
                  className="flex items-center space-x-1.5 text-white text-xs font-bold px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Signaler</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Formulaire Ticket Style ── */}
      {showForm && (
        <>
          <div className="flex items-center justify-between mb-4 ml-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Nouvelle anomalie</h2>
              <span className="bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded text-xs font-bold font-mono">DRAFT</span>
            </div>
            <button onClick={closeForm}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row mb-6">

            {/* Gauche : Titre + Description + Photo */}
            <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">

              <input
                type="text"
                placeholder="Titre court du problème..."
                value={form.titre}
                onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                className="w-full text-2xl font-bold text-slate-900 placeholder-slate-300 border-none focus:ring-0 px-0 py-2 bg-transparent"
              />

              <div className="mt-4 flex-1 flex flex-col">
                <div className="flex items-center space-x-2 text-slate-400 mb-2">
                  <AlignLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Description</span>
                </div>
                <textarea
                  placeholder="Décrivez en détail le problème rencontré sur le terrain. Plus il y a de détails, plus vite le problème sera résolu..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full flex-1 min-h-[160px] text-sm text-slate-700 placeholder-slate-300 border-none focus:ring-0 px-0 py-2 bg-transparent resize-none"
                />
              </div>

              <div className="mt-8">
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={photoPreview} alt="Photo anomalie" className="w-full h-44 object-cover" />
                    <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/70 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full border-2 border-dashed border-slate-200 hover:border-orange-300 bg-slate-50/50 hover:bg-orange-50/30 rounded-xl p-6 flex flex-col items-center justify-center transition-colors group cursor-pointer">
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:text-orange-500 text-slate-400 transition-colors">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-orange-700">Cliquez pour ajouter des photos</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG jusqu'à 10MB</span>
                  </label>
                )}
              </div>
            </div>

            {/* Droite : Propriétés */}
            <div className="w-full md:w-[280px] bg-[#F8FAFC]/50 p-6 flex flex-col justify-between">
              <div className="space-y-6">

                {/* Catégorie */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Catégorie</span>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-3 py-2.5 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all cursor-pointer shadow-sm"
                    >
                      {TYPES_ANOMALIE.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Gravité */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Niveau de gravité</span>
                  <div className="flex flex-col space-y-2">
                    {([
                      { val: 'haute'   as AnomalieGravite, label: 'Haute priorité', activeClass: 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm',    dotClass: 'bg-rose-500 animate-pulse' },
                      { val: 'moyenne' as AnomalieGravite, label: 'Moyenne',         activeClass: 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm',  dotClass: 'bg-amber-500' },
                      { val: 'basse'   as AnomalieGravite, label: 'Basse (Mineur)',  activeClass: 'bg-slate-100 border-slate-300 text-slate-700 shadow-sm', dotClass: 'bg-slate-500' },
                    ]).map(g => (
                      <button
                        key={g.val}
                        onClick={() => setForm(f => ({ ...f, gravite: g.val }))}
                        className={`flex items-center space-x-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                          form.gravite === g.val
                            ? g.activeClass
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.gravite === g.val ? g.dotClass : 'bg-slate-300'}`} />
                        <span>{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Signalé par */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Signalé par</span>
                  <div className="flex items-center space-x-2 bg-white border border-slate-100 px-3 py-2 rounded-lg shadow-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{profile?.full_name ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 pt-6 border-t border-slate-200/60">
                <button
                  onClick={handleSubmit}
                  disabled={!form.description.trim() || submitting}
                  className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  <span>{submitting ? 'Envoi en cours...' : 'Créer le ticket'}</span>
                </button>
                <button
                  onClick={closeForm}
                  className="w-full mt-2 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Liste anomalies ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : anomalies.length === 0 ? (
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center ${showForm ? 'opacity-70' : ''}`}>
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-3" />
          <p className="text-sm font-semibold text-slate-600">Aucune anomalie signalée</p>
          <p className="text-xs text-slate-400 mt-1">Ce chantier ne présente aucun problème</p>
        </div>
      ) : (
        <>
          {showForm && (
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 ml-1">Anomalies précédentes</h3>
          )}
          <div className="space-y-3">
            {anomalies.map(anomalie => {
              const statut     = STATUT_CONFIG[anomalie.statut]
              const isSelected = selectedIds.has(anomalie.id)
              return (
                <div
                  key={anomalie.id}
                  onClick={() => selectMode && toggleSelect(anomalie.id)}
                  className={`bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-rose-400' : ''}`}
                >
                  {anomalie.photo_url && (
                    <div className="relative">
                      <img src={anomalie.photo_url} alt="Anomalie" className="w-full h-44 object-cover" />
                      {!selectMode && (
                        <a href={anomalie.photo_url} target="_blank" rel="noreferrer"
                          className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectMode && (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-300'}`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-slate-800">{anomalie.type}</span>
                        <GraviteBadge gravite={anomalie.gravite} />
                      </div>
                      {!selectMode && (canResolve || statut.next !== 'resolu') && (
                        <button onClick={() => updateStatut(anomalie.id, statut.next)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-80 ${statut.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
                          {statut.label} →
                        </button>
                      )}
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">{anomalie.description}</p>
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <p className="text-xs text-slate-400">
                        Signalée le {new Date(anomalie.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {anomalie.resolved_at && (
                        <p className="text-xs text-emerald-600 font-medium">
                          ✓ Résolue le {new Date(anomalie.resolved_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Barre bulk actions ── */}
      {selectMode && selectedIds.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-100 px-4 py-4"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <p className="text-xs text-slate-400 text-center mb-3 font-medium">
            {selectedIds.size} anomalie{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </p>
          <div className="flex gap-2 max-w-2xl mx-auto">
            <button onClick={() => handleBulkStatut('en_cours')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">En cours</button>
            {canResolve && (
              <button onClick={() => handleBulkStatut('resolu')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">Résoudre</button>
            )}
            <button onClick={() => handleBulkStatut('ouvert')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors">Rouvrir</button>
            {isManager && (
              <button onClick={handleBulkDelete} className="py-3 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

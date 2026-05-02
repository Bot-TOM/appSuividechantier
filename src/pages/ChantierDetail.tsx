import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useChantierDetail } from '@/hooks/useChantierDetail'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useChantierTechniciens } from '@/hooks/useChantierTechniciens'
import { useChecklistMateriel } from '@/hooks/useChecklistMateriel'
import { useAutoControle } from '@/hooks/useAutoControle'
import { formatDuree, getElapsedMinutes, getDureeReelle } from '@/lib/duree'
import { ChantierStatut, Etape, EtapePhoto, Note } from '@/types'

type InnerTab = 'etapes' | 'notes' | 'infos'

// ─── Sélecteur statut chantier ────────────────────────────────────────────────
const STATUTS_CHANTIER: { value: ChantierStatut; label: string; dot: string; bg: string }[] = [
  { value: 'en_attente', label: 'En attente', dot: 'bg-gray-400',  bg: 'bg-gray-50 text-gray-700 border-gray-200' },
  { value: 'en_cours',   label: 'En cours',   dot: 'bg-blue-500',  bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'bloque',     label: 'Bloqué',     dot: 'bg-red-500',   bg: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'termine',    label: 'Terminé',    dot: 'bg-green-500', bg: 'bg-green-50 text-green-700 border-green-200' },
]

function StatutSelector({ current, onChange }: { current: ChantierStatut; onChange: (s: ChantierStatut) => void }) {
  const [open, setOpen] = useState(false)
  const selected = STATUTS_CHANTIER.find(s => s.value === current)!
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${selected.bg}`}
      >
        <span className={`w-2 h-2 rounded-full ${selected.dot}`} />
        {selected.label}
        <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-11 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden min-w-40">
          {STATUTS_CHANTIER.map(s => (
            <button key={s.value}
              onClick={() => { onChange(s.value); setOpen(false) }}
              className={`w-full text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 flex items-center gap-2.5 transition-colors ${s.value === current ? 'bg-gray-50' : ''}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Timer en cours ───────────────────────────────────────────────────────────
function ElapsedBadge({ startedAt }: { startedAt: string }) {
  const [minutes, setMinutes] = useState(() => getElapsedMinutes(startedAt))
  useEffect(() => {
    const id = setInterval(() => setMinutes(getElapsedMinutes(startedAt)), 60_000)
    return () => clearInterval(id)
  }, [startedAt])
  return <span className="text-xs font-semibold text-orange-500 tabular-nums">⏱ {formatDuree(minutes)}</span>
}

// ─── Lightbox photos ──────────────────────────────────────────────────────────
function Lightbox({ photos, initialIndex, onClose, onDelete }: {
  photos: EtapePhoto[]
  initialIndex: number
  onClose: () => void
  onDelete?: (photo: EtapePhoto) => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/60 text-sm">{index + 1} / {photos.length}</span>
        <div className="flex items-center gap-3">
          {onDelete && (
            <button
              onClick={() => { onDelete(photo); if (photos.length === 1) onClose() }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg">
            ✕
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4" onClick={e => e.stopPropagation()}>
        <img src={photo.url} alt="Photo" className="max-w-full max-h-full rounded-xl object-contain" />
      </div>

      {/* Navigation */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-3 py-5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            disabled={index === 0}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors"
          >←</button>
          <div className="flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white scale-125' : 'bg-white/40'}`} />
            ))}
          </div>
          <button
            onClick={() => setIndex(i => Math.min(photos.length - 1, i + 1))}
            disabled={index === photos.length - 1}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors"
          >→</button>
        </div>
      )}
    </div>
  )
}

// ─── Ligne d'étape ────────────────────────────────────────────────────────────
function EtapeLine({
  etape, photos, onAdvance, isManager = false, onUpdateConsigne, onUploadPhoto, onDeletePhoto,
}: {
  etape: Etape
  photos: EtapePhoto[]
  onAdvance: (e: Etape) => void
  isManager?: boolean
  onUpdateConsigne?: (etapeId: string, consigne: string) => void
  onUploadPhoto?: (etapeId: string, file: File) => Promise<{ error: string | null }>
  onDeletePhoto?: (photo: EtapePhoto) => void
}) {
  const [consigneValue, setConsigneValue] = useState(etape.consigne ?? '')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => { setConsigneValue(etape.consigne ?? '') }, [etape.consigne])

  const isFait    = etape.statut === 'fait'
  const isEnCours = etape.statut === 'en_cours'
  const dureeReelle = isFait && etape.started_at && etape.finished_at
    ? getDureeReelle(etape.started_at, etape.finished_at) : null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !onUploadPhoto) return
    setUploading(true)
    setUploadError('')
    for (const file of files) {
      const { error } = await onUploadPhoto(etape.id, file)
      if (error) { setUploadError(error); break }
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <>
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          {/* Bouton statut */}
          <button onClick={() => onAdvance(etape)} className="flex-shrink-0 mt-0.5 active:scale-90 transition-transform">
            {isFait ? (
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : isEnCours ? (
              <div className="w-7 h-7 rounded-full border-2 border-orange-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-gray-200" />
            )}
          </button>

          {/* Contenu */}
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-semibold leading-snug block ${isFait ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {etape.nom}
            </span>
            {isManager && !isFait && (
              <input
                value={consigneValue}
                onChange={e => setConsigneValue(e.target.value)}
                onBlur={() => onUpdateConsigne?.(etape.id, consigneValue)}
                onKeyDown={e => { if (e.key === 'Enter') onUpdateConsigne?.(etape.id, consigneValue) }}
                placeholder="Consigne ou durée estimée…"
                className="mt-1.5 w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-600 placeholder-gray-300 bg-gray-50"
              />
            )}
            {!isManager && etape.consigne && !isFait && (
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{etape.consigne}</p>
            )}
            {isEnCours && etape.started_at && (
              <span className="block mt-1"><ElapsedBadge startedAt={etape.started_at} /></span>
            )}
            {isFait && dureeReelle !== null && (
              <span className="text-xs text-green-500 font-medium mt-0.5 block">✓ {formatDuree(dureeReelle)}</span>
            )}
          </div>

          {/* Droite : état + bouton photo */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`text-[11px] font-semibold ${isEnCours ? 'text-orange-400' : 'text-gray-300'}`}>
              {isEnCours ? 'Terminer →' : isFait ? '↺' : 'Démarrer'}
            </span>
            <label className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              uploading ? 'opacity-40 pointer-events-none' : 'text-gray-300 hover:text-orange-400 hover:bg-orange-50 active:bg-orange-100'
            }`} title="Ajouter une photo">
              <input type="file" accept="image/*" multiple onChange={handleFileChange}
                className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none" tabIndex={-1} />
              {uploading
                ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
              }
            </label>
          </div>
        </div>

        {uploadError && <p className="mt-1.5 ml-10 text-xs text-red-500">{uploadError}</p>}

        {/* Galerie photos */}
        {photos.length > 0 && (
          <div className="mt-3 ml-10 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {photos.map((photo, i) => (
              <button key={photo.id} onClick={() => setLightboxIndex(i)} className="flex-shrink-0">
                <img
                  src={photo.url}
                  alt={`Photo ${i + 1}`}
                  className="h-20 w-20 rounded-xl object-cover border border-gray-100 hover:opacity-90 active:opacity-75 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={onDeletePhoto}
        />
      )}
    </>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ChantierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { chantier, etapes, notes, photos, loading, updateStatut, advanceEtape, updateConsigne, addNote, uploadEtapePhoto, deleteEtapePhoto } = useChantierDetail(id!)
  const { anomalies }   = useAnomalies(id!)
  const { techniciens } = useChantierTechniciens(id!)
  const { total: matTotal, checked: matChecked } = useChecklistMateriel(id!)
  const { autocontrole } = useAutoControle(id!)

  const [activeTab, setActiveTab]     = useState<InnerTab>('etapes')
  const [noteText, setNoteText]       = useState('')
  const [savingNote, setSavingNote]   = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [pdfError, setPdfError]       = useState('')

  const isManager         = profile?.role === 'manager'
  const anomaliesOuvertes = anomalies.filter(a => a.statut !== 'resolu').length
  const faites            = etapes.filter(e => e.statut === 'fait').length
  const pct               = etapes.length === 0 ? 0 : Math.round((faites / etapes.length) * 100)
  const terminees         = etapes.filter(e => e.statut === 'fait' && e.started_at && e.finished_at)
  const totalTemps        = terminees.reduce((s, e) => s + getDureeReelle(e.started_at!, e.finished_at!), 0)

  async function handleDownloadPDF() {
    if (!chantier) return
    setGeneratingPDF(true)
    setPdfError('')

    // Ouvrir la fenêtre MAINTENANT (tick synchrone) pour éviter le blocage mobile
    const win = window.open('', '_blank')
    if (win) {
      win.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#6b7280">Génération du PDF…</body></html>')
    }

    try {
      const [{ pdf }, { default: ChantierPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/ChantierPDF'),
      ])
      const blob = await pdf(
        <ChantierPDF chantier={chantier} etapes={etapes} photos={photos} notes={notes as never} anomalies={anomalies as never} />
      ).toBlob()
      const url = URL.createObjectURL(blob)

      if (win && !win.closed) {
        win.location.href = url
      } else {
        // Fallback : navigation dans l'onglet courant
        window.location.href = url
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      if (win && !win.closed) win.close()
      setPdfError(`Erreur PDF : ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGeneratingPDF(false)
    }
  }

  async function handleAddNote() {
    if (!noteText.trim() || !profile) return
    setSavingNote(true)
    await addNote(noteText.trim(), profile.id)
    setNoteText('')
    setSavingNote(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!chantier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <p className="text-gray-500 font-medium">Chantier introuvable</p>
        </div>
      </div>
    )
  }

  const isGradient = !isManager

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="px-4 pt-5 pb-3 sticky top-0 z-20"
        style={isGradient
          ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }
          : { background: '#ffffff', borderBottom: '1px solid #f3f4f6' }
        }
      >
        <div className="max-w-2xl mx-auto">
          {/* Ligne titre */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <button
                onClick={() => navigate(isManager ? '/manager' : '/technicien')}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-lg transition-colors mt-0.5 ${
                  isGradient ? 'text-white/80 hover:bg-white/20' : 'text-gray-400 hover:bg-gray-100'
                }`}
              >←</button>
              <div className="min-w-0">
                <p className={`text-xs font-medium mb-0.5 truncate ${isGradient ? 'text-orange-200' : 'text-gray-400'}`}>
                  {chantier.client_nom}
                </p>
                <h1 className={`font-bold text-lg leading-tight truncate ${isGradient ? 'text-white' : 'text-gray-900'}`}>
                  {chantier.nom}
                </h1>
                <p className={`text-xs mt-0.5 truncate ${isGradient ? 'text-orange-100/80' : 'text-gray-400'}`}>
                  {chantier.client_adresse}
                </p>
              </div>
            </div>

            {isManager
              ? <StatutSelector current={chantier.statut} onChange={updateStatut} />
              : (
                <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl flex-shrink-0 mt-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    chantier.statut === 'en_cours' ? 'bg-blue-300' :
                    chantier.statut === 'bloque'   ? 'bg-red-300' :
                    chantier.statut === 'termine'  ? 'bg-green-300' : 'bg-white/60'
                  }`} />
                  <span className="text-white text-xs font-semibold">
                    {STATUTS_CHANTIER.find(s => s.value === chantier.statut)?.label}
                  </span>
                </div>
              )
            }
          </div>

          {/* Barre de progression dans le header */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className={isGradient ? 'text-orange-100/80' : 'text-gray-400'}>{faites}/{etapes.length} étapes</span>
              <span className={`font-bold ${isGradient ? 'text-white' : pct === 100 ? 'text-green-600' : 'text-orange-500'}`}>{pct}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${isGradient ? 'bg-white/20' : 'bg-gray-100'}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isGradient ? 'bg-white' : pct === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Onglets internes */}
          <div className="flex gap-0 -mb-3">
            {([
              { key: 'etapes', label: 'Étapes' },
              { key: 'notes',  label: 'Notes', badge: notes.length || undefined },
              { key: 'infos',  label: 'Infos' },
            ] as { key: InnerTab; label: string; badge?: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? isGradient
                      ? 'border-white text-white font-semibold'
                      : 'border-orange-500 text-orange-600 font-semibold'
                    : isGradient
                      ? 'border-transparent text-white/60 hover:text-white/80'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                    isGradient ? 'bg-white/30 text-white' : 'bg-orange-100 text-orange-600'
                  }`}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Actions rapides terrain (technicien) ─────────────────────────── */}
      {!isManager && activeTab === 'etapes' && (
        <div className="px-4 pt-3 pb-0 max-w-2xl mx-auto w-full">
          <div className="flex gap-2.5">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(chantier.client_adresse)}`}
              target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-white rounded-2xl py-3 text-gray-700 font-semibold text-sm active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            >
              <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Itinéraire
            </a>
            {chantier.client_telephone && (
              <a
                href={`tel:${chantier.client_telephone}`}
                className="flex-1 flex items-center justify-center gap-2 bg-white rounded-2xl py-3 text-gray-700 font-semibold text-sm active:scale-[0.98] transition-all"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              >
                <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Appeler
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Contenu onglets ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-3 pb-safe-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}>

        {/* ── ÉTAPES ────────────────────────────────────────────────────────── */}
        {activeTab === 'etapes' && (
          <>
            <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Checklist</h2>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> En cours
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Fait
                  </span>
                </div>
              </div>
              {etapes.length === 0
                ? <p className="text-center text-gray-400 text-sm py-10">Aucune étape définie</p>
                : <div className="divide-y divide-gray-50">
                    {etapes.map(etape => (
                      <EtapeLine
                        key={etape.id}
                        etape={etape}
                        photos={photos[etape.id] ?? []}
                        onAdvance={advanceEtape}
                        isManager={isManager}
                        onUpdateConsigne={updateConsigne}
                        onUploadPhoto={uploadEtapePhoto}
                        onDeletePhoto={p => deleteEtapePhoto(p.id, new URL(p.url).pathname.replace(/^\/storage\/v1\/object\/public\/chantier-photos\//, ''))}
                      />
                    ))}
                  </div>
              }
            </section>

            {/* Synthèse temps */}
            {terminees.length > 0 && (
              <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="px-4 py-3.5 border-b border-gray-50 flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900 text-sm">Temps enregistrés</h2>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{terminees.length}</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-orange-800">Total terrain</span>
                    <span className="text-lg font-bold text-orange-600 tabular-nums">{formatDuree(totalTemps)}</span>
                  </div>
                  <div className="space-y-2">
                    {terminees.map(e => (
                      <div key={e.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate flex-1 mr-3">{e.nom}</span>
                        <span className="text-gray-500 font-medium tabular-nums flex-shrink-0">
                          {formatDuree(getDureeReelle(e.started_at!, e.finished_at!))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ── NOTES ─────────────────────────────────────────────────────────── */}
        {activeTab === 'notes' && (
          <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="p-4 border-b border-gray-50 flex gap-2.5">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                placeholder="Ajouter une note..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim() || savingNote}
                className="text-white px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-40 text-lg"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >✓</button>
            </div>
            {notes.length === 0
              ? <p className="text-center text-gray-400 text-sm py-10">Aucune note pour l'instant</p>
              : <div className="divide-y divide-gray-50">
                  {(notes as (Note & { profiles?: { full_name: string } })[]).map(note => (
                    <div key={note.id} className="px-4 py-4">
                      <p className="text-gray-800 text-sm leading-relaxed">{note.contenu}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {note.profiles?.full_name} · {new Date(note.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
            }
          </section>
        )}

        {/* ── INFOS ─────────────────────────────────────────────────────────── */}
        {activeTab === 'infos' && (
          <>
            {/* Infos chantier */}
            <section className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h2 className="font-semibold text-gray-900 text-sm">Informations</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Panneaux', value: String(chantier.nb_panneaux) },
                  { label: 'Type', value: chantier.type_installation },
                  { label: 'Date prévue', value: new Date(chantier.date_prevue).toLocaleDateString('fr-FR') },
                  { label: 'Adresse', value: chantier.client_adresse },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Équipe */}
            {techniciens.length > 0 && (
              <section className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h2 className="font-semibold text-gray-900 text-sm mb-3">Équipe</h2>
                <div className="flex flex-wrap gap-2">
                  {techniciens.map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-full">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                        {t.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-orange-800 font-medium">{t.full_name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Matériel + Anomalies */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate(`/chantier/${id}/materiel`)}
                className="bg-white rounded-2xl p-4 text-left active:scale-[0.98] transition-all"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-800 text-sm">Matériel</p>
                <p className="text-xs text-gray-400 mt-0.5">{matChecked}/{matTotal} vérifié{matChecked > 1 ? 's' : ''}</p>
                {matTotal > 0 && (
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${matChecked === matTotal ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${Math.round((matChecked / matTotal) * 100)}%` }} />
                  </div>
                )}
              </button>

              <button
                onClick={() => navigate(`/chantier/${id}/anomalies`)}
                className="bg-white rounded-2xl p-4 text-left active:scale-[0.98] transition-all"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-800 text-sm">Anomalies</p>
                {anomaliesOuvertes > 0
                  ? <span className="text-xs font-semibold text-red-500 mt-0.5 block">{anomaliesOuvertes} ouverte{anomaliesOuvertes > 1 ? 's' : ''}</span>
                  : <span className="text-xs text-green-500 font-semibold mt-0.5 block">Tout OK</span>
                }
              </button>
            </div>

            {/* Auto-contrôle */}
            <button
              onClick={() => navigate(`/chantier/${id}/autocontrole`)}
              className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 text-left active:scale-[0.98] transition-all"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                autocontrole?.signe_le ? 'bg-green-50' : 'bg-orange-50'
              }`}>
                <svg className={`w-5 h-5 ${autocontrole?.signe_le ? 'text-green-500' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">Fiche auto-contrôle</p>
                <p className={`text-xs mt-0.5 ${autocontrole?.signe_le ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  {autocontrole?.signe_le
                    ? `Signée le ${new Date(autocontrole.signe_le).toLocaleDateString('fr-FR')}`
                    : autocontrole ? 'Brouillon en cours' : 'À compléter'
                  }
                </p>
              </div>
              <span className="text-gray-300 text-lg flex-shrink-0">→</span>
            </button>

            {/* Actions manager */}
            {isManager && (
              <button
                onClick={() => navigate(`/chantier/${id}/modifier`)}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-semibold py-4 rounded-2xl hover:bg-gray-50 transition-colors text-sm bg-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Modifier le chantier
              </button>
            )}

            {/* PDF */}
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              className="w-full flex items-center justify-center gap-3 text-white font-semibold py-4 rounded-2xl transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              {generatingPDF
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Génération...</>
                : <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Télécharger le rapport PDF
                  </>
              }
            </button>

            {pdfError && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl text-center">{pdfError}</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

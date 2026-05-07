import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useChantierDetail } from '@/hooks/useChantierDetail'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useChecklistMateriel } from '@/hooks/useChecklistMateriel'
import { useAutoControle, initChecks } from '@/hooks/useAutoControle'
import { useDocuments } from '@/hooks/useDocuments'
import { useRapports } from '@/hooks/useRapports'
import type { RapportPhoto } from '@/hooks/useRapports'
import { ChantierStatut, Etape, EtapePhoto, Note, AutoControleCheck } from '@/types'
import { PdfOptions, PDF_OPTIONS_DEFAULT } from '@/components/pdf/ChantierPDF'
import AnomaliesTabContent from '@/components/anomalies/AnomaliesTabContent'
import ChatTab from '@/components/chat/ChatTab'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { usePermissions } from '@/hooks/usePermissions'

type InnerTab = 'etapes' | 'rapport' | 'chat' | 'docs' | 'notes' | 'materiel' | 'anomalies' | 'autocontrole' | 'infos'

// ─── Sélecteur statut chantier ────────────────────────────────────────────────
const STATUTS_CHANTIER: { value: ChantierStatut; label: string; dot: string; bg: string }[] = [
  { value: 'planifie',   label: 'Planifié',   dot: 'bg-purple-400', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'en_attente', label: 'En attente', dot: 'bg-gray-400',   bg: 'bg-gray-50 text-gray-700 border-gray-200' },
  { value: 'en_cours',   label: 'En cours',   dot: 'bg-blue-500',   bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'bloque',     label: 'Bloqué',     dot: 'bg-red-500',    bg: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'termine',    label: 'Terminé',    dot: 'bg-green-500',  bg: 'bg-green-50 text-green-700 border-green-200' },
]

function StatutSelector({ current, onChange }: { current: ChantierStatut; onChange: (s: ChantierStatut) => void }) {
  const [open, setOpen] = useState(false)
  const selected = STATUTS_CHANTIER.find(s => s.value === current) ?? STATUTS_CHANTIER[0]
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

// ─── Lightbox photos ──────────────────────────────────────────────────────────
async function downloadPhoto(url: string) {
  const res  = await fetch(url)
  const blob = await res.blob()
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `photo_${Date.now()}.jpg`
  a.click()
  URL.revokeObjectURL(a.href)
}

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
          <button
            onClick={() => downloadPhoto(photo.url)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Télécharger"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
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

// ─── Lightbox rapport ─────────────────────────────────────────────────────────
function RapportLightbox({ photos, initialIndex, onClose, onDelete }: {
  photos: RapportPhoto[]
  initialIndex: number
  onClose: () => void
  onDelete?: (photo: RapportPhoto) => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const photo = photos[index]

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-white/60 text-sm">{index + 1} / {photos.length}</span>
        <div className="flex items-center gap-3">
          <button onClick={() => downloadPhoto(photo.url)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" title="Télécharger">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {onDelete && (
            <button onClick={() => { onDelete(photo); if (photos.length === 1) onClose() }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg">✕</button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4" onClick={e => e.stopPropagation()}>
        <img src={photo.url} alt="Photo" className="max-w-full max-h-full rounded-xl object-contain" />
      </div>
      {photos.length > 1 && (
        <div className="flex justify-center gap-3 py-5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors">←</button>
          <div className="flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === index ? 'bg-white scale-125' : 'bg-white/40'}`} />
            ))}
          </div>
          <button onClick={() => setIndex(i => Math.min(photos.length - 1, i + 1))} disabled={index === photos.length - 1}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors">→</button>
        </div>
      )}
    </div>
  )
}

// ─── Ligne d'étape ────────────────────────────────────────────────────────────
function EtapeLine({
  etape, photos, onAdvance, isManager = false, canValidate = true, onUpdateConsigne, onUploadPhoto, onDeletePhoto,
}: {
  etape: Etape
  photos: EtapePhoto[]
  onAdvance: (e: Etape) => void
  isManager?: boolean
  canValidate?: boolean
  onUpdateConsigne?: (etapeId: string, consigne: string) => void
  onUploadPhoto?: (etapeId: string, file: File) => Promise<{ error: string | null }>
  onDeletePhoto?: (photo: EtapePhoto) => void
}) {
  const [localStatut, setLocalStatut] = useState(etape.statut)
  const [consigneValue, setConsigneValue] = useState(etape.consigne ?? '')
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => { setLocalStatut(etape.statut) }, [etape.statut])
  useEffect(() => { setConsigneValue(etape.consigne ?? '') }, [etape.consigne])

  const isFait    = localStatut === 'fait'
  const isEnCours = localStatut === 'en_cours'

  function handleAdvance() {
    if (!canValidate) return
    const next = localStatut === 'non_fait' ? 'en_cours' : localStatut === 'en_cours' ? 'fait' : 'non_fait'
    setLocalStatut(next)
    onAdvance(etape)
  }

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
      <div className={`px-4 py-4 transition-colors ${isEnCours ? 'bg-orange-50' : ''}`}>
        <div className="flex items-start gap-3">
          {/* Bouton statut */}
          <button
            onClick={handleAdvance}
            disabled={!canValidate}
            className={`flex-shrink-0 mt-0.5 transition-transform ${canValidate ? 'active:scale-90' : 'opacity-40 cursor-not-allowed'}`}
          >
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
  const { profile, session } = useAuth()
  const { chantier, etapes, notes, photos, loading, updateStatut, advanceEtape, updateConsigne, addNote, deleteNote, uploadEtapePhoto, deleteEtapePhoto, deleteChantier } = useChantierDetail(id!)
  const { anomalies }   = useAnomalies(id!)
  const { items: matItems, total: matTotal, checked: matChecked, toggleItem: toggleMat, addItem: addMat, deleteItem: deleteMat } = useChecklistMateriel(id!)
  const { autocontrole, save: saveAC, signer: signerAC } = useAutoControle(id!)
  const { documents, uploadDocument, deleteDocument } = useDocuments(id!)
  const { rapports, addRapport, deleteRapport, deleteRapportPhoto } = useRapports(id!)
  const userId = profile?.id ?? ''
  const unreadChat = useUnreadMessages(id!, userId)

  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<InnerTab>(() => {
    const t = searchParams.get('tab')
    return (t && ['etapes','rapport','chat','docs','notes','materiel','anomalies','autocontrole','infos'].includes(t))
      ? t as InnerTab
      : 'etapes'
  })
  const [rapportLightbox, setRapportLightbox] = useState<{ photos: RapportPhoto[]; index: number } | null>(null)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadDocError, setUploadDocError] = useState('')

  const [newMatItem, setNewMatItem]         = useState('')
  const [importedItems, setImportedItems]   = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)

  const [acChecks, setAcChecks]           = useState<AutoControleCheck[]>(initChecks)
  const [acCommentaire, setAcCommentaire] = useState('')
  const [acSaving, setAcSaving]           = useState(false)
  const [acSigning, setAcSigning]         = useState(false)
  const [acExpandedId, setAcExpandedId]   = useState<string | null>(null)

  const [rapportMessage, setRapportMessage] = useState('')
  const [rapportPhotos, setRapportPhotos]   = useState<File[]>([])
  const [rapportPreviews, setRapportPreviews] = useState<string[]>([])
  const [submittingRapport, setSubmittingRapport] = useState(false)
  const [rapportError, setRapportError] = useState('')
  const [noteText, setNoteText]         = useState('')
  const [savingNote, setSavingNote]     = useState(false)
  const [generatingPDF, setGeneratingPDF]   = useState(false)
  const [pdfError, setPdfError]             = useState('')
  const [showPdfOptions, setShowPdfOptions] = useState(false)
  const [pdfOptions, setPdfOptions]         = useState<PdfOptions>(PDF_OPTIONS_DEFAULT)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [deleting, setDeleting]         = useState(false)

  useEffect(() => {
    if (autocontrole) {
      setAcChecks(autocontrole.checks)
      setAcCommentaire(autocontrole.commentaire ?? '')
    }
  }, [autocontrole])

  const isManager              = profile?.role === 'manager'
  const { can }                = usePermissions()
  const canValidateEtapes      = isManager || can('creer_chantier')
  const faites                 = etapes.filter(e => e.statut === 'fait').length
  const pct               = etapes.length === 0 ? 0 : Math.round((faites / etapes.length) * 100)

  async function handleDownloadPDF() {
    if (!chantier) return
    setShowPdfOptions(false)
    setGeneratingPDF(true)
    setPdfError('')

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
        <ChantierPDF
          chantier={chantier}
          etapes={etapes}
          photos={photos}
          notes={notes as never}
          anomalies={anomalies as never}
          matItems={matItems}
          acChecks={acChecks}
          acSigne={autocontrole?.signe_le}
          rapportsList={rapports}
          options={pdfOptions}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)

      if (win && !win.closed) {
        win.location.href = url
      } else {
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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Convertir le fichier en texte brut pour l'envoyer à l'API
    const { read, utils } = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = read(buf)
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = (utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][])
      .filter(r => r.some(cell => cell != null && String(cell).trim() !== ''))
    const MAX_CHARS = 20_000
    const full = rows.map(r => r.join('\t')).join('\n')
    const content = full.length > MAX_CHARS ? full.slice(0, MAX_CHARS) : full

    setImportedItems([])
    setShowImportModal(true) // ouvrir la modale avec état "chargement"

    try {
      const res  = await fetch('/api/extract-material', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error('API error', res.status, text)
        setImportedItems(['⚠️ Erreur ' + res.status + ' — ' + text.slice(0, 80)])
        return
      }
      const data = await res.json()
      if (data.error) {
        console.error('Parse error', data.raw)
        setImportedItems(['⚠️ Analyse impossible — réessaie ou vérifie le format du fichier'])
        return
      }
      const items: string[] = (data.items ?? []).map((i: { nom: string; qte?: string }) =>
        i.qte ? `${i.nom} — ${i.qte}` : i.nom
      )
      if (items.length === 0) {
        setImportedItems(['⚠️ Aucun matériel trouvé dans ce fichier'])
        return
      }
      setImportedItems(items)
    } catch (err) {
      console.error('fetch error', err)
      setImportedItems(['⚠️ Impossible de contacter le serveur'])
    }
  }

  async function handleConfirmImport() {
    for (const nom of importedItems) await addMat(nom)
    setShowImportModal(false)
    setImportedItems([])
  }

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImportedItems([])
    setShowImportModal(true)

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const [header, imageBase64] = dataUrl.split(',')
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'

      try {
        const res  = await fetch('/api/scan-material', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ imageBase64, mediaType }),
        })
        if (!res.ok) {
          setImportedItems(['⚠️ Erreur serveur — ' + res.status])
          return
        }
        const data = await res.json()
        const items: string[] = (data.items ?? []).map((i: { nom: string; qte?: string }) =>
          i.qte ? `${i.nom} — ${i.qte}` : i.nom
        )
        if (items.length === 0) { setShowImportModal(false); return }
        setImportedItems(items)
      } catch {
        setImportedItems(['⚠️ Impossible de contacter le serveur'])
      }
    }
    reader.readAsDataURL(file)
  }

  const acIsSigne = !!autocontrole?.signe_le
  const acCategories = [...new Set(acChecks.map(c => c.categorie))]
  const acTotalChecked = acChecks.filter(c => c.checked).length
  const acPct = Math.round((acTotalChecked / acChecks.length) * 100)

  function toggleAcCheck(id: string) {
    if (acIsSigne) return
    setAcChecks(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  async function handleAcSave() {
    if (!profile) return
    setAcSaving(true)
    await saveAC(acChecks, acCommentaire, profile.id)
    setAcSaving(false)
  }

  async function handleAcSigner() {
    if (!profile) return
    setAcSigning(true)
    await signerAC(acChecks, acCommentaire, profile.id)
    setAcSigning(false)
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length || !profile) return
    e.target.value = ''
    setUploadingDoc(true)
    setUploadDocError('')
    for (const file of files) {
      const { error } = await uploadDocument(file, profile.id)
      if (error) { setUploadDocError(error); break }
    }
    setUploadingDoc(false)
  }

  function handleRapportPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setRapportPhotos(prev => [...prev, ...files])
    setRapportPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removeRapportPhoto(index: number) {
    URL.revokeObjectURL(rapportPreviews[index])
    setRapportPhotos(prev => prev.filter((_, i) => i !== index))
    setRapportPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleRapportSubmit() {
    if (!rapportMessage.trim() || !profile) return
    setSubmittingRapport(true)
    setRapportError('')
    const { error } = await addRapport(rapportMessage, profile.id, rapportPhotos)
    if (error) { setRapportError(error); setSubmittingRapport(false); return }
    setRapportMessage('')
    rapportPreviews.forEach(URL.revokeObjectURL)
    setRapportPhotos([])
    setRapportPreviews([])
    setSubmittingRapport(false)
  }

  async function downloadRapportPhotos(photos: { url: string }[], rapportDate: string) {
    if (photos.length === 1) {
      window.open(photos[0].url, '_blank')
      return
    }
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    await Promise.all(photos.map(async (photo, i) => {
      const res  = await fetch(photo.url)
      const blob = await res.blob()
      const ext  = blob.type.split('/')[1] || 'jpg'
      zip.file(`photo_${i + 1}.${ext}`, blob)
    }))
    const content = await zip.generateAsync({ type: 'blob' })
    const date    = new Date(rapportDate).toLocaleDateString('fr-FR').replace(/\//g, '-')
    const a       = document.createElement('a')
    a.href        = URL.createObjectURL(content)
    a.download    = `rapport_${date}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleDeleteChantier() {
    setDeleting(true)
    const { error } = await deleteChantier()
    if (error) { setDeleting(false); setConfirmDelete(false); return }
    navigate('/manager')
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
        <div className="max-w-2xl md:max-w-5xl mx-auto">
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
              ? (
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  {can('modifier_chantier') && <StatutSelector current={chantier.statut} onChange={updateStatut} />}
                  {can('modifier_chantier') && (
                    <button
                      onClick={() => navigate(`/chantier/${id}/modifier`)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                      title="Modifier le chantier"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Supprimer le chantier"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
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
          <div className="flex gap-0 -mb-3 overflow-x-auto no-scrollbar">
            {([
              { key: 'etapes',      label: 'Étapes' },
              can('voir_rapports') ? { key: 'rapport', label: 'Rapport', badge: rapports.length || undefined } : null,
              { key: 'chat',        label: 'Chat',        badge: activeTab !== 'chat' && unreadChat > 0 ? unreadChat : undefined },
              { key: 'docs',        label: 'Docs',        badge: documents.length || undefined },
              { key: 'notes',       label: 'Notes',       badge: notes.length || undefined },
              { key: 'materiel',    label: 'Matériel',    badge: matTotal > 0 ? matChecked === matTotal ? undefined : matTotal - matChecked : undefined },
              { key: 'anomalies',   label: 'Anomalies',   badge: anomalies.filter(a => a.statut !== 'resolu').length || undefined },
              { key: 'autocontrole', label: 'Contrôle',   badge: acIsSigne ? undefined : acTotalChecked > 0 ? acTotalChecked : undefined },
              { key: 'infos',       label: 'Infos' },
            ].filter(Boolean) as { key: InnerTab; label: string; badge?: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
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
        <div className="px-4 pt-3 pb-0 max-w-2xl md:max-w-5xl mx-auto w-full">
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
      <main className="flex-1 max-w-2xl md:max-w-5xl mx-auto w-full px-4 py-4 space-y-3 pb-safe-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}>

        {/* ── ÉTAPES ────────────────────────────────────────────────────────── */}
        {activeTab === 'etapes' && (
          <>
            <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">Étapes</h2>
                <div className="flex items-center gap-2">
                  {etapes.filter(e => e.statut === 'en_cours').length > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
                      {etapes.filter(e => e.statut === 'en_cours').length} en cours
                    </span>
                  )}
                  <span className="text-xs text-gray-400 font-medium">{faites}/{etapes.length}</span>
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
                        canValidate={canValidateEtapes}
                        onUpdateConsigne={updateConsigne}
                        onUploadPhoto={uploadEtapePhoto}
                        onDeletePhoto={p => deleteEtapePhoto(p.id, new URL(p.url).pathname.replace(/^\/storage\/v1\/object\/public\/chantier-photos\//, ''))}
                      />
                    ))}
                  </div>
              }
            </section>

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
                    <div key={note.id} className="px-4 py-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 text-sm leading-relaxed">{note.contenu}</p>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {note.profiles?.full_name} · {new Date(note.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {(isManager || note.technicien_id === profile?.id) && (
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors mt-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
            }
          </section>
        )}

        {/* ── DOCS ──────────────────────────────────────────────────────────── */}
        {activeTab === 'docs' && (
          <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">
                Documents
                {documents.length > 0 && (
                  <span className="ml-2 text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full align-middle">{documents.length}</span>
                )}
              </h2>
              {can('ajouter_document') && (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-orange-100 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.xls,.xlsx"
                    multiple
                    onChange={handleDocUpload}
                    className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none"
                    tabIndex={-1}
                    disabled={uploadingDoc}
                  />
                  {uploadingDoc
                    ? <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                    : '+'
                  }
                  Ajouter
                </label>
              )}
            </div>
            {uploadDocError && <p className="px-4 py-2 text-xs text-red-500 bg-red-50">{uploadDocError}</p>}
            {documents.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">Aucun document ajouté</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {documents.map(doc => {
                  const ext = doc.nom.split('.').pop()?.toLowerCase() ?? ''
                  const isPdf    = ext === 'pdf'
                  const isExcel  = ['xls','xlsx'].includes(ext)
                  const iconColor = isPdf ? 'bg-red-50 text-red-400' : isExcel ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'
                  // PDFs : Google Docs Viewer pour ouverture directe sur tous les appareils (évite le téléchargement sur Android)
                  // Excel/autres : URL directe
                  const openUrl = isPdf
                    ? `https://docs.google.com/viewer?url=${encodeURIComponent(doc.url)}`
                    : doc.url
                  return (
                    <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.nom}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          {doc.taille != null && ` · ${doc.taille < 1024 * 1024 ? `${Math.round(doc.taille / 1024)} Ko` : `${(doc.taille / 1024 / 1024).toFixed(1)} Mo`}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={openUrl} target="_blank" rel="noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                          title="Ouvrir"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        {(isManager || doc.uploaded_by === profile?.id) && (
                          <button onClick={() => deleteDocument(doc)}
                            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ── MATÉRIEL ──────────────────────────────────────────────────────── */}
        {activeTab === 'materiel' && (
          <section className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">
                Checklist matériel
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle ${
                  matChecked === matTotal && matTotal > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>{matChecked}/{matTotal}</span>
              </h2>
              {matTotal > 0 && (
                <span className={`text-xs font-semibold ${matChecked === matTotal ? 'text-green-500' : 'text-orange-500'}`}>
                  {matChecked === matTotal ? 'Tout vérifié ✓' : `${matTotal - matChecked} restant${matTotal - matChecked > 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {matItems.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">Aucun élément dans la checklist</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {matItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      onClick={() => toggleMat(item.id, !item.checked)}
                      className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all active:scale-90"
                      style={item.checked ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', borderColor: 'transparent' } : { borderColor: '#d1d5db' }}
                    >
                      {item.checked && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                      {item.nom}
                    </span>
                    {isManager && (
                      <button
                        onClick={() => deleteMat(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-gray-50 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMatItem}
                    onChange={e => setNewMatItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newMatItem.trim() && (addMat(newMatItem), setNewMatItem(''))}
                    placeholder="Ajouter un élément…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 placeholder-gray-400"
                  />
                  <button
                    onClick={() => { if (newMatItem.trim()) { addMat(newMatItem); setNewMatItem('') } }}
                    disabled={!newMatItem.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                  >
                    + Ajouter
                  </button>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleImportFile}
                      className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none"
                      tabIndex={-1}
                    />
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importer
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleScanFile}
                      className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none"
                      tabIndex={-1}
                    />
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Scanner
                  </label>
                </div>
            </div>
          </section>
        )}

        {/* ── RAPPORT ───────────────────────────────────────────────────────── */}
        {activeTab === 'rapport' && (
          <>
            {/* Formulaire nouveau rapport */}
            <section className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h2 className="font-semibold text-gray-900 text-sm">Ajouter une entrée</h2>

              <textarea
                value={rapportMessage}
                onChange={e => setRapportMessage(e.target.value)}
                placeholder="Décrivez l'avancement, les observations, les problèmes rencontrés…"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
              />

              {/* Prévisualisation photos */}
              {rapportPreviews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {rapportPreviews.map((src, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img src={src} className="h-20 w-20 rounded-xl object-cover border border-gray-100" />
                      <button
                        type="button"
                        onClick={() => removeRapportPhoto(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input type="file" accept="image/*" multiple onChange={handleRapportPhotoChange}
                    className="absolute opacity-0 w-px h-px overflow-hidden pointer-events-none" tabIndex={-1} />
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Photos {rapportPhotos.length > 0 && <span className="text-orange-500 font-semibold">({rapportPhotos.length})</span>}
                </label>

                <button
                  onClick={handleRapportSubmit}
                  disabled={!rapportMessage.trim() || submittingRapport}
                  className="flex-1 text-white font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                >
                  {submittingRapport
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi…</>
                    : 'Publier'
                  }
                </button>
              </div>
              {rapportError && <p className="text-xs text-red-500">{rapportError}</p>}
            </section>

            {/* Liste des entrées */}
            {rapports.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <p className="text-gray-400 text-sm">Aucune entrée de rapport pour l'instant</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rapports.map(rapport => {
                  const photos = rapport.rapport_photos ?? []
                  return (
                    <div key={rapport.id} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-500">
                              {rapport.profiles?.full_name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(rapport.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {photos.length > 0 && (
                              <button
                                onClick={() => downloadRapportPhotos(photos, rapport.created_at)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
                                title={`Télécharger ${photos.length} photo${photos.length > 1 ? 's' : ''}`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {photos.length} photo{photos.length > 1 ? 's' : ''}
                              </button>
                            )}
                            {(isManager || rapport.auteur_id === profile?.id) && (
                              <button
                                onClick={() => deleteRapport(rapport)}
                                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{rapport.message}</p>

                        {photos.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {photos.map((photo, i) => (
                              <button
                                key={photo.id}
                                onClick={() => setRapportLightbox({ photos, index: i })}
                                className="relative flex-shrink-0 rounded-xl overflow-hidden border border-gray-100 active:opacity-75 transition-opacity"
                              >
                                <img
                                  src={photo.url}
                                  alt={`Photo ${i + 1}`}
                                  className="h-24 w-24 object-cover"
                                />
                                {photos.length > 1 && i === 0 && (
                                  <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                    {photos.length}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* PDF */}
            {can('exporter_pdf') && (
              <>
                <button
                  onClick={() => setShowPdfOptions(true)}
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
                        Générer le rapport PDF
                      </>
                  }
                </button>
                {pdfError && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl text-center">{pdfError}</div>}
              </>
            )}
          </>
        )}

        {/* ── CHAT — toujours monté, juste caché pour préserver le scroll ── */}
        {id && profile && (
          <div className={activeTab === 'chat' ? '' : 'hidden'}>
            <ChatTab chantierId={id} userId={profile.id} isActive={activeTab === 'chat'} />
          </div>
        )}

        {/* ── ANOMALIES ─────────────────────────────────────────────────────── */}
        {activeTab === 'anomalies' && id && (
          <section className="space-y-3">
            <AnomaliesTabContent chantierId={id} canResolve={can('resoudre_anomalie')} />
          </section>
        )}

        {/* ── AUTO-CONTRÔLE ────────────────────────────────────────────────── */}
        {activeTab === 'autocontrole' && (
          <>
            {/* Barre progression */}
            <section className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>{acTotalChecked}/{acChecks.length} points validés</span>
                <span className={`font-bold ${acPct === 100 ? 'text-green-600' : 'text-orange-500'}`}>{acPct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${acPct === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${acPct}%` }} />
              </div>
              {acIsSigne && (
                <p className="text-xs text-green-600 font-medium mt-2">
                  ✓ Signée le {new Date(autocontrole!.signe_le!).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </section>

            {/* Sections par catégorie */}
            {acCategories.map(categorie => {
              const items = acChecks.filter(c => c.categorie === categorie)
              const catChecked = items.filter(c => c.checked).length
              return (
                <section key={categorie} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 text-sm">{categorie}</h2>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      catChecked === items.length ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>{catChecked}/{items.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map(check => (
                      <div key={check.id}>
                        <div
                          className={`px-4 py-3.5 flex items-center gap-3 ${!acIsSigne ? 'cursor-pointer active:bg-gray-50' : ''}`}
                          onClick={() => toggleAcCheck(check.id)}
                        >
                          <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                            check.checked ? 'bg-orange-500' : 'border-2 border-gray-200'
                          }`}>
                            {check.checked && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`flex-1 text-sm ${check.checked ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                            {check.label}
                          </span>
                          {!acIsSigne && (
                            <button
                              onClick={e => { e.stopPropagation(); setAcExpandedId(acExpandedId === check.id ? null : check.id) }}
                              className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                                check.commentaire ? 'text-orange-400 bg-orange-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {(acExpandedId === check.id || (acIsSigne && check.commentaire)) && (
                          <div className="px-4 pb-3 pl-[52px]">
                            {acIsSigne
                              ? <p className="text-xs text-gray-500 italic">{check.commentaire}</p>
                              : <input
                                  autoFocus
                                  value={check.commentaire}
                                  onChange={e => setAcChecks(prev => prev.map(c => c.id === check.id ? { ...c, commentaire: e.target.value } : c))}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Commentaire (optionnel)..."
                                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-600 placeholder-gray-300 bg-gray-50"
                                />
                            }
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}

            {/* Observations générales */}
            <section className="bg-white rounded-2xl p-4 space-y-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h2 className="font-semibold text-gray-900 text-sm">Observations générales</h2>
              {acIsSigne
                ? <p className="text-sm text-gray-600 leading-relaxed">{acCommentaire || <span className="text-gray-400 italic">Aucune observation</span>}</p>
                : <textarea value={acCommentaire} onChange={e => setAcCommentaire(e.target.value)}
                    placeholder="Remarques, réserves, informations complémentaires..." rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              }
            </section>

            {/* Actions */}
            {!acIsSigne && (
              <div className="space-y-2.5">
                <button onClick={handleAcSave} disabled={acSaving}
                  className="w-full border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl hover:bg-gray-50 transition-colors text-sm bg-white disabled:opacity-50">
                  {acSaving ? 'Sauvegarde...' : 'Sauvegarder le brouillon'}
                </button>
                <button onClick={handleAcSigner} disabled={acSigning || acTotalChecked === 0}
                  className="w-full text-white font-semibold py-4 rounded-2xl transition-all disabled:opacity-50 text-sm"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
                  {acSigning ? 'Signature...' : `Signer la fiche (${acTotalChecked}/${acChecks.length} points)`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── INFOS ─────────────────────────────────────────────────────────── */}
        {activeTab === 'infos' && (
          <>
            <section className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h2 className="font-semibold text-gray-900 text-sm">Informations</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  chantier.puissance_kwc != null
                    ? { label: 'Puissance', value: `${chantier.puissance_kwc} kWc` }
                    : { label: 'Panneaux', value: String(chantier.nb_panneaux) },
                  { label: 'Type installation', value: chantier.type_installation },
                  ...(chantier.type_contrat ? [{ label: 'Contrat', value: {
                    revente_totale: 'Revente totale',
                    autoconsommation: 'Autoconsommation',
                    autoconsommation_surplus: 'Autocons. + surplus',
                  }[chantier.type_contrat] ?? chantier.type_contrat }] : []),
                  { label: 'Date début', value: new Date(chantier.date_prevue).toLocaleDateString('fr-FR') },
                  ...(chantier.date_fin_prevue ? [{ label: 'Date fin prévue', value: new Date(chantier.date_fin_prevue).toLocaleDateString('fr-FR') }] : []),
                  { label: 'Adresse', value: chantier.client_adresse },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {can('modifier_chantier') && (
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
          </>
        )}
      </main>

      {/* ── Modale import matériel ───────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowImportModal(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}
            style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-1 flex-shrink-0">
              <h3 className="font-bold text-gray-900">Éléments détectés</h3>
              <button onClick={() => setShowImportModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            {importedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <svg className="w-8 h-8 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <p className="text-sm text-gray-500">Analyse en cours…</p>
              </div>
            ) : (
            <p className="text-sm text-gray-500 flex-shrink-0">{importedItems.length} élément{importedItems.length > 1 ? 's' : ''} détecté{importedItems.length > 1 ? 's' : ''}. Appuyez sur ✕ pour exclure un élément.</p>
            )}
            <div className="overflow-y-auto flex-1 space-y-1 pr-1">
              {importedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50">
                  <span className="w-5 h-5 rounded-md border-2 border-orange-400 bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="text-sm text-gray-800 flex-1">{item}</span>
                  <button
                    onClick={() => setImportedItems(prev => prev.filter((_, j) => j !== i))}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 flex-shrink-0 pt-2">
              <button
                onClick={() => { setShowImportModal(false); setImportedItems([]) }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importedItems.length === 0}
                className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
              >
                {importedItems.length === 0 ? 'Analyse…' : 'Ajouter à la checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale options PDF ────────────────────────────────────────────── */}
      {showPdfOptions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={() => setShowPdfOptions(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">Contenu du rapport PDF</h3>
              <button onClick={() => setShowPdfOptions(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            {/* Toggles */}
            {([
              { key: 'etapes',       label: 'Étapes et progression' },
              { key: 'photosEtapes', label: 'Photos des étapes', sub: true },
              { key: 'anomalies',    label: 'Anomalies' },
              { key: 'notes',        label: 'Notes terrain' },
              { key: 'materiel',     label: 'Checklist matériel' },
              { key: 'autocontrole', label: 'Fiche auto-contrôle' },
            ] as { key: keyof PdfOptions; label: string; sub?: boolean }[]).map(({ key, label, sub }) => (
              <div key={key} className={`flex items-center justify-between py-2 ${sub ? 'pl-4 border-l-2 border-gray-100' : 'border-b border-gray-50'}`}>
                <span className={`text-sm ${sub ? 'text-gray-500' : 'font-medium text-gray-800'}`}>{label}</span>
                <button
                  onClick={() => setPdfOptions(o => ({ ...o, [key]: !o[key as keyof PdfOptions] }))}
                  className={`w-11 h-6 rounded-full transition-all relative ${pdfOptions[key] ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${pdfOptions[key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}

            {/* Rapports */}
            <div className="border-b border-gray-50 pb-3">
              <p className="text-sm font-medium text-gray-800 mb-2">Rapports de terrain</p>
              <div className="flex gap-2">
                {([
                  { value: 'tous',    label: 'Tous' },
                  { value: 'dernier', label: 'Dernier uniquement' },
                  { value: 'aucun',   label: 'Aucun' },
                ] as { value: PdfOptions['rapports']; label: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPdfOptions(o => ({ ...o, rapports: opt.value }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      pdfOptions.rapports === opt.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-500 bg-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="w-full text-white font-semibold py-4 rounded-2xl transition-all"
              style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            >
              Générer le PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Modale confirmation suppression ──────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Supprimer ce chantier ?</h3>
            <p className="text-gray-500 text-sm mb-6">
              Cette action est irréversible. Toutes les étapes, notes et photos associées seront supprimées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteChantier}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox photos rapport */}
      {rapportLightbox && (
        <RapportLightbox
          photos={rapportLightbox.photos}
          initialIndex={rapportLightbox.index}
          onClose={() => setRapportLightbox(null)}
          onDelete={
            rapports.find(r => r.rapport_photos?.some(p => p.id === rapportLightbox.photos[0]?.id))?.auteur_id === profile?.id || isManager
              ? (photo) => {
                  deleteRapportPhoto(photo)
                  setRapportLightbox(prev => {
                    if (!prev) return null
                    const next = prev.photos.filter(p => p.id !== photo.id)
                    return next.length > 0 ? { ...prev, photos: next, index: Math.min(prev.index, next.length - 1) } : null
                  })
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

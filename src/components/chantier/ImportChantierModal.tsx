import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import type { ImportResult, ImportedFile } from '../../../api/import-chantier'

type Step = 'upload' | 'analyzing' | 'preview' | 'creating' | 'success'

const STATUT_OPTIONS = [
  { value: 'planifie',   label: 'Planifié' },
  { value: 'en_attente', label: 'En attente' },
  { value: 'en_cours',   label: 'En cours' },
  { value: 'bloque',     label: 'Bloqué' },
  { value: 'termine',    label: 'Terminé' },
]

// Compresse une image côté client avant base64
async function compressImage(file: File, maxPx = 800): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.75).split(',')[1])
    }
    img.onerror = () => {
      const reader = new FileReader()
      reader.onload = e => resolve((e.target!.result as string).split(',')[1])
      reader.readAsDataURL(file)
    }
    img.src = URL.createObjectURL(file)
  })
}

// Lit un fichier comme base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve((e.target!.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Parse Excel/CSV → texte tabulaire
function parseExcel(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'array' })
        const rows: string[] = []
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(ws)
          rows.push(`=== Feuille : ${sheetName} ===\n${csv}`)
        })
        resolve(rows.join('\n\n').slice(0, 20_000))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

interface Props {
  onClose: () => void
  userId: string
  entrepriseId: string
}

export default function ImportChantierModal({ onClose, userId, entrepriseId }: Props) {
  const navigate  = useNavigate()
  const dropRef   = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const [step, setStep]             = useState<Step>('upload')
  const [files, setFiles]           = useState<File[]>([])
  const [dragging, setDragging]     = useState(false)
  const [error, setError]           = useState('')
  const [newChantierId, setNewChantierId] = useState('')

  // Données extraites par Claude — éditables par l'utilisateur
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [etapesEnabled, setEtapesEnabled] = useState<boolean[]>([])
  const [rapportsEnabled, setRapportsEnabled] = useState<boolean[]>([])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      return ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'xlsx', 'xls', 'csv', 'doc', 'docx'].includes(ext)
    })
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...list.filter(f => !existing.has(f.name + f.size))]
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleAnalyze = async () => {
    setError('')
    setStep('analyzing')

    try {
      // Prépare chaque fichier pour l'API
      const prepared: ImportedFile[] = await Promise.all(files.map(async file => {
        const ext  = file.name.split('.').pop()?.toLowerCase() ?? ''
        const mime = file.type || 'application/octet-stream'

        if (ext === 'pdf') {
          const data = await fileToBase64(file)
          return { name: file.name, mimeType: 'application/pdf', data }
        }
        if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
          const data = await compressImage(file)
          return { name: file.name, mimeType: 'image/jpeg', data }
        }
        if (['xlsx', 'xls', 'csv'].includes(ext)) {
          const text = await parseExcel(file)
          return { name: file.name, mimeType: mime, text }
        }
        // Word / autre → texte générique
        return { name: file.name, mimeType: mime, text: `[Document joint : ${file.name}]` }
      }))

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/import-chantier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ files: prepared }),
      })

      if (!res.ok) throw new Error(await res.text())
      const extracted: ImportResult = await res.json()

      setResult(extracted)
      setEtapesEnabled(extracted.etapes.map(() => true))
      setRapportsEnabled(extracted.rapports.map(() => true))
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setStep('upload')
    }
  }

  const handleCreate = async () => {
    if (!result) return
    setStep('creating')

    try {
      // 1. Créer le chantier
      const { data: chantier, error: chErr } = await supabase.from('chantiers').insert({
        ...result.chantier,
        entreprise_id: entrepriseId,
        date_prevue:   result.chantier.date_prevue ?? new Date().toISOString().slice(0, 10),
        nb_panneaux:   result.chantier.nb_panneaux ?? 0,
      }).select('id').single()
      if (chErr || !chantier) throw new Error(chErr?.message ?? 'Erreur création chantier')

      const chantierId = chantier.id

      // 2. Créer les étapes sélectionnées
      const etapesSelected = result.etapes.filter((_, i) => etapesEnabled[i])
      if (etapesSelected.length) {
        await supabase.from('etapes').insert(
          etapesSelected.map(e => ({
            chantier_id: chantierId,
            nom:         e.nom,
            statut:      e.statut,
            ordre:       e.ordre,
            pourcentage: e.statut === 'fait' ? 100 : 0,
          }))
        )
      }

      // 3. Créer les rapports sélectionnés
      const rapportsSelected = result.rapports.filter((_, i) => rapportsEnabled[i])
      if (rapportsSelected.length) {
        await supabase.from('rapports').insert(
          rapportsSelected.map(r => ({
            chantier_id:   chantierId,
            technicien_id: userId,
            message:       r.message,
          }))
        )
      }

      // 4. Archiver les fichiers originaux dans l'onglet Docs
      await Promise.allSettled(files.map(async file => {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const path     = `${chantierId}/${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream' })
        if (upErr) return
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        await supabase.from('documents').insert({
          chantier_id:  chantierId,
          uploaded_by:  userId,
          nom:          file.name,
          url:          publicUrl,
          taille:       file.size,
        })
      }))

      setNewChantierId(chantierId)
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création')
      setStep('preview')
    }
  }

  const updateChantier = (key: keyof ImportResult['chantier'], value: string | number | null) => {
    setResult(prev => prev ? { ...prev, chantier: { ...prev.chantier, [key]: value } } : prev)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh', paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Importer un chantier existant</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'upload'    && 'Déposez vos documents, l\'IA crée la fiche automatiquement'}
              {step === 'analyzing' && 'Claude analyse vos documents…'}
              {step === 'preview'   && 'Vérifiez et ajustez avant création'}
              {step === 'creating'  && 'Création en cours…'}
              {step === 'success'   && 'Chantier créé avec succès !'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-lg">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* ── STEP : upload ─────────────────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                }`}
              >
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-700 text-sm">Glissez vos fichiers ici</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, Excel, Word, photos — plusieurs fichiers acceptés</p>
                </div>
                <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />
              </div>

              {/* Fichiers ajoutés */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-xl">
                      <span className="text-lg">
                        {f.name.endsWith('.pdf') ? '📄' : f.name.match(/\.(xlsx?|csv)$/) ? '📊' : f.name.match(/\.(docx?)$/) ? '📝' : '🖼️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} Ko</p>
                      </div>
                      <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-red-500 transition-colors flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            </>
          )}

          {/* ── STEP : analyzing ──────────────────────────────────────────────── */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800">Claude analyse vos documents</p>
                <p className="text-sm text-gray-400 mt-1">Extraction des informations du chantier…</p>
              </div>
            </div>
          )}

          {/* ── STEP : preview ────────────────────────────────────────────────── */}
          {step === 'preview' && result && (
            <>
              {/* Fiche chantier */}
              <section className="space-y-3">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">1</span>
                  Fiche chantier
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { key: 'nom',              label: 'Nom du chantier',     type: 'text' },
                    { key: 'client_nom',       label: 'Client',              type: 'text' },
                    { key: 'client_adresse',   label: 'Adresse',             type: 'text' },
                    { key: 'client_telephone', label: 'Téléphone',           type: 'text' },
                    { key: 'type_installation',label: 'Type installation',   type: 'text' },
                    { key: 'puissance_kwc',    label: 'Puissance (kWc)',     type: 'number' },
                    { key: 'nb_panneaux',      label: 'Nb panneaux',         type: 'number' },
                    { key: 'date_prevue',      label: 'Date de début',       type: 'date' },
                  ] as { key: keyof ImportResult['chantier']; label: string; type: string }[]).map(({ key, label, type }) => (
                    <div key={key}>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                      <input
                        type={type}
                        value={result.chantier[key] ?? ''}
                        onChange={e => updateChantier(key, type === 'number' ? (parseFloat(e.target.value) || null) : e.target.value || null)}
                        className="mt-0.5 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Statut</label>
                    <select
                      value={result.chantier.statut}
                      onChange={e => updateChantier('statut', e.target.value)}
                      className="mt-0.5 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                    >
                      {STATUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Étapes */}
              <section className="space-y-2">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">2</span>
                  Étapes détectées
                  <span className="text-xs font-normal text-gray-400">({etapesEnabled.filter(Boolean).length}/{result.etapes.length})</span>
                </h3>
                {result.etapes.length === 0 ? (
                  <p className="text-sm text-gray-400 italic px-1">Aucune étape détectée dans les documents</p>
                ) : (
                  <div className="space-y-1.5">
                    {result.etapes.map((e, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors ${etapesEnabled[i] ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                        <input type="checkbox" checked={etapesEnabled[i]} onChange={() => setEtapesEnabled(prev => prev.map((v, j) => j === i ? !v : v))}
                          className="w-4 h-4 accent-orange-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 flex-1">{e.nom}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          e.statut === 'fait' ? 'bg-green-50 text-green-600' : e.statut === 'en_cours' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>{e.statut === 'fait' ? 'Fait' : e.statut === 'en_cours' ? 'En cours' : 'À faire'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Rapports */}
              <section className="space-y-2">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">3</span>
                  Rapports détectés
                  <span className="text-xs font-normal text-gray-400">({rapportsEnabled.filter(Boolean).length}/{result.rapports.length})</span>
                </h3>
                {result.rapports.length === 0 ? (
                  <p className="text-sm text-gray-400 italic px-1">Aucun rapport détecté dans les documents</p>
                ) : (
                  <div className="space-y-2">
                    {result.rapports.map((r, i) => (
                      <div key={i} className={`flex gap-3 px-4 py-3 rounded-xl border transition-colors ${rapportsEnabled[i] ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                        <input type="checkbox" checked={rapportsEnabled[i]} onChange={() => setRapportsEnabled(prev => prev.map((v, j) => j === i ? !v : v))}
                          className="w-4 h-4 accent-orange-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{r.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Documents à archiver */}
              <section className="space-y-2">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">4</span>
                  Documents à archiver
                  <span className="text-xs font-normal text-gray-400">({files.length} fichier{files.length > 1 ? 's' : ''})</span>
                </h3>
                <div className="space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
                      <span className="text-base">{f.name.endsWith('.pdf') ? '📄' : f.name.match(/\.(xlsx?|csv)$/) ? '📊' : f.name.match(/\.(docx?)$/) ? '📝' : '🖼️'}</span>
                      <p className="text-sm text-gray-700 flex-1 truncate">{f.name}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} Ko</span>
                    </div>
                  ))}
                </div>
              </section>

              {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            </>
          )}

          {/* ── STEP : creating ───────────────────────────────────────────────── */}
          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
              <p className="font-semibold text-gray-800">Création du chantier…</p>
            </div>
          )}

          {/* ── STEP : success ────────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">{result?.chantier.nom ?? 'Chantier'} créé !</p>
                <p className="text-sm text-gray-400 mt-1">Fiche, étapes, rapports et documents importés</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {step === 'upload' && (
            <button
              onClick={handleAnalyze}
              disabled={files.length === 0}
              className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-2xl transition-all disabled:opacity-40 text-sm"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Analyser avec l'IA
            </button>
          )}
          {step === 'preview' && (
            <div className="flex gap-3">
              <button onClick={() => { setStep('upload'); setError('') }}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm">
                ← Modifier les fichiers
              </button>
              <button onClick={handleCreate}
                className="flex-1 text-white font-semibold py-3 rounded-2xl transition-all text-sm"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                Créer le chantier
              </button>
            </div>
          )}
          {step === 'success' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm">
                Fermer
              </button>
              <button onClick={() => { onClose(); navigate(`/chantier/${newChantierId}`) }}
                className="flex-1 text-white font-semibold py-3 rounded-2xl transition-all text-sm"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
                Voir la fiche →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

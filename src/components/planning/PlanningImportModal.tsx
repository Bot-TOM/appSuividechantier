import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType } from '@/types'

const TYPE_LABELS: Record<PlanningType, string> = {
  chantier:          'Chantier',
  grand_deplacement: 'Grand déplacement',
  depot:             'Dépôt',
  route:             'Route',
  repos_conges:      'Repos / Congés',
  absent:            'Absent',
  ferie:             'Férié',
  libre:             'Libre',
}

const VALID_TYPES = new Set<string>([
  'chantier', 'grand_deplacement', 'depot', 'route',
  'repos_conges', 'absent', 'ferie', 'libre',
])

function matchProfile(name: string, profiles: UserProfile[]): UserProfile | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  return (
    profiles.find(p => p.full_name.toLowerCase().trim() === lower) ??
    profiles.find(p =>
      p.full_name.toLowerCase().includes(lower) ||
      lower.includes(p.full_name.toLowerCase()),
    ) ?? null
  )
}

interface AIEntry {
  date:       string
  technicien: string
  type:       string
  note:       string
}

interface ImportRow {
  date:     string
  techName: string
  techId:   string | null
  type:     PlanningType
  label:    string
  status:   'ok' | 'unknown_tech' | 'bad_date'
}

interface Props {
  profiles: UserProfile[]
  onClose:  () => void
  onDone:   () => void
}

export default function PlanningImportModal({ profiles, onClose, onDone }: Props) {
  const [rows,      setRows]      = useState<ImportRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [error,     setError]     = useState('')
  const [step,      setStep]      = useState<'idle' | 'parsing' | 'preview'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setFileName(file.name)
    setRows([])
    setStep('parsing')

    try {
      // 1. Lire le fichier Excel → texte brut (CSV)
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      // On envoie une représentation CSV + texte pour que l'IA comprenne la structure
      const csvContent = XLSX.utils.sheet_to_csv(ws, { blankrows: false })

      // 2. Envoyer à l'API Claude pour analyse intelligente
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Non connecté')

      const res = await fetch('/api/parse-planning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content:     csvContent,
          techniciens: profiles.map(p => p.full_name),
        }),
      })

      const data = await res.json() as { entries?: AIEntry[]; error?: string; raw?: string }

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Erreur serveur ${res.status}`)
      }

      const entries: AIEntry[] = data.entries ?? []

      if (!entries.length) {
        setError('L\'IA n\'a trouvé aucune entrée de planning dans ce fichier.')
        setStep('idle')
        setLoading(false)
        return
      }

      // 3. Faire correspondre les noms aux profils
      const parsed: ImportRow[] = entries.map(e => {
        const type    = VALID_TYPES.has(e.type) ? (e.type as PlanningType) : 'chantier'
        const profile = matchProfile(e.technicien, profiles)
        const dateOk  = /^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')
        return {
          date:     e.date ?? '',
          techName: e.technicien,
          techId:   profile?.id ?? null,
          type,
          label:    e.note ?? '',
          status:   !dateOk ? 'bad_date' : !profile ? 'unknown_tech' : 'ok',
        }
      })

      setRows(parsed)
      setStep('preview')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('idle')
    }
    setLoading(false)
  }

  async function doImport() {
    const valid = rows.filter(r => r.status === 'ok')
    if (!valid.length) return
    setImporting(true)
    try {
      const { error: err } = await supabase
        .from('planning_entries')
        .upsert(
          valid.map(r => ({
            technicien_id: r.techId!,
            date:          r.date,
            type:          r.type,
            label:         r.label || null,
            chantier_id:   null,
          })),
          { onConflict: 'technicien_id,date' },
        )
      if (err) throw err
      onDone()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'import')
    }
    setImporting(false)
  }

  const okCount  = rows.filter(r => r.status === 'ok').length
  const errCount = rows.filter(r => r.status !== 'ok').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl w-full max-w-lg mx-4 mb-4 sm:mb-0 flex flex-col max-h-[88vh]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Importer un planning Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              L'IA analyse ton fichier et reconnaît le format automatiquement
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Zone de dépôt */}
          {step !== 'preview' && (
            <label
              className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">
                  {fileName || 'Glissez votre fichier .xlsx ici'}
                </p>
                {!fileName && <p className="text-xs text-gray-400 mt-0.5">ou cliquez pour choisir</p>}
              </div>
            </label>
          )}

          {/* Chargement IA */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">IA en cours d'analyse…</p>
                <p className="text-xs text-gray-400 mt-0.5">Reconnaissance du format, extraction des entrées</p>
              </div>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && !loading && (
            <>
              {/* Fichier + reset */}
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-gray-600 flex-1 truncate">{fileName}</span>
                <button onClick={() => { setStep('idle'); setRows([]); setFileName(''); setError('') }}
                  className="text-xs text-orange-500 hover:text-orange-700 font-medium">
                  Changer
                </button>
              </div>

              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{okCount}</p>
                  <p className="text-xs text-green-500 mt-0.5">entrées à importer</p>
                </div>
                {errCount > 0 && (
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{errCount}</p>
                    <p className="text-xs text-amber-400 mt-0.5">ignorées</p>
                  </div>
                )}
              </div>

              {errCount > 0 && (
                <p className="text-xs text-gray-400">
                  Les lignes ignorées ont un technicien introuvable dans l'équipe ou une date invalide. Elles ne seront pas importées.
                </p>
              )}

              {/* Tableau aperçu */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium">Date</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium">Technicien</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-medium">Type</th>
                        <th className="px-2 py-2 w-5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((row, i) => (
                        <tr key={i} className={row.status !== 'ok' ? 'bg-red-50 opacity-60' : ''}>
                          <td className="px-3 py-1.5 text-gray-600 tabular-nums">{row.date || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-700">{row.techName}</td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {TYPE_LABELS[row.type]}
                            {row.label ? <span className="text-gray-400"> – {row.label}</span> : null}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {row.status === 'ok'
                              ? <span className="text-green-500 font-bold">✓</span>
                              : <span className="text-red-400 font-bold cursor-help"
                                  title={row.status === 'unknown_tech' ? 'Technicien non trouvé' : 'Date invalide'}>✗</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
          {step === 'preview' && (
            <button
              onClick={doImport}
              disabled={okCount === 0 || importing}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
            >
              {importing
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Import…</>
                : `Importer ${okCount} entrée${okCount > 1 ? 's' : ''}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

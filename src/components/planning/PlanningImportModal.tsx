import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType } from '@/types'

// ─── Mapping type texte → PlanningType ───────────────────────────────────────
const TYPE_MAP: [string, PlanningType][] = [
  ['grand d', 'grand_deplacement'],
  ['chantier', 'chantier'],
  ['dép', 'depot'],
  ['dep', 'depot'],
  ['route', 'route'],
  ['repos', 'repos_conges'],
  ['cong', 'repos_conges'],
  ['absent', 'absent'],
  ['fér', 'ferie'],
  ['feri', 'ferie'],
  ['libre', 'libre'],
]

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

function parseType(cell: string): { type: PlanningType; label: string } {
  const str = String(cell ?? '').trim()
  if (!str) return { type: 'libre', label: '' }
  const parts = str.split(/\s*[–—-]\s*/)
  const typeStr = parts[0].trim().toLowerCase()
  const label   = parts.slice(1).join(' – ').trim()
  for (const [key, val] of TYPE_MAP) {
    if (typeStr.includes(key)) return { type: val, label }
  }
  return { type: 'chantier', label: str }
}

// Convertit une valeur de cellule Excel en date ISO YYYY-MM-DD
function parseDateCell(cell: unknown): string | null {
  // Objet Date (quand cellDates:true est actif)
  if (cell instanceof Date) {
    if (isNaN(cell.getTime())) return null
    return `${cell.getFullYear()}-${String(cell.getMonth()+1).padStart(2,'0')}-${String(cell.getDate()).padStart(2,'0')}`
  }
  const str = String(cell ?? '').trim()
  if (!str) return null
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) return `${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`
  // Fallback : essai natif JS
  const d = new Date(str)
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  return null
}

// Correspondance nom → profil (exact puis partiel)
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

// ─── Types locaux ─────────────────────────────────────────────────────────────
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

// ─── Téléchargement du modèle ─────────────────────────────────────────────────
function downloadTemplate(profiles: UserProfile[]) {
  const headers = ['Date (JJ/MM/AAAA)', 'Technicien (nom complet)', 'Type', 'Note (optionnel)']
  const types   = 'Chantier | Grand déplacement | Dépôt | Route | Repos / Congés | Absent | Férié | Libre'
  const rows: string[][] = [
    headers,
    ['(Types possibles pour colonne C)', '', types, ''],
    ['16/05/2026', profiles[0]?.full_name ?? 'Prénom Nom', 'Chantier', 'Maison Dupont'],
    ['16/05/2026', profiles[1]?.full_name ?? 'Prénom Nom 2', 'Route', ''],
    ['17/05/2026', profiles[0]?.full_name ?? 'Prénom Nom', 'Repos / Congés', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planning')
  XLSX.writeFile(wb, 'modele-import-planning.xlsx')
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PlanningImportModal({ profiles, onClose, onDone }: Props) {
  const [rows,      setRows]      = useState<ImportRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [error,     setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setFileName(file.name)
    setRows([])

    try {
      const buf  = await file.arrayBuffer()
      // cellDates:true → les dates Excel sont converties en objets Date JS
      const wb   = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]

      if (!data.length) {
        setError('Fichier vide ou illisible.')
        setLoading(false)
        return
      }

      const parsed: ImportRow[] = []

      // ── Détection du format ─────────────────────────────────────────────────
      const firstRow = (data[0] as unknown[]).map(c => String(c ?? '').trim())

      // FORMAT A — Export app : 1ère colonne = "Jour", colonnes suivantes = noms de techniciens
      if (firstRow[0].toLowerCase().includes('jour') && firstRow.length > 1) {
        const techHeaders = firstRow.slice(1)
        for (let r = 1; r < data.length; r++) {
          const row  = data[r] as unknown[]
          const date = parseDateCell(row[0])
          for (let c = 0; c < techHeaders.length; c++) {
            const cellVal = String(row[c + 1] ?? '').trim()
            if (!cellVal) continue
            const { type, label } = parseType(cellVal)
            if (type === 'libre') continue
            const techName = techHeaders[c]
            const profile  = matchProfile(techName, profiles)
            parsed.push({
              date: date ?? '', techName,
              techId: profile?.id ?? null, type, label,
              status: !date ? 'bad_date' : !profile ? 'unknown_tech' : 'ok',
            })
          }
        }
      } else {
        // FORMAT B — Liste : Date | Technicien | Type | Note
        // Sauter la ligne d'en-tête si elle ne ressemble pas à une date
        const startRow = (() => {
          const dateCandidate = parseDateCell(data[0]?.[0])
          return (!dateCandidate) ? 1 : 0
        })()

        for (let r = startRow; r < data.length; r++) {
          const row      = data[r] as unknown[]
          const date     = parseDateCell(row[0])
          const techName = String(row[1] ?? '').trim()
          const typeCell = String(row[2] ?? '').trim()
          const noteCell = String(row[3] ?? '').trim()
          if (!techName || techName.toLowerCase().includes('technicien')) continue
          if (!date && !techName) continue
          const { type, label: parsedLabel } = parseType(typeCell || 'Chantier')
          const label   = noteCell || parsedLabel
          const profile = matchProfile(techName, profiles)
          parsed.push({
            date: date ?? '', techName,
            techId: profile?.id ?? null, type, label,
            status: !date ? 'bad_date' : !profile ? 'unknown_tech' : 'ok',
          })
        }
      }

      if (parsed.length === 0) {
        setError('Format non reconnu. Téléchargez le modèle ci-dessous et copiez vos données dedans.')
      }
      setRows(parsed)
    } catch (e) {
      console.error(e)
      setError('Impossible de lire le fichier. Vérifiez qu\'il est au format .xlsx ou .xls')
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
              Export de l'app · ou colonnes : <span className="font-medium text-gray-500">Date / Technicien / Type / Note</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Modèle à télécharger */}
          <button
            onClick={() => downloadTemplate(profiles)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
          >
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-orange-700">Télécharger le modèle Excel</p>
              <p className="text-xs text-orange-400">Noms de tes techniciens déjà pré-remplis</p>
            </div>
          </button>

          {/* Zone de dépôt */}
          <label
            className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors cursor-pointer"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">
                {fileName || 'Glissez votre fichier .xlsx ici'}
              </p>
              {!fileName && <p className="text-xs text-gray-400 mt-0.5">ou cliquez pour choisir</p>}
            </div>
          </label>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Lecture du fichier…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {rows.length > 0 && !loading && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{okCount}</p>
                  <p className="text-xs text-green-500 mt-0.5">entrées à importer</p>
                </div>
                {errCount > 0 && (
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{errCount}</p>
                    <p className="text-xs text-amber-400 mt-0.5">ignorées (tech inconnu / date invalide)</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
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
        </div>
      </div>
    </div>
  )
}

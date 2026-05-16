import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType } from '@/types'

// ─── Mapping mois FR → numéro ────────────────────────────────────────────────
const FR_MONTHS: Record<string, string> = {
  'janv': '01', 'janv.': '01', 'janvier': '01',
  'févr': '02', 'févr.': '02', 'février': '02',
  'mars': '03',
  'avr':  '04', 'avr.':  '04', 'avril':   '04',
  'mai':  '05',
  'juin': '06',
  'juil': '07', 'juil.': '07', 'juillet': '07',
  'août': '08', 'aout':  '08',
  'sept': '09', 'sept.': '09', 'septembre': '09',
  'oct':  '10', 'oct.':  '10', 'octobre':   '10',
  'nov':  '11', 'nov.':  '11', 'novembre':  '11',
  'déc':  '12', 'déc.':  '12', 'décembre':  '12', 'dec': '12',
}

// ─── Mapping libellé → PlanningType ─────────────────────────────────────────
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
]

function parseType(cell: string): { type: PlanningType; label: string } {
  const str = String(cell ?? '').trim()
  if (!str || str.toLowerCase() === 'libre') return { type: 'libre', label: '' }
  const parts = str.split(/\s*[–—-]\s*/)
  const typeStr = parts[0].trim().toLowerCase()
  const label   = parts.slice(1).join(' – ').trim()
  for (const [key, val] of TYPE_MAP) {
    if (typeStr.startsWith(key)) return { type: val, label }
  }
  return { type: 'libre', label: str }
}

function parseDate(cell: unknown): string | null {
  // Numéro série Excel (jours depuis 1900-01-01)
  if (typeof cell === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + cell * 86400000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  }
  const str = String(cell ?? '').trim()
  if (!str) return null
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // DD/MM/YYYY
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) return `${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`
  // "Lun. 16 mai" ou "16 mai 2026" (format export app)
  const fmtMatch = str.match(/(\d{1,2})\s+(\w+\.?)(?:\s+(\d{4}))?/)
  if (fmtMatch) {
    const day   = fmtMatch[1].padStart(2, '0')
    const mkey  = fmtMatch[2].toLowerCase()
    const month = FR_MONTHS[mkey] ?? FR_MONTHS[mkey.replace('.', '')]
    if (!month) return null
    const year  = fmtMatch[3] ?? String(new Date().getFullYear())
    return `${year}-${month}-${day}`
  }
  return null
}

// Correspondance nom → profil (exact, puis partiel)
function matchProfile(name: string, profiles: UserProfile[]): UserProfile | null {
  const lower = name.toLowerCase().trim()
  return (
    profiles.find(p => p.full_name.toLowerCase().trim() === lower) ??
    profiles.find(p => p.full_name.toLowerCase().includes(lower) || lower.includes(p.full_name.toLowerCase())) ??
    null
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
  onDone:   () => void  // pour rafraîchir le planning après import
}

export default function PlanningImportModal({ profiles, onClose, onDone }: Props) {
  const [rows,      setRows]      = useState<ImportRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [error,     setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Lecture et parsing du fichier ─────────────────────────────────────────
  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setFileName(file.name)
    setRows([])

    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]

      if (!data.length) { setLoading(false); return }

      const parsed: ImportRow[] = []
      const firstRow = (data[0] as string[]).map(c => String(c ?? '').trim())

      // ── Format "activité" (export app) : 1ère col = Jour, colonnes = techniciens
      if (firstRow[0].toLowerCase().includes('jour') && firstRow.length > 1) {
        const techHeaders = firstRow.slice(1)
        for (let r = 1; r < data.length; r++) {
          const row  = data[r] as unknown[]
          const date = parseDate(row[0])
          for (let c = 0; c < techHeaders.length; c++) {
            const cellVal = String(row[c + 1] ?? '').trim()
            if (!cellVal) continue
            const { type, label } = parseType(cellVal)
            if (type === 'libre') continue  // on ne réimporte pas "Libre"
            const techName = techHeaders[c]
            const profile  = matchProfile(techName, profiles)
            parsed.push({
              date:     date ?? '',
              techName,
              techId:   profile?.id ?? null,
              type, label,
              status: !date ? 'bad_date' : !profile ? 'unknown_tech' : 'ok',
            })
          }
        }
      } else {
        // ── Format liste générique : Date | Technicien | Type | Note
        const startRow = firstRow.some(h => /date|tech|nom|type/i.test(h)) ? 1 : 0
        for (let r = startRow; r < data.length; r++) {
          const row = data[r] as unknown[]
          if (row.length < 2) continue
          const date     = parseDate(row[0])
          const techName = String(row[1]).trim()
          const typeCell = String(row[2] ?? '').trim()
          const noteCell = String(row[3] ?? '').trim()
          if (!techName) continue
          const { type, label: parsedLabel } = parseType(typeCell)
          const label = noteCell || parsedLabel
          const profile = matchProfile(techName, profiles)
          parsed.push({
            date:     date ?? '',
            techName,
            techId:   profile?.id ?? null,
            type, label,
            status: !date ? 'bad_date' : !profile ? 'unknown_tech' : 'ok',
          })
        }
      }

      setRows(parsed)
    } catch (e) {
      setError('Impossible de lire le fichier. Vérifiez qu\'il est au format .xlsx ou .xls')
      console.error(e)
    }
    setLoading(false)
  }

  // ── Import en base ────────────────────────────────────────────────────────
  async function doImport() {
    const valid = rows.filter(r => r.status === 'ok')
    if (!valid.length) return
    setImporting(true)
    try {
      const toInsert = valid.map(r => ({
        technicien_id: r.techId!,
        date:          r.date,
        type:          r.type,
        label:         r.label || null,
        chantier_id:   null,
      }))
      const { error: err } = await supabase
        .from('planning_entries')
        .upsert(toInsert, { onConflict: 'technicien_id,date' })
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg mx-4 mb-4 sm:mb-0 flex flex-col max-h-[85vh]"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Importer un planning Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Compatible avec l'export de l'app · ou format liste : Date / Technicien / Type / Note
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

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
              <p className="text-sm text-gray-500 font-medium">
                {fileName || 'Glissez votre fichier .xlsx ici'}
              </p>
              {!fileName && <p className="text-xs text-gray-400 mt-0.5">ou cliquez pour choisir</p>}
            </div>
          </label>

          {/* Spinner lecture */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              Lecture du fichier…
            </div>
          )}

          {/* Erreur */}
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Résultats */}
          {rows.length > 0 && !loading && (
            <>
              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{okCount}</p>
                  <p className="text-xs text-green-500 mt-0.5">entrées à importer</p>
                </div>
                {errCount > 0 && (
                  <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{errCount}</p>
                    <p className="text-xs text-red-400 mt-0.5">ignorées</p>
                  </div>
                )}
              </div>

              {errCount > 0 && (
                <p className="text-xs text-gray-400">
                  Les lignes ignorées ont un technicien introuvable dans l'équipe ou une date invalide.
                </p>
              )}

              {/* Aperçu tableau */}
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
                              : <span
                                  className="text-red-400 font-bold cursor-help"
                                  title={row.status === 'unknown_tech' ? 'Technicien non trouvé dans l\'équipe' : 'Date non reconnue'}
                                >✗</span>
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
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
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

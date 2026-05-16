import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType } from '@/types'

// ─── Conversion numéro série Excel → date ISO ─────────────────────────────────
function excelSerialToISO(serial: number): string {
  // Excel epoch : 30 décembre 1899
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
}

// ─── Classification du texte libre → PlanningType ────────────────────────────
function classifyCell(raw: string): { type: PlanningType; label: string } {
  const text  = raw.replace(/\n/g, ' – ').trim()
  const lower = text.toLowerCase()

  if (!lower) return { type: 'libre', label: '' }

  if (/fér[ié]|ferie/.test(lower))
    return { type: 'ferie', label: '' }

  if (/cong[eé]|cp\b|récup|repos|rtt|vacance|paternit|maternit/.test(lower))
    return { type: 'repos_conges', label: text }

  if (/arrêt|arret|maladie|accident|accident/.test(lower))
    return { type: 'absent', label: text }

  if (/^route\b|^retour\b/.test(lower))
    return { type: 'route', label: text }

  if (/grand.d[eé]p|gd\.?d[eé]p/.test(lower))
    return { type: 'grand_deplacement', label: text }

  if (/d[eé]p[oô]t|atelier|entrepôt|entrepot/.test(lower))
    return { type: 'depot', label: text }

  // Texte présent mais inconnu → chantier avec le texte comme label
  return { type: 'chantier', label: text }
}

// ─── Correspondance nom → profil ──────────────────────────────────────────────
function matchProfile(name: string, profiles: UserProfile[]): UserProfile | null {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact
  const exact = profiles.find(p => p.full_name.toLowerCase().trim() === lower)
  if (exact) return exact
  // Partiel (ex: "Tom ROMAND" ↔ "Tom Romand")
  return profiles.find(p =>
    p.full_name.toLowerCase().replace(/\s+/g, ' ').trim() === lower ||
    lower.split(' ').every(part => p.full_name.toLowerCase().includes(part)) ||
    p.full_name.toLowerCase().split(' ').every(part => lower.includes(part))
  ) ?? null
}

// ─── Parser format pivot (Année / Mois / Sem / Jour / Date / Tech…) ───────────
function parsePivotFormat(
  data: unknown[][],
  profiles: UserProfile[],
): ImportRow[] | null {
  if (!data.length) return null
  const headers = (data[0] as unknown[]).map(c => String(c ?? '').trim().toLowerCase())

  // Détection : colonnes 0-3 doivent ressembler à "année","mois","sem","jour"
  const isPivot =
    headers[0]?.includes('ann') &&
    headers[1]?.includes('mois') &&
    headers[3]?.includes('jour') &&
    headers[4]?.includes('date')

  if (!isPivot) return null

  // Colonnes techniciens : tout ce qui est après l'index 4
  const techCols: { idx: number; name: string; profile: UserProfile | null }[] = []
  for (let c = 5; c < headers.length; c++) {
    const name = String(data[0][c] ?? '').trim()
    if (!name) continue  // colonnes cachées/vides
    techCols.push({ idx: c, name, profile: matchProfile(name, profiles) })
  }

  const rows: ImportRow[] = []
  for (let r = 1; r < data.length; r++) {
    const row    = data[r] as unknown[]
    const serial = row[4]
    if (!serial && serial !== 0) continue

    // Numéro série → date ISO
    const dateISO = typeof serial === 'number'
      ? excelSerialToISO(serial)
      : typeof serial === 'string' && /^\d+$/.test(serial.trim())
        ? excelSerialToISO(parseInt(serial.trim(), 10))
        : serial instanceof Date
          ? excelSerialToISO(Math.floor((serial.getTime() / 86400000) + 25569))
          : null

    if (!dateISO) continue

    // Ignorer week-ends (samedi=6, dimanche=0)
    const dayOfWeek = new Date(dateISO + 'T00:00:00Z').getUTCDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue

    for (const col of techCols) {
      const cellVal = String(row[col.idx] ?? '').trim()
      if (!cellVal || cellVal.toLowerCase() === 'non concerné') continue

      const { type, label } = classifyCell(cellVal)
      if (type === 'libre') continue  // cellule vide ou weekend → on n'importe pas

      rows.push({
        date:     dateISO,
        techName: col.name,
        techId:   col.profile?.id ?? null,
        type,
        label,
        status:   !col.profile ? 'unknown_tech' : 'ok',
      })
    }
  }
  return rows
}

// ─── Parser IA (fallback pour formats inconnus) ───────────────────────────────
async function parseWithAI(
  csvContent: string,
  profiles: UserProfile[],
  token: string,
): Promise<ImportRow[]> {
  const res = await fetch('/api/parse-planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      content:     csvContent,
      techniciens: profiles.map(p => p.full_name),
    }),
  })
  const data = await res.json() as { entries?: AIEntry[]; error?: string }
  if (!res.ok || data.error) throw new Error(data.error ?? `Erreur API ${res.status}`)

  const VALID_TYPES = new Set<string>([
    'chantier', 'grand_deplacement', 'depot', 'route',
    'repos_conges', 'absent', 'ferie', 'libre',
  ])

  return (data.entries ?? []).map(e => {
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
    } as ImportRow
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AIEntry { date: string; technicien: string; type: string; note: string }

interface ImportRow {
  date:     string
  techName: string
  techId:   string | null
  type:     PlanningType
  label:    string
  status:   'ok' | 'unknown_tech' | 'bad_date'
}

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

interface Props {
  profiles: UserProfile[]
  onClose:  () => void
  onDone:   () => void
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function PlanningImportModal({ profiles, onClose, onDone }: Props) {
  const [rows,      setRows]      = useState<ImportRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [error,     setError]     = useState('')
  const [step,      setStep]      = useState<'idle' | 'parsing' | 'preview'>('idle')
  const [parseMode, setParseMode] = useState<'direct' | 'ai'>('direct')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setFileName(file.name)
    setRows([])
    setStep('parsing')

    try {
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array', cellDates: false }) // raw numbers pour les dates
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][]

      // Essai parser direct (format pivot connu)
      const directRows = parsePivotFormat(data, profiles)

      if (directRows && directRows.length > 0) {
        setParseMode('direct')
        setRows(directRows)
        setStep('preview')
      } else {
        // Fallback IA
        setParseMode('ai')
        const csvContent = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) throw new Error('Non connecté')
        const aiRows = await parseWithAI(csvContent, profiles, session.access_token)
        if (!aiRows.length) {
          setError('Aucune entrée trouvée. Le fichier est peut-être vide ou dans un format non supporté.')
          setStep('idle')
        } else {
          setRows(aiRows)
          setStep('preview')
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la lecture')
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
              Format pivot (Année/Mois/Date/Technicien…) ou export de l'app
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

          {/* Chargement */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-8 h-8 border-orange-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  {parseMode === 'ai' ? 'IA en cours d\'analyse…' : 'Lecture du fichier…'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Quelques secondes</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && !loading && (
            <>
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-gray-600 flex-1 truncate">{fileName}</span>
                {parseMode === 'ai' && <span className="text-xs text-orange-500 font-medium">via IA</span>}
                <button
                  onClick={() => { setStep('idle'); setRows([]); setFileName(''); setError('') }}
                  className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                >
                  Changer
                </button>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{okCount}</p>
                  <p className="text-xs text-green-500 mt-0.5">entrées à importer</p>
                </div>
                {errCount > 0 && (
                  <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-500">{errCount}</p>
                    <p className="text-xs text-amber-400 mt-0.5">ignorées (tech inconnu)</p>
                  </div>
                )}
              </div>

              {errCount > 0 && (
                <p className="text-xs text-gray-400">
                  Technicien inconnu = son nom dans le fichier ne correspond à aucun membre de l'équipe.
                </p>
              )}

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
                                  title="Technicien non trouvé dans l'équipe">✗</span>
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

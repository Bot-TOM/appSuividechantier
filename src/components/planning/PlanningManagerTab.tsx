import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType } from '@/types'
import {
  usePlanning,
  getMondayOfWeek,
  getWeekDays,
  fmtWeekRange,
  prevMonday,
  nextMonday,
} from '@/hooks/usePlanning'
import { useTeamTimeEntries, calcDuree } from '@/hooks/useTimeEntries'
import Avatar from '@/components/Avatar'

// ─── Couleurs par type ────────────────────────────────────────────────────────
const PT: Record<PlanningType, { label: string; bg: string; text: string; border: string }> = {
  chantier:          { label: 'Chantier',          bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200'   },
  grand_deplacement: { label: 'Grand déplacement',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
  depot:             { label: 'Dépôt',              bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300'   },
  route:             { label: 'Route',              bg: 'bg-yellow-50',  text: 'text-yellow-600', border: 'border-yellow-200' },
  repos_conges:      { label: 'Repos / Congés',     bg: 'bg-violet-50',  text: 'text-violet-500', border: 'border-violet-200' },
  absent:            { label: 'Absent',             bg: 'bg-red-50',     text: 'text-red-500',    border: 'border-red-200'    },
  libre:             { label: 'Libre (trou)',        bg: 'bg-amber-50',   text: 'text-amber-500',  border: 'border-amber-200'  },
}

function localISO(d: Date): string {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}
const TODAY = localISO(new Date())

// ─── Jours fériés français (calcul automatique) ───────────────────────────────
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function addDaysISO(date: Date, n: number): string {
  return localISO(new Date(date.getFullYear(), date.getMonth(), date.getDate() + n))
}
function getFeries(year: number): Set<string> {
  const e = easterSunday(year)
  return new Set([
    `${year}-01-01`,
    addDaysISO(e, 1),
    `${year}-05-01`,
    `${year}-05-08`,
    addDaysISO(e, 39),
    addDaysISO(e, 50),
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ])
}

function fmtDayLabel(iso: string): string {
  const d    = new Date(iso + 'T00:00:00')
  const raw  = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return raw.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PlanningManagerTab() {
  const [view, setView]         = useState<'activite' | 'heures'>('activite')
  const [weekStart, setWeekStart] = useState(getMondayOfWeek())
  const [profiles, setProfiles]  = useState<UserProfile[]>([])

  const { entries, loading, upsert, upsertBulk } = usePlanning(weekStart)
  const { entries: timeEntries, loading: timeLoading } = useTeamTimeEntries(weekStart)

  const [editCell, setEditCell]   = useState<{ techId: string; techName: string; date: string } | null>(null)
  const [editType, setEditType]   = useState<PlanningType>('libre')
  const [editTexte, setEditTexte] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal]   = useState(false)
  const [bulkType, setBulkType]     = useState<PlanningType>('chantier')
  const [bulkTexte, setBulkTexte]   = useState('')

  // Charger tous les profils
  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setProfiles(data as UserProfile[])
    })
  }, [])

  const days   = getWeekDays(weekStart)
  const year   = new Date(weekStart + 'T00:00:00').getFullYear()
  const feries = getFeries(year)

  // Trier : techniciens d'abord (alpha), managers à la fin
  const sorted = [...profiles].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'manager' ? 1 : -1
    return a.full_name.localeCompare(b.full_name)
  })

  function getEntry(techId: string, date: string) {
    return entries.find(e => e.technicien_id === techId && e.date === date)
  }

  function openEdit(techId: string, techName: string, date: string) {
    const e = getEntry(techId, date)
    setEditCell({ techId, techName, date })
    setEditType(e?.type ?? 'libre')
    setEditTexte(e?.texte ?? '')
  }

  async function saveEdit() {
    if (!editCell) return
    await upsert(editCell.techId, editCell.date, editType, editTexte)
    setEditCell(null)
  }

  function toggleCell(techId: string, date: string) {
    const key = `${techId}|${date}`
    setSelected(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  async function applyBulk() {
    const cells = Array.from(selected).map(k => {
      const [techId, date] = k.split('|')
      return { techId, date }
    })
    await upsertBulk(cells, bulkType, bulkTexte)
    setSelected(new Set())
    setSelectMode(false)
    setBulkModal(false)
    setBulkTexte('')
  }

  function exportXLSX() {
    const wsData: string[][] = []

    // En-tête : JOUR + une colonne par personne
    wsData.push(['Jour', ...sorted.map(p => p.full_name)])

    // Lignes : une par jour
    for (const date of days) {
      const d          = new Date(date + 'T00:00:00')
      const isWeekend  = d.getDay() >= 6
      const isFerie    = feries.has(date)
      const dayLabel   = fmtDayLabel(date)
      const row: string[] = [dayLabel]

      for (const person of sorted) {
        if (isWeekend) {
          row.push('')
        } else {
          const entry = getEntry(person.id, date)
          if (entry && entry.type !== 'libre' && PT[entry.type]) {
            const label = PT[entry.type].label
            const note  = entry.texte ? ` – ${entry.texte}` : ''
            row.push(label + note)
          } else if (!entry && isFerie) {
            row.push('Férié')
          } else {
            row.push('Libre')
          }
        }
      }
      wsData.push(row)
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Largeur des colonnes
    ws['!cols'] = [
      { wch: 18 },
      ...sorted.map(() => ({ wch: 22 })),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planning')
    XLSX.writeFile(wb, `planning-${weekStart}.xlsx`)
  }

  function exportCSV() {
    const bom = '﻿'
    const header = [
      'Nom',
      ...days.map(d =>
        new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
          weekday: 'short', day: 'numeric', month: 'numeric',
        }),
      ),
      'Total semaine',
    ]
    const rows = sorted.map(p => {
      let totalMins = 0
      const cols = days.map(date => {
        const e = timeEntries.find(t => t.technicien_id === p.id && t.date === date)
        if (!e?.arrivee || !e?.depart) return ''
        const [ah, am] = e.arrivee.split(':').map(Number)
        const [dh, dm] = e.depart.split(':').map(Number)
        const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
        if (mins > 0) totalMins += mins
        return `${e.arrivee}-${e.depart}${e.pause ? ` (${e.pause}mn pause)` : ''}`
      })
      const h = Math.floor(totalMins / 60), m = totalMins % 60
      return [
        p.full_name, ...cols,
        totalMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`) : '—',
      ]
    })
    const csv  = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `heures-${weekStart}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Navigation semaine */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(prevMonday(weekStart))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-900 px-1 min-w-[190px] text-center">
            {fmtWeekRange(days)}
          </span>
          <button
            onClick={() => setWeekStart(nextMonday(weekStart))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            ›
          </button>
        </div>

        {/* Sélectionner (vue activité uniquement) */}
        {view === 'activite' && (
          <button
            onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-all ${
              selectMode
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {selectMode ? `Sélection (${selected.size})` : 'Sélectionner'}
          </button>
        )}

        <div className="flex-1" />

        {/* Exporter */}
        {view === 'activite' ? (
          <button
            onClick={exportXLSX}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter Excel
          </button>
        ) : (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter CSV
          </button>
        )}
      </div>

      {/* ── Onglets Planning activité / Heures équipe ─────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(['activite', 'heures'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
              view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {v === 'activite' ? 'Planning activité' : 'Heures équipe'}
          </button>
        ))}
      </div>

      {/* ═══════════════════ VUE PLANNING ACTIVITÉ ═══════════════════════════ */}
      {view === 'activite' && (
        <>
          {/* Légende */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
              <span key={k}
                className={`text-xs font-medium px-3 py-1 rounded-full border ${v.bg} ${v.text} ${v.border}`}>
                {v.label}
              </span>
            ))}
          </div>

          {/* Grille */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div
              className="bg-white rounded-2xl overflow-hidden overflow-x-auto"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <table
                className="w-full border-collapse"
                style={{ minWidth: `${180 + sorted.length * 140}px` }}>

                {/* ── En-tête : JOUR + une colonne par personne ── */}
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-widest sticky left-0 bg-white z-10 w-40">
                      JOUR
                    </th>
                    {sorted.map(person => (
                      <th key={person.id} className="px-3 py-3 text-center" style={{ minWidth: 130 }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                          <p className="text-xs font-semibold text-gray-700 leading-tight">
                            {person.full_name.split(' ')[0]}
                          </p>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* ── Corps : une ligne par jour ── */}
                <tbody>
                  {days.map(date => {
                    const dayLabel  = fmtDayLabel(date)
                    const isWeekend = new Date(date + 'T00:00:00').getDay() >= 6
                    const isToday   = date === TODAY
                    const isFerie   = !isWeekend && feries.has(date)

                    return (
                      <tr key={date} className="border-b border-gray-50 last:border-0">

                        {/* Colonne JOUR */}
                        <td className={`px-5 py-3 sticky left-0 z-10 border-r border-gray-100 ${isToday ? 'bg-orange-50/50' : 'bg-white'}`}>
                          <p className={`text-sm font-semibold ${isToday ? 'text-orange-500' : isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>
                            {dayLabel}
                          </p>
                          {isToday && (
                            <p className="text-[11px] text-orange-400 font-medium mt-0.5">Aujourd'hui</p>
                          )}
                        </td>

                        {/* Cellules par personne */}
                        {sorted.map(person => {
                          // Weekend → tiret
                          if (isWeekend) {
                            return (
                              <td key={person.id} className="px-3 py-2 text-center">
                                <span className="text-gray-300 text-sm">—</span>
                              </td>
                            )
                          }

                          const entry      = getEntry(person.id, date)
                          const cellKey    = `${person.id}|${date}`
                          const isSelected = selected.has(cellKey)

                          // Déterminer style de la cellule
                          let bg: string, textColor: string, border: string, label: string
                          let note: string | null = null

                          if (entry && entry.type !== 'libre' && PT[entry.type]) {
                            const pt = PT[entry.type]
                            bg = pt.bg; textColor = pt.text; border = pt.border
                            label = pt.label; note = entry.texte
                          } else if (!entry && isFerie) {
                            bg = 'bg-violet-50'; textColor = 'text-violet-500'
                            border = 'border-violet-200'; label = 'Férié'
                          } else {
                            bg = PT.libre.bg; textColor = PT.libre.text
                            border = PT.libre.border; label = 'Libre'
                          }

                          return (
                            <td
                              key={person.id}
                              onClick={() =>
                                selectMode
                                  ? toggleCell(person.id, date)
                                  : openEdit(person.id, person.full_name, date)
                              }
                              className={`px-3 py-2 cursor-pointer transition-colors relative ${
                                isSelected ? 'bg-orange-50' : 'hover:bg-gray-50/70'
                              }`}>

                              {/* Checkbox mode sélection */}
                              {selectMode && (
                                <div className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center z-10 ${
                                  isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              )}

                              {/* Pill de la cellule */}
                              <div className={`rounded-xl px-3 py-2.5 min-h-[52px] flex flex-col justify-center border ${bg} ${border}`}>
                                <p className={`text-xs font-semibold leading-tight ${textColor}`}>{label}</p>
                                {note && (
                                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{note}</p>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Barre bulk (fixe en bas) */}
          {selectMode && selected.size > 0 && (
            <div
              className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-6 py-4"
              style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.10)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-gray-700">
                  {selected.size} cellule{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setBulkModal(true)}
                  className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.40)' }}>
                  Affecter un type →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ VUE HEURES ÉQUIPE ═══════════════════════════════ */}
      {view === 'heures' && (
        <>
          {timeLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div
              className="bg-white rounded-2xl overflow-hidden overflow-x-auto"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-gray-400 font-semibold uppercase tracking-wide w-36">Nom</th>
                    {days.map(date => {
                      const d   = new Date(date + 'T00:00:00')
                      const raw = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
                      const lbl = raw.charAt(0).toUpperCase() + raw.slice(1)
                      return (
                        <th key={date} colSpan={4}
                          className={`text-center px-1 py-3 font-semibold uppercase tracking-wide ${date === TODAY ? 'text-orange-500' : 'text-gray-400'}`}>
                          {lbl}
                        </th>
                      )
                    })}
                    <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide">Total</th>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-5 py-2" />
                    {days.flatMap((_, i) => ([
                      <th key={`a${i}`} className="px-1 py-2 text-[10px] text-gray-400 font-medium text-center">Arr.</th>,
                      <th key={`d${i}`} className="px-1 py-2 text-[10px] text-gray-400 font-medium text-center">Dép.</th>,
                      <th key={`p${i}`} className="px-1 py-2 text-[10px] text-gray-400 font-medium text-center">Pause</th>,
                      <th key={`r${i}`} className="px-1 py-2 text-[10px] text-gray-400 font-medium text-center">Dur.</th>,
                    ]))}
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sorted.map(person => {
                    let totalMins = 0
                    const cells = days.map(date => {
                      const e   = timeEntries.find(t => t.technicien_id === person.id && t.date === date)
                      const dur = calcDuree(e?.arrivee ?? null, e?.depart ?? null, e?.pause ?? null)
                      if (dur !== '—' && e?.arrivee && e?.depart) {
                        const [ah, am] = e.arrivee.split(':').map(Number)
                        const [dh, dm] = e.depart.split(':').map(Number)
                        const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
                        if (mins > 0) totalMins += mins
                      }
                      return { e, dur }
                    })
                    const th = Math.floor(totalMins / 60), tm = totalMins % 60
                    const totalStr = totalMins > 0
                      ? (tm > 0 ? `${th}h${tm.toString().padStart(2, '0')}` : `${th}h`)
                      : '—'
                    return (
                      <tr key={person.id}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-800">{person.full_name.split(' ')[0]}</p>
                          {person.role === 'manager'
                            ? <p className="text-[10px] text-orange-500">Manager</p>
                            : person.poste && <p className="text-[10px] text-gray-400">{person.poste}</p>}
                        </td>
                        {cells.flatMap(({ e, dur }, i) => ([
                          <td key={`a${i}`} className="px-1 py-3 text-center text-gray-600">{e?.arrivee ?? <span className="text-gray-200">—</span>}</td>,
                          <td key={`d${i}`} className="px-1 py-3 text-center text-gray-600">{e?.depart ?? <span className="text-gray-200">—</span>}</td>,
                          <td key={`p${i}`} className="px-1 py-3 text-center text-gray-400">{e?.pause ? `${e.pause}mn` : <span className="text-gray-200">—</span>}</td>,
                          <td key={`r${i}`} className={`px-1 py-3 text-center font-semibold ${dur !== '—' ? 'text-gray-800' : 'text-gray-200'}`}>{dur}</td>,
                        ]))}
                        <td className="px-4 py-3 text-center font-bold text-orange-500">{totalStr}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-orange-100 bg-orange-50/60">
                    <td className="px-5 py-3 text-xs font-bold text-orange-700">Total équipe</td>
                    {days.flatMap((date, i) => {
                      let dayMins = 0
                      sorted.forEach(p => {
                        const e = timeEntries.find(t => t.technicien_id === p.id && t.date === date)
                        if (e?.arrivee && e?.depart) {
                          const [ah, am] = e.arrivee.split(':').map(Number)
                          const [dh, dm] = e.depart.split(':').map(Number)
                          const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
                          if (mins > 0) dayMins += mins
                        }
                      })
                      const h = Math.floor(dayMins / 60), m = dayMins % 60
                      const s = dayMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`) : '—'
                      return [
                        <td key={`ta${i}`} colSpan={3} className="px-1 py-3" />,
                        <td key={`td${i}`} className="px-1 py-3 text-center font-bold text-orange-600">{s}</td>,
                      ]
                    })}
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal : édition d'une cellule ─────────────────────────────────── */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setEditCell(null)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-4"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{editCell.techName}</p>
                <p className="text-sm text-gray-400">
                  {new Date(editCell.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
              </div>
              <button
                onClick={() => setEditCell(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setEditType(k)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border-2 ${
                    editType === k
                      ? `${v.bg} ${v.text} ${v.border}`
                      : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            <input
              value={editTexte}
              onChange={e => setEditTexte(e.target.value)}
              placeholder="Note (lieu, nom du chantier...)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            <button
              onClick={saveEdit}
              className="w-full text-white font-semibold py-3.5 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.40)' }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ── Modal : affectation en masse ──────────────────────────────────── */}
      {bulkModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setBulkModal(false)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-4"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">Affecter un type</p>
              <p className="text-sm text-gray-400">{selected.size} cellule{selected.size > 1 ? 's' : ''}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setBulkType(k)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border-2 ${
                    bulkType === k
                      ? `${v.bg} ${v.text} ${v.border}`
                      : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            <input
              value={bulkTexte}
              onChange={e => setBulkTexte(e.target.value)}
              placeholder="Note optionnelle (lieu, nom du chantier...)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setBulkModal(false); setBulkTexte('') }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={applyBulk}
                className="flex-1 text-white font-semibold py-3 rounded-xl text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import type { UserProfile, PlanningType, Chantier } from '@/types'
import {
  usePlanning,
  getMondayOfWeek,
  getWeekDays,
  fmtWeekRange,
  prevMonday,
  nextMonday,
  getFirstOfMonth,
  getMonthDays,
  prevMonth,
  nextMonth,
  fmtMonth,
} from '@/hooks/usePlanning'
import { useTeamTimeEntries, calcDuree } from '@/hooks/useTimeEntries'
import Avatar from '@/components/Avatar'
import { Coffee, Clock, ArrowRight } from 'lucide-react'

// ─── Couleurs par type ────────────────────────────────────────────────────────
const PT: Record<PlanningType, { label: string; bg: string; text: string; border: string }> = {
  chantier:          { label: 'Chantier',          bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200'   },
  grand_deplacement: { label: 'Grand déplacement',  bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
  depot:             { label: 'Dépôt',              bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300'   },
  route:             { label: 'Route',              bg: 'bg-yellow-50',  text: 'text-yellow-600', border: 'border-yellow-200' },
  repos_conges:      { label: 'Repos / Congés',     bg: 'bg-violet-50',  text: 'text-violet-500', border: 'border-violet-200' },
  absent:            { label: 'Absent',             bg: 'bg-red-50',     text: 'text-red-500',    border: 'border-red-200'    },
  ferie:             { label: 'Férié',              bg: 'bg-violet-50',  text: 'text-violet-500', border: 'border-violet-200' },
  libre:             { label: 'Libre',              bg: 'bg-amber-50',   text: 'text-amber-500',  border: 'border-amber-200'  },
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
export default function PlanningManagerTab({ entrepriseId }: { entrepriseId?: string }) {
  const [view, setView]         = useState<'activite' | 'heures'>('activite')
  const [weekStart, setWeekStart] = useState(getMondayOfWeek())
  const [profiles, setProfiles]  = useState<UserProfile[]>([])
  const [displayMode, setDisplayMode] = useState<'semaine' | 'mois'>('semaine')
  const [monthStart, setMonthStart] = useState(getFirstOfMonth())

  const weekEnd = getWeekDays(weekStart)[6]
  const monthDays = getMonthDays(monthStart)
  const monthEnd = monthDays[monthDays.length - 1]
  const planStart = displayMode === 'semaine' ? weekStart : monthStart
  const planEnd   = displayMode === 'semaine' ? weekEnd   : monthEnd
  const days = displayMode === 'semaine' ? getWeekDays(weekStart) : monthDays

  const { entries, loading, upsert, upsertBulk } = usePlanning(planStart, planEnd)
  const { entries: timeEntries, loading: timeLoading } = useTeamTimeEntries(weekStart, entrepriseId)

  const [editCell, setEditCell]         = useState<{ techId: string; techName: string; date: string } | null>(null)
  const [editType, setEditType]         = useState<PlanningType>('libre')
  const [editTexte, setEditTexte]       = useState('')
  const [editChantierId, setEditChantierId] = useState<string | null>(null)

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal]   = useState(false)
  const [bulkType, setBulkType]     = useState<PlanningType>('chantier')
  const [bulkTexte, setBulkTexte]   = useState('')
  const [bulkChantierId, setBulkChantierId] = useState<string | null>(null)

  const [chantiers, setChantiers] = useState<Chantier[]>([])
  const [chantiersLoaded, setChantiersLoaded] = useState(false)

  // Export modal
  const [exportModal, setExportModal] = useState<'xlsx' | 'csv' | null>(null)
  const [exportStart, setExportStart] = useState(weekStart)
  const [exportEnd,   setExportEnd]   = useState(getWeekDays(weekStart)[6])
  const [exportLoading, setExportLoading] = useState(false)

  // Charger profils + chantiers (filtrés par entreprise si sélecteur admin actif)
  useEffect(() => {
    setChantiersLoaded(false)
    let profilesQuery = supabase.from('profiles').select('*')
    if (entrepriseId) profilesQuery = profilesQuery.eq('entreprise_id', entrepriseId)
    profilesQuery.then(({ data }) => {
      if (data) setProfiles(data as UserProfile[])
    })

    let chantiersQuery = supabase.from('chantiers').select('id, nom, client_nom, statut').order('nom')
    if (entrepriseId) chantiersQuery = chantiersQuery.eq('entreprise_id', entrepriseId)
    chantiersQuery.then(({ data }) => {
      if (data) setChantiers(data as Chantier[])
      setChantiersLoaded(true)
    })
  }, [entrepriseId])

  const year   = new Date(weekStart + 'T00:00:00').getFullYear()
  const feries = getFeries(year)

  // Trier : techniciens d'abord (alpha), managers à la fin
  const sorted = [...profiles].sort((a, b) => {
    if (a.role !== b.role) return (a.role === 'manager' || a.role === 'admin') ? 1 : -1
    return a.full_name.localeCompare(b.full_name)
  })

  function getEntry(techId: string, date: string) {
    return entries.find(e => e.technicien_id === techId && e.date === date)
  }

  function openEdit(techId: string, techName: string, date: string) {
    const e = getEntry(techId, date)
    setEditCell({ techId, techName, date })
    setEditType(e?.type ?? 'libre')
    setEditTexte(e?.label ?? '')
    setEditChantierId(e?.chantier_id ?? null)
  }

  async function saveEdit() {
    if (!editCell) return
    await upsert(editCell.techId, editCell.date, editType, editTexte, editChantierId)
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
    await upsertBulk(cells, bulkType, bulkTexte, bulkChantierId)
    setSelected(new Set())
    setSelectMode(false)
    setBulkModal(false)
    setBulkTexte('')
    setBulkChantierId(null)
  }

  function handleSetDisplayMode(mode: 'semaine' | 'mois') {
    if (mode === 'mois') {
      // Aller au mois contenant la semaine affichée
      setMonthStart(getFirstOfMonth(new Date(weekStart + 'T00:00:00')))
    } else {
      // Aller à la semaine contenant le 1er du mois affiché
      setWeekStart(getMondayOfWeek(new Date(monthStart + 'T00:00:00')))
    }
    setDisplayMode(mode)
    setSelectMode(false)
    setSelected(new Set())
  }

  // ─── Helpers export ──────────────────────────────────────────────────────────
  function getDaysRange(start: string, end: string): string[] {
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const result: string[] = []
    const cur = new Date(sy, sm - 1, sd)
    const last = new Date(ey, em - 1, ed)
    while (cur <= last) {
      result.push(localISO(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  function getFeriesRange(start: string, end: string): Set<string> {
    const y0 = new Date(start + 'T00:00:00').getFullYear()
    const y1 = new Date(end   + 'T00:00:00').getFullYear()
    const all = new Set<string>()
    for (let y = y0; y <= y1; y++) getFeries(y).forEach(f => all.add(f))
    return all
  }

  async function doExport() {
    setExportLoading(true)
    const rangeDays  = getDaysRange(exportStart, exportEnd)
    const rangeFeries = getFeriesRange(exportStart, exportEnd)

    if (exportModal === 'xlsx') {
      // Fetch planning entries for range
      const { data } = await supabase
        .from('planning_entries')
        .select('*')
        .gte('date', exportStart)
        .lte('date', exportEnd)
      const rangeEntries = data ?? []

      const wsData: string[][] = [['Jour', ...sorted.map(p => p.full_name)]]
      for (const date of rangeDays) {
        const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
        const isFerie   = rangeFeries.has(date)
        const row: string[] = [fmtDayLabel(date)]
        for (const person of sorted) {
          if (isWeekend) { row.push(''); continue }
          const entry = rangeEntries.find(e => e.technicien_id === person.id && e.date === date)
          if (entry && entry.type !== 'libre' && PT[entry.type as PlanningType]) {
            const lbl  = PT[entry.type as PlanningType].label
            const note = entry.label ? ` – ${entry.label}` : ''
            row.push(lbl + note)
          } else if (!entry && isFerie) {
            row.push('Férié')
          } else {
            row.push('Libre')
          }
        }
        wsData.push(row)
      }
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = [{ wch: 18 }, ...sorted.map(() => ({ wch: 22 }))]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Planning')
      XLSX.writeFile(wb, `planning-${exportStart}_${exportEnd}.xlsx`)

    } else {
      // Fetch time entries for range
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .gte('date', exportStart)
        .lte('date', exportEnd)
      // Mapper les colonnes DB (heure_arrivee → arrivee, etc.)
      type RawTime = { technicien_id: string; date: string; heure_arrivee?: string; arrivee?: string; heure_depart?: string; depart?: string; pause_minutes?: number; pause?: number }
      const rangeTime = (data ?? [] as RawTime[]).map((r: RawTime) => ({
        technicien_id: r.technicien_id,
        date:          r.date,
        arrivee:       r.heure_arrivee ?? r.arrivee ?? null,
        depart:        r.heure_depart  ?? r.depart  ?? null,
        pause:         r.pause_minutes ?? r.pause   ?? null,
      }))

      const bom = '﻿'
      const header = [
        'Nom',
        ...rangeDays.map(d =>
          new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
            weekday: 'short', day: 'numeric', month: 'numeric',
          }),
        ),
        'Total période',
      ]
      const rows = sorted.map(p => {
        let totalMins = 0
        const cols = rangeDays.map(date => {
          const e = rangeTime.find(t => t.technicien_id === p.id && t.date === date)
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
      a.href = url; a.download = `heures-${exportStart}_${exportEnd}.csv`; a.click()
      URL.revokeObjectURL(url)
    }

    setExportLoading(false)
    setExportModal(null)
  }

  function openExportModal(type: 'xlsx' | 'csv') {
    setExportStart(planStart)
    setExportEnd(planEnd)
    setExportModal(type)
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap bg-white rounded-2xl px-4 py-3.5 border border-slate-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => displayMode === 'semaine' ? setWeekStart(prevMonday(weekStart)) : setMonthStart(prevMonth(monthStart))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>‹</button>
          <span className="text-sm font-semibold text-gray-900 px-1 min-w-[190px] text-center">
            {displayMode === 'semaine' ? fmtWeekRange(getWeekDays(weekStart)) : fmtMonth(monthStart)}
          </span>
          <button
            onClick={() => displayMode === 'semaine' ? setWeekStart(nextMonday(weekStart)) : setMonthStart(nextMonth(monthStart))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>›</button>
        </div>

        {/* Toggle Semaine / Mois */}
        <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg">
          {(['semaine', 'mois'] as const).map(m => (
            <button key={m} onClick={() => handleSetDisplayMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                displayMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {m === 'semaine' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>

        {/* Sélectionner (vue activité uniquement) */}
        {(view === 'activite' || displayMode === 'mois') && (
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
            onClick={() => openExportModal('xlsx')}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter Excel
          </button>
        ) : (
          <button
            onClick={() => openExportModal('csv')}
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
      {displayMode === 'semaine' && (
        <div className="flex p-1 bg-white rounded-xl border border-slate-100 w-fit" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {(['activite', 'heures'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                view === v
                  ? 'bg-slate-50 text-orange-600 ring-1 ring-slate-200/70 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {v === 'activite' ? 'Planning activité' : 'Heures équipe'}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════ VUE PLANNING ACTIVITÉ ═══════════════════════════ */}
      {view === 'activite' && displayMode === 'semaine' && (
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
                  <tr className="border-b border-gray-100 bg-slate-50/60">
                    <th className="text-left px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50/60 z-10 w-40">
                      Jour
                    </th>
                    {sorted.map(person => (
                      <th key={person.id} className="px-3 py-4 text-center border-l border-slate-100/60" style={{ minWidth: 130 }}>
                        <div className="flex flex-col items-center gap-2">
                          <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                          <p className="text-xs font-bold text-slate-800 leading-tight">
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
                    const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
                    const isToday   = date === TODAY
                    const isFerie   = !isWeekend && feries.has(date)

                    return (
                      <tr key={date} className={`border-b border-gray-50 last:border-0 group ${isWeekend ? 'bg-slate-50/50' : ''}`}>

                        {/* Colonne JOUR */}
                        <td className={`px-5 py-3 sticky left-0 z-10 border-r border-gray-100 transition-colors ${
                          isToday
                            ? 'bg-orange-50/40 border-l-4 border-l-orange-500'
                            : isWeekend
                            ? 'bg-slate-50/50'
                            : 'bg-white group-hover:bg-slate-50/30'
                        }`}>
                          <p className={`text-sm font-bold ${isToday ? 'text-orange-600' : isWeekend ? 'text-slate-400' : 'text-slate-800'}`}>
                            {dayLabel}
                          </p>
                          {isToday && (
                            <p className="text-[11px] text-orange-500 font-semibold mt-0.5">Aujourd'hui</p>
                          )}
                        </td>

                        {/* Cellules par personne */}
                        {sorted.map(person => {
                          // Weekend → tiret
                          if (isWeekend) {
                            return (
                              <td key={person.id} className="px-3 py-2 text-center border-l border-slate-100/40">
                                <span className="text-slate-300 text-sm">—</span>
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
                            label = pt.label; note = entry.label
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
                              className={`px-2 py-2 cursor-pointer transition-colors relative border-l border-slate-100/40 ${
                                isSelected ? 'bg-orange-50' : 'hover:bg-slate-50/40'
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

                              {/* Card de la cellule */}
                              <div className={`rounded-xl px-2.5 py-2.5 min-h-[64px] flex flex-col justify-center border transition-shadow hover:shadow-sm ${bg} ${border}`}>
                                <p className={`text-xs font-bold leading-tight tracking-tight ${textColor}`}>{label}</p>
                                {note && (
                                  <p className="text-[10px] opacity-75 mt-0.5 leading-snug line-clamp-2">{note}</p>
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

      {/* ═══════════════════ VUE PLANNING MOIS ══════════════════════════════ */}
      {displayMode === 'mois' && (() => {
        function fmtDayShort(iso: string) {
          const d = new Date(iso + 'T00:00:00')
          const day = d.toLocaleDateString('fr-FR', { weekday: 'short' })
          return `${day.charAt(0).toUpperCase()}${day.slice(1, 3)} ${d.getDate()}`
        }

        return (
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
                  style={{ minWidth: `${180 + sorted.length * 120}px` }}>
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50/60">
                      <th className="text-left px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50/60 z-10 w-40">
                        Jour
                      </th>
                      {sorted.map(person => (
                        <th key={person.id} className="px-3 py-4 text-center border-l border-slate-100/60" style={{ minWidth: 110 }}>
                          <div className="flex flex-col items-center gap-2">
                            <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                            <p className="text-xs font-bold text-slate-800 leading-tight">
                              {person.full_name.split(' ')[0]}
                            </p>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthDays.map((date, dayIdx) => {
                      const dayLabel  = fmtDayShort(date)
                      const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
                      const isToday   = date === TODAY
                      const yearOfDay = new Date(date + 'T00:00:00').getFullYear()
                      const feriesOfDay = getFeries(yearOfDay)
                      const isFerie   = !isWeekend && feriesOfDay.has(date)
                      // Numéro de semaine ISO pour l'alternance
                      const weekIdx = Math.floor(dayIdx / 7)
                      const rowBg = isToday
                        ? 'bg-orange-50/30'
                        : isWeekend
                        ? 'bg-slate-50/50'
                        : weekIdx % 2 === 1 ? 'bg-gray-50/30' : ''

                      return (
                        <tr key={date} className={`border-b border-gray-50 last:border-0 group ${rowBg}`}>
                          <td className={`px-5 py-1.5 sticky left-0 z-10 border-r border-gray-100 transition-colors ${
                            isToday
                              ? 'bg-orange-50/40 border-l-4 border-l-orange-500'
                              : isWeekend
                              ? 'bg-slate-50/50'
                              : weekIdx % 2 === 1 ? 'bg-gray-50/30' : 'bg-white group-hover:bg-slate-50/30'
                          }`}>
                            <p className={`text-xs font-bold ${isToday ? 'text-orange-600' : isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                              {dayLabel}
                            </p>
                          </td>
                          {sorted.map(person => {
                            if (isWeekend) {
                              return (
                                <td key={person.id} className="px-2 py-1 text-center border-l border-slate-100/40">
                                  <span className="text-slate-300 text-xs">—</span>
                                </td>
                              )
                            }

                            const entry      = getEntry(person.id, date)
                            const cellKey    = `${person.id}|${date}`
                            const isSelected = selected.has(cellKey)

                            let bg: string, textColor: string, border: string, label: string
                            let note: string | null = null

                            if (entry && entry.type !== 'libre' && PT[entry.type]) {
                              const pt = PT[entry.type]
                              bg = pt.bg; textColor = pt.text; border = pt.border
                              label = pt.label; note = entry.label
                            } else if (!entry && isFerie) {
                              bg = 'bg-violet-50'; textColor = 'text-violet-500'
                              border = 'border-violet-200'; label = 'Férié'
                            } else {
                              bg = PT.libre.bg; textColor = PT.libre.text
                              border = PT.libre.border; label = 'Libre'
                            }

                            // En mode mois, les cellules "Libre" sont vides pour ne pas surcharger
                            if (label === 'Libre') {
                              return (
                                <td
                                  key={person.id}
                                  onClick={() =>
                                    selectMode
                                      ? toggleCell(person.id, date)
                                      : openEdit(person.id, person.full_name, date)
                                  }
                                  className={`px-2 py-1 cursor-pointer transition-colors relative ${
                                    isSelected ? 'bg-orange-50' : 'hover:bg-gray-50/70'
                                  }`}>
                                  {selectMode && (
                                    <div className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 flex items-center justify-center z-10 ${
                                      isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div className="rounded-lg min-h-[36px]" />
                                </td>
                              )
                            }

                            return (
                              <td
                                key={person.id}
                                onClick={() =>
                                  selectMode
                                    ? toggleCell(person.id, date)
                                    : openEdit(person.id, person.full_name, date)
                                }
                                className={`px-2 py-1 cursor-pointer transition-colors relative ${
                                  isSelected ? 'bg-orange-50' : 'hover:bg-gray-50/70'
                                }`}>
                                {selectMode && (
                                  <div className={`absolute top-1 right-1 w-3 h-3 rounded-full border-2 flex items-center justify-center z-10 ${
                                    isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                <div className={`rounded-lg px-2 py-1.5 min-h-[36px] flex flex-col justify-center border ${bg} ${border}`}>
                                  <p className={`text-[10px] font-semibold leading-tight ${textColor}`}>{label}</p>
                                  {note && (
                                    <p className="text-[9px] text-gray-500 mt-0.5 leading-snug line-clamp-1">{note}</p>
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

            {/* Barre bulk mois */}
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
        )
      })()}

      {/* ═══════════════════ VUE HEURES ÉQUIPE ═══════════════════════════════ */}
      {view === 'heures' && displayMode === 'semaine' && (
        <>
          {timeLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">

              {/* ── Tableau Time Cards ─────────────────────────────────────── */}
              <div
                className="bg-white rounded-2xl overflow-hidden overflow-x-auto border border-slate-100"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="p-5 font-medium text-xs text-slate-500 uppercase tracking-widest w-56">Équipe</th>
                      {days.map(date => {
                        const d   = new Date(date + 'T00:00:00')
                        const raw = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                        const lbl = raw.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                        const isWeekend = [0, 6].includes(d.getDay())
                        return (
                          <th key={date} className="p-5 text-center">
                            <span className={`text-sm font-medium tracking-wide ${
                              date === TODAY ? 'text-orange-600' : isWeekend ? 'text-slate-300' : 'text-slate-500'
                            }`}>
                              {lbl}
                            </span>
                          </th>
                        )
                      })}
                      <th className="p-5 text-center">
                        <span className="text-sm font-semibold text-orange-500 uppercase tracking-wide">Total</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {sorted.map(person => (
                      <tr key={person.id} className="hover:bg-slate-50/30 transition-colors">

                        {/* Colonne nom */}
                        <td className="p-5 align-middle">
                          <div className="flex items-center gap-3">
                            <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                            <div>
                              <div className="font-medium text-slate-800">{person.full_name}</div>
                              {(person.poste || person.role === 'admin' || person.role === 'manager') && (
                                <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                                  {person.poste ?? (person.role === 'admin' ? 'Admin' : 'Manager')}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Time Cards par jour */}
                        {days.map(date => {
                          const isToday   = date === TODAY
                          const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
                          const e   = timeEntries.find(t => t.technicien_id === person.id && t.date === date)
                          const dur = e?.arrivee && e?.depart ? calcDuree(e.arrivee, e.depart, e.pause) : null
                          const pauseMin = e?.pause ?? 0
                          const pauseStr = pauseMin > 0
                            ? (pauseMin >= 60
                              ? `${Math.floor(pauseMin / 60)}h${pauseMin % 60 > 0 ? (pauseMin % 60) + 'm' : ''}`
                              : `${pauseMin}m`)
                            : null

                          // Cellule weekend ou vide
                          if (isWeekend || !e?.arrivee) {
                            return (
                              <td key={date} className="p-2 align-middle">
                                <div className={`h-[84px] w-full rounded-xl border-2 border-dashed flex items-center justify-center ${
                                  isToday && !isWeekend
                                    ? 'border-orange-200/50 bg-orange-50/20'
                                    : 'border-slate-100'
                                }`}>
                                  <div className="w-4 h-0.5 bg-slate-200 rounded-full" />
                                </div>
                              </td>
                            )
                          }

                          // Time Card avec données
                          return (
                            <td key={date} className="p-2 align-middle">
                              <div className={`h-[84px] w-full rounded-xl border p-3 flex flex-col justify-between transition-all group ${
                                isToday
                                  ? 'bg-orange-50/50 border-orange-200 hover:border-orange-400 hover:shadow-md hover:shadow-orange-500/10'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                              }`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center text-[11px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                                    {e.arrivee}
                                    <ArrowRight className="w-3 h-3 mx-1 text-slate-400 shrink-0" />
                                    {e.depart || '...'}
                                  </div>
                                  {dur && dur !== '—' && (
                                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-md shadow-sm border shrink-0 ml-1 ${
                                      isToday
                                        ? 'bg-orange-500 text-white border-orange-600'
                                        : 'bg-slate-100 text-slate-800 border-slate-200'
                                    }`}>
                                      {dur}
                                    </div>
                                  )}
                                </div>
                                {pauseStr && (
                                  <div className="flex items-center text-[10px] font-medium text-slate-400">
                                    <span className="flex items-center bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                      <Coffee className="w-3 h-3 mr-1 text-slate-400" />{pauseStr}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          )
                        })}

                        {/* Total semaine par personne */}
                        {(() => {
                          let personTotalMins = 0
                          days.forEach(date => {
                            const e = timeEntries.find(t => t.technicien_id === person.id && t.date === date)
                            if (e?.arrivee && e?.depart) {
                              const [ah, am] = e.arrivee.split(':').map(Number)
                              const [dh, dm] = e.depart.split(':').map(Number)
                              const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
                              if (mins > 0) personTotalMins += mins
                            }
                          })
                          const ph = Math.floor(personTotalMins / 60), pm = personTotalMins % 60
                          const str = personTotalMins > 0 ? (pm > 0 ? `${ph}h${pm.toString().padStart(2, '0')}` : `${ph}h`) : '—'
                          return (
                            <td className="p-2 align-middle">
                              <div className={`h-[84px] w-full rounded-xl flex items-center justify-center font-bold text-lg ${
                                personTotalMins > 0 ? 'text-orange-600 bg-orange-50 border border-orange-100' : 'text-slate-300 bg-slate-50'
                              }`}>
                                {str}
                              </div>
                            </td>
                          )
                        })()}
                      </tr>
                    ))}
                  </tbody>

                  {/* Footer totaux */}
                  <tfoot className="bg-orange-50/30 border-t border-orange-100/50">
                    <tr>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-orange-500" />
                          <span className="font-semibold text-orange-800 text-sm uppercase tracking-wider">Total Équipe</span>
                        </div>
                      </td>
                      {days.map(date => {
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
                        const s = dayMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`) : '0h'
                        return (
                          <td key={date} className="p-5 text-center">
                            <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-semibold tracking-tight ${
                              dayMins > 0
                                ? 'bg-white border border-orange-200 text-orange-600 shadow-sm'
                                : 'text-slate-400'
                            }`}>
                              {s}
                            </div>
                          </td>
                        )
                      })}
                      {/* Grand total toutes personnes + toute la semaine */}
                      {(() => {
                        let grandTotalMins = 0
                        sorted.forEach(p => {
                          days.forEach(date => {
                            const e = timeEntries.find(t => t.technicien_id === p.id && t.date === date)
                            if (e?.arrivee && e?.depart) {
                              const [ah, am] = e.arrivee.split(':').map(Number)
                              const [dh, dm] = e.depart.split(':').map(Number)
                              const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
                              if (mins > 0) grandTotalMins += mins
                            }
                          })
                        })
                        const h = Math.floor(grandTotalMins / 60), m = grandTotalMins % 60
                        const str = grandTotalMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`) : '—'
                        return (
                          <td className="p-5 text-center">
                            <div className={`inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold tracking-tight ${
                              grandTotalMins > 0 ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400'
                            }`}>
                              {str}
                            </div>
                          </td>
                        )
                      })()}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Répartition par chantier ───────────────────────────────── */}
              {chantiersLoaded && (() => {
                type ChantierStat = { chantier_id: string; totalMins: number; techIds: Set<string> }
                const map = new Map<string, ChantierStat>()
                for (const e of timeEntries) {
                  if (!e.chantier_id || !e.arrivee || !e.depart) continue
                  const [ah, am] = e.arrivee.split(':').map(Number)
                  const [dh, dm] = e.depart.split(':').map(Number)
                  const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
                  if (mins <= 0) continue
                  const existing = map.get(e.chantier_id)
                  if (existing) {
                    existing.totalMins += mins
                    existing.techIds.add(e.technicien_id)
                  } else {
                    map.set(e.chantier_id, { chantier_id: e.chantier_id, totalMins: mins, techIds: new Set([e.technicien_id]) })
                  }
                }
                const stats = Array.from(map.values())
                  .filter(s => chantiers.some(c => c.id === s.chantier_id))
                  .sort((a, b) => b.totalMins - a.totalMins)

                if (stats.length === 0) return (
                  <p className="text-sm text-slate-400 italic px-1">
                    Aucun chantier associé cette semaine. Les techniciens peuvent sélectionner un chantier lors de la saisie de leurs heures.
                  </p>
                )

                const totalAllMins = stats.reduce((acc, s) => acc + s.totalMins, 0)

                return (
                  <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Répartition par chantier</h3>
                      <span className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">Semaine en cours</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {stats.map(s => {
                        const chantier = chantiers.find(c => c.id === s.chantier_id)
                        const h = Math.floor(s.totalMins / 60), m = s.totalMins % 60
                        const dur = m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
                        const techNames = Array.from(s.techIds)
                          .map(id => profiles.find(p => p.id === id)?.full_name ?? null)
                          .filter(Boolean) as string[]
                        const pct = Math.round((s.totalMins / totalAllMins) * 100)
                        return (
                          <div
                            key={s.chantier_id}
                            className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col justify-between transition-all hover:shadow-md group"
                            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                            <div className="flex justify-between items-start mb-6">
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-slate-900 text-base group-hover:text-orange-600 transition-colors truncate">
                                  {chantier?.nom ?? 'Chantier inconnu'}
                                </span>
                                {chantier?.client_nom && (
                                  <span className="text-xs text-slate-500 font-medium mt-1 truncate">{chantier.client_nom}</span>
                                )}
                              </div>
                              <div className="text-2xl font-semibold text-slate-800 tracking-tight flex-shrink-0 ml-3">{dur}</div>
                            </div>
                            <div className="w-full">
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-xs text-slate-400 font-medium line-clamp-1 flex-1 pr-4">
                                  {techNames.length > 0
                                    ? techNames.join(', ')
                                    : `${s.techIds.size} technicien${s.techIds.size > 1 ? 's' : ''}`}
                                </span>
                                <span className="text-xs font-medium text-orange-500">{pct}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-orange-500 h-2 rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

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

            {/* Sélecteur chantier si type = chantier */}
            {editType === 'chantier' && chantiers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chantier</p>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-gray-200 p-1">
                  {chantiers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setEditTexte(c.nom); setEditChantierId(c.id) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        editChantierId === c.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}>
                      <span className="font-medium">{c.client_nom}</span>
                      <span className="text-gray-400"> · {c.nom}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              value={editTexte}
              onChange={e => { setEditTexte(e.target.value); setEditChantierId(null) }}
              placeholder={editType === 'chantier' ? 'Ou saisir manuellement...' : 'Note optionnelle (lieu, détail...)'}
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

      {/* ── Modal : export plage de dates ────────────────────────────────── */}
      {exportModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setExportModal(null)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-5"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">
                  {exportModal === 'xlsx' ? 'Exporter le planning' : 'Exporter les heures'}
                </p>
                <p className="text-sm text-gray-400">Choisissez la période</p>
              </div>
              <button
                onClick={() => setExportModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Du</label>
                <input
                  type="date"
                  value={exportStart}
                  onChange={e => setExportStart(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Au</label>
                <input
                  type="date"
                  value={exportEnd}
                  min={exportStart}
                  onChange={e => setExportEnd(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setExportModal(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={doExport}
                disabled={exportLoading || !exportStart || !exportEnd || exportEnd < exportStart}
                className="flex-1 flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-xl text-sm transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                {exportLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Télécharger
                  </>
                )}
              </button>
            </div>
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

            {/* Sélecteur chantier si type = chantier */}
            {bulkType === 'chantier' && chantiers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Chantier</p>
                <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-gray-200 p-1">
                  {chantiers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setBulkTexte(c.nom); setBulkChantierId(c.id) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        bulkChantierId === c.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}>
                      <span className="font-medium">{c.client_nom}</span>
                      <span className="text-gray-400"> · {c.nom}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              value={bulkTexte}
              onChange={e => { setBulkTexte(e.target.value); setBulkChantierId(null) }}
              placeholder={bulkType === 'chantier' ? 'Ou saisir manuellement...' : 'Note optionnelle (lieu, détail...)'}
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

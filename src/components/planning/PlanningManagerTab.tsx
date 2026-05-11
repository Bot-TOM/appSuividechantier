import { useState } from 'react'
import type { UserProfile, PlanningType } from '@/types'
import {
  usePlanning,
  getMondayOfWeek,
  getWeekDays,
  fmtDay,
  fmtWeekRange,
  prevMonday,
  nextMonday,
} from '@/hooks/usePlanning'
import { useTeamTimeEntries, calcDuree } from '@/hooks/useTimeEntries'
import Avatar from '@/components/Avatar'

// ─── Types planning ───────────────────────────────────────────────────────────
const PT: Record<PlanningType, { label: string; bg: string; text: string; border: string }> = {
  chantier:          { label: 'Chantier',          bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-300' },
  grand_deplacement: { label: 'Grand déplacement',  bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-300' },
  depot:             { label: 'Dépôt',              bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-300' },
  route:             { label: 'Route',              bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-300' },
  repos_conges:      { label: 'Repos / Congés',     bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-300' },
  absent:            { label: 'Absent',             bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-300' },
  libre:             { label: 'Libre',              bg: 'bg-gray-50',    text: 'text-gray-400',   border: 'border-gray-200' },
}

const TODAY = new Date().toISOString().split('T')[0]

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PlanningManagerTab({ profiles }: { profiles: UserProfile[] }) {
  const [view, setView]           = useState<'grille' | 'heures'>('grille')
  const [weekStart, setWeekStart] = useState(getMondayOfWeek())

  const { entries, loading, upsert, upsertBulk } = usePlanning(weekStart)
  const { entries: timeEntries, loading: timeLoading } = useTeamTimeEntries(weekStart)

  const [editCell, setEditCell]   = useState<{ techId: string; techName: string; date: string } | null>(null)
  const [editType, setEditType]   = useState<PlanningType>('libre')
  const [editTexte, setEditTexte] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal]   = useState(false)
  const [bulkType, setBulkType]     = useState<PlanningType>('chantier')

  const days   = getWeekDays(weekStart)
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
    setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  async function applyBulk() {
    const cells = Array.from(selected).map(k => {
      const [techId, date] = k.split('|')
      return { techId, date }
    })
    await upsertBulk(cells, bulkType)
    setSelected(new Set())
    setSelectMode(false)
    setBulkModal(false)
  }

  function exportCSV() {
    const bom = '﻿'
    const header = ['Nom', ...days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' })), 'Total semaine']
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
      return [p.full_name, ...cols, totalMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`) : '—']
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `heures-${weekStart}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['grille', 'heures'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === v ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={view === v ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}>
            {v === 'grille' ? 'Grille planning' : 'Heures équipe'}
          </button>
        ))}
      </div>

      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(prevMonday(weekStart))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          ←
        </button>
        <span className="text-sm font-semibold text-gray-900">{fmtWeekRange(days)}</span>
        <button onClick={() => setWeekStart(nextMonday(weekStart))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
          →
        </button>
      </div>

      {/* ── Vue Grille ─────────────────────────────────────────────────────── */}
      {view === 'grille' && (
        <>
          {/* Légende + sélection */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
                <span key={k} className={`text-xs font-semibold px-2 py-1 rounded-full ${v.bg} ${v.text}`}>{v.label}</span>
              ))}
            </div>
            <button
              onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                selectMode ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {selectMode ? 'Annuler' : 'Sélectionner'}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden overflow-x-auto no-scrollbar"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              {/* En-tête */}
              <div className="grid border-b border-gray-100 min-w-[700px]"
                style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
                <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Équipe</div>
                {days.map(date => {
                  const { short, num } = fmtDay(date)
                  const isToday = date === TODAY
                  return (
                    <div key={date} className={`px-1 py-3 text-center ${isToday ? 'bg-orange-50' : ''}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>{short}</p>
                      <p className={`text-sm font-bold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>{num}</p>
                    </div>
                  )
                })}
              </div>

              {/* Lignes par personne */}
              <div className="divide-y divide-gray-50 min-w-[700px]">
                {sorted.map(person => (
                  <div key={person.id} className="grid" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
                    {/* Nom */}
                    <div className="px-3 py-2 flex items-center gap-2 border-r border-gray-50">
                      <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{person.full_name.split(' ')[0]}</p>
                        {person.role === 'manager'
                          ? <p className="text-[10px] text-orange-500 font-medium">Manager</p>
                          : person.poste && <p className="text-[10px] text-gray-400 truncate">{person.poste}</p>}
                      </div>
                    </div>

                    {/* Cellules jours */}
                    {days.map(date => {
                      const entry     = getEntry(person.id, date)
                      const key       = `${person.id}|${date}`
                      const isSelected = selected.has(key)
                      const isToday   = date === TODAY
                      const pt        = entry ? PT[entry.type] : null
                      return (
                        <div key={date}
                          onClick={() => selectMode ? toggleCell(person.id, date) : openEdit(person.id, person.full_name, date)}
                          className={`px-1 py-2 min-h-[60px] cursor-pointer transition-colors relative flex flex-col justify-center
                            ${isToday ? 'bg-orange-50/40' : ''}
                            ${isSelected ? 'bg-orange-100' : 'hover:bg-gray-50'}`}>
                          {/* Checkbox select mode */}
                          {selectMode && (
                            <div className={`absolute top-1 right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300 bg-white'}`}>
                              {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          )}
                          {pt && entry ? (
                            <div className={`rounded-lg px-1.5 py-1 mx-0.5 ${pt.bg}`}>
                              <p className={`text-[10px] font-semibold truncate leading-tight ${pt.text}`}>{pt.label}</p>
                              {entry.texte && <p className="text-[10px] text-gray-500 truncate mt-0.5 leading-tight">{entry.texte}</p>}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity h-full">
                              <span className="text-gray-300 text-xl leading-none">+</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barre bulk */}
          {selectMode && selected.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-6 py-4"
              style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.10)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="max-w-4xl md:max-w-6xl mx-auto flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-gray-700">
                  {selected.size} cellule{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
                </p>
                <button onClick={() => setBulkModal(true)}
                  className="text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.40)' }}>
                  Affecter un type →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Vue Heures équipe ──────────────────────────────────────────────── */}
      {view === 'heures' && (
        <>
          <div className="flex justify-end">
            <button onClick={exportCSV}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter CSV
            </button>
          </div>

          {timeLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden overflow-x-auto no-scrollbar"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide w-36">Nom</th>
                    {days.map(date => {
                      const { short, num } = fmtDay(date)
                      return (
                        <th key={date} colSpan={4} className={`text-center px-1 py-3 font-semibold uppercase tracking-wide ${date === TODAY ? 'text-orange-500' : 'text-gray-400'}`}>
                          {short} {num}
                        </th>
                      )
                    })}
                    <th className="text-center px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide">Total</th>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-1.5" />
                    {days.flatMap((_date, i) => ([
                      <th key={`a${i}`} className="px-1 py-1.5 text-[10px] text-gray-400 font-medium text-center">Arr.</th>,
                      <th key={`d${i}`} className="px-1 py-1.5 text-[10px] text-gray-400 font-medium text-center">Dép.</th>,
                      <th key={`p${i}`} className="px-1 py-1.5 text-[10px] text-gray-400 font-medium text-center">Pause</th>,
                      <th key={`r${i}`} className="px-1 py-1.5 text-[10px] text-gray-400 font-medium text-center">Dur.</th>,
                    ]))}
                    <th className="px-4 py-1.5" />
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
                    const totalStr = totalMins > 0 ? (tm > 0 ? `${th}h${tm.toString().padStart(2,'0')}` : `${th}h`) : '—'

                    return (
                      <tr key={person.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-800 truncate">{person.full_name.split(' ')[0]}</p>
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
                  <tr className="border-t-2 border-orange-100 bg-orange-50">
                    <td className="px-4 py-3 text-xs font-bold text-orange-700">Total équipe</td>
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
                      const s = dayMins > 0 ? (m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`) : '—'
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

      {/* ── Modal édition cellule ──────────────────────────────────────────── */}
      {editCell && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setEditCell(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-5"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">{editCell.techName}</p>
                <p className="text-sm text-gray-400">
                  {new Date(editCell.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <button onClick={() => setEditCell(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
                <button key={k} onClick={() => setEditType(k)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border-2 ${
                    editType === k ? `${v.bg} ${v.text} ${v.border}` : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            <input
              value={editTexte}
              onChange={e => setEditTexte(e.target.value)}
              placeholder="Note libre (lieu, détail...)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />

            <button onClick={saveEdit}
              className="w-full text-white font-semibold py-3.5 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.40)' }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ── Modal bulk type ────────────────────────────────────────────────── */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setBulkModal(false)}>
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-5"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">Affecter un type</p>
              <p className="text-sm text-gray-400">{selected.size} cellule{selected.size > 1 ? 's' : ''}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(PT) as [PlanningType, typeof PT[PlanningType]][]).map(([k, v]) => (
                <button key={k} onClick={() => setBulkType(k)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border-2 ${
                    bulkType === k ? `${v.bg} ${v.text} ${v.border}` : 'bg-gray-50 text-gray-500 border-transparent hover:bg-gray-100'
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setBulkModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button onClick={applyBulk}
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

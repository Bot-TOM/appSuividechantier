import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { UserProfile, PlanningType, Chantier } from '@/types'
import {
  usePlanning,
  getMondayOfWeek,
  getWeekDays,
  fmtWeekRange,
  prevMonday,
  nextMonday,
} from '@/hooks/usePlanning'
import { useMyTimeEntries, calcDuree } from '@/hooks/useTimeEntries'
import Avatar from '@/components/Avatar'

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

// Jours fériés (même logique que le tab manager)
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
    `${year}-01-01`, addDaysISO(e, 1), `${year}-05-01`, `${year}-05-08`,
    addDaysISO(e, 39), addDaysISO(e, 50), `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
  ])
}

function fmtDayLabel(iso: string): string {
  const d   = new Date(iso + 'T00:00:00')
  const raw = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  return raw.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function PlanningTechTab() {
  const { profile } = useAuth()
  const { can }     = usePermissions()

  type TabId = 'activite' | 'heures' | 'equipe'
  const tabs: TabId[] = can('voir_planning_equipe')
    ? ['activite', 'heures', 'equipe']
    : ['activite', 'heures']

  const TAB_LABELS: Record<TabId, string> = {
    activite: 'Activité',
    heures:   'Mes heures',
    equipe:   'Équipe',
  }

  const [tab, setTab]           = useState<TabId>('activite')
  const [weekStart, setWeekStart] = useState(getMondayOfWeek())
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([])
  const [myChantiers, setMyChantiers] = useState<Chantier[]>([])

  const { entries: planning }                 = usePlanning(weekStart, getWeekDays(weekStart)[6])
  const { entries: timeEntries, upsert: upsertTime } = useMyTimeEntries(weekStart)

  useEffect(() => {
    if (!profile?.entreprise_id) return
    supabase.from('profiles').select('*')
      .eq('entreprise_id', profile.entreprise_id)
      .then(({ data }) => {
        if (data) setAllProfiles(data as UserProfile[])
      })
  }, [profile?.entreprise_id])

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('chantier_techniciens')
      .select('chantier_id, chantiers(id, nom, client_nom, statut)')
      .eq('technicien_id', profile.id)
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = data.map((r: any) => r.chantiers).filter(Boolean) as Chantier[]
        setMyChantiers(list.sort((a, b) => a.nom.localeCompare(b.nom)))
      })
  }, [profile?.id])

  const days   = getWeekDays(weekStart)
  const year   = new Date(weekStart + 'T00:00:00').getFullYear()
  const feries = getFeries(year)

  function getMyEntry(date: string) {
    if (!profile?.id) return undefined
    return planning.find(e => e.technicien_id === profile.id && e.date === date)
  }

  function getEntry(techId: string, date: string) {
    return planning.find(e => e.technicien_id === techId && e.date === date)
  }

  const sorted = [...allProfiles].sort((a, b) => {
    if (a.role !== b.role) return (a.role === 'manager' || a.role === 'admin') ? 1 : -1
    return a.full_name.localeCompare(b.full_name)
  })

  // État pour l'édition des heures (time input)
  const [editingDate,    setEditingDate]    = useState<string | null>(null)
  const [editArrivee,    setEditArrivee]    = useState('')
  const [editDepart,     setEditDepart]     = useState('')
  const [editPause,      setEditPause]      = useState('')
  const [editChantierId, setEditChantierId] = useState<string | null>(null)

  function openTimeEdit(date: string) {
    const e = timeEntries.find(t => t.date === date)
    setEditingDate(date)
    setEditArrivee(e?.arrivee ?? '')
    setEditDepart(e?.depart ?? '')
    setEditPause(e?.pause != null ? String(e.pause) : '')
    setEditChantierId(e?.chantier_id ?? null)
  }

  async function saveTimeEdit() {
    if (!editingDate) return
    await upsertTime(editingDate, {
      arrivee:     editArrivee || null,
      depart:      editDepart  || null,
      pause:       editPause ? parseInt(editPause, 10) : null,
      chantier_id: editChantierId,
    })
    setEditingDate(null)
  }

  return (
    <div className="space-y-4">

      {/* ── Nav semaine ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekStart(prevMonday(weekStart))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-900 flex-1 text-center">
          {fmtWeekRange(days)}
        </span>
        <button
          onClick={() => setWeekStart(nextMonday(weekStart))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          ›
        </button>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ═══════════════════ VUE ACTIVITÉ ════════════════════════════════════ */}
      {tab === 'activite' && (
        <div className="space-y-2">
          {days.map(date => {
            const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
            const isToday   = date === TODAY
            const isFerie   = !isWeekend && feries.has(date)
            const entry     = getMyEntry(date)
            const dayLabel  = fmtDayLabel(date)

            let bg: string, textColor: string, border: string, label: string
            let note: string | null = null

            if (isWeekend) {
              bg = 'bg-gray-50'; textColor = 'text-gray-300'; border = 'border-gray-100'; label = '—'
            } else if (entry && entry.type !== 'libre' && PT[entry.type]) {
              const pt = PT[entry.type]
              bg = pt.bg; textColor = pt.text; border = pt.border
              label = pt.label; note = entry.label
            } else if (!entry && isFerie) {
              bg = 'bg-violet-50'; textColor = 'text-violet-500'; border = 'border-violet-200'; label = 'Férié'
            } else {
              bg = PT.libre.bg; textColor = PT.libre.text; border = PT.libre.border; label = 'Libre'
            }

            return (
              <div
                key={date}
                className={`flex items-center gap-4 bg-white rounded-2xl px-4 py-3 ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* Jour */}
                <div className="w-20 flex-shrink-0">
                  <p className={`text-sm font-semibold ${isToday ? 'text-orange-500' : isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>
                    {dayLabel}
                  </p>
                  {isToday && <p className="text-[10px] text-orange-400 font-medium">Aujourd'hui</p>}
                </div>
                {/* Activité */}
                <div className={`flex-1 rounded-xl px-3 py-2 border ${bg} ${border}`}>
                  <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
                  {note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════ VUE MES HEURES ══════════════════════════════════ */}
      {tab === 'heures' && (() => {
        // Calcul du total semaine
        let totalMins = 0
        for (const date of days) {
          const e = timeEntries.find(t => t.date === date)
          if (e?.arrivee && e?.depart) {
            const [ah, am] = e.arrivee.split(':').map(Number)
            const [dh, dm] = e.depart.split(':').map(Number)
            const mins = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
            if (mins > 0) totalMins += mins
          }
        }
        const th = Math.floor(totalMins / 60), tm = totalMins % 60
        const totalStr = totalMins > 0
          ? (tm > 0 ? `${th}h${tm.toString().padStart(2, '0')}` : `${th}h`)
          : '—'

        return (
        <div className="space-y-2">
          {days.map(date => {
            const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
            const isToday   = date === TODAY
            const e         = timeEntries.find(t => t.date === date)
            const dur       = calcDuree(e?.arrivee ?? null, e?.depart ?? null, e?.pause ?? null)
            const dayLabel  = fmtDayLabel(date)

            if (isWeekend) {
              return (
                <div key={date}
                  className="flex items-center gap-4 bg-white rounded-2xl px-4 py-3 opacity-40"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="w-20">
                    <p className="text-sm font-semibold text-gray-300">{dayLabel}</p>
                  </div>
                  <p className="text-sm text-gray-200">—</p>
                </div>
              )
            }

            return (
              <button
                key={date}
                onClick={() => openTimeEdit(date)}
                className={`w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 text-left transition-colors ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : 'hover:bg-slate-50/50'}`}
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* Label jour */}
                <div className="w-[72px] flex-shrink-0">
                  <p className={`text-sm font-semibold ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                    {dayLabel}
                  </p>
                  {isToday && <p className="text-[10px] text-orange-400 font-medium">Aujourd'hui</p>}
                </div>
                {/* Time card */}
                {e?.arrivee ? (
                  <div className={`flex-1 rounded-xl border p-3 flex flex-col justify-between min-h-[72px] transition-all ${
                    isToday
                      ? 'bg-orange-50/50 border-orange-200'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center text-[12px] font-medium text-slate-700">
                        {e.arrivee}
                        <svg className="w-3 h-3 mx-1.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        {e.depart || '...'}
                      </div>
                      {dur && dur !== '—' && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shadow-sm border shrink-0 ml-1 ${
                          isToday
                            ? 'bg-orange-500 text-white border-orange-600'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          {dur}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      {e.pause ? (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          ☕ {e.pause}mn
                        </span>
                      ) : null}
                      {e.chantier_id && (() => {
                        const c = myChantiers.find(ch => ch.id === e.chantier_id)
                        return c ? (
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 truncate max-w-[120px]">
                            {c.nom}
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className={`flex-1 rounded-xl border-2 border-dashed flex items-center justify-center min-h-[72px] ${
                    isToday ? 'border-orange-200/60 bg-orange-50/20' : 'border-slate-100'
                  }`}>
                    <p className="text-xs text-orange-400 font-semibold">+ Saisir</p>
                  </div>
                )}
              </button>
            )
          })}

          {/* Total semaine */}
          <div
            className="flex items-center justify-between bg-orange-50 rounded-2xl px-4 py-3 mt-1"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p className="text-sm font-semibold text-orange-700">Total semaine</p>
            <p className={`text-xl font-bold ${totalMins > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
              {totalStr}
            </p>
          </div>
        </div>
        )
      })()}

      {/* ═══════════════════ VUE ÉQUIPE (lecture seule) ══════════════════════ */}
      {tab === 'equipe' && (
        <div
          className="bg-white rounded-2xl overflow-hidden overflow-x-auto"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <table className="w-full border-collapse" style={{ minWidth: `${160 + sorted.length * 120}px` }}>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-widest sticky left-0 bg-white z-10 w-32">
                  JOUR
                </th>
                {sorted.map(person => (
                  <th key={person.id} className="px-2 py-3 text-center" style={{ minWidth: 110 }}>
                    <div className="flex flex-col items-center gap-1">
                      <Avatar name={person.full_name} avatarUrl={person.avatar_url} size="sm" />
                      <p className="text-xs font-semibold text-gray-700">{person.full_name.split(' ')[0]}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(date => {
                const isWeekend = [0, 6].includes(new Date(date + 'T00:00:00').getDay())
                const isToday   = date === TODAY
                const isFerie   = !isWeekend && feries.has(date)
                const dayLabel  = fmtDayLabel(date)
                return (
                  <tr key={date} className="border-b border-gray-50 last:border-0">
                    <td className={`px-4 py-2 sticky left-0 z-10 border-r border-gray-100 ${isToday ? 'bg-orange-50/50' : 'bg-white'}`}>
                      <p className={`text-xs font-semibold ${isToday ? 'text-orange-500' : isWeekend ? 'text-gray-300' : 'text-gray-700'}`}>
                        {dayLabel}
                      </p>
                      {isToday && <p className="text-[10px] text-orange-400 font-medium">Aujourd'hui</p>}
                    </td>
                    {sorted.map(person => {
                      if (isWeekend) {
                        return (
                          <td key={person.id} className="px-2 py-2 text-center">
                            <span className="text-gray-300 text-sm">—</span>
                          </td>
                        )
                      }
                      const entry = getEntry(person.id, date)
                      let bg: string, textColor: string, border: string, label: string
                      let note: string | null = null
                      if (entry && entry.type !== 'libre' && PT[entry.type]) {
                        const pt = PT[entry.type]
                        bg = pt.bg; textColor = pt.text; border = pt.border
                        label = pt.label; note = entry.label
                      } else if (!entry && isFerie) {
                        bg = 'bg-violet-50'; textColor = 'text-violet-500'; border = 'border-violet-200'; label = 'Férié'
                      } else {
                        bg = PT.libre.bg; textColor = PT.libre.text; border = PT.libre.border; label = 'Libre'
                      }
                      const isMe = person.id === profile?.id
                      return (
                        <td key={person.id} className="px-2 py-2">
                          <div className={`rounded-xl px-2 py-2 min-h-[44px] flex flex-col justify-center border ${bg} ${border} ${isMe ? 'ring-1 ring-orange-300' : ''}`}>
                            <p className={`text-[11px] font-semibold leading-tight ${textColor}`}>{label}</p>
                            {note && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{note}</p>}
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

      {/* ── Modal saisie heures ──────────────────────────────────────────────── */}
      {editingDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setEditingDate(null)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-5"
            style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">Saisir mes heures</p>
                <p className="text-sm text-gray-400">
                  {new Date(editingDate + 'T00:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
              </div>
              <button
                onClick={() => setEditingDate(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-sm">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Arrivée</label>
                <input
                  type="time"
                  value={editArrivee}
                  onChange={e => setEditArrivee(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Départ</label>
                <input
                  type="time"
                  value={editDepart}
                  onChange={e => setEditDepart(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">Pause (mn)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={editPause}
                  onChange={e => setEditPause(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            {/* Durée calculée */}
            {editArrivee && editDepart && (
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-orange-400 font-medium">Durée travaillée</p>
                <p className="text-2xl font-bold text-orange-500 mt-0.5">
                  {calcDuree(editArrivee, editDepart, editPause ? parseInt(editPause, 10) : null)}
                </p>
              </div>
            )}

            {/* Sélecteur chantier */}
            {myChantiers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Chantier <span className="normal-case font-normal">(optionnel)</span>
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl border border-gray-200 p-1">
                  {editChantierId && (
                    <button
                      onClick={() => setEditChantierId(null)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-50 transition-colors">
                      ✕ Aucun chantier
                    </button>
                  )}
                  {myChantiers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setEditChantierId(editChantierId === c.id ? null : c.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        editChantierId === c.id
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}>
                      <span className="font-medium">{c.nom}</span>
                      {c.client_nom && <span className="text-gray-400"> · {c.client_nom}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={saveTimeEdit}
              className="w-full text-white font-semibold py-3.5 rounded-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.40)' }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

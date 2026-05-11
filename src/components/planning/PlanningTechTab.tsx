import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { UserProfile, PlanningType } from '@/types'
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
  libre:             { label: 'Libre',              bg: 'bg-amber-50',   text: 'text-amber-500',  border: 'border-amber-200'  },
}

const TODAY = new Date().toISOString().split('T')[0]

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
  const d = new Date(date); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
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

  const { entries: planning }                 = usePlanning(weekStart)
  const { entries: timeEntries, upsert: upsertTime } = useMyTimeEntries(weekStart)

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => {
      if (data) setAllProfiles(data as UserProfile[])
    })
  }, [])

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
    if (a.role !== b.role) return a.role === 'manager' ? 1 : -1
    return a.full_name.localeCompare(b.full_name)
  })

  // État pour l'édition des heures (time input)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editArrivee, setEditArrivee] = useState('')
  const [editDepart,  setEditDepart]  = useState('')
  const [editPause,   setEditPause]   = useState('')

  function openTimeEdit(date: string) {
    const e = timeEntries.find(t => t.date === date)
    setEditingDate(date)
    setEditArrivee(e?.arrivee ?? '')
    setEditDepart(e?.depart ?? '')
    setEditPause(e?.pause != null ? String(e.pause) : '')
  }

  async function saveTimeEdit() {
    if (!editingDate) return
    await upsertTime(editingDate, {
      arrivee: editArrivee || null,
      depart:  editDepart  || null,
      pause:   editPause ? parseInt(editPause, 10) : null,
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
            const isWeekend = new Date(date + 'T00:00:00').getDay() >= 6
            const isToday   = date === TODAY
            const isFerie   = !isWeekend && feries.has(date)
            const entry     = getMyEntry(date)
            const dayLabel  = fmtDayLabel(date)

            let bg: string, textColor: string, border: string, label: string
            let note: string | null = null

            if (isWeekend) {
              bg = 'bg-gray-50'; textColor = 'text-gray-300'; border = 'border-gray-100'; label = '—'
            } else if (entry && entry.type !== 'libre') {
              const pt = PT[entry.type]
              bg = pt.bg; textColor = pt.text; border = pt.border
              label = pt.label; note = entry.texte
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
      {tab === 'heures' && (
        <div className="space-y-2">
          {days.map(date => {
            const isWeekend = new Date(date + 'T00:00:00').getDay() >= 6
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
                className={`w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-3 text-left hover:bg-gray-50/80 transition-colors ${isToday ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="w-20 flex-shrink-0">
                  <p className={`text-sm font-semibold ${isToday ? 'text-orange-500' : 'text-gray-700'}`}>
                    {dayLabel}
                  </p>
                  {isToday && <p className="text-[10px] text-orange-400 font-medium">Aujourd'hui</p>}
                </div>
                {e?.arrivee ? (
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="text-gray-400">▶</span>
                      <span className="font-medium">{e.arrivee}</span>
                    </div>
                    <span className="text-gray-200">→</span>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="font-medium">{e.depart ?? '—'}</span>
                      <span className="text-gray-400">◀</span>
                    </div>
                    {e.pause ? <span className="text-xs text-gray-400">{e.pause}mn pause</span> : null}
                    <div className="ml-auto">
                      <span className={`text-sm font-bold ${dur !== '—' ? 'text-orange-500' : 'text-gray-300'}`}>
                        {dur}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between">
                    <p className="text-sm text-gray-300">Aucune saisie</p>
                    <p className="text-xs text-orange-400 font-medium">+ Saisir</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

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
                const isWeekend = new Date(date + 'T00:00:00').getDay() >= 6
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
                      if (entry && entry.type !== 'libre') {
                        const pt = PT[entry.type]
                        bg = pt.bg; textColor = pt.text; border = pt.border
                        label = pt.label; note = entry.texte
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

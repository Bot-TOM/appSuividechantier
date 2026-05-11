import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { usePlanning, getMondayOfWeek, getWeekDays, fmtDay, fmtWeekRange, prevMonday, nextMonday } from '@/hooks/usePlanning'
import { useMyTimeEntries, calcDuree } from '@/hooks/useTimeEntries'
import Avatar from '@/components/Avatar'
import type { PlanningType, UserProfile } from '@/types'

const PT: Record<PlanningType, { label: string; bg: string; text: string; border: string }> = {
  chantier:          { label: 'Chantier',         bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  grand_deplacement: { label: 'Grand déplac.',     bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  depot:             { label: 'Dépôt',             bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  route:             { label: 'Route',             bg: 'bg-sky-100',    text: 'text-sky-700',    border: 'border-sky-200' },
  repos_conges:      { label: 'Repos / Congés',    bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
  absent:            { label: 'Absent',            bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200' },
  libre:             { label: 'Libre',             bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200' },
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const today = new Date().toISOString().split('T')[0]

// ── Sous-onglet Activité ──────────────────────────────────────────────────────
function ActiviteTab({ weekStart, onWeekChange }: { weekStart: string; onWeekChange: (w: string) => void }) {
  const { profile } = useAuth()
  const { entries, upsert } = usePlanning(weekStart)
  const days = getWeekDays(weekStart)

  const [editDay, setEditDay] = useState<string | null>(null)
  const [editType, setEditType] = useState<PlanningType>('chantier')
  const [editTexte, setEditTexte] = useState('')

  function openEdit(day: string) {
    const entry = entries.find(e => e.technicien_id === profile?.id && e.date === day)
    setEditType(entry?.type ?? 'chantier')
    setEditTexte(entry?.texte ?? '')
    setEditDay(day)
  }

  async function saveEdit() {
    if (!profile?.id || !editDay) return
    await upsert(profile.id, editDay, editType, editTexte)
    setEditDay(null)
  }

  return (
    <>
      {/* Navigation semaine */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onWeekChange(prevMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-700">{fmtWeekRange(days)}</p>
        <button onClick={() => onWeekChange(nextMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ›
        </button>
      </div>

      {/* Grille verticale */}
      <div className="space-y-2">
        {days.map((day, i) => {
          const entry = entries.find(e => e.technicien_id === profile?.id && e.date === day)
          const isToday = day === today
          const d = fmtDay(day)
          return (
            <button key={day} onClick={() => openEdit(day)}
              className={`w-full flex items-center gap-3 bg-white rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 ${isToday ? 'ring-2 ring-orange-400' : ''}`}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              {/* Jour */}
              <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isToday ? 'text-white' : 'bg-gray-50 text-gray-600'}`}
                style={isToday ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}>
                <span className="text-[10px] font-semibold uppercase">{DAYS_FR[i]}</span>
                <span className="text-sm font-bold leading-tight">{d.num}</span>
              </div>
              {/* Contenu */}
              <div className="flex-1 min-w-0">
                {entry ? (
                  <>
                    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${PT[entry.type].bg} ${PT[entry.type].text} ${PT[entry.type].border}`}>
                      {PT[entry.type].label}
                    </span>
                    {entry.texte && <p className="text-xs text-gray-500 mt-1 truncate">{entry.texte}</p>}
                  </>
                ) : (
                  <span className="text-xs text-gray-300 italic">— Non renseigné</span>
                )}
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* Modal édition */}
      {editDay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/40" onClick={() => setEditDay(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">
                {DAYS_FR[getWeekDays(weekStart).indexOf(editDay)]} {fmtDay(editDay).num}
              </p>
              <button onClick={() => setEditDay(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PT) as PlanningType[]).map(t => (
                <button key={t} onClick={() => setEditType(t)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${editType === t ? `${PT[t].bg} ${PT[t].text} ${PT[t].border} ring-1 ring-offset-1 ring-current` : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                  {PT[t].label}
                </button>
              ))}
            </div>
            <input
              value={editTexte}
              onChange={e => setEditTexte(e.target.value)}
              placeholder="Note (optionnel)..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button onClick={saveEdit}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sous-onglet Mes heures ───────────────────────────────────────────────────
function HeuresTab({ weekStart, onWeekChange }: { weekStart: string; onWeekChange: (w: string) => void }) {
  const days = getWeekDays(weekStart)
  const { entries, upsert } = useMyTimeEntries(weekStart)

  function getEntry(date: string) {
    return entries.find(e => e.date === date) ?? null
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onWeekChange(prevMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-700">{fmtWeekRange(days)}</p>
        <button onClick={() => onWeekChange(nextMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ›
        </button>
      </div>

      <div className="space-y-3">
        {days.map((day, i) => {
          const entry = getEntry(day)
          const isToday = day === today
          const d = fmtDay(day)
          const duree = calcDuree(entry?.arrivee ?? null, entry?.depart ?? null, entry?.pause ?? null)
          return (
            <div key={day}
              className={`bg-white rounded-2xl p-4 ${isToday ? 'ring-2 ring-orange-400' : ''}`}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isToday ? 'text-white' : 'bg-gray-50 text-gray-600'}`}
                  style={isToday ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}>
                  <span className="text-[9px] font-semibold uppercase">{DAYS_FR[i]}</span>
                  <span className="text-sm font-bold leading-tight">{d.num}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{DAYS_FR[i]} {d.num}</p>
                  {duree !== '—' && <p className="text-xs text-orange-500 font-semibold">{duree}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Arrivée</label>
                  <input type="time" value={entry?.arrivee ?? ''}
                    onChange={e => upsert(day, { arrivee: e.target.value || null })}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Départ</label>
                  <input type="time" value={entry?.depart ?? ''}
                    onChange={e => upsert(day, { depart: e.target.value || null })}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Pause (min)</label>
                  <input type="number" min={0} step={5} value={entry?.pause ?? ''}
                    onChange={e => upsert(day, { pause: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Total semaine */}
      {(() => {
        let totalMin = 0
        days.forEach(day => {
          const e = getEntry(day)
          if (!e?.arrivee || !e?.depart) return
          const [ah, am] = e.arrivee.split(':').map(Number)
          const [dh, dm] = e.depart.split(':').map(Number)
          const t = dh * 60 + dm - (ah * 60 + am) - (e.pause ?? 0)
          if (t > 0) totalMin += t
        })
        if (totalMin === 0) return null
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        const label = m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
        return (
          <div className="mt-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
            <span className="text-sm font-semibold opacity-90">Total semaine</span>
            <span className="text-2xl font-bold">{label}</span>
          </div>
        )
      })()}
    </>
  )
}

// ── Sous-onglet Équipe (lecture seule) ───────────────────────────────────────
function EquipeTab({ weekStart, onWeekChange, profiles }: {
  weekStart: string
  onWeekChange: (w: string) => void
  profiles: UserProfile[]
}) {
  const days = getWeekDays(weekStart)
  const { entries } = usePlanning(weekStart)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onWeekChange(prevMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-700">{fmtWeekRange(days)}</p>
        <button onClick={() => onWeekChange(nextMonday(weekStart))}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          ›
        </button>
      </div>

      <div className="space-y-3">
        {profiles.map(p => (
          <div key={p.id} className="bg-white rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
              <Avatar name={p.full_name} avatarUrl={p.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.full_name}</p>
                {p.poste && <p className="text-xs text-gray-400">{p.poste}</p>}
              </div>
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-50">
              {days.map((day, i) => {
                const entry = entries.find(e => e.technicien_id === p.id && e.date === day)
                const isToday = day === today
                return (
                  <div key={day} className={`flex flex-col items-center py-2 gap-1 ${isToday ? 'bg-orange-50/50' : ''}`}>
                    <span className={`text-[9px] font-semibold ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>
                      {DAYS_FR[i]}
                    </span>
                    {entry ? (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border ${PT[entry.type].bg} ${PT[entry.type].text} ${PT[entry.type].border}`}
                        title={PT[entry.type].label}>
                        {PT[entry.type].label.charAt(0)}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-100" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(PT) as PlanningType[]).map(t => (
          <span key={t} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PT[t].bg} ${PT[t].text} ${PT[t].border}`}>
            {PT[t].label.charAt(0)} {PT[t].label}
          </span>
        ))}
      </div>
    </>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function PlanningTechTab({ profiles }: { profiles: UserProfile[] }) {
  const { can } = usePermissions()
  const [subTab, setSubTab] = useState<'activite' | 'heures' | 'equipe'>('activite')
  const [weekStart, setWeekStart] = useState(getMondayOfWeek())

  const canSeeEquipe = can('voir_planning_equipe')

  const SUB_TABS = [
    { key: 'activite' as const, label: 'Activité' },
    { key: 'heures'   as const, label: 'Mes heures' },
    ...(canSeeEquipe ? [{ key: 'equipe' as const, label: 'Équipe' }] : []),
  ]

  return (
    <div className="space-y-4 pb-6">
      {/* Sous-onglets */}
      <div className="flex gap-2">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${subTab === t.key ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            style={subTab === t.key ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'activite' && <ActiviteTab weekStart={weekStart} onWeekChange={setWeekStart} />}
      {subTab === 'heures'   && <HeuresTab   weekStart={weekStart} onWeekChange={setWeekStart} />}
      {subTab === 'equipe'   && canSeeEquipe && (
        <EquipeTab weekStart={weekStart} onWeekChange={setWeekStart} profiles={profiles} />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { Chantier, Anomalie } from '@/types'
import type { Notification } from '@/hooks/useNotifications'
import {
  AlertTriangle, Calendar, Layers, ArrowRight, Clock,
  CheckCircle2, FileText, Bell, Plus, ShieldAlert,
  Users, TrendingUp, ChevronRight, Sun, Lock, CheckSquare, X,
} from 'lucide-react'

// ─── Types internes ───────────────────────────────────────────────────────────
interface PlanningEntry {
  technicien_id: string
  type: string
  label: string | null
  profiles?: { full_name: string } | null
}

interface Rapport {
  id: string
  message: string
  created_at: string
  chantier_id: string
  chantiers?: { nom: string } | null
  profiles?: { full_name: string } | null
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  chantiers:     Chantier[]
  anomalies:     Anomalie[]
  notifications: Notification[]
  entrepriseId?: string
  managerName?:  string
  onNavigate:    (tab: string, filter?: string) => void
  markAllRead?:  () => void
  markRead?:     (id: string) => void
}

// ─── Icône par type de notification ──────────────────────────────────────────
function NotifIcon({ type }: { type: Notification['type'] }) {
  const map: Record<Notification['type'], { icon: React.ReactNode; bg: string; text: string }> = {
    anomalie:     { icon: <AlertTriangle className="w-3.5 h-3.5" />, bg: 'bg-red-100',    text: 'text-red-500'    },
    rapport:      { icon: <FileText      className="w-3.5 h-3.5" />, bg: 'bg-blue-100',   text: 'text-blue-500'   },
    bloque:       { icon: <Lock          className="w-3.5 h-3.5" />, bg: 'bg-orange-100', text: 'text-orange-500' },
    autocontrole: { icon: <CheckSquare   className="w-3.5 h-3.5" />, bg: 'bg-purple-100', text: 'text-purple-500' },
    termine:      { icon: <CheckCircle2  className="w-3.5 h-3.5" />, bg: 'bg-emerald-100',text: 'text-emerald-500'},
    heures:       { icon: <Clock         className="w-3.5 h-3.5" />, bg: 'bg-slate-100',  text: 'text-slate-500'  },
  }
  const s = map[type] ?? map.rapport
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${s.bg} ${s.text}`}>
      {s.icon}
    </span>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function localISO(d: Date) {
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `il y a ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

const TYPE_PLANNING_LABEL: Record<string, string> = {
  chantier:          'Chantier',
  grand_deplacement: 'Grand déplacement',
  depot:             'Dépôt',
  route:             'Route',
  repos_conges:      'Congés',
  absent:            'Absent',
  ferie:             'Férié',
  libre:             'Libre',
}

// ─── Mini-composants ──────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, urgent, onClick }: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'orange' | 'blue' | 'red' | 'amber' | 'green'
  urgent?: boolean
  onClick?: () => void
}) {
  const colors = {
    orange: { bg: 'bg-orange-50',  text: 'text-orange-600',  icon: 'bg-orange-100', ring: 'ring-orange-200' },
    blue:   { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'bg-blue-100',   ring: 'ring-blue-200'   },
    red:    { bg: 'bg-red-50',     text: 'text-red-600',     icon: 'bg-red-100',    ring: 'ring-red-200'    },
    amber:  { bg: 'bg-amber-50',   text: 'text-amber-600',   icon: 'bg-amber-100',  ring: 'ring-amber-200'  },
    green:  { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-100',ring: 'ring-emerald-200'},
  }[color]

  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-all group ${urgent ? `ring-2 ${colors.ring}` : ''}`}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center`}>
          <div className={colors.text}>{icon}</div>
        </div>
        {urgent && value > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>!</span>
        )}
      </div>
      <div className={`text-3xl font-bold ${colors.text} mb-1`}>{value}</div>
      <div className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{label}</div>
    </button>
  )
}

function SectionCard({ title, icon, onMore, children, moreLabel = 'Voir tout' }: {
  title: string
  icon: React.ReactNode
  onMore?: () => void
  children: React.ReactNode
  moreLabel?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">{icon}</span>
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        </div>
        {onMore && (
          <button onClick={onMore} className="flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
            {moreLabel} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-center text-slate-400 text-sm py-8">{text}</p>
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ManagerHomeTab({ chantiers, anomalies, notifications, managerName, onNavigate, markAllRead, markRead }: Props) {
  const navigate = useNavigate()

  const today  = localISO(new Date())
  const in14   = localISO(new Date(Date.now() + 14 * 86400000))
  const [year, month] = today.split('-').map(Number)

  // ── KPIs dérivés des chantiers ────────────────────────────────────────────
  const enCours         = chantiers.filter(c => c.statut === 'en_cours')
  const planifies       = chantiers.filter(c => c.statut === 'planifie')
  const bloques         = chantiers.filter(c => c.statut === 'bloque')
  const terminesCeMois  = chantiers.filter(c => {
    if (c.statut !== 'termine') return false
    const d = new Date(c.updated_at)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  const anomaliesOuvertes  = anomalies.filter(a => a.statut !== 'resolu')
  const anomaliesHaute     = anomaliesOuvertes.filter(a => a.gravite === 'haute').slice(0, 3)

  // ── Chantiers à venir (14j) ───────────────────────────────────────────────
  const aVenir = planifies
    .filter(c => c.date_prevue >= today && c.date_prevue <= in14)
    .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue))
    .slice(0, 5)

  // ── Interventions en retard ───────────────────────────────────────────────
  const enRetard = enCours
    .filter(c => c.date_fin_prevue && c.date_fin_prevue < today)
    .sort((a, b) => (a.date_fin_prevue ?? '').localeCompare(b.date_fin_prevue ?? ''))

  // ── Données fetchées ──────────────────────────────────────────────────────
  const [planningToday, setPlanningToday] = useState<PlanningEntry[]>([])
  const [recentRapports, setRecentRapports] = useState<Rapport[]>([])
  const [loadingRapports, setLoadingRapports] = useState(true)

  useEffect(() => {
    // Planning aujourd'hui
    supabase
      .from('planning_entries')
      .select('technicien_id, type, label, profiles(full_name)')
      .eq('date', today)
      .neq('type', 'libre')
      .then(({ data }) => setPlanningToday((data ?? []) as unknown as PlanningEntry[]))

    // Derniers rapports terrain
    const ids = chantiers.map(c => c.id)
    if (ids.length === 0) { setLoadingRapports(false); return }
    supabase
      .from('rapports')
      .select('id, message, created_at, chantier_id, chantiers(nom), profiles(full_name)')
      .in('chantier_id', ids)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { setRecentRapports((data ?? []) as unknown as Rapport[]); setLoadingRapports(false) })
  }, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notifications ────────────────────────────────────────────────────────
  const unreadNotifs = notifications.filter(n => !n.lu)
  const unreadCount  = unreadNotifs.length

  // ── Greeting ──────────────────────────────────────────────────────────────
  const prenom    = managerName?.split(' ')[0] ?? 'Manager'
  const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div className="space-y-6">

      {/* ── Greeting + actions rapides ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        {/* Déco solaire */}
        <div className="absolute right-6 top-4 opacity-10">
          <Sun className="w-28 h-28 text-orange-400" />
        </div>
        <div className="relative">
          <p className="text-slate-400 text-sm font-medium capitalize mb-1">{dateLabel}</p>
          <h1 className="text-2xl font-bold mb-4">{greeting}, {prenom} 👋</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/manager/nouveau-chantier')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-400 transition-colors text-white">
              <Plus className="w-4 h-4" /> Nouveau chantier
            </button>
            <button
              onClick={() => navigate('/vt/nouvelle')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition-colors text-white">
              <Plus className="w-4 h-4" /> Nouvelle VT
            </button>
            <button
              onClick={() => onNavigate('planning')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition-colors text-white">
              <Calendar className="w-4 h-4" /> Planning semaine
            </button>
          </div>
        </div>
      </div>

      {/* ── Inbox notifications non-lues ──────────────────────────────────── */}
      {unreadCount > 0 && (
        <div
          className="bg-white rounded-2xl border border-orange-200 overflow-hidden"
          style={{ boxShadow: '0 2px 12px rgba(249,115,22,0.12)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Notifications</h3>
                <p className="text-xs text-orange-600 font-medium">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''} — action requise
                </p>
              </div>
            </div>
            <button
              onClick={() => markAllRead?.()}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-orange-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-orange-50">
              <X className="w-3.5 h-3.5" /> Tout lu
            </button>
          </div>

          {/* Liste */}
          <div className="divide-y divide-slate-50">
            {unreadNotifs.slice(0, 7).map(n => (
              <button
                key={n.id}
                onClick={() => {
                  markRead?.(n.id)
                  if (n.chantier_id) navigate(`/chantier/${n.chantier_id}`)
                }}
                className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-orange-50/50 transition-colors group">
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  {n.chantier_id && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 transition-colors" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer si débordement */}
          {unreadCount > 7 && (
            <div className="px-5 py-3 bg-orange-50/50 border-t border-orange-100 text-center">
              <p className="text-xs text-orange-500 font-medium">
                +{unreadCount - 7} autres notifications non lues
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Layers className="w-5 h-5" />}
          label="Chantiers en cours"
          value={enCours.length}
          color="orange"
          onClick={() => onNavigate('chantiers', 'en_cours')}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          label="Planifiés"
          value={planifies.length}
          color="blue"
          onClick={() => onNavigate('chantiers', 'planifie')}
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Bloqués"
          value={bloques.length}
          color="red"
          urgent={bloques.length > 0}
          onClick={() => onNavigate('chantiers', 'bloque')}
        />
        <KpiCard
          icon={<ShieldAlert className="w-5 h-5" />}
          label="Anomalies ouvertes"
          value={anomaliesOuvertes.length}
          color="amber"
          urgent={anomaliesHaute.length > 0}
          onClick={() => onNavigate('anomalies')}
        />
      </div>

      {/* ── Stats secondaires ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Terminés ce mois', value: terminesCeMois.length, color: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" />, tab: 'chantiers', filter: 'termine' },
          { label: 'Total chantiers',  value: chantiers.length,      color: 'text-slate-600 bg-slate-50',    icon: <Layers className="w-4 h-4" />,       tab: 'chantiers', filter: 'tous'    },
          { label: 'Anomalies haute priorité', value: anomaliesHaute.length, color: 'text-red-600 bg-red-50', icon: <AlertTriangle className="w-4 h-4" />, tab: 'anomalies', filter: undefined },
          { label: 'En retard',        value: enRetard.length,       color: 'text-amber-600 bg-amber-50',   icon: <Clock className="w-4 h-4" />,         tab: 'chantiers', filter: 'en_cours' },
        ] as const).map(({ label, value, color, icon, tab, filter }) => (
          <button
            key={label}
            onClick={() => onNavigate(tab, filter)}
            className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-4 py-3 hover:shadow-md transition-all text-left w-full"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
            <div>
              <div className="text-lg font-bold text-slate-800">{value}</div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Alertes + Équipe aujourd'hui ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Alertes prioritaires */}
        <SectionCard
          title="Alertes prioritaires"
          icon={<AlertTriangle className="w-4 h-4" />}
          onMore={() => onNavigate('anomalies')}
          moreLabel="Anomalies">
          {bloques.length === 0 && anomaliesHaute.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Aucune alerte — tout est sous contrôle ✓</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {bloques.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/chantier/${c.id}`)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.nom}</p>
                    <p className="text-xs text-red-500 font-medium">Chantier bloqué</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" />
                </button>
              ))}
              {anomaliesHaute.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/chantier/${a.chantier_id}/anomalies`)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.type}</p>
                    <p className="text-xs text-amber-600 font-medium">Anomalie haute priorité</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Équipe aujourd'hui */}
        <SectionCard
          title="Équipe aujourd'hui"
          icon={<Users className="w-4 h-4" />}
          onMore={() => onNavigate('planning')}
          moreLabel="Planning">
          {planningToday.length === 0 ? (
            <EmptyState text="Aucune entrée planning pour aujourd'hui" />
          ) : (
            <div className="divide-y divide-slate-50">
              {planningToday.slice(0, 6).map((entry, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                    {entry.profiles?.full_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{entry.profiles?.full_name ?? '—'}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {TYPE_PLANNING_LABEL[entry.type] ?? entry.type}
                      {entry.label ? ` — ${entry.label}` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {planningToday.length > 6 && (
                <p className="text-center text-xs text-slate-400 py-3">+{planningToday.length - 6} autres</p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Prochaines interventions + En retard ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Prochaines interventions */}
        <SectionCard
          title="Prochaines interventions (14j)"
          icon={<Calendar className="w-4 h-4" />}
          onMore={() => onNavigate('chantiers')}
          moreLabel="Tous les chantiers">
          {aVenir.length === 0 ? (
            <EmptyState text="Aucune intervention planifiée dans les 14 prochains jours" />
          ) : (
            <div className="divide-y divide-slate-50">
              {aVenir.map(c => {
                const daysUntil = Math.round((new Date(c.date_prevue + 'T00:00:00').getTime() - Date.now()) / 86400000)
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chantier/${c.id}`)}
                    className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex flex-col items-center justify-center shrink-0">
                      <span className="text-blue-600 text-[10px] font-bold uppercase leading-none">
                        {new Date(c.date_prevue + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                      </span>
                      <span className="text-blue-700 text-base font-bold leading-none">
                        {new Date(c.date_prevue + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.nom}</p>
                      <p className="text-xs text-slate-400 truncate">{c.client_nom}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-500 shrink-0">
                      {daysUntil === 0 ? "Auj." : daysUntil === 1 ? "Demain" : `J-${daysUntil}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Interventions en retard */}
        <SectionCard
          title="Interventions en retard"
          icon={<Clock className="w-4 h-4" />}
          onMore={() => onNavigate('chantiers')}>
          {enRetard.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Aucun retard — planning respecté ✓</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {enRetard.slice(0, 5).map(c => {
                const daysLate = c.date_fin_prevue
                  ? Math.round((Date.now() - new Date(c.date_fin_prevue + 'T00:00:00').getTime()) / 86400000)
                  : 0
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/chantier/${c.id}`)}
                    className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.nom}</p>
                      <p className="text-xs text-slate-400 truncate">{c.client_nom}</p>
                    </div>
                    <span className="text-xs font-bold text-red-500 shrink-0">+{daysLate}j</span>
                  </button>
                )
              })}
              {enRetard.length > 5 && (
                <p className="text-center text-xs text-slate-400 py-3">+{enRetard.length - 5} autres</p>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Derniers rapports terrain ──────────────────────────────────────── */}
      <SectionCard
        title="Derniers rapports terrain"
        icon={<FileText className="w-4 h-4" />}
        onMore={() => onNavigate('chantiers')}
        moreLabel="Tous les chantiers">
        {loadingRapports ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : recentRapports.length === 0 ? (
          <EmptyState text="Aucun rapport terrain enregistré" />
        ) : (
          <div className="divide-y divide-slate-50">
            {recentRapports.map(r => (
              <button
                key={r.id}
                onClick={() => navigate(`/chantier/${r.chantier_id}`)}
                className="w-full text-left px-5 py-4 flex items-start gap-3 hover:bg-slate-50 transition-colors group">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0 mt-0.5">
                  {r.profiles?.full_name?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{r.profiles?.full_name ?? '—'}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{r.chantiers?.nom ?? '—'}</span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{r.message}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{timeAgo(r.created_at)}</span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Statistiques rapides ───────────────────────────────────────────── */}
      <SectionCard
        title="Répartition des chantiers"
        icon={<TrendingUp className="w-4 h-4" />}
        onMore={() => onNavigate('stats')}
        moreLabel="Stats complètes">
        {chantiers.length === 0 ? (
          <EmptyState text="Aucun chantier" />
        ) : (
          <div className="px-5 py-4 space-y-3">
            {([
              { label: 'En cours',   count: enCours.length,    color: 'bg-orange-400' },
              { label: 'Planifiés',  count: planifies.length,  color: 'bg-blue-400' },
              { label: 'Terminés',   count: chantiers.filter(c => c.statut === 'termine').length, color: 'bg-emerald-400' },
              { label: 'En attente', count: chantiers.filter(c => c.statut === 'en_attente').length, color: 'bg-slate-300' },
              { label: 'Bloqués',    count: bloques.length,    color: 'bg-red-400' },
            ].filter(s => s.count > 0)).map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 w-24 shrink-0">{s.label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${s.color}`}
                    style={{ width: `${Math.round((s.count / chantiers.length) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Historique notifications ───────────────────────────────────────── */}
      {notifications.length > 0 && (
        <SectionCard
          title="Historique des notifications"
          icon={<Bell className="w-4 h-4" />}>
          <div className="divide-y divide-slate-50">
            {notifications.slice(0, 8).map(n => (
              <button
                key={n.id}
                onClick={() => {
                  markRead?.(n.id)
                  if (n.chantier_id) navigate(`/chantier/${n.chantier_id}`)
                }}
                className={`w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors ${!n.lu ? 'bg-orange-50/30' : ''}`}>
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug truncate ${!n.lu ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{n.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.lu && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Spacer mobile */}
      <div className="h-4" />
    </div>
  )
}

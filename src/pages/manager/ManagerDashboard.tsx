import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, RefreshCw, AlertTriangle, CheckCircle2, Sun, LogOut, Bell, Calendar, Zap, MoreHorizontal, Shield, ChevronRight, AlertCircle, FileText, CheckSquare, MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useChantiers } from '@/hooks/useChantiers'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useEtapesProgression } from '@/hooks/useEtapesProgression'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useNotifications } from '@/hooks/useNotifications'
import { useNotifPreferences } from '@/hooks/useNotifPreferences'
import GraviteBadge from '@/components/anomalies/GraviteBadge'
import Avatar from '@/components/Avatar'
import { supabase } from '@/lib/supabase'
import { Chantier, ChantierStatut, Anomalie } from '@/types'
import PlanningManagerTab from '@/components/planning/PlanningManagerTab'
import GestionEquipe from '@/pages/manager/GestionEquipe'
import AdminEntreprisesTab from '@/components/admin/AdminEntreprisesTab'
import AdminBugReportsTab from '@/components/admin/AdminBugReportsTab'
import BugReportButton from '@/components/BugReportButton'
import GlobalChatTab from '@/components/chat/GlobalChatTab'
import { useGlobalMessages } from '@/hooks/useGlobalMessages'
type SortKey = 'date' | 'nom' | 'statut'
type FilterStatut = ChantierStatut | 'tous'
type Tab = 'chantiers' | 'anomalies' | 'stats' | 'equipe' | 'profil' | 'planning' | 'entreprises' | 'bugs' | 'chat'

type AnomalieWithRelations = Anomalie & {
  profiles?: { full_name?: string } | null
  chantiers?: { nom?: string } | null
}

type TechStat = {
  id: string
  full_name: string
  avatar_url: string | null
  poste: string | null
  nb_actifs: number
  nb_total: number
  nb_anomalies: number
  progression_moy: number
}

const STATUT_LABEL: Record<ChantierStatut, string> = {
  planifie:   'Planifié',
  en_attente: 'En attente',
  en_cours:   'En cours',
  termine:    'Terminé',
  bloque:     'Bloqué',
}


const STATUT_TOP: Record<ChantierStatut, string> = {
  planifie:   'bg-purple-400',
  en_attente: 'bg-slate-300',
  en_cours:   'bg-blue-400',
  termine:    'bg-emerald-400',
  bloque:     'bg-red-400',
}

const STATUT_BADGE: Record<ChantierStatut, string> = {
  planifie:   'text-purple-700 bg-purple-50 ring-purple-600/20',
  en_attente: 'text-slate-700 bg-slate-100 ring-slate-600/20',
  en_cours:   'text-blue-700 bg-blue-50 ring-blue-600/20',
  termine:    'text-emerald-700 bg-emerald-50 ring-emerald-600/20',
  bloque:     'text-red-700 bg-red-50 ring-red-600/20',
}

// ─── Carte chantier ──────────────────────────────────────────────────────────
function ChantierCard({ chantier, pct, onClick }: { chantier: Chantier; pct: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group flex flex-col justify-between relative overflow-hidden cursor-pointer"
    >
      {/* Barre colorée en haut selon le statut */}
      <div className={`absolute top-0 left-0 w-full h-1 ${STATUT_TOP[chantier.statut]}`} />

      <div className="p-6 pt-7">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-slate-900 group-hover:text-orange-600 transition-colors truncate">{chantier.nom}</h3>
            <p className="text-sm text-slate-500 mt-0.5 truncate">{chantier.client_nom}</p>
          </div>
          <button onClick={e => e.stopPropagation()} className="text-slate-300 hover:text-slate-500 transition-colors ml-2 flex-shrink-0">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-5">
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Progression</span>
            <span className="text-sm font-bold text-slate-700">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-orange-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 pb-5 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {new Date(chantier.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </div>
          {chantier.puissance_kwc != null && (
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              {chantier.puissance_kwc} kWc
            </div>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${STATUT_BADGE[chantier.statut]}`}>
          {chantier.statut === 'termine'  && <CheckCircle2 className="w-3 h-3" />}
          {chantier.statut === 'en_cours' && <RefreshCw className="w-3 h-3" />}
          {chantier.statut === 'bloque'   && <AlertTriangle className="w-3 h-3" />}
          {STATUT_LABEL[chantier.statut]}
        </span>
      </div>
    </div>
  )
}

const STATUT_ANOMALIE: Record<string, { label: string; next: string; dot: string; bg: string }> = {
  ouvert:   { label: 'Ouvert',   next: 'en_cours', dot: 'bg-red-500',    bg: 'bg-red-50 text-red-700' },
  en_cours: { label: 'En cours', next: 'resolu',   dot: 'bg-orange-500', bg: 'bg-orange-50 text-orange-700' },
  resolu:   { label: 'Résolu',   next: 'ouvert',   dot: 'bg-green-500',  bg: 'bg-green-50 text-green-700' },
}

// ─── Dashboard principal ─────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [avatarLoading, setAvatarLoading] = useState(false)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    e.target.value = ''
    setAvatarLoading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${profile.id}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadErr) { console.error('[avatar] upload:', uploadErr.message); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`
      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      if (updateErr) { console.error('[avatar] update profile:', updateErr.message); return }
      await refreshProfile()
    } finally {
      setAvatarLoading(false)
    }
  }
  const [selectedEntreprise, setSelectedEntreprise] = useState<{ id: string; nom: string } | null>(null)

  const { chantiers, loading } = useChantiers(selectedEntreprise?.id)
  const { anomalies, updateStatut: updateAnomalieStatut, updateStatutBulk, deleteAnomalies } = useAnomalies(undefined, selectedEntreprise?.id)
  const navigate               = useNavigate()

  const [activeTab, setActiveTab]       = useState<Tab>('chantiers')
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('tous')
  const [sortKey, setSortKey]           = useState<SortKey>('date')
  const [searchQuery, setSearchQuery]   = useState('')
  const [anomalieFilter, setAnomalieFilter]   = useState<'tous' | 'ouvert' | 'en_cours' | 'resolu'>('tous')
  const [anomalieSelectMode, setAnomalieSelectMode] = useState(false)
  const [anomalieSelectedIds, setAnomalieSelectedIds] = useState<Set<string>>(new Set())

  function toggleAnomalieSelect(id: string) {
    setAnomalieSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exitAnomalieSelectMode() { setAnomalieSelectMode(false); setAnomalieSelectedIds(new Set()) }
  function toggleAnomalieSelectAll() {
    setAnomalieSelectedIds(anomalieSelectedIds.size === anomaliesFiltrees.length ? new Set() : new Set(anomaliesFiltrees.map(a => a.id)))
  }
  async function handleAnomalieBulkStatut(statut: Anomalie['statut']) {
    if (!anomalieSelectedIds.size) return
    await updateStatutBulk(Array.from(anomalieSelectedIds), statut)
    exitAnomalieSelectMode()
  }
  async function handleAnomalieBulkDelete() {
    if (!anomalieSelectedIds.size) return
    await deleteAnomalies(Array.from(anomalieSelectedIds))
    exitAnomalieSelectMode()
  }
  const [showPwd, setShowPwd]           = useState(false)
  const [pwd, setPwd]                   = useState({ new: '', confirm: '' })
  const [showPwdNew, setShowPwdNew]     = useState(false)
  const [showPwdConfirm, setShowPwdConfirm] = useState(false)
  const [pwdLoading, setPwdLoading]     = useState(false)
  const [pwdMsg, setPwdMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const { status: pushStatus, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications()
  const { prefs: notifPrefs, toggle: toggleNotifPref } = useNotifPreferences(pushStatus === 'subscribed')
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications()
  const { unreadCount: chatUnread } = useGlobalMessages(profile?.id ?? '')
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const notifPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false)
      }
    }
    if (showNotifPanel) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifPanel])

  const handleChangePwd = useCallback(async () => {
    if (pwd.new.length < 6) { setPwdMsg({ type: 'err', text: 'Minimum 6 caractères' }); return }
    if (pwd.new !== pwd.confirm) { setPwdMsg({ type: 'err', text: 'Les mots de passe ne correspondent pas' }); return }
    setPwdLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwd.new })
    if (error) {
      setPwdMsg({ type: 'err', text: error.message })
    } else {
      setPwdMsg({ type: 'ok', text: 'Mot de passe modifié' })
      setPwd({ new: '', confirm: '' })
      setShowPwd(false)
    }
    setPwdLoading(false)
  }, [pwd])

  const progression = useEtapesProgression(chantiers.map(c => c.id))
  const anomaliesOuvertes = anomalies.filter(a => a.statut !== 'resolu')
  const anomaliesFiltrees = anomalieFilter === 'tous' ? anomalies : anomalies.filter(a => a.statut === anomalieFilter)

  const stats = {
    total:      chantiers.length,
    en_cours:   chantiers.filter(c => c.statut === 'en_cours').length,
    bloques:    chantiers.filter(c => c.statut === 'bloque').length,
    termines:   chantiers.filter(c => c.statut === 'termine').length,
    planifies:  chantiers.filter(c => c.statut === 'planifie').length,
    en_attente: chantiers.filter(c => c.statut === 'en_attente').length,
  }

  // ── Stats avancées ──────────────────────────────────────────────────────────
  const [techStats, setTechStats]     = useState<TechStat[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  const enhancedStats = useMemo(() => {
    const kwc_en_cours = chantiers
      .filter(c => c.statut === 'en_cours')
      .reduce((s, c) => s + (c.puissance_kwc ?? 0), 0)
    const kwc_installe = chantiers
      .filter(c => c.statut === 'termine')
      .reduce((s, c) => s + (c.puissance_kwc ?? 0), 0)
    const pcts = chantiers.map(c => progression[c.id]?.pct ?? 0)
    const progression_moy = pcts.length > 0
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : 0
    return {
      kwc_en_cours: Math.round(kwc_en_cours * 10) / 10,
      kwc_installe: Math.round(kwc_installe * 10) / 10,
      progression_moy,
    }
  }, [chantiers, progression])

  useEffect(() => {
    if (activeTab !== 'stats') return
    setLoadingStats(true)
    async function fetchTechStats() {
      let profilesQuery = supabase.from('profiles').select('id, full_name, avatar_url, poste').eq('role', 'technicien')
      if (selectedEntreprise?.id) profilesQuery = profilesQuery.eq('entreprise_id', selectedEntreprise.id)

      const [profilesRes, assignmentsRes] = await Promise.all([
        profilesQuery,
        supabase.from('chantier_techniciens').select('technicien_id, chantier_id'),
      ])
      const profiles    = profilesRes.data    ?? []
      const assignments = assignmentsRes.data ?? []

      const anomaliesPerTech: Record<string, number> = {}
      anomalies.forEach(a => {
        if (a.technicien_id) anomaliesPerTech[a.technicien_id] = (anomaliesPerTech[a.technicien_id] ?? 0) + 1
      })

      const result: TechStat[] = profiles.map(p => {
        const ids = new Set(assignments.filter(a => a.technicien_id === p.id).map(a => a.chantier_id))
        const mine = chantiers.filter(c => ids.has(c.id))
        const actifs = mine.filter(c => c.statut === 'en_cours')
        const pcts = actifs.map(c => progression[c.id]?.pct ?? 0)
        return {
          id:             p.id,
          full_name:      p.full_name ?? '',
          avatar_url:     p.avatar_url ?? null,
          poste:          p.poste ?? null,
          nb_actifs:      actifs.length,
          nb_total:       mine.length,
          nb_anomalies:   anomaliesPerTech[p.id] ?? 0,
          progression_moy: pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
        }
      })
      result.sort((a, b) => b.nb_actifs - a.nb_actifs || b.nb_total - a.nb_total)
      setTechStats(result)
      setLoadingStats(false)
    }
    fetchTechStats()
  }, [activeTab, selectedEntreprise?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const chantiersFiltres = useMemo(() => {
    let result = [...chantiers]
    if (filterStatut !== 'tous') result = result.filter(c => c.statut === filterStatut)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c => c.nom.toLowerCase().includes(q) || c.client_nom.toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      if (sortKey === 'date')   return new Date(a.date_prevue).getTime() - new Date(b.date_prevue).getTime()
      if (sortKey === 'nom')    return a.nom.localeCompare(b.nom)
      if (sortKey === 'statut') return a.statut.localeCompare(b.statut)
      return 0
    })
    return result
  }, [chantiers, filterStatut, sortKey, searchQuery])

  const FILTERS: { value: FilterStatut; label: string }[] = [
    { value: 'tous',       label: 'Tous' },
    { value: 'planifie',   label: 'Planifiés' },
    { value: 'en_cours',   label: 'En cours' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'bloque',     label: 'Bloqués' },
    { value: 'termine',    label: 'Terminés' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Ligne principale */}
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Sun className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">PVPilot</span>
            </div>

            {/* Actions droite */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">{profile?.full_name}</div>
                <div className="text-xs text-slate-500 font-medium capitalize">{profile?.role}</div>
              </div>
              <button onClick={() => setActiveTab('profil')} className="flex-shrink-0">
                <Avatar name={profile?.full_name ?? ''} avatarUrl={profile?.avatar_url} size="md" />
              </button>
              <div className="h-6 w-px bg-slate-200" />

              {/* Cloche notifications */}
              <div className="relative" ref={notifPanelRef}>
                <button
                  onClick={() => { setShowNotifPanel(o => !o); if (!showNotifPanel) markAllRead() }}
                  className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-50"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white" />
                  )}
                </button>

                {showNotifPanel && (
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    {/* En-tête panneau */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <span className="font-bold text-gray-900 text-sm">Notifications</span>
                      <div className="flex items-center gap-2">
                        {/* Toggle push */}
                        {pushStatus !== 'unsupported' && (
                          <button
                            onClick={pushStatus === 'subscribed' ? unsubscribePush : subscribePush}
                            disabled={pushStatus === 'denied'}
                            title={pushStatus === 'subscribed' ? 'Désactiver les push' : pushStatus === 'denied' ? 'Bloquées par le navigateur' : 'Activer les push'}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                              pushStatus === 'subscribed' ? 'bg-orange-100 text-orange-600' :
                              pushStatus === 'denied'     ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                              'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-500'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${pushStatus === 'subscribed' ? 'bg-orange-500' : 'bg-gray-300'}`} />
                            Push {pushStatus === 'subscribed' ? 'ON' : 'OFF'}
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={clearAll} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout effacer</button>
                        )}
                      </div>
                    </div>

                    {/* Liste */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
                          <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <span className="text-sm">Aucune notification</span>
                        </div>
                      ) : notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => { markRead(n.id); setShowNotifPanel(false); navigate(`/chantier/${n.chantier_id}`) }}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${!n.lu ? 'bg-orange-50/40' : ''}`}
                        >
                          <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
                            n.type === 'anomalie' ? 'bg-red-100 text-red-500' :
                            n.type === 'rapport'  ? 'bg-blue-100 text-blue-500' :
                            n.type === 'bloque'   ? 'bg-orange-100 text-orange-500' :
                            'bg-green-100 text-green-500'
                          }`}>
                            {n.type === 'anomalie' ? '⚠' : n.type === 'rapport' ? '📋' : n.type === 'bloque' ? '🔒' : '✓'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${!n.lu ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.message}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          {!n.lu && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button onClick={signOut} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-slate-50">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Onglets navigation — style underline */}
          <nav className="flex gap-0 overflow-x-auto no-scrollbar -mb-px">
            {([
              { key: 'chantiers', label: 'Chantiers' },
              { key: 'anomalies', label: 'Anomalies', badge: anomaliesOuvertes.length || undefined },
              { key: 'stats',     label: 'Stats' },
              { key: 'planning',  label: 'Planning' },
              { key: 'equipe',    label: 'Équipe' },
              { key: 'chat',      label: 'Chat', badge: activeTab !== 'chat' ? (chatUnread || undefined) : undefined },
              profile?.role === 'admin' ? { key: 'entreprises', label: 'Entreprises' } : null,
              profile?.role === 'admin' ? { key: 'bugs', label: 'Bugs' } : null,
              { key: 'profil',    label: 'Profil' },
            ].filter(Boolean) as { key: Tab; label: string; badge?: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                  }`}>{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Bannière filtre entreprise (admin seulement) ────────────────────── */}
      {selectedEntreprise && profile?.role === 'admin' && (
        <div className="bg-orange-500 text-white px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm font-medium">
            Vue filtrée : <strong>{selectedEntreprise.nom}</strong>
          </span>
          <button
            onClick={() => setSelectedEntreprise(null)}
            className="text-white/80 hover:text-white text-sm underline underline-offset-2 transition-colors"
          >
            ✕ Voir tout
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Onglet Anomalies ──────────────────────────────────────────────── */}
        {activeTab === 'anomalies' && (
          <>
            {/* Filtres + actions sélection */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {([
                  { value: 'tous',     label: 'Toutes' },
                  { value: 'ouvert',   label: 'Ouvertes' },
                  { value: 'en_cours', label: 'En cours' },
                  { value: 'resolu',   label: 'Résolues' },
                ] as { value: typeof anomalieFilter; label: string }[]).map(f => (
                  <button key={f.value} onClick={() => setAnomalieFilter(f.value)}
                    className={`flex-shrink-0 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-150 ${anomalieFilter === f.value ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    style={anomalieFilter === f.value ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}
                  >{f.label}</button>
                ))}
              </div>
              {anomaliesFiltrees.length > 0 && (
                anomalieSelectMode ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={toggleAnomalieSelectAll} className="text-xs font-semibold text-orange-600 whitespace-nowrap">
                      {anomalieSelectedIds.size === anomaliesFiltrees.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </button>
                    <button onClick={exitAnomalieSelectMode} className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50">Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setAnomalieSelectMode(true)}
                    className="flex-shrink-0 text-gray-500 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                    Sélectionner
                  </button>
                )
              )}
            </div>

            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {anomaliesFiltrees.length} anomalie{anomaliesFiltrees.length !== 1 ? 's' : ''}
              {anomalieSelectMode && anomalieSelectedIds.size > 0 && ` · ${anomalieSelectedIds.size} sélectionnée${anomalieSelectedIds.size > 1 ? 's' : ''}`}
            </p>

            {anomaliesFiltrees.length === 0 ? (
              <div className="bg-white rounded-2xl p-14 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                <div className="text-5xl mb-4">✅</div>
                <p className="font-semibold text-gray-700 mb-1">Aucune anomalie</p>
                <p className="text-sm text-gray-400">Tout est en ordre</p>
              </div>
            ) : (
              <div className="space-y-3 pb-24">
                {(anomaliesFiltrees as AnomalieWithRelations[]).map(a => {
                  const s          = STATUT_ANOMALIE[a.statut]
                  const isSelected = anomalieSelectedIds.has(a.id)
                  return (
                    <div key={a.id}
                      onClick={() => anomalieSelectMode && toggleAnomalieSelect(a.id)}
                      className={`bg-white rounded-2xl p-6 space-y-4 transition-all ${anomalieSelectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-red-400' : ''}`}
                      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-start gap-3">
                          {anomalieSelectMode && (
                            <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-gray-300'}`}>
                              {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-gray-800">{a.type}</span>
                              <GraviteBadge gravite={a.gravite} />
                            </div>
                            <button onClick={e => { e.stopPropagation(); navigate(`/chantier/${a.chantier_id}/anomalies`) }}
                              className="text-xs text-orange-500 font-medium hover:underline">
                              {(a as AnomalieWithRelations).chantiers?.nom ?? '—'}
                            </button>
                          </div>
                        </div>
                        {!anomalieSelectMode && (
                          <button onClick={() => updateAnomalieStatut(a.id, s.next as Anomalie['statut'])}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-80 ${s.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                            {s.label} →
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{a.description}</p>
                      <p className="text-xs text-gray-400">
                        {(a as AnomalieWithRelations).profiles?.full_name ?? '—'} · {new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Barre bulk actions */}
            {anomalieSelectMode && anomalieSelectedIds.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 py-4"
                style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <p className="text-xs text-gray-400 text-center mb-3 font-medium">
                  {anomalieSelectedIds.size} anomalie{anomalieSelectedIds.size > 1 ? 's' : ''} sélectionnée{anomalieSelectedIds.size > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2 max-w-7xl mx-auto">
                  <button onClick={() => handleAnomalieBulkStatut('en_cours')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors">En cours</button>
                  <button onClick={() => handleAnomalieBulkStatut('resolu')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">Résoudre</button>
                  <button onClick={() => handleAnomalieBulkStatut('ouvert')} className="flex-1 py-3 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors">Rouvrir</button>
                  <button onClick={handleAnomalieBulkDelete} className="py-3 px-4 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}


        {/* ── Onglet Stats ──────────────────────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className="space-y-5 pb-6">

            {/* Métriques globales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'kWc en cours', value: enhancedStats.kwc_en_cours || '—', unit: enhancedStats.kwc_en_cours ? 'kWc' : '', color: 'text-orange-500' },
                { label: 'kWc installés', value: enhancedStats.kwc_installe || '—', unit: enhancedStats.kwc_installe ? 'kWc' : '', color: 'text-green-500' },
                { label: 'Progression moy.', value: `${enhancedStats.progression_moy}%`, unit: 'tous chantiers', color: 'text-blue-500' },
                { label: 'Anomalies ouvertes', value: anomaliesOuvertes.length, unit: 'à traiter', color: anomaliesOuvertes.length > 0 ? 'text-red-500' : 'text-green-500' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{kpi.label}</p>
                  <p className={`text-4xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  {kpi.unit && <p className="text-xs text-gray-400 mt-1.5">{kpi.unit}</p>}
                </div>
              ))}
            </div>

            {/* Répartition statuts */}
            {stats.total > 0 && (
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
                <h3 className="font-semibold text-gray-900 mb-5">Répartition des chantiers</h3>
                <div className="space-y-4">
                  {[
                    { label: 'En cours',   count: stats.en_cours,   color: 'bg-blue-500' },
                    { label: 'Terminés',   count: stats.termines,   color: 'bg-green-500' },
                    { label: 'Planifiés',  count: stats.planifies,  color: 'bg-purple-400' },
                    { label: 'En attente', count: stats.en_attente, color: 'bg-gray-400' },
                    { label: 'Bloqués',    count: stats.bloques,    color: 'bg-red-500' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-600">{item.label}</span>
                        <span className="text-gray-400">{item.count} / {stats.total}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                          style={{ width: `${Math.round(item.count / stats.total * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance équipe */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <h3 className="font-semibold text-gray-900">Performance équipe</h3>
                {loadingStats && <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              {!loadingStats && techStats.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Aucun technicien</div>
              ) : (
                <>
                  {/* En-tête colonnes */}
                  <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Technicien</span>
                    <span className="text-center w-16">Actifs</span>
                    <span className="text-center w-16">Total</span>
                    <span className="text-center w-16">Anomalies</span>
                    <span className="text-center w-20">Progression</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {techStats.map(tech => (
                      <div key={tech.id} className="flex items-center gap-4 px-6 py-4">
                        <Avatar name={tech.full_name} avatarUrl={tech.avatar_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{tech.full_name}</p>
                          <p className="text-xs text-gray-400">{tech.poste ?? 'Technicien'}</p>
                        </div>
                        <div className="text-center w-16">
                          <p className="text-lg font-bold text-blue-500">{tech.nb_actifs}</p>
                          <p className="text-[10px] text-gray-400 md:hidden">actifs</p>
                        </div>
                        <div className="text-center w-16">
                          <p className="text-lg font-bold text-gray-500">{tech.nb_total}</p>
                          <p className="text-[10px] text-gray-400 md:hidden">total</p>
                        </div>
                        <div className="text-center w-16">
                          <p className={`text-lg font-bold ${tech.nb_anomalies > 0 ? 'text-red-500' : 'text-gray-300'}`}>{tech.nb_anomalies}</p>
                          <p className="text-[10px] text-gray-400 md:hidden">anomalies</p>
                        </div>
                        <div className="text-center w-20 hidden md:block">
                          {tech.nb_actifs > 0 ? (
                            <>
                              <p className="text-lg font-bold text-orange-500">{tech.progression_moy}%</p>
                              <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full" style={{ width: `${tech.progression_moy}%` }} />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-300">—</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Onglet Profil ─────────────────────────────────────────────────── */}
        {activeTab === 'profil' && (
          <div className="max-w-4xl pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* ── Colonne gauche ──────────────────────────────────────── */}
              <div className="md:col-span-1 space-y-4">

                {/* Carte avatar */}
                <div className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col items-center text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="relative mb-5">
                    <label className="cursor-pointer block">
                      <Avatar name={profile?.full_name ?? ''} avatarUrl={profile?.avatar_url} size="xl" />
                      <div className="absolute bottom-0 right-0 p-1.5 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center border-2 border-white transition-colors shadow-sm">
                        {avatarLoading
                          ? <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        }
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={avatarLoading} />
                    </label>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-800 tracking-tight">{profile?.full_name}</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1">{profile?.email}</p>
                  <div className={`mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${
                    profile?.role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                      : 'bg-orange-50 text-orange-700 border-orange-100'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${profile?.role === 'admin' ? 'bg-purple-500' : 'bg-orange-500'}`} />
                    {profile?.role === 'admin' ? 'Admin' : 'Manager'}
                  </div>
                </div>

                {/* Carte mot de passe → ouvre une modal */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <button
                    onClick={() => { setShowPwd(true); setPwdMsg(null); setPwd({ new: '', confirm: '' }) }}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 text-slate-700 group-hover:text-slate-900 transition-colors">
                      <Shield className="w-5 h-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      <span className="text-sm font-semibold">Changer le mot de passe</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Déconnexion */}
                <button
                  onClick={signOut}
                  className="w-full bg-red-50 text-red-600 font-semibold py-4 rounded-2xl hover:bg-red-100 transition-colors text-sm border border-red-100"
                >
                  Se déconnecter
                </button>
              </div>

              {/* ── Colonne droite — Préférences notifications ───────────── */}
              <div className="md:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="px-8 py-6 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Préférences de notifications</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                      {pushStatus === 'subscribed'
                        ? 'Gérez ce que vous souhaitez recevoir sur cet appareil.'
                        : 'Activez les notifications push (bouton cloche) pour gérer vos préférences.'}
                    </p>
                  </div>

                  <div className="p-2">
                    {([
                      { key: 'anomalie_notif_enabled',     label: 'Anomalies',        desc: 'Nouvelle anomalie signalée',              icon: <AlertCircle className="w-5 h-5 text-rose-500" />,    iconBg: 'bg-rose-50'    },
                      { key: 'rapport_notif_enabled',      label: 'Rapports terrain',  desc: "Message d'un technicien",                 icon: <FileText className="w-5 h-5 text-blue-500" />,       iconBg: 'bg-blue-50'    },
                      { key: 'chantier_notif_enabled',     label: 'Chantiers',         desc: 'Bloqué ou terminé',                       icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, iconBg: 'bg-amber-50'   },
                      { key: 'autocontrole_notif_enabled', label: 'Auto-contrôles',    desc: 'Rapport soumis par un technicien',         icon: <CheckSquare className="w-5 h-5 text-emerald-500" />, iconBg: 'bg-emerald-50' },
                      { key: 'chat_notif_enabled',         label: 'Messages chat',     desc: 'Nouveau message dans un chantier ou chat', icon: <MessageCircle className="w-5 h-5 text-indigo-500" />, iconBg: 'bg-indigo-50' },
                    ] as const).map(({ key, label, desc, icon, iconBg }) => (
                      <div key={key} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-xl transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 ${iconBg} rounded-xl mt-0.5 flex-shrink-0`}>{icon}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{label}</p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">{desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => pushStatus === 'subscribed' && toggleNotifPref(key)}
                          disabled={pushStatus !== 'subscribed'}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                            pushStatus !== 'subscribed' ? 'bg-slate-200 cursor-not-allowed opacity-50' :
                            notifPrefs[key] ? 'bg-orange-500 cursor-pointer' : 'bg-slate-200 cursor-pointer'
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            notifPrefs[key] ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Modal : changement de mot de passe ────────────────────────────── */}
        {showPwd && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={e => e.target === e.currentTarget && setShowPwd(false)}
          >
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.20)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-50 rounded-xl">
                    <Shield className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className="font-bold text-slate-900">Mot de passe</p>
                </div>
                <button
                  onClick={() => setShowPwd(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-sm">
                  ✕
                </button>
              </div>

              {pwdMsg && (
                <p className={`text-xs font-medium px-3 py-2.5 rounded-xl ${pwdMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {pwdMsg.text}
                </p>
              )}

              <div className="relative">
                <input type={showPwdNew ? 'text' : 'password'} placeholder="Nouveau mot de passe"
                  value={pwd.new} onChange={e => setPwd(p => ({ ...p, new: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <button type="button" onClick={() => setShowPwdNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPwdNew
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>

              <div className="relative">
                <input type={showPwdConfirm ? 'text' : 'password'} placeholder="Confirmer le mot de passe"
                  value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <button type="button" onClick={() => setShowPwdConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPwdConfirm
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowPwd(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleChangePwd}
                  disabled={pwdLoading || !pwd.new || !pwd.confirm}
                  className="flex-1 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                >
                  {pwdLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Onglet Chantiers ──────────────────────────────────────────────── */}
        {activeTab === 'chantiers' && (<>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Chantiers', value: stats.total,    sub: 'Sur la période',        border: 'border-l-slate-800',   icon: <Layers className="w-5 h-5 text-slate-700" />,      iconBg: 'bg-slate-100'   },
            { label: 'En cours',        value: stats.en_cours, sub: 'Actuellement sur site',  border: 'border-l-blue-500',    icon: <RefreshCw className="w-5 h-5 text-blue-600" />,    iconBg: 'bg-blue-50'     },
            { label: 'Bloqués',         value: stats.bloques,  sub: 'Nécessitent une action', border: 'border-l-red-500',     icon: <AlertTriangle className="w-5 h-5 text-red-600" />, iconBg: 'bg-red-50'      },
            { label: 'Terminés',        value: stats.termines, sub: 'Ce mois-ci',             border: 'border-l-emerald-500', icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, iconBg: 'bg-emerald-50' },
          ].map((kpi, i) => (
            <div key={i} className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-l-4 ${kpi.border} hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default relative overflow-hidden group`}>
              {/* Filigrane icône en fond */}
              <div className="absolute -right-3 -bottom-3 opacity-[0.04] group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500 pointer-events-none">
                {React.cloneElement(kpi.icon as React.ReactElement, { className: 'w-28 h-28' })}
              </div>
              <div className="flex justify-between items-start mb-5 relative z-10">
                <div className={`p-2.5 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
              </div>
              <div className="relative z-10">
                <p className="text-4xl font-black text-slate-800 tracking-tight">{kpi.value}</p>
                <h3 className="text-sm font-bold text-slate-700 mt-1">{kpi.label}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Anomalies ouvertes ────────────────────────────────────────────── */}
        {anomaliesOuvertes.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
              <h2 className="font-semibold text-gray-900">Anomalies ouvertes</h2>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {anomaliesOuvertes.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {anomaliesOuvertes.slice(0, 5).map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/chantier/${a.chantier_id}/anomalies`)}
                  className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <GraviteBadge gravite={a.gravite} />
                  <span className="flex-1 text-sm text-gray-700 truncate">{a.type} — {a.description}</span>
                  <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Alerte bloqués ────────────────────────────────────────────────── */}
        {stats.bloques > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-3.5 flex items-center gap-3">
            <span className="text-lg">🚨</span>
            <p className="text-sm text-red-700 font-medium">
              {stats.bloques} chantier{stats.bloques > 1 ? 's' : ''} bloqué{stats.bloques > 1 ? 's' : ''} — action requise
            </p>
            <button
              onClick={() => setFilterStatut('bloque')}
              className="ml-auto text-xs font-semibold text-red-600 bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
            >
              Voir →
            </button>
          </div>
        )}

        {/* ── Recherche + tri + action ──────────────────────────────────────── */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher un chantier..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-600"
          >
            <option value="date">Date ↑</option>
            <option value="nom">Nom A–Z</option>
            <option value="statut">Statut</option>
          </select>
        </div>

        {/* ── Filtres statut ────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatut(f.value)}
              className={`flex-shrink-0 transition-all ${
                filterStatut === f.value
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 px-4 py-2 rounded-full text-sm font-medium'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-500 hover:text-orange-500 px-4 py-2 rounded-full text-sm font-medium'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── En-tête liste ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {chantiersFiltres.length} chantier{chantiersFiltres.length !== 1 ? 's' : ''}
          </h2>
          <button
            onClick={() => navigate('/manager/nouveau-chantier')}
            className="text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
          >
            + Nouveau chantier
          </button>
        </div>

        {/* ── Liste chantiers ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chantiersFiltres.length === 0 ? (
          <div className="bg-white rounded-2xl p-14 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="text-5xl mb-4">🏗️</div>
            <p className="font-semibold text-gray-700 mb-1">
              {searchQuery ? 'Aucun résultat' : 'Aucun chantier ici'}
            </p>
            <p className="text-sm text-gray-400">
              {searchQuery ? 'Essayez un autre terme de recherche' : 'Créez votre premier chantier pour commencer'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-8">
            {chantiersFiltres.map(c => (
              <ChantierCard
                key={c.id}
                chantier={c}
                pct={progression[c.id]?.pct ?? 0}
                onClick={() => navigate(`/chantier/${c.id}`)}
              />
            ))}
          </div>
        )}
        </>)}

        {/* ── Onglet Planning ───────────────────────────────────────────────── */}
        {activeTab === 'planning' && (
          <PlanningManagerTab entrepriseId={selectedEntreprise?.id} />
        )}

        {/* ── Onglet Équipe ────────────────────────────────────────────────── */}
        {activeTab === 'equipe' && (
          <GestionEquipe embedded entrepriseId={selectedEntreprise?.id} />
        )}

        {/* ── Onglet Entreprises (admin seulement) ─────────────────────────── */}
        {activeTab === 'entreprises' && profile?.role === 'admin' && (
          <AdminEntreprisesTab onFilter={e => { setSelectedEntreprise(e); setActiveTab('chantiers') }} />
        )}

        {/* ── Onglet Bugs (admin seulement) ────────────────────────────────── */}
        {activeTab === 'bugs' && profile?.role === 'admin' && (
          <AdminBugReportsTab />
        )}

        {/* ── Onglet Chat général ───────────────────────────────────────────── */}
        {activeTab === 'chat' && profile?.id && (
          <GlobalChatTab userId={profile.id} isActive={activeTab === 'chat'} />
        )}
      </main>

      <BugReportButton />
    </div>
  )
}

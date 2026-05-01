import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useChantiers } from '@/hooks/useChantiers'
import { useAnomalies } from '@/hooks/useAnomalies'
import { useEtapesProgression } from '@/hooks/useEtapesProgression'
import GraviteBadge from '@/components/anomalies/GraviteBadge'
import { supabase } from '@/lib/supabase'
import { Chantier, ChantierStatut, Anomalie } from '@/types'

type SortKey = 'date' | 'nom' | 'statut'
type FilterStatut = ChantierStatut | 'tous'
type Tab = 'chantiers' | 'anomalies' | 'equipe' | 'profil'

type AnomalieWithRelations = Anomalie & {
  profiles?: { full_name?: string } | null
  chantiers?: { nom?: string } | null
}

const STATUT_LABEL: Record<ChantierStatut, string> = {
  en_attente: 'En attente',
  en_cours:   'En cours',
  termine:    'Terminé',
  bloque:     'Bloqué',
}

const STATUT_DOT: Record<ChantierStatut, string> = {
  en_attente: 'bg-gray-400',
  en_cours:   'bg-blue-500',
  termine:    'bg-green-500',
  bloque:     'bg-red-500',
}

const STATUT_BORDER: Record<ChantierStatut, string> = {
  en_attente: 'border-l-gray-300',
  en_cours:   'border-l-blue-500',
  termine:    'border-l-green-500',
  bloque:     'border-l-red-500',
}

// ─── Carte chantier ──────────────────────────────────────────────────────────
function ChantierCard({ chantier, pct, onClick }: { chantier: Chantier; pct: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border-l-4 ${STATUT_BORDER[chantier.statut]} cursor-pointer hover:shadow-md transition-all duration-200`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-[15px]">{chantier.nom}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{chantier.client_nom}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUT_DOT[chantier.statut]}`} />
            <span className="text-xs font-medium text-gray-600">{STATUT_LABEL[chantier.statut]}</span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Progression</span>
            <span className={`font-semibold ${pct === 100 ? 'text-green-600' : 'text-gray-600'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>📅 {new Date(chantier.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
          <span>☀️ {chantier.nb_panneaux} panneaux</span>
          <span>{chantier.type_installation}</span>
        </div>
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
  const { profile, signOut } = useAuth()
  const { chantiers, loading } = useChantiers()
  const { anomalies, updateStatut: updateAnomalieStatut } = useAnomalies()
  const navigate               = useNavigate()

  const [activeTab, setActiveTab]       = useState<Tab>('chantiers')
  const [filterStatut, setFilterStatut] = useState<FilterStatut>('tous')
  const [sortKey, setSortKey]           = useState<SortKey>('date')
  const [searchQuery, setSearchQuery]   = useState('')
  const [anomalieFilter, setAnomalieFilter] = useState<'tous' | 'ouvert' | 'en_cours' | 'resolu'>('tous')
  const [showPwd, setShowPwd]           = useState(false)
  const [pwd, setPwd]                   = useState({ new: '', confirm: '' })
  const [pwdLoading, setPwdLoading]     = useState(false)
  const [pwdMsg, setPwdMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
    total:    chantiers.length,
    en_cours: chantiers.filter(c => c.statut === 'en_cours').length,
    bloques:  chantiers.filter(c => c.statut === 'bloque').length,
    termines: chantiers.filter(c => c.statut === 'termine').length,
  }

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
    { value: 'en_cours',   label: 'En cours' },
    { value: 'en_attente', label: 'En attente' },
    { value: 'bloque',     label: 'Bloqués' },
    { value: 'termine',    label: 'Terminés' },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6">

          {/* Ligne principale */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                ☀️
              </div>
              <span className="font-bold text-gray-900 text-lg tracking-tight">SolarTrack</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{profile?.full_name}</p>
                <p className="text-xs text-gray-400">Manager</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={signOut}
                title="Se déconnecter"
                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none ml-1"
              >
                ↩
              </button>
            </div>
          </div>

          {/* Onglets navigation */}
          <div className="flex gap-0 -mb-px overflow-x-auto no-scrollbar">
            {([
              { key: 'chantiers', label: 'Chantiers' },
              { key: 'anomalies', label: 'Anomalies', badge: anomaliesOuvertes.length || undefined },
              { key: 'equipe',    label: 'Équipe' },
              { key: 'profil',    label: 'Profil' },
            ] as { key: Tab; label: string; badge?: number }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => tab.key === 'equipe' ? navigate('/manager/equipe') : setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-orange-500 text-orange-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* ── Onglet Anomalies ──────────────────────────────────────────────── */}
        {activeTab === 'anomalies' && (
          <>
            {/* Filtres */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
              {([
                { value: 'tous',     label: 'Toutes' },
                { value: 'ouvert',   label: 'Ouvertes' },
                { value: 'en_cours', label: 'En cours' },
                { value: 'resolu',   label: 'Résolues' },
              ] as { value: typeof anomalieFilter; label: string }[]).map(f => (
                <button
                  key={f.value}
                  onClick={() => setAnomalieFilter(f.value)}
                  className={`flex-shrink-0 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-150 ${
                    anomalieFilter === f.value
                      ? 'text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                  style={anomalieFilter === f.value ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {anomaliesFiltrees.length} anomalie{anomaliesFiltrees.length !== 1 ? 's' : ''}
            </p>

            {anomaliesFiltrees.length === 0 ? (
              <div className="bg-white rounded-2xl p-14 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
                <div className="text-5xl mb-4">✅</div>
                <p className="font-semibold text-gray-700 mb-1">Aucune anomalie</p>
                <p className="text-sm text-gray-400">Tout est en ordre</p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {(anomaliesFiltrees as AnomalieWithRelations[]).map(a => {
                  const s = STATUT_ANOMALIE[a.statut]
                  return (
                    <div key={a.id} className="bg-white rounded-2xl p-5 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-gray-800">{a.type}</span>
                            <GraviteBadge gravite={a.gravite} />
                          </div>
                          <button
                            onClick={() => navigate(`/chantier/${a.chantier_id}/anomalies`)}
                            className="text-xs text-orange-500 font-medium hover:underline"
                          >
                            {a.chantiers?.nom ?? '—'}
                          </button>
                        </div>
                        <button
                          onClick={() => updateAnomalieStatut(a.id, s.next as Anomalie['statut'])}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:opacity-80 ${s.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label} →
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{a.description}</p>
                      <p className="text-xs text-gray-400">
                        {a.profiles?.full_name ?? '—'} · {new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}


        {/* ── Onglet Profil ─────────────────────────────────────────────────── */}
        {activeTab === 'profil' && (
          <div className="max-w-lg space-y-4 pb-6">
            <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >
                {profile?.full_name?.charAt(0).toUpperCase()}
              </div>
              <h2 className="font-bold text-gray-900 text-lg">{profile?.full_name}</h2>
              <p className="text-gray-400 text-sm mt-1">{profile?.email}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Manager
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <button
                onClick={() => { setShowPwd(v => !v); setPwdMsg(null) }}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-gray-900">Changer le mot de passe</span>
                <span className="text-gray-400 text-lg">{showPwd ? '▴' : '▾'}</span>
              </button>
              {showPwd && (
                <div className="px-5 pb-5 space-y-3 border-t border-gray-50 pt-4">
                  {pwdMsg && (
                    <p className={`text-xs font-medium px-3 py-2 rounded-lg ${pwdMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {pwdMsg.text}
                    </p>
                  )}
                  <input
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={pwd.new}
                    onChange={e => setPwd(p => ({ ...p, new: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <input
                    type="password"
                    placeholder="Confirmer le mot de passe"
                    value={pwd.confirm}
                    onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <button
                    onClick={handleChangePwd}
                    disabled={pwdLoading || !pwd.new || !pwd.confirm}
                    className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
                  >
                    {pwdLoading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={signOut}
              className="w-full bg-red-50 text-red-600 font-semibold py-4 rounded-2xl hover:bg-red-100 transition-colors text-sm"
            >
              Se déconnecter
            </button>
          </div>
        )}

        {/* ── Onglet Chantiers ──────────────────────────────────────────────── */}
        {activeTab === 'chantiers' && (<>

        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',    value: stats.total,    dot: 'bg-gray-400',  filter: 'tous'       },
            { label: 'En cours', value: stats.en_cours, dot: 'bg-blue-500',  filter: 'en_cours'   },
            { label: 'Bloqués',  value: stats.bloques,  dot: 'bg-red-500',   filter: 'bloque'     },
            { label: 'Terminés', value: stats.termines, dot: 'bg-green-500', filter: 'termine'    },
          ].map(kpi => (
            <button
              key={kpi.label}
              onClick={() => setFilterStatut(kpi.filter as FilterStatut)}
              className={`bg-white rounded-2xl p-4 text-left transition-all duration-150 ${
                filterStatut === kpi.filter
                  ? 'ring-2 ring-orange-400 ring-offset-1'
                  : 'hover:shadow-sm'
              }`}
              style={{ boxShadow: filterStatut === kpi.filter ? undefined : '0 1px 3px rgba(0,0,0,0.07)' }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full ${kpi.dot}`} />
                <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{kpi.value}</div>
            </button>
          ))}
        </div>

        {/* ── Anomalies ouvertes ────────────────────────────────────────────── */}
        {anomaliesOuvertes.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2.5">
              <h2 className="font-semibold text-gray-800 text-sm">Anomalies ouvertes</h2>
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {anomaliesOuvertes.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {anomaliesOuvertes.slice(0, 5).map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/chantier/${a.chantier_id}/anomalies`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left transition-colors"
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
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-150 ${
                filterStatut === f.value
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
              style={filterStatut === f.value ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}
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
          <div className="bg-white rounded-2xl p-14 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div className="text-5xl mb-4">🏗️</div>
            <p className="font-semibold text-gray-700 mb-1">
              {searchQuery ? 'Aucun résultat' : 'Aucun chantier ici'}
            </p>
            <p className="text-sm text-gray-400">
              {searchQuery ? 'Essayez un autre terme de recherche' : 'Créez votre premier chantier pour commencer'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
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
      </main>
    </div>
  )
}

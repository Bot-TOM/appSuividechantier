import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useChantiers } from '@/hooks/useChantiers'
import { useEtapesProgression } from '@/hooks/useEtapesProgression'
import { supabase } from '@/lib/supabase'
import { Chantier, ChantierStatut } from '@/types'

const STATUT_LABEL: Record<ChantierStatut, string> = {
  planifie:   'Planifié',
  en_attente: 'En attente',
  en_cours:   'En cours',
  termine:    'Terminé',
  bloque:     'Bloqué',
}

const STATUT_DOT: Record<ChantierStatut, string> = {
  planifie:   'bg-purple-400',
  en_attente: 'bg-gray-400',
  en_cours:   'bg-blue-500',
  termine:    'bg-green-500',
  bloque:     'bg-red-500',
}

const STATUT_BORDER: Record<ChantierStatut, string> = {
  planifie:   'border-l-purple-400',
  en_attente: 'border-l-gray-300',
  en_cours:   'border-l-blue-500',
  termine:    'border-l-green-500',
  bloque:     'border-l-red-500',
}

// ─── Carte chantier ──────────────────────────────────────────────────────────
function ChantierCard({
  chantier, pct, etapeActive, onClick,
}: {
  chantier: Chantier
  pct: number
  etapeActive: string | null
  onClick: () => void
}) {
  const isBloque  = chantier.statut === 'bloque'
  const isTermine = chantier.statut === 'termine'

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border-l-4 ${STATUT_BORDER[chantier.statut]} active:scale-[0.99] transition-all duration-150 cursor-pointer`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <div className="p-5">
        {/* Nom + statut */}
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

        {/* Barre de progression */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Progression</span>
            <span className={`font-semibold ${pct === 100 ? 'text-green-600' : 'text-gray-600'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : isBloque ? 'bg-red-400' : 'bg-orange-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Étape active */}
        {etapeActive && !isTermine && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isBloque ? 'bg-red-400' : 'bg-orange-400 animate-pulse'}`} />
            <span className="text-xs text-gray-500 truncate">{etapeActive}</span>
          </div>
        )}

        {/* Infos */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>📅 {new Date(chantier.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
          {chantier.puissance_kwc != null
            ? <span>⚡ {chantier.puissance_kwc} kWc</span>
            : <span>☀️ {chantier.nb_panneaux} pan.</span>
          }
          <span className="truncate">{chantier.type_installation}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Onglet Profil ───────────────────────────────────────────────────────────
function ProfilTab({ profile, signOut }: { profile: { full_name: string; email?: string } | null; signOut: () => void }) {
  const [showPwd, setShowPwd]       = useState(false)
  const [pwd, setPwd]               = useState({ new: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleChangePwd() {
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
  }

  return (
    <div className="space-y-4">
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
          Technicien
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
            <input type="password" placeholder="Nouveau mot de passe" value={pwd.new}
              onChange={e => setPwd(p => ({ ...p, new: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="password" placeholder="Confirmer le mot de passe" value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button onClick={handleChangePwd} disabled={pwdLoading || !pwd.new || !pwd.confirm}
              className="w-full text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
              {pwdLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      <button onClick={signOut}
        className="w-full bg-red-50 text-red-600 font-semibold py-4 rounded-2xl hover:bg-red-100 transition-colors text-sm">
        Se déconnecter
      </button>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function TechnicienHome() {
  const { profile, signOut } = useAuth()
  const { chantiers, loading } = useChantiers()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'chantiers' | 'profil'>('chantiers')

  const progression = useEtapesProgression(chantiers.map(c => c.id))

  const firstName = profile?.full_name?.split(' ')[0] ?? profile?.full_name ?? ''
  const hour      = new Date().getHours()
  const greeting  = hour < 18 ? 'Bonjour' : 'Bonsoir'
  const dateStr   = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const stats = {
    enCours:  chantiers.filter(c => c.statut === 'en_cours').length,
    bloques:  chantiers.filter(c => c.statut === 'bloque').length,
    termines: chantiers.filter(c => c.statut === 'termine').length,
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header gradient ───────────────────────────────────────────────── */}
      <header className="px-5 pt-6 pb-5" style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
        <div className="max-w-lg mx-auto">

          {/* Barre du haut : logo + avatar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white text-xl">☀️</span>
              <span className="text-white/80 text-sm font-medium">SolarTrack</span>
            </div>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-white/20">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
          </div>

          {activeTab === 'chantiers' ? (
            <>
              {/* Greeting */}
              <div className="mt-4">
                <p className="text-orange-200 text-xs font-medium capitalize">{dateStr}</p>
                <h1 className="text-white font-bold text-2xl mt-0.5">{greeting}, {firstName} 👋</h1>
              </div>

              {/* Stats pills */}
              {chantiers.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {stats.enCours > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                      {stats.enCours} en cours
                    </span>
                  )}
                  {stats.bloques > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                      {stats.bloques} bloqué{stats.bloques > 1 ? 's' : ''}
                    </span>
                  )}
                  {stats.termines > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
                      {stats.termines} terminé{stats.termines > 1 ? 's' : ''}
                    </span>
                  )}
                  {stats.enCours === 0 && stats.bloques === 0 && stats.termines === 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-white/20 text-white font-semibold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      {chantiers.length} assigné{chantiers.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="mt-4">
              <h1 className="text-white font-bold text-2xl">Mon profil</h1>
              <p className="text-orange-100 text-sm mt-0.5">{profile?.full_name}</p>
            </div>
          )}
        </div>
      </header>

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <main className="px-4 py-5 max-w-lg mx-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>

        {activeTab === 'chantiers' && (
          <>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chantiers.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center mt-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="text-5xl mb-4">📋</div>
                <p className="font-semibold text-gray-700 mb-1">Aucun chantier assigné</p>
                <p className="text-sm text-gray-400">Votre manager vous assignera bientôt un chantier</p>
              </div>
            ) : (
              <div className="space-y-3 mt-2">
                {chantiers.map(c => (
                  <ChantierCard
                    key={c.id}
                    chantier={c}
                    pct={progression[c.id]?.pct ?? 0}
                    etapeActive={progression[c.id]?.etapeActive ?? null}
                    onClick={() => navigate(`/chantier/${c.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'profil' && (
          <div className="mt-2">
            <ProfilTab profile={profile} signOut={signOut} />
          </div>
        )}
      </main>

      {/* ── Barre de navigation bas ───────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 pb-safe">
        <div className="flex max-w-lg mx-auto">
          <button
            onClick={() => setActiveTab('chantiers')}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${activeTab === 'chantiers' ? 'text-orange-500' : 'text-gray-400'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'chantiers' ? 2.5 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[11px] font-semibold">Chantiers</span>
            {activeTab === 'chantiers' && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />}
          </button>

          <button
            onClick={() => setActiveTab('profil')}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${activeTab === 'profil' ? 'text-orange-500' : 'text-gray-400'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'profil' ? 2.5 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[11px] font-semibold">Profil</span>
            {activeTab === 'profil' && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />}
          </button>
        </div>
      </nav>
    </div>
  )
}

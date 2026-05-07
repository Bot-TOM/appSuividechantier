import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useChantiers } from '@/hooks/useChantiers'
import { useEtapesProgression } from '@/hooks/useEtapesProgression'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import Avatar from '@/components/Avatar'
import { supabase } from '@/lib/supabase'
import { Chantier, ChantierStatut, UserProfile } from '@/types'
import { usePermissions } from '@/hooks/usePermissions'

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
function ProfilTab({ profile, signOut, pushStatus, subscribePush, unsubscribePush, onAvatarChange }: {
  profile: { id: string; full_name: string; email?: string; avatar_url?: string | null; poste?: string | null } | null
  signOut: () => void
  pushStatus: 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'
  subscribePush: () => void
  unsubscribePush: () => void
  onAvatarChange: (url: string) => void
}) {
  const [showPwd, setShowPwd]       = useState(false)
  const [pwd, setPwd]               = useState({ new: '', confirm: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
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
      onAvatarChange(url)
    } finally {
      setAvatarLoading(false)
    }
  }

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
        <label className="relative inline-block cursor-pointer mb-4">
          <Avatar name={profile?.full_name ?? ''} avatarUrl={profile?.avatar_url} size="xl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white">
            {avatarLoading
              ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            }
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={avatarLoading} />
        </label>
        <h2 className="font-bold text-gray-900 text-lg">{profile?.full_name}</h2>
        <p className="text-gray-400 text-sm mt-1">{profile?.email}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          {profile?.poste ?? 'Technicien'}
        </div>

        {/* Toggle notifications push */}

        {pushStatus !== 'unsupported' && (
          <div className="mt-4">
            <button
              onClick={pushStatus === 'subscribed' ? unsubscribePush : subscribePush}
              disabled={pushStatus === 'denied'}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                pushStatus === 'subscribed'
                  ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                  : pushStatus === 'denied'
                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200'
              }`}
            >
              <svg className="w-4 h-4" fill={pushStatus === 'subscribed' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {pushStatus === 'subscribed'
                ? 'Notifications activées'
                : pushStatus === 'denied'
                ? 'Notifications bloquées'
                : 'Activer les notifications'}
            </button>
            {pushStatus === 'denied' && (
              <p className="text-xs text-gray-400 mt-1.5">Autorise les notifications dans les paramètres du navigateur</p>
            )}
          </div>
        )}
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
  const { profile, signOut, refreshProfile } = useAuth()
  const { chantiers, loading } = useChantiers()
  const { can } = usePermissions()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'chantiers' | 'equipe' | 'profil'>('chantiers')
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([])

  useEffect(() => {
    supabase.from('profiles').select('*').order('role').then(({ data }) => {
      if (data) setTeamMembers(data)
    })
  }, [])
  const { status: pushStatus, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications()

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
            <button onClick={() => { setActiveTab('profil'); refreshProfile() }} className="flex-shrink-0">
              <Avatar name={profile?.full_name ?? ''} avatarUrl={profile?.avatar_url} size="md" className="border-2 border-white/30" />
            </button>
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
            {/* Bouton créer — visible seulement si permission creer_chantier */}
            {can('creer_chantier') && (
              <button
                onClick={() => navigate('/manager/nouveau-chantier')}
                className="w-full text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 text-sm mb-4"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
              >
                + Nouveau chantier
              </button>
            )}

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chantiers.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center mt-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="text-5xl mb-4">📋</div>
                <p className="font-semibold text-gray-700 mb-1">
                  {can('voir_tous_chantiers') ? 'Aucun chantier' : 'Aucun chantier assigné'}
                </p>
                <p className="text-sm text-gray-400">
                  {can('voir_tous_chantiers') ? 'Créez votre premier chantier ci-dessus' : 'Votre manager vous assignera bientôt un chantier'}
                </p>
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

        {/* ── Onglet Équipe ─────────────────────────────────────────────────── */}
        {activeTab === 'equipe' && (() => {
          const managers     = teamMembers.filter(m => m.role === 'manager')
          const techniciens  = teamMembers.filter(m => m.role === 'technicien')
          return (
            <div className="space-y-4 pb-6">
              {/* Managers */}
              {managers.length > 0 && (
                <section className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Responsable</p>
                  <div className="space-y-3">
                    {managers.map(m => (
                      <div key={m.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)' }}>
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{m.full_name}</p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex-shrink-0">
                          Manager
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Techniciens */}
              {techniciens.length > 0 && (
                <section className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Équipe terrain</p>
                  <div className="space-y-3">
                    {techniciens.map(t => (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                          {t.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{t.full_name}</p>
                          {t.poste && <p className="text-xs text-gray-400">{t.poste}</p>}
                        </div>
                        {t.id === profile?.id && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-100 flex-shrink-0">
                            Vous
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {teamMembers.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-10">Aucun membre</p>
              )}
            </div>
          )
        })()}

        {activeTab === 'profil' && (
          <div className="mt-2">
            <ProfilTab profile={profile} signOut={signOut} pushStatus={pushStatus} subscribePush={subscribePush} unsubscribePush={unsubscribePush} onAvatarChange={refreshProfile} />
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
            onClick={() => setActiveTab('equipe')}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${activeTab === 'equipe' ? 'text-orange-500' : 'text-gray-400'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'equipe' ? 2.5 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[11px] font-semibold">Équipe</span>
            {activeTab === 'equipe' && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />}
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

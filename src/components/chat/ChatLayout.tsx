import { useState, useMemo, useEffect } from 'react'
import { Search, Plus, ChevronLeft, MessageSquare, Users, Layers, User, X } from 'lucide-react'
import GlobalChatTab from '@/components/chat/GlobalChatTab'
import ChatTab from '@/components/chat/ChatTab'
import GroupChatTab from '@/components/chat/GroupChatTab'
import CreateGroupModal from '@/components/chat/CreateGroupModal'
import { supabase } from '@/lib/supabase'
import { useChatGroups } from '@/hooks/useChatGroups'
import { useChantiers } from '@/hooks/useChantiers'
import { useChatUnread, relativeTime } from '@/hooks/useChatUnread'
import { useGlobalMessages } from '@/hooks/useGlobalMessages'
import type { UserProfile } from '@/types'

type ConvType = 'global' | 'chantier' | 'group'

interface ActiveConv {
  type: ConvType
  id: string       // chantierId ou groupId (ignoré pour 'global')
  label: string
}

interface Props {
  profile: UserProfile
  isActive?: boolean
  /** Surcharge l'entreprise active — utilisé par l'admin quand il filtre sur une autre entreprise */
  entrepriseIdOverride?: string
}

export default function ChatLayout({ profile, isActive = true, entrepriseIdOverride }: Props) {
  const userId       = profile.id
  const entrepriseId = entrepriseIdOverride ?? profile.entreprise_id ?? ''

  const { groups, loading: groupsLoading, createGroup, deleteGroup, leaveGroup, createDM, refetch: refetchGroups } =
    useChatGroups(userId, entrepriseId)
  const { chantiers, loading: chantiersLoading } = useChantiers(entrepriseIdOverride)

  // Non-lus
  const chantierIds = useMemo(() => chantiers.map(c => c.id), [chantiers])
  const groupIds    = useMemo(() => groups.map(g => g.id),    [groups])
  const { unreadMap, lastActivityMap, lastMsgMap, markAsRead } = useChatUnread(userId, chantierIds, groupIds)
  const { unreadCount: globalUnread } = useGlobalMessages(userId, entrepriseId)

  const [searchQuery, setSearchQuery]       = useState('')
  const [activeConv, setActiveConv]         = useState<ActiveConv>({ type: 'global', id: 'global', label: 'Équipe' })
  const [showConvOnMobile, setShowConvOnMobile] = useState(false)
  const [showCreateModal, setShowCreateModal]   = useState(false)
  const [showDMSearch, setShowDMSearch]         = useState(false)
  const [dmSearchQuery, setDMSearchQuery]       = useState('')
  const [dmUsers, setDMUsers]                   = useState<{ id: string; full_name: string; avatar_url?: string | null; poste?: string | null }[]>([])
  const [dmUsersLoading, setDMUsersLoading]     = useState(false)
  const [dmCreating, setDMCreating]             = useState(false)
  const [dmError, setDMError]                   = useState<string | null>(null)

  // Quand l'admin change d'entreprise, revenir au chat Équipe de la nouvelle entreprise
  useEffect(() => {
    setActiveConv({ type: 'global', id: 'global', label: 'Équipe' })
    setShowConvOnMobile(false)
    setSearchQuery('')
    setShowDMSearch(false)
  }, [entrepriseId])

  // Ouvre automatiquement le groupe ciblé si l'URL contient ?group=<id>
  // (ex. après un clic sur une notification push)
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const groupId = params.get('group')
    if (!groupId || !groups.length) return
    const target = groups.find(g => g.id === groupId)
    if (!target) return
    const label = target.is_dm
      ? ((target.members ?? []).find(m => m.user_id !== userId)?.profiles?.full_name ?? 'Message privé')
      : (target.name || 'Groupe')
    setActiveConv({ type: 'group', id: groupId, label })
    setShowConvOnMobile(true)
    // Retire le paramètre de l'URL sans recharger la page
    const clean = new URL(window.location.href)
    clean.searchParams.delete('group')
    window.history.replaceState({}, '', clean.toString())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  // Charger les collègues quand le panneau DM s'ouvre
  useEffect(() => {
    if (!showDMSearch || !entrepriseId) return
    setDMUsersLoading(true)
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, poste')
      .eq('entreprise_id', entrepriseId)
      .neq('id', userId)
      .order('full_name')
      .then(({ data }) => {
        setDMUsers((data ?? []) as typeof dmUsers)
        setDMUsersLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDMSearch, entrepriseId, userId])

  // Filtre sidebar
  const showGlobal = !searchQuery.trim() ||
    'équipe'.includes(searchQuery.toLowerCase()) ||
    'chat'.includes(searchQuery.toLowerCase())

  // Liste unifiée chantiers + groupes (hors DMs) triée par dernière activité
  type ConvEntry =
    | { type: 'chantier'; id: string; label: string; sub: string }
    | { type: 'group';    id: string; label: string; sub: string }

  const sortedConversations = useMemo<ConvEntry[]>(() => {
    const q = searchQuery.toLowerCase()

    const chantierEntries: ConvEntry[] = chantiers
      .filter(c => !q || c.nom.toLowerCase().includes(q) || (c.client_nom ?? '').toLowerCase().includes(q))
      .map(c => ({ type: 'chantier' as const, id: c.id, label: c.nom, sub: c.client_nom }))

    const groupEntries: ConvEntry[] = groups
      .filter(g => !g.is_dm && (!q || g.name.toLowerCase().includes(q)))
      .map(g => ({
        type:  'group' as const,
        id:    g.id,
        label: g.name,
        sub:   `${g.members?.length ?? 0} membre${(g.members?.length ?? 0) !== 1 ? 's' : ''}`,
      }))

    return [...chantierEntries, ...groupEntries].sort((a, b) => {
      const ta = lastActivityMap[a.id] ?? '1970-01-01'
      const tb = lastActivityMap[b.id] ?? '1970-01-01'
      return tb.localeCompare(ta)
    })
  }, [chantiers, groups, searchQuery, lastActivityMap])

  // Liste des DMs triée par dernière activité
  type DMEntry = { id: string; label: string; sub: string }

  const sortedDMs = useMemo<DMEntry[]>(() => {
    const q = searchQuery.toLowerCase()
    return groups
      .filter(g => g.is_dm === true)
      .map(g => {
        const other = (g.members ?? []).find(m => m.user_id !== userId)
        const label = other?.profiles?.full_name ?? 'Message privé'
        const sub   = other?.profiles?.poste ?? (other?.profiles?.role === 'manager' ? 'Manager' : '')
        return { id: g.id, label, sub }
      })
      .filter(dm => !q || dm.label.toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = lastActivityMap[a.id] ?? '1970-01-01'
        const tb = lastActivityMap[b.id] ?? '1970-01-01'
        return tb.localeCompare(ta)
      })
  }, [groups, userId, searchQuery, lastActivityMap])

  const openConv = (conv: ActiveConv) => {
    setActiveConv(conv)
    setShowConvOnMobile(true)
    // Marque comme lu à l'ouverture
    if (conv.type === 'chantier') markAsRead(conv.id, 'chantier')
    if (conv.type === 'group')    markAsRead(conv.id, 'group')
  }

  const activeGroup = activeConv.type === 'group'
    ? groups.find(g => g.id === activeConv.id)
    : null

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = (
    <div className="flex flex-col bg-white h-full border-r border-slate-100 overflow-hidden">
      {/* Header sidebar */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <h2 className="text-base font-bold text-slate-900 mb-1">Messages</h2>
        {entrepriseIdOverride && (
          <p className="text-[11px] font-semibold text-orange-500 mb-2 truncate">
            Vue entreprise filtrée
          </p>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Liste des conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">

        {/* ── Chat Équipe (épinglé en haut) ──────────────────────────────── */}
        {showGlobal && (
          <ConvItem
            icon={<MessageSquare className="w-4 h-4 text-white" />}
            iconBg="bg-gradient-to-br from-orange-500 to-orange-600"
            label="Équipe"
            sub="Chat de l'entreprise"
            unread={globalUnread}
            active={activeConv.type === 'global'}
            onClick={() => openConv({ type: 'global', id: 'global', label: 'Équipe' })}
          />
        )}

        {/* ── Conversations + DMs ─────────────────────────────────────── */}
        {(chantiersLoading || groupsLoading) ? (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Section Conversations (chantiers + groupes) ── */}
            {(sortedConversations.length > 0 || !searchQuery) && (
              <>
                <div className="flex items-center justify-between px-2 mt-3 mb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Conversations
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nouveau groupe
                  </button>
                </div>

                {sortedConversations.length === 0 ? (
                  <p className="text-xs text-slate-400 px-2 py-1.5">Aucun chantier ou groupe</p>
                ) : (
                  sortedConversations.map(conv => {
                    const preview = lastMsgMap[conv.id]
                    return (
                      <ConvItem
                        key={`${conv.type}-${conv.id}`}
                        icon={
                          conv.type === 'chantier'
                            ? <Layers className="w-4 h-4 text-white" />
                            : <Users  className="w-4 h-4 text-white" />
                        }
                        iconBg={
                          conv.type === 'chantier'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                            : 'bg-gradient-to-br from-violet-500 to-violet-600'
                        }
                        label={conv.label}
                        preview={preview?.text}
                        previewOwn={preview?.isOwn}
                        time={preview ? relativeTime(preview.time) : undefined}
                        unread={unreadMap[conv.id] ?? 0}
                        active={activeConv.type === conv.type && activeConv.id === conv.id}
                        onClick={() => openConv({ type: conv.type, id: conv.id, label: conv.label })}
                      />
                    )
                  })
                )}
              </>
            )}

            {/* ── Section Privés (DMs) ── */}
            {(sortedDMs.length > 0 || !searchQuery) && (
              <>
                <div className="flex items-center justify-between px-2 mt-4 mb-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                    Privés
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowDMSearch(s => !s); setDMSearchQuery('') }}
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    {showDMSearch ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showDMSearch ? 'Fermer' : 'Nouveau'}
                  </button>
                </div>

                {/* ── Panneau inline de recherche de collègue ── */}
                {showDMSearch && (
                  <div className="mb-2 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        autoFocus
                        type="text"
                        value={dmSearchQuery}
                        onChange={e => setDMSearchQuery(e.target.value)}
                        placeholder="Rechercher un collègue…"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 placeholder-slate-400"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border-t border-slate-200">
                      {dmUsersLoading ? (
                        <div className="flex justify-center py-3">
                          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : dmUsers.filter(u => !dmSearchQuery.trim() || u.full_name.toLowerCase().includes(dmSearchQuery.toLowerCase())).length === 0 ? (
                        <p className="text-center text-slate-400 text-xs py-3">
                          {dmSearchQuery ? 'Aucun résultat' : 'Aucun collègue'}
                        </p>
                      ) : (
                        dmUsers
                          .filter(u => !dmSearchQuery.trim() || u.full_name.toLowerCase().includes(dmSearchQuery.toLowerCase()))
                          .map(u => (
                            <button
                              key={u.id}
                              type="button"
                              disabled={dmCreating}
                              onClick={async () => {
                                setDMError(null)
                                setDMCreating(true)
                                const { group, error } = await createDM(u.id)
                                setDMCreating(false)
                                if (group) {
                                  setShowDMSearch(false)
                                  setDMSearchQuery('')
                                  openConv({ type: 'group', id: group.id, label: u.full_name })
                                } else {
                                  setDMError(error ?? 'Impossible de démarrer la conversation')
                                }
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 transition-colors text-left disabled:opacity-50"
                            >
                              {dmCreating
                                ? <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                    <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                  </div>
                                : <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                    {u.full_name.charAt(0).toUpperCase()}
                                  </div>
                              }
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{u.full_name}</p>
                                {u.poste && <p className="text-[10px] text-slate-400 truncate">{u.poste}</p>}
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  {dmError && (
                    <p className="text-[10px] text-red-500 font-medium px-3 py-1.5 bg-red-50">
                      ⚠ {dmError}
                    </p>
                  )}
                  </div>
                )}

                {sortedDMs.length === 0 && !showDMSearch ? (
                  <button
                    type="button"
                    onClick={() => setShowDMSearch(true)}
                    className="w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium">Démarrer une conversation</span>
                  </button>
                ) : (
                  sortedDMs.map(dm => {
                    const preview = lastMsgMap[dm.id]
                    return (
                      <ConvItem
                        key={`dm-${dm.id}`}
                        icon={<User className="w-4 h-4 text-white" />}
                        iconBg="bg-gradient-to-br from-pink-500 to-rose-500"
                        label={dm.label}
                        sub={dm.sub || undefined}
                        preview={preview?.text}
                        previewOwn={preview?.isOwn}
                        time={preview ? relativeTime(preview.time) : undefined}
                        unread={unreadMap[dm.id] ?? 0}
                        active={activeConv.type === 'group' && activeConv.id === dm.id}
                        onClick={() => openConv({ type: 'group', id: dm.id, label: dm.label })}
                      />
                    )
                  })
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )

  // ── Zone conversation ──────────────────────────────────────────────────────
  const conversation = (
    <div className="flex-1 min-w-0 flex flex-col h-[calc(100dvh-270px)] md:h-auto min-h-[420px] md:min-h-0">
      {/* Header conversation (mobile : bouton retour) */}
      <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <button
          onClick={() => setShowConvOnMobile(false)}
          className="flex items-center gap-1 text-sm font-medium text-orange-500"
        >
          <ChevronLeft className="w-5 h-5" />
          Retour
        </button>
        <span className="text-sm font-semibold text-slate-800 truncate">{activeConv.label}</span>
      </div>

      {/* Composant de chat selon la conversation active */}
      {activeConv.type === 'global' && (
        <GlobalChatTab
          userId={userId}
          entrepriseId={entrepriseId}
          isActive={isActive && (showConvOnMobile || window.innerWidth >= 768)}
        />
      )}

      {activeConv.type === 'chantier' && (
        <ChatTab
          chantierId={activeConv.id}
          userId={userId}
          isActive={isActive && (showConvOnMobile || window.innerWidth >= 768)}
        />
      )}

      {activeConv.type === 'group' && activeGroup && (
        <GroupChatTab
          group={activeGroup}
          userId={userId}
          userRole={profile.role}
          isActive={isActive && (showConvOnMobile || window.innerWidth >= 768)}
          onLeave={async () => {
            await leaveGroup(activeGroup.id)
            setActiveConv({ type: 'global', id: 'global', label: 'Équipe' })
            setShowConvOnMobile(false)
          }}
          onDelete={async () => {
            await deleteGroup(activeGroup.id)
            setActiveConv({ type: 'global', id: 'global', label: 'Équipe' })
            setShowConvOnMobile(false)
          }}
        />
      )}

      {activeConv.type === 'group' && !activeGroup && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Groupe introuvable
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* ── Layout desktop : sidebar gauche + conversation droite ──────── */}
      <div className="hidden md:flex flex-1 min-h-0 rounded-2xl overflow-hidden border border-slate-100 bg-white">
        <div className="w-72 shrink-0 flex flex-col border-r border-slate-100">
          {sidebar}
        </div>
        {conversation}
      </div>

      {/* ── Layout mobile : sidebar OU conversation (plein écran) ─────── */}
      <div className="md:hidden">
        {!showConvOnMobile ? (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ height: 'calc(100dvh - 270px)', minHeight: 420 }}>
            {sidebar}
          </div>
        ) : (
          conversation
        )}
      </div>

      {/* ── Modale création groupe ──────────────────────────────────────── */}
      {showCreateModal && (
        <CreateGroupModal
          userId={userId}
          entrepriseId={entrepriseId}
          onClose={() => setShowCreateModal(false)}
          onCreated={async groupId => {
            setShowCreateModal(false)
            await refetchGroups()
            openConv({ type: 'group', id: groupId, label: '…' })
          }}
          onCreate={createGroup}
        />
      )}

    </>
  )
}

// ── Composant item conversation dans la sidebar ──────────────────────────────
function ConvItem({
  icon, iconBg, label, sub, preview, previewOwn, time, active, unread = 0, onClick,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  sub?: string
  preview?: string
  previewOwn?: boolean
  time?: string
  active: boolean
  unread?: number
  onClick: () => void
}) {
  const hasUnread = unread > 0 && !active
  const showPreview = !!preview
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left mb-0.5 ${
        active ? 'bg-orange-50' : hasUnread ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-slate-50'
      }`}
    >
      {/* Icône avec badge non-lus */}
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Ligne 1 : nom + horodatage */}
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm truncate ${
            active ? 'font-semibold text-orange-600' : hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
          }`}>
            {label}
          </p>
          {time && (
            <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1">{time}</span>
          )}
        </div>

        {/* Ligne 2 : aperçu dernier message OU sous-titre */}
        {showPreview ? (
          <p className={`text-xs truncate ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
            {previewOwn && <span className="text-slate-400">Vous : </span>}
            {preview}
          </p>
        ) : sub ? (
          <p className={`text-xs truncate ${hasUnread ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
            {sub}
          </p>
        ) : null}
      </div>

      {active && !hasUnread && (
        <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
      )}
    </button>
  )
}

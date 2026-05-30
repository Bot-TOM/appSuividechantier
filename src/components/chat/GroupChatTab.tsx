import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Paperclip, Send, Users, Trash2, Lock } from 'lucide-react'
import { useGroupMessages } from '@/hooks/useGroupMessages'
import { usePresence } from '@/hooks/usePresence'
import Avatar from '@/components/Avatar'
import VoiceMessage from '@/components/chat/VoiceMessage'
import type { GroupMessage, ChatGroup } from '@/types'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👎']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function dateSeparatorLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

interface Props {
  group: ChatGroup
  userId: string
  userRole?: string
  isActive?: boolean
  onLeave?: () => void
  onDelete?: () => void
}

export default function GroupChatTab({ group, userId, userRole, isActive = true, onLeave, onDelete }: Props) {
  const { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction } =
    useGroupMessages(group.id, userId)

  const myName = useMemo(
    () => messages.find(m => m.user_id === userId)?.profiles?.full_name ?? '',
    [messages, userId]
  )

  const { onlineUsers, typingNames, setTyping } = usePresence(`group-${group.id}`, userId, myName)

  const [text, setText]             = useState('')
  const [replyTo, setReplyTo]       = useState<GroupMessage | null>(null)
  const [activeMsg, setActiveMsg]   = useState<string | null>(null)
  const [emojiFor, setEmojiFor]     = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null)

  const bottomRef        = useRef<HTMLDivElement>(null)
  const msgsContainerRef = useRef<HTMLDivElement>(null)
  const fileRef          = useRef<HTMLInputElement>(null)
  const textareaRef      = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef    = useRef(0)

  const [showScrollBtn,   setShowScrollBtn]   = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)

  const canDelete = (userRole === 'manager' || userRole === 'admin') && !group.is_dm

  useEffect(() => {
    const el = msgsContainerRef.current
    if (!el) return
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(dist > 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 112) + 'px'
  }, [text])

  const members = useMemo(() => {
    return (group.members ?? []).map(m => ({
      id: m.user_id,
      name: m.profiles?.full_name ?? '?',
      avatarUrl: m.profiles?.avatar_url,
      poste: m.profiles?.poste,
      role: m.profiles?.role,
    }))
  }, [group.members])

  // Pour les DMs : identifier l'autre membre
  const otherMember = group.is_dm ? members.find(m => m.id !== userId) ?? null : null
  const otherOnline = otherMember ? onlineUsers.has(otherMember.id) : false

  const scrollToBottom = useCallback((smooth = false) => {
    const el = msgsContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => {
    if (!isActive) return
    scrollToBottom(false)
  }, [isActive, scrollToBottom])

  useEffect(() => {
    if (messages.length === 0) return
    const isFirst = prevLengthRef.current === 0
    prevLengthRef.current = messages.length
    if (isFirst) { scrollToBottom(false); return }
    const el = msgsContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 150) scrollToBottom(true)
  }, [messages.length, scrollToBottom])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    setReplyTo(null)
    await sendMessage(trimmed, replyTo?.id)
  }, [text, replyTo, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await sendFile(file, replyTo?.id)
    setReplyTo(null)
  }

  const dismiss = () => { setActiveMsg(null); setEmojiFor(null) }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
    <div
      className="flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 flex-1 min-h-0"
      onClick={dismiss}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0" onClick={e => e.stopPropagation()}>

        {group.is_dm ? (
          /* Header DM : avatar + nom + statut en ligne */
          <div className="flex items-center gap-2.5">
            <Avatar
              name={otherMember?.name ?? '?'}
              avatarUrl={otherMember?.avatarUrl}
              size="sm"
              online={otherOnline}
            />
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {otherMember?.name ?? 'Message privé'}
              </p>
              <p className={`text-xs leading-tight ${otherOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                {otherOnline ? 'En ligne' : 'Hors ligne'}
              </p>
            </div>
            <span className="ml-1 flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" />
              Privé
            </span>
          </div>
        ) : (
          /* Header groupe classique */
          <button
            onClick={() => setShowMembers(p => !p)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              showMembers
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{members.length} membre{members.length !== 1 ? 's' : ''} · {onlineUsers.size} en ligne</span>
          </button>
        )}

        {!group.is_dm && (
          <div className="flex items-center gap-2">
            {onLeave && !canDelete && (
              <button
                onClick={onLeave}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              >
                Quitter
              </button>
            )}
            {canDelete && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-red-600 font-medium">Supprimer définitivement ?</span>
                  <button onClick={onDelete}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
                    Oui
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    Non
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer le groupe
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Panneau membres (groupes seulement) ───────────────────────── */}
      {showMembers && !group.is_dm && (
        <div className="bg-white border-b border-slate-100 px-4 py-3 shrink-0" onClick={e => e.stopPropagation()}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2.5">
            Membres ({members.length})
          </p>
          <div className="flex flex-col gap-2">
            {members.map(m => {
              const isMe   = m.id === userId
              const online = isMe || onlineUsers.has(m.id)
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" online={online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">
                        {m.name}
                        {isMe && <span className="text-[11px] text-slate-400 font-normal ml-1">(vous)</span>}
                      </span>
                      {m.poste && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{m.poste}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${online ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 right-3 z-10 w-8 h-8 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-500 hover:bg-orange-50 hover:text-orange-500 hover:border-orange-200 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      <div ref={msgsContainerRef} className="h-full overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm font-medium">Aucun message pour l'instant</p>
            <p className="text-slate-400 text-xs">Soyez le premier à écrire !</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn      = msg.user_id === userId
          const prev       = messages[i - 1]
          const showDateSep = !prev || !sameDay(prev.created_at, msg.created_at)
          const showAuthor  = !isOwn && (!prev || prev.user_id !== msg.user_id || showDateSep)
          const replyMsg   = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
          const isActiveMg = activeMsg === msg.id
          const showEmoji  = emojiFor === msg.id

          const reactionGroups: Record<string, { count: number; mine: boolean }> = {}
          for (const r of msg.group_message_reactions ?? []) {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false }
            reactionGroups[r.emoji].count++
            if (r.user_id === userId) reactionGroups[r.emoji].mine = true
          }

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center justify-center my-5 relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100" />
                  </div>
                  <div className="relative bg-white px-4 text-xs font-medium text-slate-400">
                    {dateSeparatorLabel(msg.created_at)}
                  </div>
                </div>
              )}

              <div
                className={`flex items-end gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                onClick={e => { e.stopPropagation(); setActiveMsg(p => p === msg.id ? null : msg.id); setEmojiFor(null) }}
              >
                {!isOwn && (
                  <Avatar
                    name={msg.profiles?.full_name ?? '?'}
                    avatarUrl={msg.profiles?.avatar_url}
                    size="sm"
                    online={onlineUsers.has(msg.user_id)}
                    className="self-end mb-1 shrink-0"
                  />
                )}

                <div className={`flex flex-col gap-0.5 max-w-[75%] group ${isOwn ? 'items-end' : 'items-start'}`}>
                  {showAuthor && (
                    <div className="flex items-baseline gap-1.5 pl-1 mb-0.5">
                      <span className="text-xs font-semibold text-slate-700">{msg.profiles?.full_name ?? 'Inconnu'}</span>
                      {(() => {
                        const label = msg.profiles?.poste ?? (msg.profiles?.role === 'manager' ? 'Manager' : null)
                        return label ? <span className="text-[10px] font-medium text-slate-500">{label}</span> : null
                      })()}
                    </div>
                  )}

                  <div className={`relative rounded-2xl px-4 py-2.5 ${
                    isOwn ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  } ${isActiveMg ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}>

                    {replyMsg && (
                      <div className={`mb-2 pl-2 border-l-2 rounded ${isOwn ? 'border-white/40' : 'border-orange-400'}`}>
                        <p className={`text-[10px] font-semibold ${isOwn ? 'text-white/70' : 'text-orange-500'}`}>
                          {replyMsg.profiles?.full_name ?? 'Inconnu'}
                        </p>
                        <p className={`text-[11px] truncate ${isOwn ? 'text-white/75' : 'text-slate-500'}`}>
                          {replyMsg.content ?? replyMsg.file_name ?? '📎 Fichier'}
                        </p>
                      </div>
                    )}

                    {msg.file_type === 'audio' && msg.file_url && (
                      <div className="mb-1" onClick={e => e.stopPropagation()}>
                        <VoiceMessage url={msg.file_url} isOwn={isOwn} />
                      </div>
                    )}

                    {msg.file_type === 'image' && msg.file_url && (
                      <a href={msg.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                        <img src={msg.file_url} alt={msg.file_name ?? 'image'}
                          className="rounded-xl max-w-[200px] max-h-[200px] object-cover mb-1 block" />
                      </a>
                    )}

                    {msg.file_type === 'document' && msg.file_url && (() => {
                      const isPdf = msg.file_name?.toLowerCase().endsWith('.pdf')
                      return isPdf ? (
                        <button
                          onClick={e => { e.stopPropagation(); setPdfPreview({ url: msg.file_url!, name: msg.file_name ?? 'Document' }) }}
                          className={`flex items-center gap-2 text-xs font-medium px-2.5 py-2 rounded-xl mb-1 w-full text-left hover:opacity-80 ${
                            isOwn ? 'bg-white/20 text-white' : 'bg-red-50 text-red-700 border border-red-100'
                          }`}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate max-w-[150px]">{msg.file_name ?? 'Document'}</span>
                        </button>
                      ) : (
                        <a href={msg.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className={`flex items-center gap-2 text-xs font-medium px-2.5 py-2 rounded-xl mb-1 ${
                            isOwn ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-700 border border-slate-100'
                          }`}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate max-w-[150px]">{msg.file_name ?? 'Document'}</span>
                        </a>
                      )
                    })()}

                    {msg.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                  </div>

                  <span className="text-[10px] font-medium text-slate-400 pl-1 mt-0.5">{formatTime(msg.created_at)}</span>

                  {Object.keys(reactionGroups).length > 0 && (
                    <div className={`flex gap-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'} px-1`}>
                      {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
                        <button key={emoji}
                          onClick={e => { e.stopPropagation(); toggleReaction(msg.id, emoji) }}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            mine ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {emoji}{count > 1 && <span className="ml-0.5 font-medium">{count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {isActiveMg && (
                    <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'} flex-wrap`} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEmojiFor(p => p === msg.id ? null : msg.id)}
                        className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-slate-50">
                        😊
                      </button>
                      <button onClick={() => { setReplyTo(msg); dismiss(); textareaRef.current?.focus() }}
                        className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-slate-50 font-medium text-slate-600">
                        ↩ Répondre
                      </button>
                      {isOwn && (
                        <button onClick={() => { deleteMessage(msg.id); dismiss() }}
                          className="text-xs bg-red-50 border border-red-100 text-red-500 rounded-full px-2.5 py-1 shadow-sm hover:bg-red-100 font-medium flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      )}
                    </div>
                  )}

                  {showEmoji && (
                    <div className={`flex gap-1 bg-white border border-slate-100 rounded-2xl p-2 shadow-xl ${isOwn ? 'self-end' : 'self-start'}`}
                      onClick={e => e.stopPropagation()}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => { toggleReaction(msg.id, e); dismiss() }}
                          className="text-xl hover:scale-125 transition-transform active:scale-90 leading-none">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {typingNames.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-1">
            <span>{typingNames[0]} est en train d'écrire</span>
            <span className="flex gap-0.5 items-end pb-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      </div>

      {/* ── Saisie ─────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 relative shrink-0" onClick={e => e.stopPropagation()}>
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-orange-400 bg-orange-50 rounded-r-xl py-1.5 pr-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-orange-500">{replyTo.profiles?.full_name ?? 'Inconnu'}</p>
              <p className="text-xs text-slate-500 truncate">{replyTo.content ?? replyTo.file_name ?? '📎 Fichier'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-full shadow-sm p-1 flex items-center gap-1 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 transition-all">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="shrink-0 p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-50">
            {uploading
              ? <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              : <Paperclip className="w-5 h-5" />
            }
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); if (e.target.value.trim()) setTyping() }}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none bg-transparent border-none focus:outline-none text-sm text-slate-800 placeholder-slate-400 py-2 px-2 max-h-28 overflow-y-auto"
            style={{ lineHeight: '1.45' }}
          />
          {text.trim() && (
            <button onClick={handleSend}
              className="shrink-0 p-2.5 text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-all shadow-md shadow-orange-500/20">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ── Aperçu PDF ──────────────────────────────────────────────────── */}
    {pdfPreview && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={() => setPdfPreview(null)}>
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-white text-sm font-medium truncate max-w-[70%]">{pdfPreview.name}</span>
          <button onClick={() => setPdfPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0" onClick={e => e.stopPropagation()}>
          <iframe src={pdfPreview.url} className="w-full h-full border-0" title={pdfPreview.name} />
        </div>
      </div>
    )}
    </>
  )
}

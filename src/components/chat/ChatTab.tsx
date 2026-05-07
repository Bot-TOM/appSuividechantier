import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useMessages } from '@/hooks/useMessages'
import { useChatNotif } from '@/hooks/useChatNotif'
import { usePresence } from '@/hooks/usePresence'
import { useChantierTechniciens } from '@/hooks/useChantierTechniciens'
import Avatar from '@/components/Avatar'
import type { ChatMessage } from '@/types'

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

// Surligne les @mentions dans le contenu d'un message
function renderWithMentions(
  content: string,
  knownNames: string[],
  myName: string,
  isOwn: boolean
): React.ReactNode {
  if (!content.includes('@') || knownNames.length === 0) return content
  const escaped = knownNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  const parts = content.split(pattern)
  return parts.map((part, i) => {
    if (knownNames.some(n => part === `@${n}`)) {
      const isMe = part === `@${myName}`
      return (
        <span key={i} className={`font-semibold rounded px-0.5 ${
          isMe
            ? isOwn ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'
            : isOwn ? 'text-white/90 underline underline-offset-2' : 'text-blue-500'
        }`}>
          {part}
        </span>
      )
    }
    return part
  })
}

interface Props {
  chantierId: string
  userId: string
}

export default function ChatTab({ chantierId, userId }: Props) {
  const { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead } =
    useMessages(chantierId, userId)
  const { enabled: notifEnabled, toggle: toggleNotif } = useChatNotif(userId)
  const { techniciens } = useChantierTechniciens(chantierId)

  // Nom de l'utilisateur courant — doit être avant usePresence
  const myName = useMemo(
    () => messages.find(m => m.user_id === userId)?.profiles?.full_name ?? '',
    [messages, userId]
  )

  const { onlineUsers, typingNames, setTyping } = usePresence(chantierId, userId, myName)

  const [text, setText]           = useState('')
  const [replyTo, setReplyTo]     = useState<ChatMessage | null>(null)
  const [activeMsg, setActiveMsg] = useState<string | null>(null)
  const [emojiFor, setEmojiFor]   = useState<string | null>(null)

  // ── Mentions ────────────────────────────────────────────────────────────────
  const [mentionAnchor, setMentionAnchor]       = useState<number | null>(null)
  const [mentionHighlight, setMentionHighlight] = useState(0)

  // Tous les noms connus (techniciens + auteurs des messages) pour le surlignage
  const allNames = useMemo(() => {
    const names = new Set<string>()
    techniciens.forEach(t => names.add(t.full_name))
    messages.forEach(m => { if (m.profiles?.full_name) names.add(m.profiles.full_name) })
    return Array.from(names)
  }, [techniciens, messages])

  // Query après le @ (text from anchor+1 to end, no newline)
  const mentionQuery = useMemo(() => {
    if (mentionAnchor === null) return null
    const afterAt = text.slice(mentionAnchor + 1)
    const stop = afterAt.indexOf('\n')
    return (stop >= 0 ? afterAt.slice(0, stop) : afterAt).toLowerCase()
  }, [mentionAnchor, text])

  // Résultats filtrés (max 5, hors soi-même)
  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return []
    return techniciens
      .filter(t => t.id !== userId && t.full_name.toLowerCase().includes(mentionQuery))
      .slice(0, 5)
  }, [mentionQuery, techniciens, userId])

  // Reset highlight quand les résultats changent
  useEffect(() => { setMentionHighlight(0) }, [mentionResults.length])

  const selectMention = useCallback((name: string) => {
    if (mentionAnchor === null) return
    const cursor = textareaRef.current?.selectionStart ?? text.length
    const before  = text.slice(0, mentionAnchor)
    const after   = text.slice(cursor)
    const newText = `${before}@${name} ${after}`
    setText(newText)
    setMentionAnchor(null)
    setMentionHighlight(0)
    const newCursor = mentionAnchor + name.length + 2
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursor, newCursor)
    }, 0)
  }, [mentionAnchor, text])

  // ── Refs ────────────────────────────────────────────────────────────────────
  const bottomRef      = useRef<HTMLDivElement>(null)
  const fileRef        = useRef<HTMLInputElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef  = useRef(0)

  useEffect(() => {
    if (messages.length === 0) return
    // Chargement initial (0 → N) : scroll instantané pour garantir d'atteindre le bas
    // Nouveau message (N → N+1) : scroll smooth pour une transition fluide
    const isInitialLoad = prevLengthRef.current === 0
    prevLengthRef.current = messages.length
    // requestAnimationFrame garantit que le DOM est peint avant de scroller
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: isInitialLoad ? 'instant' : 'smooth' })
    })
  }, [messages.length])

  useEffect(() => { markAllRead() }, [markAllRead, messages.length])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    setReplyTo(null)
    setMentionAnchor(null)
    await sendMessage(trimmed, replyTo?.id)
  }, [text, replyTo, sendMessage])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setText(val)

    // Broadcaster "est en train d'écrire" dès qu'il y a du texte
    if (val.trim()) setTyping()

    // Ouvrir mention quand @ est tapé
    if (val.length > text.length && val[cursor - 1] === '@') {
      setMentionAnchor(cursor - 1)
      return
    }
    // Fermer si le @ a été supprimé
    if (mentionAnchor !== null && (val.length <= mentionAnchor || val[mentionAnchor] !== '@')) {
      setMentionAnchor(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigation dans le dropdown mentions
    if (mentionAnchor !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlight(p => Math.min(p + 1, mentionResults.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionHighlight(p => Math.max(p - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); selectMention(mentionResults[mentionHighlight].full_name); return }
    }
    if (e.key === 'Escape') { setMentionAnchor(null); return }
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
    <div
      className="flex flex-col bg-gray-50 rounded-2xl overflow-hidden"
      style={{ height: 'calc(100dvh - 270px)', minHeight: 420 }}
      onClick={dismiss}
    >
      {/* ── Header clochette ──────────────────────────────────────────── */}
      {notifEnabled !== null && (
        <div className="flex items-center justify-end px-3 py-2 border-b border-gray-100 bg-white" onClick={e => e.stopPropagation()}>
          <button
            onClick={toggleNotif}
            title={notifEnabled ? 'Désactiver les notifications du chat' : 'Activer les notifications du chat'}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              notifEnabled
                ? 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
                : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={notifEnabled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifEnabled ? 'Notifs activées' : 'Activer les notifs'}
          </button>
        </div>
      )}

      {/* ── Liste des messages ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Aucun message pour l'instant</p>
            <p className="text-gray-400 text-xs">Soyez le premier à écrire !</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn       = msg.user_id === userId
          const prev        = messages[i - 1]
          const showDateSep = !prev || !sameDay(prev.created_at, msg.created_at)
          const showAuthor  = !isOwn && (!prev || prev.user_id !== msg.user_id || showDateSep)
          const replyMsg    = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
          const isActive    = activeMsg === msg.id
          const showEmoji   = emojiFor === msg.id

          const reactionGroups: Record<string, { count: number; mine: boolean }> = {}
          for (const r of msg.message_reactions ?? []) {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false }
            reactionGroups[r.emoji].count++
            if (r.user_id === userId) reactionGroups[r.emoji].mine = true
          }

          const readers = (msg.message_reads ?? []).filter(r => r.user_id !== userId)

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 py-3 px-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-400 font-medium">{dateSeparatorLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}

              <div
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-1 mb-0.5`}
                onClick={e => { e.stopPropagation(); setActiveMsg(p => p === msg.id ? null : msg.id); setEmojiFor(null) }}
              >
                {!isOwn && (
                  <Avatar
                    name={msg.profiles?.full_name ?? '?'}
                    avatarUrl={msg.profiles?.avatar_url}
                    size="sm"
                    online={onlineUsers.has(msg.user_id)}
                    className="mr-1.5 self-end mb-1"
                  />
                )}

                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {showAuthor && (
                    <span className="text-[11px] font-semibold text-orange-500 pl-1 mb-0.5">
                      {msg.profiles?.full_name ?? 'Inconnu'}
                    </span>
                  )}

                  <div className={`relative rounded-2xl px-3 py-2 ${
                    isOwn
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                  } ${isActive ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}
                    style={isOwn ? {} : { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                  >
                    {replyMsg && (
                      <div className={`mb-2 pl-2 border-l-2 rounded ${isOwn ? 'border-white/40' : 'border-orange-400'}`}>
                        <p className={`text-[10px] font-semibold ${isOwn ? 'text-white/70' : 'text-orange-500'}`}>
                          {replyMsg.profiles?.full_name ?? 'Inconnu'}
                        </p>
                        <p className={`text-[11px] truncate ${isOwn ? 'text-white/75' : 'text-gray-500'}`}>
                          {replyMsg.content ?? replyMsg.file_name ?? '📎 Fichier'}
                        </p>
                      </div>
                    )}

                    {msg.file_type === 'image' && msg.file_url && (
                      <a href={msg.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                        <img src={msg.file_url} alt={msg.file_name ?? 'image'}
                          className="rounded-xl max-w-[200px] max-h-[200px] object-cover mb-1 block" />
                      </a>
                    )}

                    {msg.file_type === 'document' && msg.file_url && (
                      <a href={msg.file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        className={`flex items-center gap-2 text-xs font-medium px-2.5 py-2 rounded-xl mb-1 ${
                          isOwn ? 'bg-white/20 text-white' : 'bg-gray-50 text-gray-700 border border-gray-100'
                        }`}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate max-w-[150px]">{msg.file_name ?? 'Document'}</span>
                      </a>
                    )}

                    {/* Texte avec mentions surlignées */}
                    {msg.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {renderWithMentions(msg.content, allNames, myName, isOwn)}
                      </p>
                    )}

                    <p className={`text-[10px] mt-1 leading-none ${isOwn ? 'text-white/55 text-right' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                      {isOwn && readers.length > 0 && <span className="ml-1 text-white/80">✓✓</span>}
                    </p>
                  </div>

                  {Object.keys(reactionGroups).length > 0 && (
                    <div className={`flex gap-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'} px-1`}>
                      {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
                        <button key={emoji}
                          onClick={e => { e.stopPropagation(); toggleReaction(msg.id, emoji) }}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            mine ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {emoji}{count > 1 && <span className="ml-0.5 font-medium">{count}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {isOwn && readers.length > 0 && (
                    <p className="text-[10px] text-gray-400 pr-1">Vu</p>
                  )}

                  {isActive && (
                    <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'} flex-wrap`} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEmojiFor(p => p === msg.id ? null : msg.id)}
                        className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-gray-50 transition-colors">
                        😊
                      </button>
                      <button onClick={() => { setReplyTo(msg); dismiss(); textareaRef.current?.focus() }}
                        className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-gray-50 transition-colors font-medium text-gray-600">
                        ↩ Répondre
                      </button>
                      {isOwn && (
                        <button onClick={() => { deleteMessage(msg.id); dismiss() }}
                          className="text-xs bg-red-50 border border-red-100 text-red-500 rounded-full px-2.5 py-1 shadow-sm hover:bg-red-100 transition-colors font-medium">
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}

                  {showEmoji && (
                    <div className={`flex gap-1 bg-white border border-gray-100 rounded-2xl p-2 shadow-xl ${isOwn ? 'self-end' : 'self-start'}`}
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

        <div ref={bottomRef} />
      </div>

      {/* ── Barre de saisie ───────────────────────────────────────────── */}
      <div className="border-t border-gray-200 bg-white px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>

        {/* ── Indicateur "est en train d'écrire" ────────────────────── */}
        {typingNames.length > 0 && (
          <div className="absolute bottom-full left-3 mb-0.5 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span>
              {typingNames.length === 1
                ? `${typingNames[0]} est en train d'écrire`
                : `${typingNames.slice(0, 2).join(' et ')} écrivent`}
            </span>
            <span className="flex gap-0.5 items-end pb-0.5">
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        {/* ── Dropdown mentions ──────────────────────────────────────── */}
        {mentionAnchor !== null && mentionResults.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-20">
            {mentionResults.map((tech, idx) => (
              <button
                key={tech.id}
                onMouseDown={e => { e.preventDefault(); selectMention(tech.full_name) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  idx === mentionHighlight ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <Avatar name={tech.full_name} avatarUrl={tech.avatar_url} size="sm"
                  online={onlineUsers.has(tech.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{tech.full_name}</p>
                  <p className="text-[11px] text-gray-400">Technicien</p>
                </div>
                {onlineUsers.has(tech.id) && (
                  <span className="text-[10px] text-green-500 font-medium flex-shrink-0">En ligne</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Bandeau de réponse */}
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 pl-3 border-l-2 border-orange-400 bg-orange-50 rounded-r-xl py-1.5 pr-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-orange-500">{replyTo.profiles?.full_name ?? 'Inconnu'}</p>
              <p className="text-xs text-gray-500 truncate">{replyTo.content ?? replyTo.file_name ?? '📎 Fichier'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-orange-100 hover:text-orange-500 transition-colors disabled:opacity-50">
            {uploading
              ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
            }
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message… (@ pour mentionner)"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 bg-gray-50 max-h-28 overflow-y-auto"
            style={{ lineHeight: '1.45' }}
          />

          <button onClick={handleSend} disabled={!text.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors disabled:opacity-35 disabled:cursor-not-allowed">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

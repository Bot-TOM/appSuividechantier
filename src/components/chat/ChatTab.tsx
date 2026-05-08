import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useMessages } from '@/hooks/useMessages'
import { useChatNotif } from '@/hooks/useChatNotif'
import { usePresence } from '@/hooks/usePresence'
import { useChantierTechniciens } from '@/hooks/useChantierTechniciens'
import { useChantiers } from '@/hooks/useChantiers'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import VoiceMessage from '@/components/chat/VoiceMessage'
import type { ChatMessage } from '@/types'
import { usePermissions } from '@/hooks/usePermissions'

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👎', '🔥', '🎉', '👀', '✅', '💯', '⚡']

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
  isActive?: boolean
}

export default function ChatTab({ chantierId, userId, isActive = true }: Props) {
  const { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead, updateMessage } =
    useMessages(chantierId, userId)
  const { enabled: notifEnabled, toggle: toggleNotif } = useChatNotif(userId)
  const { can } = usePermissions()
  const { techniciens } = useChantierTechniciens(chantierId)
  const { chantiers }   = useChantiers()

  const myName = useMemo(
    () => messages.find(m => m.user_id === userId)?.profiles?.full_name ?? '',
    [messages, userId]
  )

  const { onlineUsers, typingNames, setTyping } = usePresence(chantierId, userId, myName)

  // ── États ────────────────────────────────────────────────────────────────────
  const [text, setText]               = useState('')
  const [replyTo, setReplyTo]         = useState<ChatMessage | null>(null)
  const [activeMsg, setActiveMsg]     = useState<string | null>(null)
  const [emojiFor, setEmojiFor]       = useState<string | null>(null)
  const [showParticipants, setShowParticipants] = useState(false)
  const [pdfPreview, setPdfPreview]   = useState<{ url: string; name: string } | null>(null)
  const [forwardMsg, setForwardMsg]   = useState<ChatMessage | null>(null)
  const [forwardDone, setForwardDone] = useState(false)
  const [imageLightbox, setImageLightbox] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [newMsgCount, setNewMsgCount]     = useState(0)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editText, setEditText]     = useState('')
  const [firstUnreadId, setFirstUnreadId] = useState<string | null | undefined>(undefined)

  // ── Transfert ────────────────────────────────────────────────────────────────
  const handleForward = useCallback(async (targetChantierId: string) => {
    if (!forwardMsg) return
    const payload: Record<string, unknown> = {
      chantier_id: targetChantierId,
      user_id: userId,
      content: forwardMsg.content ? `↪ Transféré : ${forwardMsg.content}` : null,
      file_url:  forwardMsg.file_url,
      file_name: forwardMsg.file_name,
      file_type: forwardMsg.file_type,
    }
    await supabase.from('messages').insert(payload)
    setForwardMsg(null)
    setForwardDone(true)
    setTimeout(() => setForwardDone(false), 2500)
  }, [forwardMsg, userId])

  // ── Mentions ─────────────────────────────────────────────────────────────────
  const [mentionAnchor, setMentionAnchor]       = useState<number | null>(null)
  const [mentionHighlight, setMentionHighlight] = useState(0)

  const participants = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl?: string | null; poste?: string | null }>()
    techniciens.forEach(t => map.set(t.id, { id: t.id, name: t.full_name, avatarUrl: t.avatar_url, poste: t.poste }))
    messages.forEach(m => {
      if (m.user_id && m.profiles?.full_name && !map.has(m.user_id)) {
        const poste = m.profiles.poste ?? (m.profiles.role === 'manager' ? 'Manager' : null)
        map.set(m.user_id, { id: m.user_id, name: m.profiles.full_name, avatarUrl: m.profiles.avatar_url, poste })
      }
    })
    return Array.from(map.values())
  }, [techniciens, messages])

  // Tous les noms connus pour le surlignage des @mentions
  const allNames = useMemo(() => participants.map(p => p.name), [participants])

  const mentionQuery = useMemo(() => {
    if (mentionAnchor === null) return null
    const afterAt = text.slice(mentionAnchor + 1)
    const stop = afterAt.indexOf('\n')
    return (stop >= 0 ? afterAt.slice(0, stop) : afterAt).toLowerCase()
  }, [mentionAnchor, text])

  // Résultats filtrés (max 5, hors soi-même) — inclut managers et techniciens
  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return []
    return participants
      .filter(p => p.id !== userId && p.name.toLowerCase().includes(mentionQuery))
      .slice(0, 5)
  }, [mentionQuery, participants, userId])

  useEffect(() => { setMentionHighlight(0) }, [mentionResults.length])

  const selectMention = useCallback((name: string) => {
    if (mentionAnchor === null) return
    const cursor  = textareaRef.current?.selectionStart ?? text.length
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

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const bottomRef          = useRef<HTMLDivElement>(null)
  const msgsContainerRef   = useRef<HTMLDivElement>(null)
  const fileRef            = useRef<HTMLInputElement>(null)
  const textareaRef        = useRef<HTMLTextAreaElement>(null)
  const editRef            = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef      = useRef(0)
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const audioChunksRef     = useRef<Blob[]>([])
  const recordingTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const pointerStartXRef   = useRef(0)
  const isCancelledRef     = useRef(false)
  const micBtnRef          = useRef<HTMLButtonElement>(null)
  const hasSetUnreadRef    = useRef(false)

  // ── Enregistrement vocal ─────────────────────────────────────────────────────
  const [isRecording,      setIsRecording]      = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [cancelProgress,   setCancelProgress]   = useState(0)
  const CANCEL_THRESHOLD = 80

  const doStopRecorder = useCallback((cancelled: boolean) => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return Promise.resolve()
    return new Promise<void>(resolve => {
      if (cancelled) { recorder.onstop = null } else { recorder.onstop = () => resolve() }
      recorder.stop()
      recorder.stream.getTracks().forEach(t => t.stop())
      if (cancelled) resolve()
    })
  }, [])

  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true
    doStopRecorder(true)
    setIsRecording(false)
    setCancelProgress(0)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecordingSeconds(0)
    audioChunksRef.current = []
  }, [doStopRecorder])

  const stopAndSend = useCallback(async () => {
    if (isCancelledRef.current) return
    setIsRecording(false)
    setCancelProgress(0)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    await doStopRecorder(false)
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    const mimeType = recorder.mimeType || 'audio/webm'
    const ext      = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const blob     = new Blob(audioChunksRef.current, { type: mimeType })
    if (blob.size < 500) return
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })
    await sendFile(file, replyTo?.id)
    setReplyTo(null)
  }, [doStopRecorder, sendFile, replyTo])

  useEffect(() => {
    if (!isRecording) return
    const onMove = (e: PointerEvent) => {
      const dx = pointerStartXRef.current - e.clientX
      const progress = Math.min(1, Math.max(0, dx / CANCEL_THRESHOLD))
      setCancelProgress(progress)
      if (dx > CANCEL_THRESHOLD) cancelRecording()
    }
    const onUp = () => { if (!isCancelledRef.current) stopAndSend() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isRecording, cancelRecording, stopAndSend])

  const handleMicPointerDown = useCallback(async (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (isRecording) return
    isCancelledRef.current = false
    pointerStartXRef.current = e.clientX
    micBtnRef.current?.setPointerCapture(e.pointerId)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.start(100)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      alert('Accès au micro refusé. Vérifiez les permissions de votre navigateur.')
    }
  }, [isRecording])

  // ── Scroll ───────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    const el = msgsContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  const handleScroll = useCallback(() => {
    const el = msgsContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(dist > 200)
    if (dist < 50) setNewMsgCount(0)
  }, [])

  useEffect(() => {
    const el = msgsContainerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (!isActive) return
    scrollToBottom(false)
  }, [isActive, scrollToBottom])

  useEffect(() => {
    if (messages.length === 0) return
    const isFirst = prevLengthRef.current === 0
    const prevLen = prevLengthRef.current
    prevLengthRef.current = messages.length
    if (isFirst) {
      // Scroll to first unread or bottom
      if (firstUnreadId) {
        setTimeout(() => {
          document.getElementById(`msg-${firstUnreadId}`)?.scrollIntoView({ behavior: 'instant', block: 'center' })
        }, 50)
      } else {
        scrollToBottom(false)
      }
      return
    }
    // Nouveau message en temps réel
    const el = msgsContainerRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    if (dist < 150) {
      scrollToBottom(true)
    } else {
      // Compter les nouveaux messages si on est remonté
      const added = messages.length - prevLen
      if (added > 0) setNewMsgCount(c => c + added)
    }
  }, [messages.length, scrollToBottom, firstUnreadId])

  useEffect(() => { if (isActive) markAllRead() }, [isActive, markAllRead, messages.length])

  // ── Détecter les messages non lus au premier chargement ──────────────────────
  useEffect(() => {
    if (hasSetUnreadRef.current || messages.length === 0) return
    hasSetUnreadRef.current = true
    const unread = messages.find(m =>
      m.user_id !== userId &&
      !(m.message_reads ?? []).some(r => r.user_id === userId)
    )
    setFirstUnreadId(unread?.id ?? null)
  }, [messages, userId])

  // Effacer le séparateur après 8 secondes
  useEffect(() => {
    if (!firstUnreadId) return
    const t = setTimeout(() => setFirstUnreadId(null), 8000)
    return () => clearTimeout(t)
  }, [firstUnreadId])

  // ── Auto-resize textarea ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  // ── Envoi ─────────────────────────────────────────────────────────────────────
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
    if (val.trim()) setTyping()
    if (val.length > text.length && val[cursor - 1] === '@') {
      setMentionAnchor(cursor - 1)
      return
    }
    if (mentionAnchor !== null && (val.length <= mentionAnchor || val[mentionAnchor] !== '@')) {
      setMentionAnchor(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionAnchor !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionHighlight(p => Math.min(p + 1, mentionResults.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionHighlight(p => Math.max(p - 1, 0)); return }
      if (e.key === 'Enter')     { e.preventDefault(); selectMention(mentionResults[mentionHighlight].name); return }
    }
    if (e.key === 'Escape') { setMentionAnchor(null); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Édition ──────────────────────────────────────────────────────────────────
  const startEdit = useCallback((msg: ChatMessage) => {
    setEditingId(msg.id)
    setEditText(msg.content ?? '')
    setActiveMsg(null)
    setEmojiFor(null)
    setTimeout(() => {
      editRef.current?.focus()
      const len = (msg.content ?? '').length
      editRef.current?.setSelectionRange(len, len)
    }, 50)
  }, [])

  const submitEdit = useCallback(async () => {
    if (!editingId || !editText.trim()) { setEditingId(null); return }
    await updateMessage(editingId, editText.trim())
    setEditingId(null)
    setEditText('')
  }, [editingId, editText, updateMessage])

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
    if (e.key === 'Escape') { setEditingId(null); setEditText('') }
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
      className="flex flex-col bg-gray-50 rounded-2xl overflow-hidden relative"
      style={{ height: 'calc(100dvh - 270px)', minHeight: 420 }}
      onClick={dismiss}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      {notifEnabled !== null && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-white flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowParticipants(p => !p)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              showParticipants
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{onlineUsers.size} en ligne</span>
          </button>
          <button
            onClick={toggleNotif}
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

      {/* ── Participants ────────────────────────────────────────────────── */}
      {showParticipants && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
            Participants ({participants.length})
          </p>
          <div className="flex flex-col gap-2">
            {participants.map(p => {
              const isMe = p.id === userId
              const online = isMe || onlineUsers.has(p.id)
              return (
                <div key={p.id} className="flex items-center gap-2.5">
                  <Avatar name={p.name} avatarUrl={p.avatarUrl} size="sm" online={online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">
                        {p.name}
                        {isMe && <span className="text-[11px] text-gray-400 font-normal ml-1">(vous)</span>}
                      </span>
                      {p.poste && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{p.poste}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${online ? 'text-green-500' : 'text-gray-400'}`}>
                    {online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Liste messages ──────────────────────────────────────────────── */}
      <div ref={msgsContainerRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
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
          const isActivated = activeMsg === msg.id
          const showEmoji   = emojiFor === msg.id
          const isEditing   = editingId === msg.id

          const reactionGroups: Record<string, { count: number; mine: boolean }> = {}
          for (const r of msg.message_reactions ?? []) {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false }
            reactionGroups[r.emoji].count++
            if (r.user_id === userId) reactionGroups[r.emoji].mine = true
          }

          const readers = (msg.message_reads ?? []).filter(r => r.user_id !== userId)

          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
              {showDateSep && (
                <div className="flex items-center gap-3 py-3 px-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-400 font-medium">{dateSeparatorLabel(msg.created_at)}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}

              {/* ── Séparateur "Nouveaux messages" ────────────────── */}
              {firstUnreadId && msg.id === firstUnreadId && (
                <div className="flex items-center gap-3 py-2 px-2">
                  <div className="flex-1 h-px bg-orange-300" />
                  <span className="text-[11px] text-orange-500 font-semibold bg-orange-50 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    Nouveaux messages
                  </span>
                  <div className="flex-1 h-px bg-orange-300" />
                </div>
              )}

              <div
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-1 mb-0.5`}
                onClick={e => {
                  e.stopPropagation()
                  if (isEditing) return
                  setActiveMsg(p => p === msg.id ? null : msg.id)
                  setEmojiFor(null)
                }}
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
                    <div className="flex items-center gap-1.5 pl-1 mb-0.5">
                      <span className="text-[11px] font-semibold text-orange-500">
                        {msg.profiles?.full_name ?? 'Inconnu'}
                      </span>
                      {(() => {
                        const label = msg.profiles?.poste ?? (msg.profiles?.role === 'manager' ? 'Manager' : null)
                        return label ? (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{label}</span>
                        ) : null
                      })()}
                    </div>
                  )}

                  <div className={`relative rounded-2xl px-3 py-2 ${
                    isOwn
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                  } ${isActivated && !isEditing ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}
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

                    {msg.file_type === 'audio' && msg.file_url && (
                      <div className="mb-1" onClick={e => e.stopPropagation()}>
                        <VoiceMessage url={msg.file_url} isOwn={isOwn} />
                      </div>
                    )}

                    {/* Image → lightbox au clic */}
                    {msg.file_type === 'image' && msg.file_url && (
                      <button
                        onClick={e => { e.stopPropagation(); setImageLightbox(msg.file_url!) }}
                        className="block mb-1"
                      >
                        <img
                          src={msg.file_url}
                          alt={msg.file_name ?? 'image'}
                          className="rounded-xl max-w-[200px] max-h-[200px] object-cover hover:opacity-95 transition-opacity"
                        />
                      </button>
                    )}

                    {msg.file_type === 'document' && msg.file_url && (() => {
                      const isPdf = msg.file_name?.toLowerCase().endsWith('.pdf')
                      return isPdf ? (
                        <button
                          onClick={e => { e.stopPropagation(); setPdfPreview({ url: msg.file_url!, name: msg.file_name ?? 'Document' }) }}
                          className={`flex items-center gap-2 text-xs font-medium px-2.5 py-2 rounded-xl mb-1 w-full text-left transition-opacity hover:opacity-80 ${
                            isOwn ? 'bg-white/20 text-white' : 'bg-red-50 text-red-700 border border-red-100'
                          }`}
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="truncate max-w-[150px]">{msg.file_name ?? 'Document'}</span>
                          <svg className="w-3 h-3 flex-shrink-0 ml-auto opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      ) : (
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
                      )
                    })()}

                    {/* Texte ou mode édition inline */}
                    {isEditing ? (
                      <div onClick={e => e.stopPropagation()}>
                        <textarea
                          ref={editRef}
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          rows={2}
                          className={`w-full text-sm resize-none rounded-lg px-2 py-1.5 focus:outline-none ${
                            isOwn
                              ? 'bg-white/15 text-white placeholder-white/60 border border-white/30'
                              : 'bg-gray-50 text-gray-800 border border-gray-200'
                          }`}
                        />
                        <div className="flex gap-1.5 mt-1.5 justify-end">
                          <button
                            onClick={() => { setEditingId(null); setEditText('') }}
                            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${isOwn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >Annuler</button>
                          <button
                            onClick={submitEdit}
                            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${isOwn ? 'bg-white/30 text-white hover:bg-white/40' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                          >Sauvegarder</button>
                        </div>
                      </div>
                    ) : msg.content ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {renderWithMentions(msg.content, allNames, myName, isOwn)}
                      </p>
                    ) : null}

                    <div className={`flex items-center gap-1 mt-1 leading-none ${isOwn ? 'justify-end' : ''}`}>
                      {msg.edited_at && (
                        <span className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>(modifié)</span>
                      )}
                      <p className={`text-[10px] ${isOwn ? 'text-white/55' : 'text-gray-400'}`}>
                        {formatTime(msg.created_at)}
                        {isOwn && readers.length > 0 && <span className="ml-1 text-white/80">✓✓</span>}
                      </p>
                    </div>
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

                  {isOwn && readers.length > 0 && !isEditing && (
                    <p className="text-[10px] text-gray-400 pr-1">
                      {(() => {
                        const names = readers.map(r => r.profiles?.full_name?.split(' ')[0] ?? '?')
                        if (names.length <= 2) return `Vu par ${names.join(', ')}`
                        return `Vu par ${names.slice(0, 2).join(', ')} +${names.length - 2}`
                      })()}
                    </p>
                  )}

                  {isActivated && !isEditing && (
                    <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'} flex-wrap`} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEmojiFor(p => p === msg.id ? null : msg.id)}
                        className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-gray-50 transition-colors">
                        😊
                      </button>
                      <button onClick={() => { setReplyTo(msg); dismiss(); textareaRef.current?.focus() }}
                        className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-gray-50 transition-colors font-medium text-gray-600">
                        ↩ Répondre
                      </button>
                      <button onClick={() => { setForwardMsg(msg); dismiss() }}
                        className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-gray-50 transition-colors font-medium text-gray-600">
                        ↪ Transférer
                      </button>
                      {isOwn && (
                        <button onClick={() => startEdit(msg)}
                          className="text-xs bg-blue-50 border border-blue-100 text-blue-600 rounded-full px-2.5 py-1 shadow-sm hover:bg-blue-100 transition-colors font-medium">
                          ✏️ Modifier
                        </button>
                      )}
                      {(isOwn || can('supprimer_message_autres')) && (
                        <button onClick={() => { deleteMessage(msg.id); dismiss() }}
                          className="text-xs bg-red-50 border border-red-100 text-red-500 rounded-full px-2.5 py-1 shadow-sm hover:bg-red-100 transition-colors font-medium">
                          Supprimer
                        </button>
                      )}
                    </div>
                  )}

                  {showEmoji && (
                    <div className={`flex flex-wrap gap-1 bg-white border border-gray-100 rounded-2xl p-2 shadow-xl ${isOwn ? 'self-end' : 'self-start'}`}
                      style={{ maxWidth: 192 }}
                      onClick={e => e.stopPropagation()}>
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => { toggleReaction(msg.id, e); dismiss() }}
                          className="text-xl hover:scale-125 transition-transform active:scale-90 leading-none w-8 h-8 flex items-center justify-center">
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

      {/* ── Bouton scroll bas ───────────────────────────────────────────── */}
      {showScrollBtn && (
        <button
          onClick={(e) => { e.stopPropagation(); scrollToBottom(true); setNewMsgCount(0) }}
          className="absolute bottom-20 right-3 z-10 flex items-center gap-1.5 bg-white shadow-lg rounded-full pl-3 pr-2 py-1.5 border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          {newMsgCount > 0 && (
            <span className="bg-orange-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {newMsgCount}
            </span>
          )}
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* ── Barre de saisie ─────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 bg-white px-3 py-2.5 relative flex-shrink-0" onClick={e => e.stopPropagation()}>

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

        {/* Dropdown mentions */}
        {mentionAnchor !== null && mentionResults.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden z-20">
            {mentionResults.map((p, idx) => (
              <button
                key={p.id}
                onMouseDown={e => { e.preventDefault(); selectMention(p.name) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  idx === mentionHighlight ? 'bg-orange-50' : 'hover:bg-gray-50'
                }`}
              >
                <Avatar name={p.name} avatarUrl={p.avatarUrl} size="sm" online={onlineUsers.has(p.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  {p.poste && <p className="text-[11px] text-gray-400">{p.poste}</p>}
                </div>
                {onlineUsers.has(p.id) && (
                  <span className="text-[10px] text-green-500 font-medium flex-shrink-0">En ligne</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Bandeau réponse */}
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

          {isRecording ? (
            <>
              <div className="flex-1 flex items-center gap-2 px-3 overflow-hidden">
                <span
                  className="text-xs text-gray-400 flex items-center gap-1 transition-all duration-75 select-none"
                  style={{ opacity: 0.3 + cancelProgress * 0.7, transform: `translateX(${-cancelProgress * 12}px)` }}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Annuler
                </span>
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-500 tabular-nums">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>
              <button
                ref={micBtnRef}
                onPointerDown={handleMicPointerDown}
                className="flex-shrink-0 w-11 h-11 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg"
                style={{ touchAction: 'none', transform: 'scale(1.1)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Message… (@ pour mentionner)"
                className="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 bg-gray-50 overflow-y-auto"
                style={{ lineHeight: '1.45', minHeight: '38px', maxHeight: '120px' }}
              />

              {text.trim() ? (
                <button onClick={handleSend}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors self-end">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              ) : (
                <button
                  ref={micBtnRef}
                  onPointerDown={handleMicPointerDown}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-orange-100 hover:text-orange-500 transition-colors select-none self-end"
                  style={{ touchAction: 'none' }}
                  title="Maintenir pour enregistrer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* ── Toast transfert ──────────────────────────────────────────────────── */}
    {forwardDone && (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-full shadow-xl">
        ↪ Message transféré
      </div>
    )}

    {/* ── Modale transfert ─────────────────────────────────────────────────── */}
    {forwardMsg && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0" onClick={() => setForwardMsg(null)}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Transférer vers…</h3>
            <button onClick={() => setForwardMsg(null)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Message à transférer</p>
            <p className="text-sm text-gray-700 truncate">{forwardMsg.content ?? forwardMsg.file_name ?? '📎 Fichier'}</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {chantiers.filter(c => c.id !== chantierId).map(c => (
              <button key={c.id} onClick={() => handleForward(c.id)}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.nom}</p>
                  <p className="text-xs text-gray-400 truncate">{c.client_nom}</p>
                </div>
              </button>
            ))}
            {chantiers.filter(c => c.id !== chantierId).length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Aucun autre chantier disponible</p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Modale aperçu PDF ─────────────────────────────────────────────────── */}
    {pdfPreview && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={() => setPdfPreview(null)}>
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-white text-sm font-medium truncate max-w-[70%]">{pdfPreview.name}</span>
          <div className="flex items-center gap-2">
            <a href={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfPreview.url)}`}
              target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              className="text-white/70 hover:text-white text-xs border border-white/20 px-3 py-1.5 rounded-full transition-colors">
              Ouvrir ↗
            </a>
            <button onClick={() => setPdfPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0" onClick={e => e.stopPropagation()}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfPreview.url)}&embedded=true`}
            className="w-full h-full border-0"
            title={pdfPreview.name}
          />
        </div>
      </div>
    )}

    {/* ── Lightbox image ───────────────────────────────────────────────────── */}
    {imageLightbox && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.92)' }}
        onClick={() => setImageLightbox(null)}
      >
        <button
          onClick={() => setImageLightbox(null)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={imageLightbox}
          alt=""
          className="max-w-full max-h-[85vh] object-contain rounded-xl"
          style={{ padding: '20px' }}
          onClick={e => e.stopPropagation()}
        />
        <a
          href={imageLightbox}
          download
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute bottom-6 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-full transition-colors border border-white/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger
        </a>
      </div>
    )}
    </>
  )
}

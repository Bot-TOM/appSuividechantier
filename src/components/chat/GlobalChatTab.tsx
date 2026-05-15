import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useGlobalMessages, GlobalMessage } from '@/hooks/useGlobalMessages'
import { usePresence } from '@/hooks/usePresence'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import VoiceMessage from '@/components/chat/VoiceMessage'

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

// Membres actifs récupérés depuis les profils
type Member = { id: string; name: string; avatarUrl?: string | null; poste?: string | null; role?: string | null }

interface Props {
  userId: string
  isActive?: boolean
}

export default function GlobalChatTab({ userId, isActive = true }: Props) {
  const { messages, loading, uploading, sendMessage, sendFile, deleteMessage, toggleReaction, markAllRead } =
    useGlobalMessages(userId)

  // Nom courant de l'utilisateur
  const myName = useMemo(
    () => messages.find(m => m.user_id === userId)?.profiles?.full_name ?? '',
    [messages, userId]
  )

  const { onlineUsers, typingNames, setTyping } = usePresence('global', userId, myName)

  const [text, setText]           = useState('')
  const [replyTo, setReplyTo]     = useState<GlobalMessage | null>(null)
  const [activeMsg, setActiveMsg] = useState<string | null>(null)
  const [emojiFor, setEmojiFor]   = useState<string | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers]     = useState<Member[]>([])

  // Charge tous les membres de l'équipe
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, poste, role')
      .then(({ data }) => {
        setMembers((data ?? []).map(p => ({
          id: p.id,
          name: p.full_name ?? '?',
          avatarUrl: p.avatar_url,
          poste: p.poste,
          role: p.role,
        })))
      })
  }, [])

  // Noms connus pour les mentions
  const allNames = useMemo(() => members.map(m => m.name), [members])

  // ── Mentions ──────────────────────────────────────────────────────────────
  const [mentionAnchor, setMentionAnchor]       = useState<number | null>(null)
  const [mentionHighlight, setMentionHighlight] = useState(0)

  const mentionQuery = useMemo(() => {
    if (mentionAnchor === null) return null
    const afterAt = text.slice(mentionAnchor + 1)
    const stop = afterAt.indexOf('\n')
    return (stop >= 0 ? afterAt.slice(0, stop) : afterAt).toLowerCase()
  }, [mentionAnchor, text])

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return []
    return members.filter(m => m.id !== userId && m.name.toLowerCase().includes(mentionQuery)).slice(0, 5)
  }, [mentionQuery, members, userId])

  useEffect(() => { setMentionHighlight(0) }, [mentionResults.length])

  const selectMention = useCallback((name: string) => {
    if (mentionAnchor === null) return
    const cursor  = textareaRef.current?.selectionStart ?? text.length
    const before  = text.slice(0, mentionAnchor)
    const after   = text.slice(cursor)
    const newText = `${before}@${name} ${after}`
    setText(newText)
    setMentionAnchor(null)
    const newCursor = mentionAnchor + name.length + 2
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursor, newCursor)
    }, 0)
  }, [mentionAnchor, text])

  // Surlignage des mentions
  function renderWithMentions(content: string, isOwn: boolean) {
    if (!content.includes('@') || allNames.length === 0) return content
    const escaped = allNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
    const parts = content.split(pattern)
    return parts.map((part, i) => {
      if (allNames.some(n => part === `@${n}`)) {
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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const msgsContainerRef  = useRef<HTMLDivElement>(null)
  const bottomRef         = useRef<HTMLDivElement>(null)
  const fileRef           = useRef<HTMLInputElement>(null)
  const textareaRef       = useRef<HTMLTextAreaElement>(null)
  const prevLengthRef     = useRef(0)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const audioChunksRef    = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pointerStartXRef  = useRef(0)
  const isCancelledRef    = useRef(false)
  const micBtnRef         = useRef<HTMLButtonElement>(null)

  // ── Enregistrement vocal ──────────────────────────────────────────────────
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
    setIsRecording(false); setCancelProgress(0)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    setRecordingSeconds(0); audioChunksRef.current = []
  }, [doStopRecorder])

  const stopAndSend = useCallback(async () => {
    if (isCancelledRef.current) return
    setIsRecording(false); setCancelProgress(0)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    await doStopRecorder(false)
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    const mimeType = recorder.mimeType || 'audio/webm'
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    if (blob.size < 500) return
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })
    await sendFile(file, replyTo?.id)
    setReplyTo(null)
  }, [doStopRecorder, sendFile, replyTo])

  useEffect(() => {
    if (!isRecording) return
    const onMove = (e: PointerEvent) => {
      const dx = pointerStartXRef.current - e.clientX
      setCancelProgress(Math.min(1, Math.max(0, dx / CANCEL_THRESHOLD)))
      if (dx > CANCEL_THRESHOLD) cancelRecording()
    }
    const onUp = () => { if (!isCancelledRef.current) stopAndSend() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
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
      setIsRecording(true); setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      alert('Accès au micro refusé. Vérifiez les permissions de votre navigateur.')
    }
  }, [isRecording])

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((smooth = false) => {
    const el = msgsContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { if (isActive) scrollToBottom(false) }, [isActive, scrollToBottom])

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

  useEffect(() => { if (isActive) markAllRead() }, [isActive, markAllRead, messages.length])

  // ── Envoi texte ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText(''); setReplyTo(null); setMentionAnchor(null)
    await sendMessage(trimmed, replyTo?.id)
  }, [text, replyTo, sendMessage])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setText(val)
    if (val.trim()) setTyping()
    if (val.length > text.length && val[cursor - 1] === '@') { setMentionAnchor(cursor - 1); return }
    if (mentionAnchor !== null && (val.length <= mentionAnchor || val[mentionAnchor] !== '@')) setMentionAnchor(null)
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
      className="bg-white rounded-2xl border border-slate-200 flex overflow-hidden"
      style={{ height: 'calc(100dvh - 240px)', minHeight: 480, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      onClick={dismiss}
    >

      {/* ── Sidebar membres (desktop uniquement) ─────────────────────── */}
      <div className="hidden md:flex w-64 border-r border-slate-100 bg-slate-50/50 flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Membres — {members.length}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {members.map(m => {
            const isMe   = m.id === userId
            const online = isMe || onlineUsers.has(m.id)
            const roleLabel = m.poste ?? (m.role === 'admin' ? 'Admin' : m.role === 'manager' ? 'Manager' : 'Technicien')
            return (
              <div key={m.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-100/80 transition-colors">
                <div className="relative flex-shrink-0">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-50 ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {m.name}{isMe && <span className="text-slate-400 font-normal ml-1">(vous)</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Zone principale chat ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Chat header ───────────────────────────────────────────── */}
        <div className="h-14 border-b border-slate-100 px-4 flex items-center justify-between flex-shrink-0 bg-white/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 leading-tight">Général</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {onlineUsers.size > 0 ? `${onlineUsers.size} membre${onlineUsers.size > 1 ? 's' : ''} en ligne` : 'Toute l\'équipe'}
              </p>
            </div>
          </div>
          {/* Bouton membres sur mobile */}
          <button
            onClick={() => setShowMembers(p => !p)}
            className={`md:hidden flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              showMembers ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {members.length}
          </button>
        </div>

        {/* Liste membres mobile */}
        {showMembers && (
          <div className="md:hidden bg-white border-b border-slate-100 px-3 py-2.5 max-h-40 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {members.map(m => {
              const isMe = m.id === userId
              const online = isMe || onlineUsers.has(m.id)
              return (
                <div key={m.id} className="flex items-center gap-2.5 py-1.5">
                  <div className="relative flex-shrink-0">
                    <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {m.name}{isMe && <span className="text-slate-400 font-normal ml-1">(vous)</span>}
                  </p>
                  <span className={`ml-auto text-[10px] font-medium flex-shrink-0 ${online ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Messages ────────────────────────────────────────────────── */}
        <div ref={msgsContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50/30">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-medium">Canal général — toute l'équipe</p>
              <p className="text-slate-400 text-xs">Soyez le premier à écrire !</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isOwn       = msg.user_id === userId
            const prev        = messages[i - 1]
            const showDateSep = !prev || !sameDay(prev.created_at, msg.created_at)
            const showAuthor  = !isOwn && (!prev || prev.user_id !== msg.user_id || showDateSep)
            const replyMsg    = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null
            const isMsgActive = activeMsg === msg.id
            const showEmoji   = emojiFor === msg.id

            const reactionGroups: Record<string, { count: number; mine: boolean }> = {}
            for (const r of msg.global_message_reactions ?? []) {
              if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false }
              reactionGroups[r.emoji].count++
              if (r.user_id === userId) reactionGroups[r.emoji].mine = true
            }

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-4">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] text-slate-400 font-medium bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                      {dateSeparatorLabel(msg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                <div
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}
                  onClick={e => { e.stopPropagation(); setActiveMsg(p => p === msg.id ? null : msg.id); setEmojiFor(null) }}
                >
                  {/* Avatar autres */}
                  {!isOwn && (
                    <Avatar
                      name={msg.profiles?.full_name ?? '?'}
                      avatarUrl={msg.profiles?.avatar_url}
                      size="sm"
                      online={onlineUsers.has(msg.user_id)}
                      className="mr-2.5 self-end mb-5 flex-shrink-0"
                    />
                  )}

                  <div className={`max-w-[78%] sm:max-w-[70%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>

                    {/* Nom + heure (au-dessus, pour les autres) */}
                    {showAuthor && (
                      <div className="flex items-baseline gap-2 pl-1 mb-0.5">
                        <span className="text-xs font-bold text-slate-700">
                          {msg.profiles?.full_name ?? 'Inconnu'}
                        </span>
                        {(() => {
                          const label = msg.profiles?.poste ?? (msg.profiles?.role === 'admin' ? 'Admin' : msg.profiles?.role === 'manager' ? 'Manager' : null)
                          return label ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{label}</span>
                          ) : null
                        })()}
                        <span className="text-[10px] font-medium text-slate-400">{formatTime(msg.created_at)}</span>
                      </div>
                    )}

                    {/* Bulle */}
                    <div className={`relative rounded-2xl px-3.5 py-2.5 ${
                      isOwn
                        ? 'bg-orange-500 text-white rounded-br-sm shadow-sm'
                        : 'bg-white text-slate-700 rounded-bl-sm border border-slate-200 shadow-sm'
                    } ${isMsgActive ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}>

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
                            className={`flex items-center gap-2 text-xs font-medium px-2.5 py-2 rounded-xl mb-1 w-full text-left transition-opacity hover:opacity-80 ${
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
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {renderWithMentions(msg.content, isOwn)}
                        </p>
                      )}
                    </div>

                    {/* Heure en dessous (mes messages uniquement) */}
                    {isOwn && (
                      <span className="text-[10px] font-medium text-slate-400 pr-1">{formatTime(msg.created_at)}</span>
                    )}

                    {/* Réactions */}
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

                    {/* Actions sur message (clic) */}
                    {isMsgActive && (
                      <div className={`flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'} flex-wrap`} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEmojiFor(p => p === msg.id ? null : msg.id)}
                          className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-slate-50 transition-colors">
                          😊
                        </button>
                        <button onClick={() => { setReplyTo(msg); dismiss(); textareaRef.current?.focus() }}
                          className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 shadow-sm hover:bg-slate-50 transition-colors font-medium text-slate-600">
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

                    {/* Picker emoji */}
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
          <div ref={bottomRef} />
        </div>

        {/* ── Indicateur "en train d'écrire" ──────────────────────────── */}
        {typingNames.length > 0 && (
          <div className="px-4 py-1 flex items-center gap-1.5 text-[11px] text-slate-400 bg-white border-t border-slate-50">
            <span>
              {typingNames.length === 1
                ? `${typingNames[0]} est en train d'écrire`
                : `${typingNames.slice(0, 2).join(' et ')} écrivent`}
            </span>
            <span className="flex gap-0.5 items-end pb-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        {/* ── Zone de saisie enrichie ──────────────────────────────────── */}
        <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0 relative" onClick={e => e.stopPropagation()}>

          {/* Autocomplete mentions */}
          {mentionAnchor !== null && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-20">
              {mentionResults.map((member, idx) => (
                <button key={member.id}
                  onMouseDown={e => { e.preventDefault(); selectMention(member.name) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    idx === mentionHighlight ? 'bg-orange-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <Avatar name={member.name} avatarUrl={member.avatarUrl} size="sm" online={onlineUsers.has(member.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
                    <p className="text-[11px] text-slate-400">{member.poste ?? member.role ?? 'Membre'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Bannière réponse */}
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

          {/* Conteneur input enrichi */}
          <div className={`relative bg-white border rounded-xl overflow-hidden transition-all ${
            isRecording ? 'border-red-300 ring-4 ring-red-500/10' : 'border-slate-200 focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-500/10'
          }`}>

            {isRecording ? (
              /* ── Mode enregistrement ── */
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-slate-400 flex items-center gap-1 transition-all duration-75 select-none"
                  style={{ opacity: 0.3 + cancelProgress * 0.7, transform: `translateX(${-cancelProgress * 12}px)` }}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Glisser pour annuler
                </span>
                <div className="flex-1 flex items-center justify-end gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-500 tabular-nums">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <button ref={micBtnRef} onPointerDown={handleMicPointerDown}
                  className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm"
                  style={{ touchAction: 'none' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Envoyer un message dans # Général  (@ pour mentionner)"
                  rows={2}
                  className="w-full bg-transparent border-none focus:outline-none text-sm px-4 pt-3 pb-1 text-slate-800 placeholder-slate-400 resize-none max-h-32 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                />

                {/* Toolbar sous le textarea */}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-0.5">
                    {/* Pièce jointe */}
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                      title="Joindre un fichier">
                      {uploading
                        ? <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                      }
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    {/* Micro */}
                    <button ref={micBtnRef} onPointerDown={handleMicPointerDown}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors select-none"
                      style={{ touchAction: 'none' }} title="Maintenir pour enregistrer un vocal">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  </div>

                  {/* Bouton Envoyer */}
                  <button
                    onClick={handleSend}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      text.trim()
                        ? 'bg-orange-500 text-white shadow-sm hover:bg-orange-600'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    disabled={!text.trim()}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
        </div>
      </div>
    </div>

    {/* ── Aperçu PDF ───────────────────────────────────────────────────── */}
    {pdfPreview && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/80" onClick={() => setPdfPreview(null)}>
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-white text-sm font-medium truncate max-w-[70%]">{pdfPreview.name}</span>
          <div className="flex items-center gap-2">
            <a href={pdfPreview.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
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
          <iframe src={pdfPreview.url} className="w-full h-full border-0" title={pdfPreview.name} />
        </div>
      </div>
    )}
    </>
  )
}

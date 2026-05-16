import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type State = 'idle' | 'recording' | 'processing' | 'preview' | 'error'

interface Props {
  /** Contexte du chantier transmis à l'IA pour améliorer la qualité */
  chantierContext?: string
  /** Appelé quand l'utilisateur confirme le rapport généré */
  onGenerated: (rapport: string) => void
}

export default function VoiceReportButton({ chantierContext, onGenerated }: Props) {
  const [state, setState] = useState<State>('idle')
  const [seconds, setSeconds] = useState(0)
  const [rapport, setRapport] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Démarre l'enregistrement
  async function startRecording() {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        sendToAPI(blob)
      }

      recorder.start(250) // chunk toutes les 250ms
      setState('recording')
      setSeconds(0)

      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= 119) {
            // Limite 2 minutes
            stopRecording()
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur microphone'
      setErrorMsg(`Microphone inaccessible : ${message}`)
      setState('error')
    }
  }

  // Arrête l'enregistrement
  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current?.stop()
    setState('processing')
  }

  // Envoi à l'API Edge Function
  async function sendToAPI(audioBlob: Blob) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Non connecté')

      const form = new FormData()
      form.append('audio', audioBlob, 'audio.webm')
      if (chantierContext) form.append('context', chantierContext)

      const res = await fetch('/api/voice-report', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })

      const data = await res.json() as { rapport?: string; transcript?: string; error?: string }

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Erreur serveur ${res.status}`)
      }

      setRapport(data.rapport ?? '')
      setTranscript(data.transcript ?? '')
      setState('preview')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setErrorMsg(message)
      setState('error')
    }
  }

  // Confirme le rapport généré → l'insère dans le textarea parent
  function confirm() {
    onGenerated(rapport)
    reset()
  }

  function reset() {
    setState('idle')
    setRapport('')
    setTranscript('')
    setSeconds(0)
    setShowTranscript(false)
    setErrorMsg('')
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
        title="Dicter un rapport vocal"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
        Vocal
      </button>
    )
  }

  // ── RECORDING ───────────────────────────────────────────────────────────────
  if (state === 'recording') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50">
        {/* Point pulsant */}
        <span className="relative flex h-3 w-3 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-sm text-red-600 font-medium tabular-nums">{fmt(seconds)}</span>
        <span className="text-xs text-red-400 flex-1">Enregistrement…</span>
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <rect x="5" y="5" width="10" height="10" rx="1" />
          </svg>
          Arrêter
        </button>
      </div>
    )
  }

  // ── PROCESSING ──────────────────────────────────────────────────────────────
  if (state === 'processing') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50">
        <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-orange-600">IA en cours de rédaction…</span>
      </div>
    )
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="w-full p-3 rounded-xl border border-red-200 bg-red-50 space-y-2">
        <p className="text-xs text-red-600">{errorMsg}</p>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-red-500 underline"
        >
          Réessayer
        </button>
      </div>
    )
  }

  // ── PREVIEW ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-3 p-4 rounded-xl border border-orange-200 bg-orange-50">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-semibold text-orange-700">Rapport généré par l'IA — vérifiez avant de publier</span>
      </div>

      <textarea
        value={rapport}
        onChange={e => setRapport(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
      />

      {/* Transcription brute (optionnelle) */}
      <button
        type="button"
        onClick={() => setShowTranscript(v => !v)}
        className="text-xs text-orange-500 underline"
      >
        {showTranscript ? 'Masquer' : 'Voir'} la transcription brute
      </button>
      {showTranscript && (
        <p className="text-xs text-gray-500 italic bg-white rounded-lg p-2 border border-gray-100">
          {transcript}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!rapport.trim()}
          className="flex-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
        >
          Utiliser ce rapport
        </button>
      </div>
    </div>
  )
}

import { useRef, useState, useMemo, useEffect } from 'react'

interface Props {
  url: string
  isOwn: boolean
}

/** Génère des barres pseudo-aléatoires consistantes à partir d'une seed (URL) */
function generateBars(seed: string, count = 30): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return Array.from({ length: count }, (_, i) => {
    const v = Math.abs(Math.sin(hash * (i + 1) * 0.37 + i))
    return Math.round(3 + v * 16) // 3–19 px de haut
  })
}

function fmtSec(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function VoiceMessage({ url, isOwn }: Props) {
  const audioRef   = useRef<HTMLAudioElement>(null)
  const waveRef    = useRef<HTMLDivElement>(null)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [loaded,      setLoaded]      = useState(false)

  const bars = useMemo(() => generateBars(url), [url])
  const progress = duration > 0 ? currentTime / duration : 0

  // Précharger les métadonnées pour avoir la durée même avant lecture
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onMeta = () => { setDuration(a.duration || 0); setLoaded(true) }
    a.addEventListener('loadedmetadata', onMeta)
    return () => a.removeEventListener('loadedmetadata', onMeta)
  }, [])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = waveRef.current!.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }

  return (
    <div className={`flex items-center gap-2.5 py-1 min-w-[190px] max-w-[240px]`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => { setDuration(audioRef.current?.duration ?? 0); setLoaded(true) }}
      />

      {/* Bouton play / pause */}
      <button
        onClick={togglePlay}
        disabled={!loaded}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isOwn ? 'bg-white/25 hover:bg-white/35' : 'bg-orange-100 hover:bg-orange-200'
        } disabled:opacity-40`}
      >
        {playing ? (
          <svg className={`w-4 h-4 ${isOwn ? 'text-white' : 'text-orange-600'}`} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={`w-4 h-4 ml-0.5 ${isOwn ? 'text-white' : 'text-orange-600'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        )}
      </button>

      {/* Forme d'onde cliquable */}
      <div
        ref={waveRef}
        className="flex items-center gap-[2.5px] flex-1 h-9 cursor-pointer select-none"
        onClick={handleSeek}
        onTouchEnd={handleSeek}
      >
        {bars.map((height, i) => {
          const barPos    = (i + 1) / bars.length
          const isPlayed  = barPos <= progress
          return (
            <div
              key={i}
              className={`rounded-full flex-shrink-0 transition-colors duration-75 ${
                isPlayed
                  ? isOwn ? 'bg-white/90' : 'bg-orange-500'
                  : isOwn ? 'bg-white/30' : 'bg-gray-300'
              }`}
              style={{ width: 2.5, height }}
            />
          )
        })}
      </div>

      {/* Durée */}
      <span className={`text-[11px] font-medium flex-shrink-0 w-9 text-right tabular-nums ${
        isOwn ? 'text-white/70' : 'text-gray-400'
      }`}>
        {loaded ? fmtSec(playing || currentTime > 0 ? currentTime : duration) : '—'}
      </span>
    </div>
  )
}

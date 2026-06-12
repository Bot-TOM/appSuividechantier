import { useEffect, useRef, useState } from 'react'
import { Pencil, Square, Eraser, Undo2, Trash2, Camera, X, Download, Check } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — Croquis de calepinage sur chantier
// Page isolée pour valider l'ergonomie du dessin tactile avant intégration VT.
// Aucune écriture en base : le résultat s'exporte en PNG localement.
// ─────────────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'rect' | 'eraser'

interface Point { x: number; y: number }

interface Stroke {
  tool: Tool
  color: string
  width: number
  points: Point[] // pen/eraser : tracé ; rect : [coin départ, coin opposé]
}

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#f97316']
const WIDTHS = [2, 4, 7]

export default function ProtoCroquis() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  // Le tracé en cours vit dans une ref (pas un state) : les pointermove arrivent
  // plus vite que les re-rendus React et perdraient des points sinon.
  const currentRef = useRef<Stroke | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const photoRef = useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [exportUrl, setExportUrl] = useState<string | null>(null)

  // Coordonnées logiques 1000x1414 (ratio A4 portrait) quelle que soit la taille écran
  const LOGICAL_W = 1000
  const LOGICAL_H = 1414

  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  function drawScene(ctx: CanvasRenderingContext2D, all: Stroke[], live: Stroke | null) {
    const bg = photoRef.current
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H)

    // Fond : blanc, puis photo éventuelle, puis quadrillage léger
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)

    if (bg) {
      // Photo ajustée pour tenir entière (contain), centrée
      const scale = Math.min(LOGICAL_W / bg.width, LOGICAL_H / bg.height)
      const w = bg.width * scale
      const h = bg.height * scale
      ctx.globalAlpha = 0.9
      ctx.drawImage(bg, (LOGICAL_W - w) / 2, (LOGICAL_H - h) / 2, w, h)
      ctx.globalAlpha = 1
    }

    // Quadrillage 50px logique (plus discret sur photo)
    ctx.strokeStyle = bg ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.25)'
    ctx.lineWidth = 1
    for (let x = 0; x <= LOGICAL_W; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LOGICAL_H); ctx.stroke()
    }
    for (let y = 0; y <= LOGICAL_H; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_W, y); ctx.stroke()
    }

    for (const s of [...all, ...(live ? [live] : [])]) drawStroke(ctx, s)
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (s.tool === 'rect') {
      if (s.points.length < 2) return
      const [a, b] = [s.points[0], s.points[s.points.length - 1]]
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
      return
    }

    // Gomme = tracé blanc épais ; stylo = couleur choisie
    ctx.strokeStyle = s.tool === 'eraser' ? '#ffffff' : s.color
    ctx.lineWidth = s.tool === 'eraser' ? 28 : s.width

    const pts = s.points
    if (pts.length === 0) return
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = ctx.strokeStyle
      ctx.fill()
      return
    }

    // Lissage : courbes quadratiques entre points médians
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2
      const my = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
    ctx.stroke()
  }

  function redraw() {
    const ctx = getCtx()
    if (ctx) drawScene(ctx, strokesRef.current, currentRef.current)
  }

  // Garde les refs en phase avec le state, puis redessine
  useEffect(() => {
    strokesRef.current = strokes
    photoRef.current = photo
    redraw()
  }, [strokes, photo])

  // Canvas net sur écrans haute densité, redimensionné avec la fenêtre
  useEffect(() => {
    function resize() {
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const rect = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = LOGICAL_W * dpr * (rect.width / LOGICAL_W)
      canvas.height = LOGICAL_H * dpr * (rect.width / LOGICAL_W)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.width * (LOGICAL_H / LOGICAL_W)}px`
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform((canvas.width / LOGICAL_W), 0, 0, (canvas.height / LOGICAL_H), 0, 0)
        drawScene(ctx, strokesRef.current, currentRef.current)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  function toLogical(e: React.PointerEvent): Point {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    currentRef.current = { tool, color, width, points: [toLogical(e)] }
    redraw()
  }

  function onPointerMove(e: React.PointerEvent) {
    const c = currentRef.current
    if (!c) return
    e.preventDefault()
    const p = toLogical(e)
    if (c.tool === 'rect') c.points = [c.points[0], p]
    else c.points.push(p)
    redraw()
  }

  function onPointerUp() {
    const c = currentRef.current
    if (!c) return
    currentRef.current = null
    setStrokes(s => [...s, c])
  }

  function undo() { setStrokes(s => s.slice(0, -1)) }
  function clearAll() {
    if (strokes.length && !window.confirm('Effacer tout le croquis ?')) return
    setStrokes([]); setPhoto(null)
  }

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new Image()
    img.onload = () => setPhoto(img)
    img.src = URL.createObjectURL(file)
    e.target.value = ''
  }

  function exportPng() {
    // Rendu propre en pleine résolution logique, indépendant de l'écran
    const off = document.createElement('canvas')
    off.width = LOGICAL_W
    off.height = LOGICAL_H
    const ctx = off.getContext('2d')!
    drawScene(ctx, strokes, null)
    off.toBlob(blob => {
      if (blob) setExportUrl(URL.createObjectURL(blob))
    }, 'image/png')
  }

  const toolBtn = (active: boolean) =>
    `p-3 rounded-xl transition-colors ${active ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Bandeau prototype */}
      <div className="bg-slate-900 text-white text-center text-xs font-bold py-2 tracking-widest uppercase">
        Prototype croquis — test ergonomie (rien n'est enregistré)
      </div>

      {/* Barre d'outils */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 flex-wrap sticky top-0 z-10">
        <button onClick={() => setTool('pen')} className={toolBtn(tool === 'pen')} aria-label="Stylo">
          <Pencil className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('rect')} className={toolBtn(tool === 'rect')} aria-label="Rectangle (panneau)">
          <Square className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('eraser')} className={toolBtn(tool === 'eraser')} aria-label="Gomme">
          <Eraser className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-slate-200 mx-1" />

        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Couleur ${c}`}
            className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-slate-900 scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }} />
        ))}

        <div className="w-px h-8 bg-slate-200 mx-1" />

        {WIDTHS.map(w => (
          <button key={w} onClick={() => setWidth(w)} aria-label={`Épaisseur ${w}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${width === w ? 'bg-slate-200' : 'bg-white'}`}>
            <div className="rounded-full bg-slate-700" style={{ width: w + 3, height: w + 3 }} />
          </button>
        ))}

        <div className="flex-1" />

        <label className={`${toolBtn(false)} cursor-pointer`} aria-label="Photo de fond">
          <Camera className="w-5 h-5" />
          <input type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
        </label>
        <button onClick={undo} disabled={!strokes.length} className={`${toolBtn(false)} disabled:opacity-30`} aria-label="Annuler">
          <Undo2 className="w-5 h-5" />
        </button>
        <button onClick={clearAll} disabled={!strokes.length && !photo} className={`${toolBtn(false)} disabled:opacity-30`} aria-label="Tout effacer">
          <Trash2 className="w-5 h-5" />
        </button>
        <button onClick={exportPng}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl shadow-md transition-colors">
          <Check className="w-5 h-5" /> Valider
        </button>
      </div>

      {/* Zone de dessin — touch-action:none empêche le scroll pendant le tracé */}
      <div ref={wrapRef} className="flex-1 overflow-y-auto p-3">
        <canvas
          ref={canvasRef}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <p className="text-center text-xs text-slate-400 font-medium py-3">
          ✏️ Stylo pour tracer · ⬜ Rectangle pour les panneaux · 📷 Photo en fond · Astuce : tourne ton téléphone en paysage pour les grands pans
        </p>
      </div>

      {/* Aperçu export */}
      {exportUrl && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4" onClick={() => setExportUrl(null)}>
          <div className="bg-white rounded-3xl p-4 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900">Aperçu du croquis (PNG)</h2>
              <button onClick={() => setExportUrl(null)} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={exportUrl} alt="Croquis exporté" className="w-full rounded-xl border border-slate-200" />
            <a href={exportUrl} download="croquis-calepinage.png"
              className="mt-4 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors">
              <Download className="w-5 h-5" /> Télécharger
            </a>
            <p className="text-xs text-slate-400 text-center mt-3 font-medium">
              Dans la version finale, ce fichier serait enregistré automatiquement dans la VT.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

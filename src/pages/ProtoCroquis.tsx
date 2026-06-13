import { useEffect, useRef, useState } from 'react'
import { Pencil, Square, Slash, Move, Eraser, Undo2, Trash2, Camera, X, Download, Check, Maximize, MessageSquare } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — Croquis de calepinage sur chantier
// Page isolée pour valider l'ergonomie du dessin tactile avant intégration VT.
// Aucune écriture en base : le résultat s'exporte en PNG localement.
// ─────────────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'rect' | 'line' | 'bubble' | 'move' | 'eraser'

interface Point { x: number; y: number }

interface Stroke {
  tool: Tool
  color: string
  width: number
  points: Point[] // pen/eraser : tracé ; rect/line : [début, fin] ; bubble : [position]
  text?: string   // bubble : texte de la mesure (ex « 5,35 m »)
}

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#f97316']
const WIDTHS = [2, 4, 7]

// Coordonnées logiques 1000x1414 (ratio A4 portrait) quelle que soit la taille écran
const LOGICAL_W = 1000
const LOGICAL_H = 1414

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
  const [zoomed, setZoomed] = useState(false)

  // Édition de bulle : indice de la bulle + texte en cours de saisie
  const [labelEdit, setLabelEdit] = useState<{ index: number; text: string } | null>(null)

  // Vue : zoom (s) et déplacement (tx, ty) en unités logiques
  const viewRef = useRef({ s: 1, tx: 0, ty: 0 })
  // Doigts posés (pour le pincement à deux doigts)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{ d0: number; s0: number; m0: Point; t0: Point } | null>(null)

  function getCanvas() { return canvasRef.current }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  function drawScene(ctx: CanvasRenderingContext2D, all: Stroke[], live: Stroke | null) {
    const bg = photoRef.current

    // Page blanche avec bord léger (le fond gris apparaît quand on dézoome)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H)
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, LOGICAL_W, LOGICAL_H)

    if (bg) {
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

    if (s.tool === 'line') {
      if (s.points.length < 2) return
      const [a, b] = [s.points[0], s.points[s.points.length - 1]]
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      return
    }

    if (s.tool === 'bubble') {
      drawBubble(ctx, s)
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

  // Boîte d'une bulle (centrée sur sa position points[0])
  function bubbleBox(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.font = '600 30px system-ui, sans-serif'
    const label = s.text && s.text.length ? s.text : '…'
    const w = ctx.measureText(label).width + 36
    const h = 56
    const c = s.points[0]
    return { x: c.x - w / 2, y: c.y - h / 2, w, h, label }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, s: Stroke) {
    const b = bubbleBox(ctx, s)
    // Pastille blanche, contour de la couleur choisie + petit ergot façon bulle
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = s.color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 14)
    else ctx.rect(b.x, b.y, b.w, b.h)
    ctx.fill()
    ctx.stroke()
    // Ergot sous la bulle
    const cx = s.points[0].x
    ctx.beginPath()
    ctx.moveTo(cx - 10, b.y + b.h - 1)
    ctx.lineTo(cx, b.y + b.h + 14)
    ctx.lineTo(cx + 10, b.y + b.h - 1)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = s.color
    ctx.beginPath()
    ctx.moveTo(cx - 10, b.y + b.h - 1)
    ctx.lineTo(cx, b.y + b.h + 14)
    ctx.lineTo(cx + 10, b.y + b.h - 1)
    ctx.stroke()
    // Texte
    ctx.fillStyle = s.color
    ctx.font = '600 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.label, s.points[0].x, s.points[0].y + 1)
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  function redraw() {
    const canvas = getCanvas()
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const b = canvas.width / LOGICAL_W
    const v = viewRef.current
    // Fond gris hors page (visible en dézoom)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Transformation vue : zoom + déplacement
    ctx.setTransform(b * v.s, 0, 0, b * v.s, b * v.tx * v.s, b * v.ty * v.s)
    drawScene(ctx, strokesRef.current, currentRef.current)
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
      const canvas = getCanvas()
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const rect = wrap.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.width * (LOGICAL_H / LOGICAL_W) * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.width * (LOGICAL_H / LOGICAL_W)}px`
      redraw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ── Coordonnées ────────────────────────────────────────────────────────────

  // Position écran en "unités logiques écran" (avant zoom/déplacement)
  function toScreen(e: { clientX: number; clientY: number }): Point {
    const canvas = getCanvas()!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    }
  }

  // Position dans le repère du dessin (tient compte du zoom/déplacement)
  function toLogical(e: { clientX: number; clientY: number }): Point {
    const p = toScreen(e)
    const v = viewRef.current
    return { x: p.x / v.s - v.tx, y: p.y / v.s - v.ty }
  }

  // ── Détection de forme sous le doigt ───────────────────────────────────────

  function distToSegment(p: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }

  // Bulle sous le doigt ? (prioritaire sur les formes)
  function hitTestBubble(p: Point): number {
    const ctx = getCanvas()?.getContext('2d')
    if (!ctx) return -1
    const list = strokesRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].tool !== 'bubble') continue
      const b = bubbleBox(ctx, list[i])
      const M = 12 / viewRef.current.s
      if (p.x > b.x - M && p.x < b.x + b.w + M && p.y > b.y - M && p.y < b.y + b.h + M) return i
    }
    return -1
  }

  // Forme sous le doigt (la plus récente d'abord), marge tactile constante à l'écran
  function hitTest(p: Point): number {
    const HIT = 20 / viewRef.current.s
    const list = strokesRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      if (s.points.length < 2) continue
      const [a, b] = [s.points[0], s.points[s.points.length - 1]]
      if (s.tool === 'rect') {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x)
        const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
        // Sur un bord du rectangle (pas l'intérieur, pour pouvoir dessiner dedans)
        const nearV = (Math.abs(p.x - x1) < HIT || Math.abs(p.x - x2) < HIT) && p.y > y1 - HIT && p.y < y2 + HIT
        const nearH = (Math.abs(p.y - y1) < HIT || Math.abs(p.y - y2) < HIT) && p.x > x1 - HIT && p.x < x2 + HIT
        if (nearV || nearH) return i
      } else if (s.tool === 'line') {
        if (distToSegment(p, a, b) < HIT) return i
      } else {
        for (let j = 0; j < s.points.length - 1; j++) {
          if (distToSegment(p, s.points[j], s.points[j + 1]) < HIT) return i
        }
      }
    }
    return -1
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  // Déplacement : forme ou bulle attrapée + suivi pour distinguer "tap" et "glisser"
  const moveRef = useRef<{ index: number; last: Point; kind: 'shape' | 'bubble'; start: Point; t0: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    pointersRef.current.set(e.pointerId, toScreen(e))
    // setPointerCapture peut lever une exception (pointeur déjà levé, id inconnu…)
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* non bloquant */ }

    // Deuxième doigt → pincement : on abandonne le tracé en cours
    if (pointersRef.current.size === 2) {
      currentRef.current = null
      moveRef.current = null
      const [p1, p2] = [...pointersRef.current.values()]
      const v = viewRef.current
      pinchRef.current = {
        d0: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        s0: v.s,
        m0: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
        t0: { x: v.tx, y: v.ty },
      }
      redraw()
      return
    }

    const p = toLogical(e)

    if (tool === 'move') {
      const bi = hitTestBubble(p)
      if (bi >= 0) {
        moveRef.current = { index: bi, last: p, kind: 'bubble', start: p, t0: Date.now() }
        return
      }
      const i = hitTest(p)
      if (i >= 0) moveRef.current = { index: i, last: p, kind: 'shape', start: p, t0: Date.now() }
      return
    }

    // Outil bulle : on attend le relâcher (tap) pour créer la bulle — pas de tracé continu
    if (tool === 'bubble') return

    currentRef.current = { tool, color, width, points: [p] }
    redraw()
  }

  function onPointerMove(e: React.PointerEvent) {
    e.preventDefault()
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, toScreen(e))

    // Pincement en cours : zoom autour du milieu des deux doigts
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const [p1, p2] = [...pointersRef.current.values()]
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const m = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      const s = Math.min(4, Math.max(0.4, pinch.s0 * (d / Math.max(pinch.d0, 1))))
      // Le point du dessin sous le milieu des doigts reste sous les doigts
      const lx = pinch.m0.x / pinch.s0 - pinch.t0.x
      const ly = pinch.m0.y / pinch.s0 - pinch.t0.y
      viewRef.current = { s, tx: m.x / s - lx, ty: m.y / s - ly }
      setZoomed(Math.abs(s - 1) > 0.01 || Math.abs(viewRef.current.tx) > 1 || Math.abs(viewRef.current.ty) > 1)
      redraw()
      return
    }

    const p = toLogical(e)

    // Déplacement d'une forme ou d'une bulle (tous deux = déplacer leurs points)
    const mv = moveRef.current
    if (mv) {
      const dx = p.x - mv.last.x, dy = p.y - mv.last.y
      const s = strokesRef.current[mv.index]
      s.points = s.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }))
      mv.last = p
      redraw()
      return
    }

    const c = currentRef.current
    if (!c) return
    if (c.tool === 'rect') {
      c.points = [c.points[0], p]
    } else if (c.tool === 'line') {
      // Aimantation horizontale/verticale quand on en est proche (~7°)
      const a = c.points[0]
      let dx = p.x - a.x, dy = p.y - a.y
      if (Math.abs(dy) < Math.abs(dx) * 0.12) dy = 0
      else if (Math.abs(dx) < Math.abs(dy) * 0.12) dx = 0
      c.points = [a, { x: a.x + dx, y: a.y + dy }]
    } else {
      c.points.push(p)
    }
    redraw()
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null

    const mv = moveRef.current
    if (mv) {
      moveRef.current = null
      const moved = Math.hypot(mv.last.x - mv.start.x, mv.last.y - mv.start.y)
      // Tap bref sur une bulle (sans la déplacer) → réédition du texte
      if (mv.kind === 'bubble' && moved < 8 && Date.now() - mv.t0 < 400) {
        setLabelEdit({ index: mv.index, text: strokesRef.current[mv.index].text ?? '' })
      }
      setStrokes([...strokesRef.current])
      return
    }

    // Outil bulle : tap simple → crée une bulle à cet endroit et ouvre la saisie
    if (tool === 'bubble') {
      const p = toLogical(e)
      const bubble: Stroke = { tool: 'bubble', color, width, points: [p], text: '' }
      const nextIndex = strokesRef.current.length
      setStrokes(s => [...s, bubble])
      setLabelEdit({ index: nextIndex, text: '' })
      return
    }

    const c = currentRef.current
    if (!c) return
    currentRef.current = null
    setStrokes(s => [...s, c])
  }

  function applyLabel(index: number, rawText: string) {
    const text = rawText.trim()
    setStrokes(s => {
      // Texte vide → on retire la bulle (notamment une bulle fraîchement créée)
      if (!text) return s.filter((_, i) => i !== index)
      return s.map((st, i) => (i === index ? { ...st, text } : st))
    })
    setLabelEdit(null)
  }

  function undo() { setStrokes(s => s.slice(0, -1)) }
  function clearAll() {
    if (strokes.length && !window.confirm('Effacer tout le croquis ?')) return
    setStrokes([]); setPhoto(null)
  }
  function resetView() {
    viewRef.current = { s: 1, tx: 0, ty: 0 }
    setZoomed(false)
    redraw()
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
    // Rendu propre en pleine résolution logique, indépendant du zoom écran
    const off = document.createElement('canvas')
    off.width = LOGICAL_W
    off.height = LOGICAL_H
    const ctx = off.getContext('2d')!
    drawScene(ctx, strokesRef.current, null)
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
        <button onClick={() => setTool('line')} className={toolBtn(tool === 'line')} aria-label="Ligne droite">
          <Slash className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('bubble')} className={toolBtn(tool === 'bubble')} aria-label="Bulle de mesure">
          <MessageSquare className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('move')} className={toolBtn(tool === 'move')} aria-label="Déplacer">
          <Move className="w-5 h-5" />
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

        {zoomed && (
          <button onClick={resetView} className={`${toolBtn(false)}`} aria-label="Recentrer la vue">
            <Maximize className="w-5 h-5" />
          </button>
        )}
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
          ✏️ Stylo · ⬜ Rectangle (panneaux) · ╱ Ligne droite · 💬 Bulle de mesure (tape pour la poser) · ✥ Déplacer · 🤏 Pince à deux doigts pour zoomer
        </p>
      </div>

      {/* Saisie du texte de la bulle */}
      {labelEdit && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl">
            <h2 className="font-bold text-slate-900 mb-1">Bulle de mesure</h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Écris la mesure ou l'annotation. Ensuite, déplace la bulle où tu veux avec l'outil ✥.</p>
            <input
              autoFocus
              type="text"
              placeholder="ex : 5,35 m"
              value={labelEdit.text}
              onChange={e => setLabelEdit(le => le ? { ...le, text: e.target.value } : le)}
              onKeyDown={e => { if (e.key === 'Enter') applyLabel(labelEdit.index, labelEdit.text) }}
              className="w-full border-2 border-slate-200 focus:border-orange-400 rounded-xl px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition-colors"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => applyLabel(labelEdit.index, '')}
                className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors">
                Supprimer
              </button>
              <button onClick={() => applyLabel(labelEdit.index, labelEdit.text)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors">
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

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

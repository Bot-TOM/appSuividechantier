import { useEffect, useRef, useState } from 'react'
import { Pencil, Square, Slash, Move, Copy, Eraser, Undo2, Trash2, Camera, X, Download, Check, Maximize, MessageSquare } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CroquisCanvas — éditeur de croquis tactile réutilisable (calepinage chantier)
// Outils : stylo lissé, rectangle, ligne aimantée, bulle de mesure, déplacer,
// dupliquer, gomme. Zoom au pincement, photo de fond, surface infinie, export PNG.
// Le composant ne décide pas du stockage : il expose ses formes via onChange.
// ─────────────────────────────────────────────────────────────────────────────

export type CroquisTool = 'pen' | 'rect' | 'line' | 'bubble' | 'move' | 'duplicate' | 'eraser'

export interface CroquisPoint { x: number; y: number }

export interface CroquisStroke {
  tool: CroquisTool
  color: string
  width: number
  points: CroquisPoint[] // pen/eraser : tracé ; rect/line : [début, fin] ; bubble : [position]
  text?: string          // bubble : texte de la mesure (ex « 5,35 m »)
}

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

const COLORS = ['#1e293b', '#ef4444', '#3b82f6', '#f97316']
const WIDTHS = [2, 4, 7]

// Coordonnées logiques 1000x1414 (ratio A4 portrait) quelle que soit la taille écran
const LOGICAL_W = 1000
const LOGICAL_H = 1414

export interface CroquisCanvasProps {
  /** Formes initiales (réouverture d'un croquis existant) */
  initialStrokes?: CroquisStroke[]
  /** Appelé à chaque modification des formes — pour la sauvegarde par le parent */
  onChange?: (strokes: CroquisStroke[]) => void
  /** Si fourni, affiche un bouton de fermeture (usage en superposition) */
  onClose?: () => void
  /** Titre affiché dans la barre (ex nom du croquis) */
  title?: string
}

export default function CroquisCanvas({ initialStrokes, onChange, onClose, title }: CroquisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [strokes, setStrokes] = useState<CroquisStroke[]>(initialStrokes ?? [])
  // Le tracé en cours vit dans une ref (pas un state) : les pointermove arrivent
  // plus vite que les re-rendus React et perdraient des points sinon.
  const currentRef = useRef<CroquisStroke | null>(null)
  const strokesRef = useRef<CroquisStroke[]>(initialStrokes ?? [])
  const photoRef = useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<CroquisTool>('pen')
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
  const pointersRef = useRef(new Map<number, CroquisPoint>())
  const pinchRef = useRef<{ d0: number; s0: number; m0: CroquisPoint; t0: CroquisPoint } | null>(null)

  // Notifie le parent à chaque changement de formes (pour sauvegarde)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  function getCanvas() { return canvasRef.current }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  function drawScene(ctx: CanvasRenderingContext2D, all: CroquisStroke[], live: CroquisStroke | null, bounds: Bounds) {
    const bg = photoRef.current
    const { minX, minY, maxX, maxY } = bounds

    // Surface de travail blanche couvrant toute la zone visible/exportée
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY)

    if (bg) {
      const scale = Math.min(LOGICAL_W / bg.width, LOGICAL_H / bg.height)
      const w = bg.width * scale
      const h = bg.height * scale
      ctx.globalAlpha = 0.9
      ctx.drawImage(bg, (LOGICAL_W - w) / 2, (LOGICAL_H - h) / 2, w, h)
      ctx.globalAlpha = 1
    }

    // Quadrillage 50px aligné, étendu à toute la zone visible
    ctx.strokeStyle = bg ? 'rgba(100,116,139,0.18)' : 'rgba(100,116,139,0.25)'
    ctx.lineWidth = 1
    const startX = Math.floor(minX / 50) * 50
    const startY = Math.floor(minY / 50) * 50
    for (let x = startX; x <= maxX; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke()
    }
    for (let y = startY; y <= maxY; y += 50) {
      ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke()
    }

    for (const s of [...all, ...(live ? [live] : [])]) drawStroke(ctx, s)
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: CroquisStroke) {
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
  function bubbleBox(ctx: CanvasRenderingContext2D, s: CroquisStroke) {
    ctx.font = '600 30px system-ui, sans-serif'
    const label = s.text && s.text.length ? s.text : '…'
    const w = ctx.measureText(label).width + 36
    const h = 56
    const c = s.points[0]
    return { x: c.x - w / 2, y: c.y - h / 2, w, h, label }
  }

  function drawBubble(ctx: CanvasRenderingContext2D, s: CroquisStroke) {
    const b = bubbleBox(ctx, s)
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
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(b * v.s, 0, 0, b * v.s, b * v.tx * v.s, b * v.ty * v.s)
    const bounds: Bounds = {
      minX: -v.tx - 2,
      minY: -v.ty - 2,
      maxX: LOGICAL_W / v.s - v.tx + 2,
      maxY: LOGICAL_H / v.s - v.ty + 2,
    }
    drawScene(ctx, strokesRef.current, currentRef.current, bounds)
  }

  // Garde les refs en phase avec le state, redessine, et notifie le parent
  useEffect(() => {
    strokesRef.current = strokes
    photoRef.current = photo
    redraw()
    onChangeRef.current?.(strokes)
  }, [strokes, photo])

  // Canvas net sur écrans haute densité. Un ResizeObserver garantit qu'on
  // dimensionne quand le conteneur a réellement sa taille (montage en
  // superposition : le layout n'est pas prêt au tout premier rendu).
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    function resize() {
      const canvas = getCanvas()
      if (!canvas || !wrap) return
      const rect = wrap.getBoundingClientRect()
      if (rect.width < 1) return // pas encore mis en page
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.width * (LOGICAL_H / LOGICAL_W) * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.width * (LOGICAL_H / LOGICAL_W)}px`
      redraw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()
    return () => ro.disconnect()
  }, [])

  // ── Coordonnées ────────────────────────────────────────────────────────────

  function toScreen(e: { clientX: number; clientY: number }): CroquisPoint {
    const canvas = getCanvas()!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    }
  }

  function toLogical(e: { clientX: number; clientY: number }): CroquisPoint {
    const p = toScreen(e)
    const v = viewRef.current
    return { x: p.x / v.s - v.tx, y: p.y / v.s - v.ty }
  }

  // ── Détection de forme sous le doigt ───────────────────────────────────────

  function distToSegment(p: CroquisPoint, a: CroquisPoint, b: CroquisPoint) {
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }

  function hitTestBubble(p: CroquisPoint): number {
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

  // fill = true : on attrape aussi l'intérieur des rectangles (pratique pour dupliquer)
  function hitTest(p: CroquisPoint, fill = false): number {
    const HIT = 20 / viewRef.current.s
    const list = strokesRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]
      if (s.points.length < 2) continue
      const [a, b] = [s.points[0], s.points[s.points.length - 1]]
      if (s.tool === 'rect') {
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x)
        const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y)
        if (fill) {
          if (p.x > x1 - HIT && p.x < x2 + HIT && p.y > y1 - HIT && p.y < y2 + HIT) return i
        } else {
          const nearV = (Math.abs(p.x - x1) < HIT || Math.abs(p.x - x2) < HIT) && p.y > y1 - HIT && p.y < y2 + HIT
          const nearH = (Math.abs(p.y - y1) < HIT || Math.abs(p.y - y2) < HIT) && p.x > x1 - HIT && p.x < x2 + HIT
          if (nearV || nearH) return i
        }
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

  const moveRef = useRef<{ index: number; last: CroquisPoint; kind: 'shape' | 'bubble'; start: CroquisPoint; t0: number } | null>(null)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    pointersRef.current.set(e.pointerId, toScreen(e))
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

    // Outil dupliquer : copie la forme touchée (décalée) et on la place en glissant
    if (tool === 'duplicate') {
      const bi = hitTestBubble(p)
      const src = bi >= 0 ? bi : hitTest(p, true)
      if (src < 0) return
      const orig = strokesRef.current[src]
      const OFF = 30
      const copy: CroquisStroke = { ...orig, points: orig.points.map(pt => ({ x: pt.x + OFF, y: pt.y + OFF })) }
      strokesRef.current = [...strokesRef.current, copy]
      const newIndex = strokesRef.current.length - 1
      moveRef.current = { index: newIndex, last: { x: p.x + OFF, y: p.y + OFF }, kind: 'shape', start: p, t0: Date.now() }
      redraw()
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
      if (mv.kind === 'bubble' && moved < 8 && Date.now() - mv.t0 < 400) {
        setLabelEdit({ index: mv.index, text: strokesRef.current[mv.index].text ?? '' })
      }
      setStrokes([...strokesRef.current])
      return
    }

    // Outil bulle : tap simple → crée une bulle à cet endroit et ouvre la saisie
    if (tool === 'bubble') {
      const p = toLogical(e)
      const bubble: CroquisStroke = { tool: 'bubble', color, width, points: [p], text: '' }
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

  // Rectangle englobant tout le contenu dessiné (+ marge), pour recadrer l'export
  function contentBounds(): Bounds {
    const all = strokesRef.current
    if (!all.length && !photoRef.current) {
      return { minX: 0, minY: 0, maxX: LOGICAL_W, maxY: LOGICAL_H }
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of all) {
      const pad = s.tool === 'bubble' ? 130 : 0
      for (const p of s.points) {
        minX = Math.min(minX, p.x - pad); minY = Math.min(minY, p.y - 40)
        maxX = Math.max(maxX, p.x + pad); maxY = Math.max(maxY, p.y + 40)
      }
    }
    if (photoRef.current) {
      minX = Math.min(minX, 0); minY = Math.min(minY, 0)
      maxX = Math.max(maxX, LOGICAL_W); maxY = Math.max(maxY, LOGICAL_H)
    }
    const M = 70
    return { minX: minX - M, minY: minY - M, maxX: maxX + M, maxY: maxY + M }
  }

  function exportPng() {
    const { minX, minY, maxX, maxY } = contentBounds()
    const w = Math.max(1, maxX - minX)
    const h = Math.max(1, maxY - minY)
    const scale = Math.min(2, 2000 / Math.max(w, h))
    const off = document.createElement('canvas')
    off.width = Math.round(w * scale)
    off.height = Math.round(h * scale)
    const ctx = off.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.translate(-minX, -minY)
    drawScene(ctx, strokesRef.current, null, { minX, minY, maxX, maxY })
    off.toBlob(blob => {
      if (blob) setExportUrl(URL.createObjectURL(blob))
    }, 'image/png')
  }

  const toolBtn = (active: boolean) =>
    `p-3 rounded-xl transition-colors ${active ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* Barre d'outils */}
      <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 flex-wrap sticky top-0 z-10">
        {onClose && (
          <>
            <button onClick={onClose} className={toolBtn(false)} aria-label="Fermer le croquis">
              <X className="w-5 h-5" />
            </button>
            {title && <span className="font-bold text-slate-900 text-sm mr-1 max-w-[120px] truncate">{title}</span>}
            <div className="w-px h-8 bg-slate-200 mx-1" />
          </>
        )}
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
        <button onClick={() => setTool('duplicate')} className={toolBtn(tool === 'duplicate')} aria-label="Dupliquer">
          <Copy className="w-5 h-5" />
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
          <Check className="w-5 h-5" /> Aperçu
        </button>
      </div>

      {/* Zone de dessin — touch-action:none empêche le scroll pendant le tracé */}
      <div ref={wrapRef} className="flex-1 overflow-y-auto p-3 bg-slate-100">
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
          ✏️ Stylo · ⬜ Rectangle · ╱ Ligne · 💬 Bulle · ✥ Déplacer · ⧉ Dupliquer (tape une forme, glisse pour la placer) · 🤏 Pince pour zoomer
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
          </div>
        </div>
      )}
    </div>
  )
}

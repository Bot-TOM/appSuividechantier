import { useState } from 'react'
import { Plus, Pencil, Trash2, Map } from 'lucide-react'
import CroquisCanvas, { type CroquisStroke } from './CroquisCanvas'

// ─────────────────────────────────────────────────────────────────────────────
// CroquisManager — gère plusieurs croquis nommés (ex « Toiture bas », « haut »).
// Liste des croquis + création + renommage + suppression. L'édition se fait
// dans CroquisCanvas affiché en superposition plein écran. Le composant ne
// décide pas du stockage : il reçoit la liste et notifie via onChange.
// ─────────────────────────────────────────────────────────────────────────────

export interface CroquisDoc {
  id: string
  name: string
  strokes: CroquisStroke[]
}

interface CroquisManagerProps {
  value: CroquisDoc[]
  onChange: (docs: CroquisDoc[]) => void
}

function newId() {
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function CroquisManager({ value, onChange }: CroquisManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = value.find(d => d.id === editingId) ?? null

  function createCroquis() {
    const name = window.prompt('Nom du croquis (ex « Toiture bas »)', `Croquis ${value.length + 1}`)
    if (name === null) return
    const doc: CroquisDoc = { id: newId(), name: name.trim() || `Croquis ${value.length + 1}`, strokes: [] }
    onChange([...value, doc])
    setEditingId(doc.id)
  }

  function renameCroquis(id: string) {
    const doc = value.find(d => d.id === id)
    if (!doc) return
    const name = window.prompt('Renommer le croquis', doc.name)
    if (name === null) return
    onChange(value.map(d => (d.id === id ? { ...d, name: name.trim() || d.name } : d)))
  }

  function deleteCroquis(id: string) {
    const doc = value.find(d => d.id === id)
    if (doc && !window.confirm(`Supprimer le croquis « ${doc.name} » ?`)) return
    onChange(value.filter(d => d.id !== id))
  }

  function updateStrokes(id: string, strokes: CroquisStroke[]) {
    onChange(value.map(d => (d.id === id ? { ...d, strokes } : d)))
  }

  return (
    <div>
      {/* Liste des croquis */}
      <div className="space-y-3">
        {value.length === 0 && (
          <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl">
            <Map className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Aucun croquis pour l'instant.</p>
          </div>
        )}

        {value.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
            <button
              onClick={() => setEditingId(doc.id)}
              className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0"
              aria-label={`Ouvrir ${doc.name}`}>
              <Map className="w-6 h-6 text-orange-500" />
            </button>
            <button onClick={() => setEditingId(doc.id)} className="flex-1 text-left min-w-0">
              <div className="font-semibold text-slate-900 truncate">{doc.name}</div>
              <div className="text-xs text-slate-400 font-medium">
                {doc.strokes.length} élément{doc.strokes.length > 1 ? 's' : ''}
              </div>
            </button>
            <button onClick={() => renameCroquis(doc.id)} className="p-2 text-slate-400 hover:text-slate-600" aria-label="Renommer">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => deleteCroquis(doc.id)} className="p-2 text-slate-400 hover:text-rose-500" aria-label="Supprimer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={createCroquis}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-md shadow-orange-500/20 transition-colors">
        <Plus className="w-5 h-5" /> Nouveau croquis
      </button>

      {/* Éditeur plein écran en superposition */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <CroquisCanvas
            key={editing.id}
            title={editing.name}
            initialStrokes={editing.strokes}
            onChange={strokes => updateStrokes(editing.id, strokes)}
            onClose={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  )
}

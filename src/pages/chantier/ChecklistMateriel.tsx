import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChecklistMateriel } from '@/hooks/useChecklistMateriel'

export default function ChecklistMateriel() {
  const { id: chantierId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { items, loading, total, checked, toggleItem, addItem, deleteItem } = useChecklistMateriel(chantierId!)

  const [newItem, setNewItem] = useState('')
  const [adding, setAdding]   = useState(false)

  async function handleAdd() {
    if (!newItem.trim()) return
    setAdding(true)
    await addItem(newItem)
    setNewItem('')
    setAdding(false)
  }

  const pct = total === 0 ? 0 : Math.round((checked / total) * 100)
  const done = pct === 100 && total > 0

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chantier/${chantierId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-xl"
          >
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Matériel</h1>
            <p className="text-xs text-gray-400">{checked}/{total} articles préparés</p>
          </div>
          <div className={`text-sm font-bold px-3 py-1.5 rounded-full ${done ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
            {pct}%
          </div>
        </div>

        {/* Barre de progression dans le header */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 1rem))' }}>

        {/* Message succès si tout coché */}
        {done && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-4 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <p className="text-sm font-semibold text-green-700">Tout le matériel est prêt !</p>
          </div>
        )}

        {/* ── Liste articles ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">📦</div>
              <p className="font-semibold text-gray-700 mb-1">Aucun article</p>
              <p className="text-sm text-gray-400">Ajoutez des articles ci-dessous</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-4 min-h-[52px]">
                  <button
                    onClick={() => toggleItem(item.id, !item.checked)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      item.checked ? 'border-transparent' : 'border-gray-300'
                    }`}
                    style={item.checked ? { background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' } : undefined}
                  >
                    {item.checked && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`flex-1 text-sm font-medium ${item.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {item.nom}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ajout article ─────────────────────────────────────────────────── */}
        <div className="flex gap-2.5">
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Ajouter un article..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim() || adding}
            className="text-white px-5 py-3 rounded-xl font-bold text-lg transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
          >
            +
          </button>
        </div>

        <div className="h-2" />
      </main>
    </div>
  )
}

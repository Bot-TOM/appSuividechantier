import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
import { Search, X, Check, Users } from 'lucide-react'

interface Member {
  id: string
  name: string
  avatarUrl?: string | null
  poste?: string | null
  role?: string | null
}

interface Props {
  userId: string
  entrepriseId: string
  onClose: () => void
  onCreated: (groupId: string) => void
  onCreate: (name: string, memberIds: string[]) => Promise<{ group?: { id: string }; error?: string }>
}

export default function CreateGroupModal({ userId, entrepriseId, onClose, onCreated, onCreate }: Props) {
  const [name, setName]           = useState('')
  const [search, setSearch]       = useState('')
  const [members, setMembers]     = useState<Member[]>([])
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, poste, role')
      .eq('entreprise_id', entrepriseId)
      .neq('id', userId)
      .neq('role', 'admin')
      .then(({ data }) => {
        setMembers((data ?? []).map(p => ({
          id: p.id,
          name: p.full_name ?? '?',
          avatarUrl: p.avatar_url,
          poste: p.poste,
          role: p.role,
        })))
      })
  }, [entrepriseId, userId])

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.poste ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Donnez un nom au groupe'); return }
    if (selected.size === 0) { setError('Ajoutez au moins un membre'); return }
    setLoading(true)
    setError('')
    const result = await onCreate(name.trim(), Array.from(selected))
    setLoading(false)
    if (result.error) { setError(result.error); return }
    if (result.group) onCreated(result.group.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-500" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm">Nouveau groupe</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nom du groupe */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
            Nom du groupe
          </label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex : Équipe électriciens, Bordeaux 2025…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            maxLength={60}
          />
        </div>

        {/* Membres sélectionnés (chips) */}
        {selected.size > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            {Array.from(selected).map(id => {
              const m = members.find(x => x.id === id)
              if (!m) return null
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full hover:bg-orange-200 transition-colors"
                >
                  {m.name.split(' ')[0]}
                  <X className="w-3 h-3" />
                </button>
              )
            })}
          </div>
        )}

        {/* Recherche membres */}
        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un membre…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-slate-50"
            />
          </div>
        </div>

        {/* Liste des membres */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 min-h-0">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">Aucun membre trouvé</p>
          )}
          {filtered.map(m => {
            const isSelected = selected.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isSelected ? 'bg-orange-50' : 'hover:bg-slate-50'
                }`}
              >
                <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {m.poste ?? (m.role === 'manager' ? 'Manager' : 'Technicien')}
                  </p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-slate-100 shrink-0">
          {error && <p className="text-xs text-red-500 mb-2 text-center">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim() || selected.size === 0}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              : `Créer le groupe · ${selected.size} membre${selected.size !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

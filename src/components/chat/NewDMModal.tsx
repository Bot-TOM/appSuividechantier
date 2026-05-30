import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Avatar from '@/components/Avatar'

interface UserItem {
  id: string
  full_name: string
  avatar_url?: string | null
  poste?: string | null
  role?: string | null
}

interface Props {
  userId: string
  entrepriseId: string
  onClose: () => void
  onSelect: (otherUserId: string, name: string) => void
}

export default function NewDMModal({ userId, entrepriseId, onClose, onSelect }: Props) {
  const [users, setUsers]     = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, poste, role')
      .eq('entreprise_id', entrepriseId)
      .neq('id', userId)
      .order('full_name')
      .then(({ data }) => {
        setUsers((data ?? []) as UserItem[])
        setLoading(false)
      })
  }, [userId, entrepriseId])

  const filtered = users.filter(u =>
    !search.trim() || u.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Nouveau message</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recherche */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un collègue…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto max-h-72 py-2 px-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">
              {search ? 'Aucun résultat' : 'Aucun collègue disponible'}
            </p>
          ) : (
            filtered.map(u => (
              <button
                key={u.id}
                onClick={() => onSelect(u.id, u.full_name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-left"
              >
                <Avatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</p>
                  {(u.poste ?? u.role) && (
                    <p className="text-xs text-slate-400 truncate">{u.poste ?? u.role}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

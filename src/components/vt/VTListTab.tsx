import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useVisitesTechniques } from '@/hooks/useVisitesTechniques'
import Avatar from '@/components/Avatar'
import { VTType, VTStatut } from '@/types'

const TYPE_LABEL: Record<VTType, string> = { btoc: 'BtoC', btob: 'BtoB' }
const TYPE_COLOR: Record<VTType, string> = {
  btoc: 'bg-purple-50 text-purple-700 border border-purple-200',
  btob: 'bg-blue-50 text-blue-700 border border-blue-200',
}
const STATUT_LABEL: Record<VTStatut, string> = {
  brouillon: 'Brouillon',
  complete: 'Complété',
  valide: 'Validé',
}
const STATUT_COLOR: Record<VTStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  complete: 'bg-blue-50 text-blue-700',
  valide: 'bg-emerald-50 text-emerald-700',
}

export default function VTListTab({ userId: _userId, isManager: _isManager }: { userId: string; isManager: boolean }) {
  const { vts, loading } = useVisitesTechniques()
  const navigate = useNavigate()
  const [filterType, setFilterType] = useState<VTType | 'tous'>('tous')
  const [filterStatut, setFilterStatut] = useState<VTStatut | 'tous'>('tous')

  const filtered = vts.filter(v => {
    if (filterType !== 'tous' && v.type !== filterType) return false
    if (filterStatut !== 'tous' && v.statut !== filterStatut) return false
    return true
  })

  return (
    <div className="space-y-6 pb-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-xl">
            <ClipboardList className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-900">Visites Techniques</h2>
            <p className="text-sm text-slate-500">{vts.length} visite{vts.length !== 1 ? 's' : ''} au total</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/vt/nouvelle')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Nouvelle VT
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        {/* Filtre type */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['tous', 'btoc', 'btob'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'tous' ? 'Tous types' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {/* Filtre statut */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['tous', 'brouillon', 'complete', 'valide'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatut === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'tous' ? 'Tous statuts' : STATUT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mr-3" />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <ClipboardList className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium">Aucune visite technique trouvée</p>
          <p className="text-xs text-slate-400">
            {vts.length === 0
              ? 'Créez votre première VT pour commencer'
              : 'Modifiez les filtres pour voir plus de résultats'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(vt => (
            <button
              key={vt.id}
              onClick={() => navigate(`/vt/${vt.id}`)}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all text-left relative overflow-hidden group"
            >
              {/* Barre colorée en haut */}
              <div className={`absolute top-0 left-0 w-full h-1 ${
                vt.statut === 'valide' ? 'bg-emerald-400' :
                vt.statut === 'complete' ? 'bg-blue-400' :
                'bg-slate-200'
              }`} />

              <div className="p-5 pt-6">
                {/* En-tête de la card */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-orange-600 transition-colors">
                      {vt.client_nom ?? 'Sans titre'}
                    </h3>
                    {vt.client_adresse && (
                      <p className="text-sm text-slate-500 truncate mt-0.5">{vt.client_adresse}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${TYPE_COLOR[vt.type]}`}>
                    {TYPE_LABEL[vt.type]}
                  </span>
                </div>

                {/* Méta */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  {/* Technicien */}
                  {vt.profiles && (
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={vt.profiles.full_name}
                        avatarUrl={vt.profiles.avatar_url}
                        size="sm"
                      />
                      <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">
                        {vt.profiles.full_name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Date */}
                    <span className="text-xs text-slate-400">
                      {new Date(vt.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                    {/* Badge statut */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${STATUT_COLOR[vt.statut]}`}>
                      {STATUT_LABEL[vt.statut]}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

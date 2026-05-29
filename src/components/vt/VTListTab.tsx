import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, FileEdit, FileCheck, CheckCircle2, Search } from 'lucide-react'
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
  complete: 'Complète',
  valide: 'Validée',
}
const STATUT_COLOR: Record<VTStatut, string> = {
  brouillon: 'bg-gray-100 text-gray-600',
  complete: 'bg-blue-50 text-blue-700',
  valide: 'bg-emerald-50 text-emerald-700',
}

export default function VTListTab({ userId: _userId, isManager: _isManager }: { userId: string; isManager: boolean }) {
  const { vts, loading } = useVisitesTechniques()
  const navigate = useNavigate()
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState<VTType | 'tous'>('tous')
  const [filterStatut, setFilterStatut] = useState<VTStatut | 'tous'>('tous')

  const kpis = [
    {
      label: 'Total VT',
      value: vts.length,
      sub: 'Sur la période',
      border: 'border-l-slate-800',
      icon: <ClipboardList className="w-5 h-5 text-slate-700" />,
      iconBg: 'bg-slate-100',
    },
    {
      label: 'Brouillons',
      value: vts.filter(v => v.statut === 'brouillon').length,
      sub: 'En cours de rédaction',
      border: 'border-l-amber-400',
      icon: <FileEdit className="w-5 h-5 text-amber-600" />,
      iconBg: 'bg-amber-50',
    },
    {
      label: 'Complètes',
      value: vts.filter(v => v.statut === 'complete').length,
      sub: 'En attente de validation',
      border: 'border-l-blue-500',
      icon: <FileCheck className="w-5 h-5 text-blue-600" />,
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Validées',
      value: vts.filter(v => v.statut === 'valide').length,
      sub: 'Prêtes pour chantier',
      border: 'border-l-emerald-500',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      iconBg: 'bg-emerald-50',
    },
  ]

  const filtered = vts.filter(v => {
    if (filterType !== 'tous' && v.type !== filterType) return false
    if (filterStatut !== 'tous' && v.statut !== filterStatut) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const nomProjet = (v.data as Record<string, unknown>)?.['nom_projet'] as string | undefined
      if (
        !nomProjet?.toLowerCase().includes(q) &&
        !v.client_nom?.toLowerCase().includes(q) &&
        !v.client_adresse?.toLowerCase().includes(q) &&
        !v.profiles?.full_name?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="space-y-6 pb-8">

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 border-l-4 ${kpi.border} hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default relative overflow-hidden group`}
          >
            <div className="absolute -right-3 -bottom-3 opacity-[0.04] group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500 pointer-events-none">
              {React.cloneElement(kpi.icon as React.ReactElement, { className: 'w-28 h-28' })}
            </div>
            <div className="flex justify-between items-start mb-5 relative z-10">
              <div className={`p-2.5 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
            </div>
            <div className="relative z-10">
              <p className="text-4xl font-black text-slate-800 tracking-tight">{kpi.value}</p>
              <h3 className="text-sm font-bold text-slate-700 mt-1">{kpi.label}</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Barre de recherche + bouton nouvelle VT ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une VT (client, adresse, technicien)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-slate-400"
          />
        </div>
        <button
          onClick={() => navigate('/vt/nouvelle')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.35)' }}
        >
          <Plus className="w-4 h-4" />
          Nouvelle VT
        </button>
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
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

      {/* ── Liste ────────────────────────────────────────────────────────────── */}
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
              <div className={`absolute top-0 left-0 w-full h-1 ${
                vt.statut === 'valide'   ? 'bg-emerald-400' :
                vt.statut === 'complete' ? 'bg-blue-400' :
                'bg-slate-200'
              }`} />
              <div className="p-5 pt-6">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-orange-600 transition-colors">
                      {(vt.data as Record<string, unknown>)?.['nom_projet'] as string || vt.client_nom || 'Sans titre'}
                    </h3>
                    {vt.client_adresse && (
                      <p className="text-sm text-slate-500 truncate mt-0.5">{vt.client_adresse}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0 ${TYPE_COLOR[vt.type]}`}>
                    {TYPE_LABEL[vt.type]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  {vt.profiles && (
                    <div className="flex items-center gap-2">
                      <Avatar name={vt.profiles.full_name} avatarUrl={vt.profiles.avatar_url} size="sm" />
                      <span className="text-xs text-slate-600 font-medium truncate max-w-[100px]">
                        {vt.profiles.full_name}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-slate-400">
                      {new Date(vt.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
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

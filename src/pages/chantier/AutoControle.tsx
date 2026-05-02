import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAutoControle, initChecks } from '@/hooks/useAutoControle'
import { AutoControleCheck } from '@/types'

export default function AutoControlePage() {
  const { id: chantierId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { autocontrole, loading, save, signer } = useAutoControle(chantierId!)

  const [checks, setChecks]           = useState<AutoControleCheck[]>(initChecks())
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving]           = useState(false)
  const [signing, setSigning]         = useState(false)
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  useEffect(() => {
    if (autocontrole) {
      setChecks(autocontrole.checks)
      setCommentaire(autocontrole.commentaire ?? '')
    }
  }, [autocontrole])

  const isSigne = !!autocontrole?.signe_le
  const categories = useMemo(() => [...new Set(checks.map(c => c.categorie))], [checks])
  const totalChecked = checks.filter(c => c.checked).length
  const pct = Math.round((totalChecked / checks.length) * 100)

  function toggleCheck(id: string) {
    if (isSigne) return
    setChecks(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  function setCheckCommentaire(id: string, value: string) {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, commentaire: value } : c))
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    await save(checks, commentaire, profile.id)
    setSaving(false)
  }

  async function handleSigner() {
    if (!profile) return
    setSigning(true)
    await signer(checks, commentaire, profile.id)
    setSigning(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/chantier/${chantierId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-xl flex-shrink-0"
          >←</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">Fiche auto-contrôle</h1>
            {isSigne && (
              <p className="text-xs text-green-600 font-medium">
                Signée le {new Date(autocontrole!.signe_le!).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {isSigne && (
            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Signée
            </span>
          )}
        </div>

        {/* Barre de progression */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{totalChecked}/{checks.length} points validés</span>
            <span className={`font-bold ${pct === 100 ? 'text-green-600' : 'text-orange-500'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-8">

        {/* Sections par catégorie */}
        {categories.map(categorie => {
          const items = checks.filter(c => c.categorie === categorie)
          const catChecked = items.filter(c => c.checked).length
          return (
            <section key={categorie} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 text-sm">{categorie}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  catChecked === items.length ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}>{catChecked}/{items.length}</span>
              </div>

              <div className="divide-y divide-gray-50">
                {items.map(check => (
                  <div key={check.id}>
                    <div
                      className={`px-4 py-3.5 flex items-center gap-3 ${!isSigne ? 'cursor-pointer active:bg-gray-50' : ''}`}
                      onClick={() => !isSigne && toggleCheck(check.id)}
                    >
                      {/* Checkbox */}
                      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                        check.checked
                          ? 'bg-orange-500'
                          : 'border-2 border-gray-200'
                      }`}>
                        {check.checked && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <span className={`flex-1 text-sm ${check.checked ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                        {check.label}
                      </span>

                      {/* Toggle commentaire */}
                      {!isSigne && (
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedId(expandedId === check.id ? null : check.id) }}
                          className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors flex-shrink-0 ${
                            check.commentaire ? 'text-orange-400 bg-orange-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Commentaire inline */}
                    {(expandedId === check.id || (isSigne && check.commentaire)) && (
                      <div className="px-4 pb-3 pl-[52px]">
                        {isSigne
                          ? <p className="text-xs text-gray-500 italic">{check.commentaire}</p>
                          : <input
                              autoFocus
                              value={check.commentaire}
                              onChange={e => setCheckCommentaire(check.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              placeholder="Commentaire (optionnel)..."
                              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-600 placeholder-gray-300 bg-gray-50"
                            />
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {/* Commentaire général */}
        <section className="bg-white rounded-2xl p-4 space-y-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 className="font-semibold text-gray-900 text-sm">Observations générales</h2>
          {isSigne
            ? <p className="text-sm text-gray-600 leading-relaxed">{commentaire || <span className="text-gray-400 italic">Aucune observation</span>}</p>
            : <textarea
                value={commentaire}
                onChange={e => setCommentaire(e.target.value)}
                placeholder="Remarques, réserves, informations complémentaires..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
          }
        </section>

        {/* Actions */}
        {!isSigne && (
          <div className="space-y-2.5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full border border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl hover:bg-gray-50 transition-colors text-sm bg-white disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder le brouillon'}
            </button>

            <button
              onClick={handleSigner}
              disabled={signing || totalChecked === 0}
              className="w-full text-white font-semibold py-4 rounded-2xl transition-all disabled:opacity-50 text-sm"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
            >
              {signing
                ? 'Signature en cours...'
                : `Signer la fiche (${totalChecked}/${checks.length} points)`
              }
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

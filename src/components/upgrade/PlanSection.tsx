import { useState } from 'react'
import { usePlan } from '@/hooks/usePlan'
import { useAuth } from '@/contexts/AuthContext'
import UpgradeModal from './UpgradeModal'

const CHECK   = <span className="text-emerald-500 font-bold">✓</span>
const CROSS   = <span className="text-slate-300 font-bold">✗</span>

const FEATURES = [
  { label: 'Chantiers illimités',      starter: '3 max',  pro: true  },
  { label: 'Techniciens illimités',    starter: '3 max',  pro: true  },
  { label: 'Rapport vocal IA',         starter: false,    pro: true  },
  { label: 'Import planning Excel',    starter: false,    pro: true  },
  { label: 'Récap hebdo automatique',  starter: true,     pro: true  },
  { label: 'PWA (app mobile)',         starter: true,     pro: true  },
]

export default function PlanSection() {
  const { isPro, hasStripeSubscription, loading } = usePlan()
  const { session } = useAuth()
  const [upgradeOpen, setUpgradeOpen]   = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError]     = useState<string | null>(null)

  async function handlePortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res  = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) { setPortalError(data.error ?? 'Erreur'); setPortalLoading(false); return }
      window.location.href = data.url
    } catch {
      setPortalError('Impossible de contacter le serveur.')
      setPortalLoading(false)
    }
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div className={`px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex items-center justify-between ${isPro ? 'bg-gradient-to-r from-orange-50 to-amber-50' : ''}`}>
        <div>
          <h2 className="text-base font-semibold text-slate-800">Mon abonnement</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isPro
              ? hasStripeSubscription ? 'Plan Pro actif — facturation mensuelle' : 'Plan Pro (offert)'
              : 'Plan Starter — gratuit'}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
          isPro
            ? 'bg-orange-100 text-orange-700 border-orange-200'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}>
          {isPro ? '⚡ Pro' : 'Starter'}
        </span>
      </div>

      {/* Tableau features */}
      <div className="px-5 sm:px-6 py-4 space-y-2.5">
        {FEATURES.map(({ label, starter, pro }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{label}</span>
            <span className={isPro ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
              {isPro
                ? (pro === true ? CHECK : CROSS)
                : (starter === true ? CHECK : starter === false ? CROSS : <span className="text-slate-400 text-xs">{starter}</span>)
              }
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-5 sm:px-6 pb-5 pt-2">
        {isPro && hasStripeSubscription ? (
          <>
            {portalError && <p className="text-red-500 text-xs mb-2">{portalError}</p>}
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {portalLoading ? 'Redirection...' : 'Gérer mon abonnement →'}
            </button>
          </>
        ) : isPro ? (
          <div className="text-center text-xs text-slate-400 py-2">
            Plan Pro activé manuellement — aucune facturation
          </div>
        ) : (
          <button
            onClick={() => setUpgradeOpen(true)}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
          >
            Passer au Pro — 49€/mois
          </button>
        )}
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="general" />
    </div>
  )
}

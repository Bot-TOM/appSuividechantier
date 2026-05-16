import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

export type UpgradeReason = 'chantiers' | 'users' | 'voice' | 'excel'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  reason: UpgradeReason
}

const REASON_MESSAGES: Record<UpgradeReason, { title: string; description: string }> = {
  chantiers: {
    title: 'Limite de chantiers atteinte',
    description: 'Limite de 3 chantiers atteinte sur le plan Starter. Passez au Pro pour créer des chantiers en illimité.',
  },
  users: {
    title: 'Limite d\'utilisateurs atteinte',
    description: 'Limite de 3 utilisateurs atteinte sur le plan Starter. Passez au Pro pour inviter autant de techniciens que vous voulez.',
  },
  voice: {
    title: 'Fonctionnalité Pro',
    description: 'Le rapport vocal IA est disponible sur le plan Pro. Passez au Pro pour dicter vos rapports de chantier.',
  },
  excel: {
    title: 'Fonctionnalité Pro',
    description: "L'import planning Excel est disponible sur le plan Pro. Passez au Pro pour importer vos plannings depuis Excel.",
  },
}

export default function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const { title, description } = REASON_MESSAGES[reason]

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Une erreur est survenue')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Impossible de contacter le serveur. Vérifiez votre connexion.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header orange */}
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
              <p className="text-orange-100 text-sm">ChantierPV Pro</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed mb-4">{description}</p>

          {/* Avantages Pro */}
          <div className="bg-orange-50 rounded-xl p-4 mb-5 space-y-2">
            <p className="text-orange-800 font-semibold text-sm mb-2">Plan Pro — 49€/mois</p>
            {[
              'Chantiers illimités',
              'Utilisateurs illimités',
              'Rapport vocal IA',
              'Import planning Excel',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <span className="text-orange-500 text-sm">✓</span>
                <span className="text-gray-700 text-sm">{feature}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-opacity"
              style={{
                background: loading
                  ? '#d1d5db'
                  : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Redirection...' : 'Passer au Pro — 49€/mois'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full py-2 rounded-xl text-gray-500 text-sm hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

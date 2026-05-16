import { useNavigate } from 'react-router-dom'

export default function UpgradeSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Bienvenue sur ChantierPV Pro !
        </h1>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Votre abonnement Pro est maintenant actif. Profitez de toutes les fonctionnalités
          sans limite : chantiers illimités, rapport vocal IA, import Excel et bien plus.
        </p>

        <div className="bg-orange-50 rounded-xl p-4 mb-6 text-left space-y-2">
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

        <button
          onClick={() => navigate('/manager')}
          className="w-full py-3 rounded-xl font-semibold text-white text-sm"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
        >
          Accéder au tableau de bord
        </button>
      </div>
    </div>
  )
}

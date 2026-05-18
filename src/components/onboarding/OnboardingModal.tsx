import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─── Données des écrans ───────────────────────────────────────────────────────

const FEATURES = [
  {
    emoji: '📋',
    label: 'Suivi chantier étape par étape',
    desc: 'Chaque chantier avance en temps réel. Vos techniciens valident les étapes depuis le terrain.',
    pro: false,
  },
  {
    emoji: '👥',
    label: 'Gestion de votre équipe',
    desc: 'Créez les comptes de vos techniciens, gérez leurs permissions et suivez leur activité.',
    pro: false,
  },
  {
    emoji: '🎙️',
    label: 'Rapport vocal IA',
    desc: 'Dictez un compte-rendu terrain en quelques secondes. L\'IA rédige le rapport automatiquement.',
    pro: true,
  },
  {
    emoji: '📅',
    label: 'Import planning IA',
    desc: 'Importez votre planning Excel ou décrivez-le — l\'IA le retranscrit directement dans l\'app.',
    pro: true,
  },
  {
    emoji: '📆',
    label: 'Planning équipe visuel',
    desc: 'Vue semaine et mois pour planifier l\'ensemble de votre équipe en un coup d\'œil.',
    pro: false,
  },
  {
    emoji: '📊',
    label: 'Récap hebdo automatique',
    desc: 'Chaque lundi matin, un email récapitulatif de la semaine passée est envoyé à toute votre équipe.',
    pro: false,
  },
]

const STEPS = [
  {
    num: '1',
    color: 'from-orange-500 to-orange-400',
    label: 'Créez votre premier chantier',
    desc: 'Client, adresse, type d\'installation, panneaux, date prévue.',
    action: 'Créer un chantier →',
    route: '/manager/nouveau-chantier',
  },
  {
    num: '2',
    color: 'from-emerald-500 to-emerald-400',
    label: 'Invitez vos techniciens',
    desc: 'Depuis l\'onglet Équipe — ils reçoivent leurs identifiants par email.',
    action: 'Gérer l\'équipe →',
    route: null,
    tab: 'equipe',
  },
  {
    num: '3',
    color: 'from-blue-500 to-blue-400',
    label: 'Planifiez votre semaine',
    desc: 'Assignez vos techniciens aux chantiers sur le planning hebdomadaire.',
    action: 'Voir le planning →',
    route: null,
    tab: 'planning',
  },
]

// ─── Composant ────────────────────────────────────────────────────────────────

interface OnboardingModalProps {
  onClose: (tab?: string) => void
}

export default function OnboardingModal({ onClose }: OnboardingModalProps) {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0) // 0 = bienvenue, 1 = features, 2 = démarrer

  async function markDone() {
    if (profile?.id) {
      await supabase.from('profiles').update({ onboarding_done: true }).eq('id', profile.id)
      await refreshProfile()
    }
  }

  async function handleSkip() {
    await markDone()
    onClose()
  }

  async function handleAction(route: string | null, tab?: string) {
    await markDone()
    if (route) {
      onClose()
      navigate(route)
    } else {
      onClose(tab)
    }
  }

  async function handleFinish() {
    await markDone()
    onClose()
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'vous'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">

        {/* Barre de progression */}
        <div className="flex gap-1.5 px-6 pt-5">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-orange-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* ── Écran 1 : Bienvenue ──────────────────────────────────────────── */}
        {step === 0 && (
          <div className="px-6 pt-6 pb-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 8px 24px rgba(249,115,22,0.35)' }}>
                ☀️
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                Bienvenue {firstName} !
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                Votre espace <strong className="text-gray-700">ChantierPV</strong> est prêt.
                En moins de 5 minutes, vous pilotez votre premier chantier depuis votre téléphone.
              </p>
            </div>

            {/* Points clés */}
            <div className="space-y-3 mb-8">
              {[
                { icon: '📱', text: '100% mobile — fonctionne partout sur le terrain' },
                { icon: '🤖', text: 'IA intégrée — rapports et planning automatisés' },
                { icon: '⚡', text: 'Temps réel — vos techniciens connectés instantanément' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3">
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <span className="text-sm font-medium text-gray-700">{text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)', boxShadow: '0 6px 20px rgba(249,115,22,0.4)' }}
            >
              Découvrir les fonctionnalités →
            </button>
            <button onClick={handleSkip} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Passer
            </button>
          </div>
        )}

        {/* ── Écran 2 : Fonctionnalités ────────────────────────────────────── */}
        {step === 1 && (
          <div className="px-6 pt-6 pb-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Ce que vous pouvez faire</h2>
              <p className="text-sm text-gray-500">Un tour complet des fonctionnalités de l'app.</p>
            </div>

            <div className="space-y-3 mb-8 max-h-72 overflow-y-auto pr-1">
              {FEATURES.map(({ emoji, label, desc, pro }) => (
                <div key={label} className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{label}</span>
                      {pro && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-600 border border-orange-200">
                          ⚡ Pro
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                ← Retour
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >
                Par où commencer →
              </button>
            </div>
            <button onClick={handleSkip} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Passer
            </button>
          </div>
        )}

        {/* ── Écran 3 : Par où commencer ───────────────────────────────────── */}
        {step === 2 && (
          <div className="px-6 pt-6 pb-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Par où commencer ?</h2>
              <p className="text-sm text-gray-500">3 actions pour être opérationnel en 5 minutes.</p>
            </div>

            <div className="space-y-3 mb-8">
              {STEPS.map(({ num, color, label, desc, action, route, tab }) => (
                <button
                  key={num}
                  onClick={() => handleAction(route, tab)}
                  className="w-full flex items-center gap-4 bg-gray-50 hover:bg-orange-50 border border-transparent hover:border-orange-100 rounded-2xl px-4 py-4 text-left transition-all group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0 bg-gradient-to-br ${color}`}>
                    {num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-orange-700 transition-colors">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                  <span className="text-xs font-semibold text-orange-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {action}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                ← Retour
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
              >
                C'est parti ! ✓
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { useState } from 'react'

// ── Données ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '📋',
    title: 'Suivi des étapes en temps réel',
    desc: 'Chaque étape validée depuis le terrain avec photo. Le manager voit l\'avancement instantanément.',
  },
  {
    icon: '💬',
    title: 'Chat d\'équipe intégré',
    desc: 'Messages texte, photos, messages vocaux. Tout reste attaché au chantier, rien ne se perd.',
  },
  {
    icon: '📄',
    title: 'Rapport PDF automatique',
    desc: 'Généré en un clic depuis les données terrain. Signé, daté, prêt à envoyer au client.',
  },
  {
    icon: '⚠️',
    title: 'Gestion des anomalies',
    desc: 'Déclarez et suivez les problèmes avec photo et niveau de gravité. Résolution tracée.',
  },
  {
    icon: '🔔',
    title: 'Notifications push',
    desc: 'Restez informé en temps réel des blocages, validations et nouveaux rapports.',
  },
  {
    icon: '📊',
    title: 'Tableau de bord manager',
    desc: 'Vue globale de tous vos chantiers : avancement, alertes, anomalies ouvertes.',
  },
]

const STEPS = [
  {
    num: '1',
    title: 'Le manager prépare le chantier',
    desc: 'Création du chantier, assignation de l\'équipe, ajout des documents et de la checklist matériel.',
  },
  {
    num: '2',
    title: 'Les techniciens suivent depuis le terrain',
    desc: 'Application mobile, saisie en moins de 30 secondes par étape, photos, chat, signalement d\'anomalies.',
  },
  {
    num: '3',
    title: 'Le rapport se génère automatiquement',
    desc: 'Toutes les données collectées sur le terrain alimentent un rapport PDF professionnel en un clic.',
  },
]

const PRICING = [
  {
    name: 'Starter',
    price: 'Gratuit',
    sub: 'Pour démarrer',
    color: 'border-gray-200',
    badge: null,
    features: [
      '1 chantier actif',
      '3 utilisateurs',
      'Suivi des étapes',
      'Chat d\'équipe',
      'Rapport PDF basique',
    ],
    cta: 'Commencer gratuitement',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '49€',
    sub: '/mois · facturation mensuelle',
    color: 'border-orange-400',
    badge: 'Recommandé',
    features: [
      'Chantiers illimités',
      '10 utilisateurs',
      'Toutes les fonctionnalités',
      'Export Excel & PDF avancé',
      'Notifications push',
      'Gestion des anomalies',
      'Auto-contrôle terrain',
    ],
    cta: 'Essayer 14 jours gratuits',
    ctaStyle: 'text-white',
    ctaGradient: true,
    href: '/signup',
  },
  {
    name: 'Business',
    price: '99€',
    sub: '/mois · facturation mensuelle',
    color: 'border-gray-200',
    badge: null,
    features: [
      'Utilisateurs illimités',
      'Chantiers illimités',
      'Tout ce qu\'inclut Pro',
      'Support prioritaire',
      'Onboarding personnalisé',
      'Facturation annuelle disponible',
    ],
    cta: 'Contacter l\'équipe',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    href: 'mailto:contact@pvpilot.app',
  },
]

const FAQS = [
  {
    q: 'Faut-il se former pour utiliser PVPilot ?',
    a: 'Non. L\'interface a été conçue pour des techniciens terrain qui n\'ont pas le temps de se former. Saisie en moins de 30 secondes, parcours guidé, zéro jargon informatique.',
  },
  {
    q: 'Ça fonctionne sans connexion internet ?',
    a: 'PVPilot est une Progressive Web App : elle se charge même sur une connexion lente. La synchronisation se fait dès que le réseau revient.',
  },
  {
    q: 'Mes données sont-elles sécurisées ?',
    a: 'Oui. Les données sont hébergées sur infrastructure européenne (Supabase), chiffrées en transit et au repos. Chaque entreprise a ses propres données isolées.',
  },
  {
    q: 'Puis-je importer mon équipe et mes chantiers existants ?',
    a: 'Oui. Vous pouvez créer vos techniciens directement depuis l\'interface manager. L\'import de chantiers via Excel est disponible sur le plan Pro.',
  },
]

// ── Composant Mockup téléphone ────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 260 }}>
      {/* Téléphone */}
      <div className="rounded-[2.5rem] bg-gray-900 p-2 shadow-2xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <div className="rounded-[2rem] overflow-hidden bg-[#F8FAFC]" style={{ height: 520 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-white">
            <span className="text-[10px] font-semibold text-gray-700">9:41</span>
            <div className="w-16 h-4 rounded-full bg-gray-900 mx-auto" />
            <div className="flex gap-1 items-center">
              <div className="w-3 h-2 rounded-sm bg-gray-700" />
              <div className="w-1 h-1 rounded-full bg-gray-700" />
            </div>
          </div>

          {/* Header app */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>☀️</div>
              <span className="font-bold text-gray-900 text-sm">PVPilot</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">T</div>
          </div>

          {/* Contenu */}
          <div className="px-3 py-3 space-y-2.5 overflow-hidden" style={{ height: 440 }}>
            {/* Titre chantier */}
            <div>
              <p className="text-[11px] text-gray-400">Chantier en cours</p>
              <p className="text-sm font-bold text-gray-900">Résidence Les Pins — 12 kWc</p>
            </div>

            {/* Barre progression */}
            <div className="bg-white rounded-xl p-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
                <span>Progression</span>
                <span className="font-bold text-orange-500">75%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-orange-500" style={{ width: '75%' }} />
              </div>
            </div>

            {/* Étapes */}
            {[
              { label: 'Pose de la structure', done: true },
              { label: 'Câblage DC', done: true },
              { label: 'Raccordement onduleur', done: true },
              { label: 'Mise en service', done: false, active: true },
              { label: 'Test de production', done: false },
            ].map((step, i) => (
              <div key={i} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${step.active ? 'bg-orange-50 border border-orange-200' : 'bg-white'}`}
                style={!step.active ? { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : {}}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                  step.done ? 'bg-green-500 text-white' :
                  step.active ? 'border-2 border-orange-400 bg-white' :
                  'bg-gray-100'
                }`}>
                  {step.done ? '✓' : step.active ? '' : ''}
                </div>
                <span className={`text-xs ${step.done ? 'text-gray-400 line-through' : step.active ? 'font-semibold text-orange-600' : 'text-gray-600'}`}>
                  {step.label}
                </span>
              </div>
            ))}

            {/* Bouton action */}
            <button className="w-full text-white text-xs font-bold py-2.5 rounded-xl mt-1"
              style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
              ✓ Valider l'étape
            </button>
          </div>
        </div>
      </div>

      {/* Notification flottante */}
      <div className="absolute -top-3 -right-8 bg-white rounded-2xl px-3 py-2 shadow-xl border border-gray-100 flex items-center gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
        <span className="text-sm">📸</span>
        <div>
          <p className="text-[10px] font-bold text-gray-800">Photo ajoutée</p>
          <p className="text-[9px] text-gray-400">Étape validée ✓</p>
        </div>
      </div>

      {/* Badge chat */}
      <div className="absolute -bottom-2 -left-10 bg-white rounded-2xl px-3 py-2 shadow-xl border border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs">💬</div>
        <div>
          <p className="text-[10px] font-bold text-gray-800">Manager</p>
          <p className="text-[9px] text-gray-400">RAS, continuez 👍</p>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shadow-sm"
              style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
              ☀️
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">PVPilot</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Fonctionnalités</a>
            <a href="#how" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Comment ça marche</a>
            <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Tarifs</a>
            <a href="#faq" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Se connecter
            </Link>
            <Link to="/signup"
              className="text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 2px 8px rgba(249,115,22,0.35)' }}>
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32"
        style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFFFFF 50%)' }}>

        {/* Cercles décoratifs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #F97316, transparent)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #EA580C, transparent)', transform: 'translate(-30%, 30%)' }} />

        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">

            {/* Texte */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Conçu par un installateur PV, pour les installateurs PV
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
                Pilotez vos chantiers
                <span className="block" style={{ WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text', backgroundImage: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
                  photovoltaïques.
                </span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                Suivi terrain en temps réel, rapports PDF automatiques, chat d'équipe,
                gestion des anomalies. Tout ce dont votre entreprise a besoin,
                dans une seule application mobile.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link to="/signup"
                  className="text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all hover:opacity-90 text-center"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
                  Essayer gratuitement →
                </Link>
                <a href="#how"
                  className="bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-gray-50 transition-colors text-center"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  Voir comment ça marche
                </a>
              </div>

              {/* Micro-preuves */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 justify-center lg:justify-start">
                {[
                  { icon: '⚡', text: 'Saisie < 30 sec' },
                  { icon: '📱', text: 'Mobile-first, PWA' },
                  { icon: '🔒', text: 'Données sécurisées EU' },
                  { icon: '🆓', text: 'Gratuit pour démarrer' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-1.5 text-sm text-gray-400">
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup */}
            <div className="flex-shrink-0 flex items-center justify-center py-8">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Bande de confiance ────────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
            Pensé pour les équipes qui travaillent sur le terrain
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: '< 30s', label: 'de saisie par étape' },
              { num: '100%', label: 'mobile, fonctionne partout' },
              { num: '1 clic', label: 'pour générer le rapport PDF' },
              { num: '0', label: 'formation requise' },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-3xl font-bold text-gray-900 mb-1">{item.num}</p>
                <p className="text-sm text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-semibold text-sm mb-3">Fonctionnalités</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont votre entreprise a besoin
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Une seule app pour le manager au bureau et les techniciens sur le terrain.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-orange-200 hover:shadow-md transition-all"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────────────────────────── */}
      <section id="how" className="py-24" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #F8FAFC 100%)' }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-semibold text-sm mb-3">Comment ça marche</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Opérationnel en 5 minutes
            </h2>
          </div>

          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
                  {step.num}
                </div>
                <div className="flex-1 bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                  <h3 className="font-bold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-semibold text-sm mb-3">Tarifs</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple et transparent
            </h2>
            <p className="text-gray-500">Sans engagement. Annulez à tout moment.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map(plan => (
              <div key={plan.name}
                className={`rounded-2xl border-2 ${plan.color} p-6 relative ${plan.badge ? 'ring-2 ring-orange-400 ring-offset-2' : ''}`}
                style={{ boxShadow: plan.badge ? '0 8px 30px rgba(249,115,22,0.15)' : '0 1px 4px rgba(0,0,0,0.06)' }}>

                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <p className="font-bold text-gray-900 text-lg mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{plan.sub}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.href.startsWith('mailto') ? (
                  <a href={plan.href}
                    className={`block w-full text-center font-semibold py-3 rounded-xl text-sm transition-all ${plan.ctaStyle}`}
                    style={plan.ctaGradient ? { background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' } : {}}>
                    {plan.cta}
                  </a>
                ) : (
                  <Link to={plan.href}
                    className={`block w-full text-center font-semibold py-3 rounded-xl text-sm transition-all ${plan.ctaStyle}`}
                    style={plan.ctaGradient ? { background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' } : {}}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24" style={{ background: '#F8FAFC' }}>
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-orange-500 font-semibold text-sm mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-gray-900">Questions fréquentes</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 border-t border-gray-50">
                    <p className="text-sm text-gray-500 leading-relaxed pt-3">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white, transparent), radial-gradient(circle at 80% 50%, white, transparent)' }} />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <div className="text-5xl mb-6">☀️</div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Prêt à moderniser la gestion de vos chantiers ?
          </h2>
          <p className="text-orange-100 mb-8 text-lg">
            Rejoignez les installateurs PV qui ont dit adieu aux tableaux Excel et aux appels terrain.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup"
              className="bg-white font-bold px-8 py-4 rounded-xl text-sm transition-all hover:bg-orange-50"
              style={{ color: '#EA580C' }}>
              Commencer gratuitement →
            </Link>
            <a href="mailto:contact@pvpilot.app"
              className="border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-xl text-sm hover:bg-white/10 transition-colors">
              Demander une démo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)' }}>☀️</div>
                <span className="font-bold text-white">PVPilot</span>
              </div>
              <p className="text-sm max-w-xs leading-relaxed">
                La solution de pilotage de chantiers photovoltaïques
                conçue par et pour les installateurs.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-semibold text-white mb-3">Produit</p>
                <ul className="space-y-2">
                  <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                  <li><Link to="/signup" className="hover:text-white transition-colors">Inscription</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-3">Support</p>
                <ul className="space-y-2">
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                  <li><a href="mailto:contact@pvpilot.app" className="hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-3">Légal</p>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-white transition-colors">CGU</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs">© 2025 PVPilot · Tous droits réservés</p>
            <p className="text-xs">Fait avec ☀️ pour les installateurs PV</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

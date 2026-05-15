import { Link } from 'react-router-dom'
import { useState } from 'react'
import Logo from '@/components/Logo'

// ── Données ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: '📅',
    title: 'Planning équipe & feuille d\'heures',
    desc: 'Grille semaine par technicien, types d\'activité (Chantier, Dépôt, Route, Congés…), saisie arrivée/départ/pause et export Excel.',
  },
  {
    icon: '📋',
    title: 'Suivi des étapes en temps réel',
    desc: 'Chaque étape validée depuis le terrain avec photos. Auto-contrôle par catégorie avec signature. Le manager voit l\'avancement instantanément.',
  },
  {
    icon: '💬',
    title: 'Chat intégré chantier & équipe',
    desc: 'Messagerie par chantier avec mentions @, réactions, statut en ligne. Chat global pour toute l\'équipe, isolé par entreprise.',
  },
  {
    icon: '📄',
    title: 'Rapport PDF automatique',
    desc: 'Généré en 1 clic depuis les données terrain. Personnalisable par section, photos pleine largeur, prêt à envoyer au client.',
  },
  {
    icon: '⚠️',
    title: 'Gestion des anomalies',
    desc: 'Signalez et suivez les problèmes avec photo et niveau de gravité. Résolution tracée, vue globale pour le manager.',
  },
  {
    icon: '🔔',
    title: 'Notifications push intelligentes',
    desc: 'Anomalies, rapports terrain, statuts chantier, messages — chaque utilisateur choisit ce qu\'il reçoit sur son appareil.',
  },
]

const HIGHLIGHTS = [
  {
    badge: 'IA',
    badgeColor: 'bg-purple-100 text-purple-700',
    title: 'Import matériel par Excel ou photo',
    desc: 'Prenez en photo votre liste de matériel ou importez un fichier Excel — l\'IA extrait automatiquement les noms et quantités pour pré-remplir la checklist.',
    icon: '🤖',
  },
  {
    badge: 'Multi-entreprise',
    badgeColor: 'bg-blue-100 text-blue-700',
    title: 'Isolation totale des données',
    desc: 'Chaque entreprise a ses propres données, équipes et chantiers parfaitement isolés. Prêt pour une utilisation SaaS multi-tenant.',
    icon: '🏢',
  },
  {
    badge: 'Terrain',
    badgeColor: 'bg-green-100 text-green-700',
    title: 'Auto-contrôle qualité',
    desc: 'Formulaire d\'auto-contrôle par catégorie (électrique, mécanique, sécurité…) avec signature numérique intégrée au rapport PDF.',
    icon: '✅',
  },
]

const STEPS = [
  {
    num: '1',
    title: 'Le manager prépare le chantier',
    desc: 'Création du chantier, assignation de l\'équipe, planning de la semaine, ajout des documents et checklist matériel (import Excel ou photo).',
  },
  {
    num: '2',
    title: 'Les techniciens suivent depuis le terrain',
    desc: 'Application mobile, validation des étapes avec photos, chat, signalement d\'anomalies, saisie des heures — le tout en moins de 30 secondes par action.',
  },
  {
    num: '3',
    title: 'Le rapport se génère automatiquement',
    desc: 'Toutes les données terrain alimentent un rapport PDF professionnel en 1 clic. Personnalisable, prêt à envoyer au client.',
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
      'Planning équipe + feuille d\'heures',
      'Export Excel & PDF avancé',
      'Notifications push',
      'Gestion des anomalies',
      'Auto-contrôle terrain',
      'Import matériel IA',
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
      'Multi-entreprise isolé',
      'Support prioritaire',
      'Onboarding personnalisé',
      'Facturation annuelle disponible',
    ],
    cta: 'Contacter l\'équipe',
    ctaStyle: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    href: 'mailto:contact@mypvpilot.fr',
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
    a: 'Oui. Les données sont hébergées sur infrastructure européenne (Supabase), chiffrées en transit et au repos. Chaque entreprise a ses propres données isolées — aucune fuite entre clients.',
  },
  {
    q: 'Comment fonctionne l\'import matériel par IA ?',
    a: 'Prenez en photo votre bon de livraison ou importez un fichier Excel — l\'IA (Claude d\'Anthropic) extrait automatiquement les articles et quantités pour pré-remplir la checklist. Vous validez avant d\'enregistrer.',
  },
  {
    q: 'Puis-je gérer plusieurs entreprises ?',
    a: 'Oui, sur le plan Business. Chaque entreprise dispose de ses propres données, équipes et chantiers parfaitement isolés. L\'administrateur peut accéder à toutes les entreprises depuis une interface dédiée.',
  },
]

// ── Composant Phone Mockup ────────────────────────────────────────────────────

function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 260 }}>
      <div className="rounded-[2.5rem] bg-gray-900 p-2 shadow-2xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)' }}>
        <div className="rounded-[2rem] overflow-hidden bg-white" style={{ height: 520 }}>
          <img
            src="/screen-dashboard.png"
            alt="Dashboard PVPilot"
            className="w-full h-full object-cover object-top"
          />
        </div>
      </div>
      {/* Notification flottante */}
      <div className="absolute -top-3 -right-8 bg-white rounded-2xl px-3 py-2 shadow-xl border border-gray-100 flex items-center gap-2 animate-bounce" style={{ animationDuration: '3s' }}>
        <span className="text-sm">⚠️</span>
        <div>
          <p className="text-[10px] font-bold text-gray-800">Anomalie signalée</p>
          <p className="text-[9px] text-gray-400">Gravité haute</p>
        </div>
      </div>
      {/* Badge statut */}
      <div className="absolute -bottom-2 -left-10 bg-white rounded-2xl px-3 py-2 shadow-xl border border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs">✓</div>
        <div>
          <p className="text-[10px] font-bold text-gray-800">Étape validée</p>
          <p className="text-[9px] text-gray-400">Mise en service</p>
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
            <Logo size={32} />
            <span className="font-bold text-gray-900 text-lg tracking-tight">PVPilot</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Fonctionnalités</a>
            <a href="#apercu" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Aperçu</a>
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
                Planning équipe, suivi terrain en temps réel, rapports PDF,
                chat intégré, gestion des anomalies et import matériel par IA.
                Tout en une seule application mobile.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link to="/signup"
                  className="text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all hover:opacity-90 text-center"
                  style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
                  Essayer gratuitement →
                </Link>
                <a href="#apercu"
                  className="bg-white border border-gray-200 text-gray-700 font-semibold px-6 py-3.5 rounded-xl text-sm hover:bg-gray-50 transition-colors text-center"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  Voir l'application
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

          {/* Highlights IA & avancé */}
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {HIGHLIGHTS.map(h => (
              <div key={h.title}
                className="rounded-2xl p-6 border border-gray-100 bg-gradient-to-br from-gray-50 to-white hover:shadow-md transition-all"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{h.icon}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${h.badgeColor}`}>{h.badge}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{h.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Aperçu de l'application ───────────────────────────────────────── */}
      <section id="apercu" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-semibold text-sm mb-3">Aperçu</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              L'app telle qu'elle est vraiment
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Conçue pour être utilisée sur le terrain, en deux clics, même avec des gants.
            </p>
          </div>

          {/* Planning desktop — vue manager */}
          <div className="mb-12 rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-1 text-xs text-gray-400 border border-gray-200">
                app.mypvpilot.fr — Planning équipe
              </div>
            </div>
            <img src="/screen-planning.png" alt="Planning équipe PVPilot" className="w-full" />
          </div>

          {/* 4 mobiles côte à côte */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
            {[
              { src: '/screen-dashboard.png', label: 'Tableau de bord',  desc: 'KPIs & anomalies ouvertes' },
              { src: '/screen-etapes.png',    label: 'Suivi terrain',    desc: 'Étapes chantier en temps réel' },
              { src: '/screen-rapport.png',   label: 'Rapport terrain',  desc: 'Photos + compte-rendu + PDF' },
              { src: '/screen-profil.png',    label: 'Préférences',      desc: 'Notifications & profil' },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center gap-3">
                <div className="rounded-[2rem] bg-gray-900 p-1.5 shadow-xl w-full"
                  style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)' }}>
                  <div className="rounded-[1.6rem] overflow-hidden bg-white aspect-[9/19]">
                    <img src={item.src} alt={item.label} className="w-full h-full object-cover object-top" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
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
            <a href="mailto:contact@mypvpilot.fr"
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
                <Logo size={28} />
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
                  <li><a href="#apercu" className="hover:text-white transition-colors">Aperçu</a></li>
                  <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                  <li><Link to="/signup" className="hover:text-white transition-colors">Inscription</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-3">Support</p>
                <ul className="space-y-2">
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                  <li><a href="mailto:contact@mypvpilot.fr" className="hover:text-white transition-colors">Contact</a></li>
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
            <p className="text-xs">© 2026 PVPilot · Tous droits réservés</p>
            <p className="text-xs">Fait avec ☀️ pour les installateurs PV</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

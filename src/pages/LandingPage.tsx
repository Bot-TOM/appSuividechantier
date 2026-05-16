import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sun,
  Menu,
  X,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  FileText,
  AlertTriangle,
  BellRing,
  Bot,
  Building2,
  ShieldCheck,
  Check,
  ChevronDown,
  ArrowRight,
  Zap,
} from 'lucide-react'

// ── Données ───────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Planning équipe & feuille d'heures",
    desc: "Grille semaine par technicien, types d'activité (Chantier, Dépôt, Route, Congés...), saisie arrivée/départ/pause et export Excel.",
    color: 'text-blue-500', bg: 'bg-blue-50',
  },
  {
    icon: ClipboardList,
    title: 'Suivi des étapes en temps réel',
    desc: "Chaque étape validée depuis le terrain avec photos. Auto-contrôle par catégorie avec signature. Le manager voit l'avancement instantanément.",
    color: 'text-orange-500', bg: 'bg-orange-50',
  },
  {
    icon: MessageSquare,
    title: 'Chat intégré chantier & équipe',
    desc: "Messagerie par chantier avec mentions @, réactions, statut en ligne. Chat global pour toute l'équipe, isolé par entreprise.",
    color: 'text-purple-500', bg: 'bg-purple-50',
  },
  {
    icon: FileText,
    title: 'Rapport PDF automatique',
    desc: 'Généré en 1 clic depuis les données terrain. Personnalisable par section, photos pleine largeur, prêt à envoyer au client.',
    color: 'text-slate-600', bg: 'bg-slate-100',
  },
  {
    icon: AlertTriangle,
    title: 'Gestion des anomalies',
    desc: 'Signalez et suivez les problèmes avec photo et niveau de gravité. Résolution tracée, vue globale pour le manager.',
    color: 'text-rose-500', bg: 'bg-rose-50',
  },
  {
    icon: BellRing,
    title: 'Notifications push intelligentes',
    desc: "Anomalies, rapports terrain, statuts chantier, messages — chaque utilisateur choisit ce qu'il reçoit sur son appareil.",
    color: 'text-amber-500', bg: 'bg-amber-50',
  },
  {
    icon: Bot,
    title: 'Import matériel par Excel ou photo',
    desc: "Prenez en photo votre liste de matériel ou importez un fichier Excel — l'IA extrait automatiquement les noms et quantités pour pré-remplir la checklist.",
    color: 'text-fuchsia-500', bg: 'bg-fuchsia-50',
  },
  {
    icon: Building2,
    title: 'Isolation totale des données',
    desc: "Chaque entreprise a ses propres données, équipes et chantiers parfaitement isolés. Prêt pour une utilisation SaaS multi-tenant.",
    color: 'text-indigo-500', bg: 'bg-indigo-50',
  },
  {
    icon: ShieldCheck,
    title: 'Auto-contrôle qualité',
    desc: "Formulaire d'auto-contrôle par catégorie (électrique, mécanique, sécurité...) avec signature numérique intégrée au rapport PDF.",
    color: 'text-emerald-500', bg: 'bg-emerald-50',
  },
]

const STEPS = [
  {
    num: 1,
    title: 'Le manager prépare le chantier',
    desc: "Création du chantier, assignation de l'équipe, planning de la semaine, ajout des documents et checklist matériel (import Excel ou photo).",
  },
  {
    num: 2,
    title: 'Les techniciens suivent depuis le terrain',
    desc: "Application mobile, validation des étapes avec photos, chat, signalement d'anomalies, saisie des heures — le tout en moins de 30 secondes par action.",
  },
  {
    num: 3,
    title: 'Le rapport se génère automatiquement',
    desc: "Toutes les données terrain alimentent un rapport PDF professionnel en 1 clic. Personnalisable, prêt à envoyer au client.",
  },
]

const PRICING = [
  {
    name: 'Starter',
    price: 'Gratuit',
    sub: 'Pour démarrer',
    highlight: false,
    features: ["1 chantier actif", "3 utilisateurs", "Suivi des étapes", "Chat d'équipe", "Rapport PDF basique"],
    cta: 'Commencer gratuitement',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '49€',
    sub: '/mois · facturation mensuelle',
    highlight: true,
    features: ["Chantiers illimités", "10 utilisateurs", "Planning équipe & feuille d'heures", "Export Excel & PDF avancé", "Notifications push", "Gestion des anomalies", "Auto-contrôle terrain", "Import matériel IA"],
    cta: 'Essayer 14 jours gratuits',
    href: '/signup',
  },
  {
    name: 'Business',
    price: '99€',
    sub: '/mois · facturation mensuelle',
    highlight: false,
    features: ["Utilisateurs illimités", "Chantiers illimités", "Tout ce qu'inclut Pro", "Multi-entreprise isolé", "Support prioritaire", "Onboarding personnalisé", "Facturation annuelle disponible"],
    cta: "Contacter l'équipe",
    href: 'mailto:contact@chantierpv.fr',
  },
]

const FAQS = [
  { q: "Faut-il se former pour utiliser ChantierPV ?", a: "Non, l'application a été conçue pour être la plus intuitive possible. Un technicien peut la prendre en main en moins de 5 minutes sur le terrain." },
  { q: "Ça fonctionne sans connexion internet ?", a: "Oui, notre application mobile permet de saisir des données et des photos même en zone blanche. Tout se synchronise dès que le réseau revient." },
  { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Toutes vos données (et celles de vos clients) sont hébergées sur des serveurs sécurisés en Europe, en conformité totale avec le RGPD." },
  { q: "Comment fonctionne l'import matériel par IA ?", a: "Il vous suffit de prendre en photo votre bon de livraison ou d'importer un fichier Excel. Notre intelligence artificielle reconnaît les articles et les quantités pour créer votre checklist instantanément." },
  { q: "Puis-je gérer plusieurs entreprises ?", a: "Oui, si vous avez plusieurs entités, ChantierPV permet une isolation totale des données avec un système multi-entreprise." },
]

const MOBILES = [
  { src: '/screen-dashboard.png', label: 'Tableau de bord',  desc: 'KPIs & anomalies ouvertes',       offset: '' },
  { src: '/screen-etapes.png',    label: 'Suivi terrain',    desc: 'Étapes chantier en temps réel',    offset: 'lg:mt-8' },
  { src: '/screen-rapport.png',   label: 'Rapport terrain',  desc: 'Photos + compte-rendu + PDF',       offset: 'lg:mt-16' },
  { src: '/screen-profil.png',    label: 'Préférences',      desc: 'Notifications & profil',            offset: 'lg:mt-8' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-orange-100 selection:text-orange-900">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">

            {/* Logo */}
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
                <Sun className="text-white w-6 h-6" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-slate-900">ChantierPV</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex space-x-8">
              {[['#fonctionnalites','Fonctionnalités'],['#apercu','Aperçu'],['#tarifs','Tarifs'],['#faq','FAQ']].map(([href, label]) => (
                <a key={href} href={href} className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">{label}</a>
              ))}
            </div>

            {/* CTA desktop */}
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">Se connecter</Link>
              <Link to="/signup" className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40">
                Essayer gratuitement
              </Link>
            </div>

            {/* Burger mobile */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-slate-600 hover:text-slate-900 p-2">
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 px-4 pt-2 pb-6 space-y-4 shadow-lg absolute w-full">
            {[['#fonctionnalites','Fonctionnalités'],['#apercu','Aperçu'],['#tarifs','Tarifs'],['#faq','FAQ']].map(([href, label]) => (
              <a key={href} href={href} className="block text-base font-medium text-slate-600" onClick={() => setMobileOpen(false)}>{label}</a>
            ))}
            <div className="pt-4 flex flex-col space-y-3">
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="w-full text-center bg-slate-50 text-slate-900 px-5 py-3 rounded-xl text-base font-bold border border-slate-200">
                Se connecter
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}
                className="w-full text-center bg-orange-500 text-white px-5 py-3 rounded-xl text-base font-bold shadow-md shadow-orange-500/20">
                Essayer gratuitement
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-gradient-to-br from-orange-50/40 to-white">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-orange-100/40 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* Texte */}
            <div className="max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5 mb-8">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Conçu par un installateur PV, pour les installateurs PV</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
                Pilotez vos chantiers{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-400">
                  photovoltaïques.
                </span>
              </h1>

              <p className="text-lg text-slate-500 mb-10 leading-relaxed font-medium max-w-xl">
                Planning équipe, suivi terrain en temps réel, rapports PDF, chat intégré,
                gestion des anomalies et import matériel par IA. Tout en une seule application mobile.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
                <Link to="/signup"
                  className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full text-base font-bold transition-all shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 flex items-center justify-center group">
                  <span>Essayer gratuitement</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#apercu"
                  className="w-full sm:w-auto bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-8 py-4 rounded-full text-base font-bold transition-all flex items-center justify-center">
                  Voir l'application
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-400">
                <div className="flex items-center"><Zap className="w-4 h-4 mr-2 text-orange-400" /> Saisie &lt; 30 sec</div>
                <div className="flex items-center"><Sun className="w-4 h-4 mr-2 text-orange-400" /> Mobile-first, PWA</div>
                <div className="flex items-center"><ShieldCheck className="w-4 h-4 mr-2 text-orange-400" /> Données sécurisées EU</div>
              </div>
            </div>

            {/* Mockup iPhone */}
            <div className="relative mx-auto w-full max-w-[320px] lg:ml-auto">
              <div className="relative rounded-[3rem] border-[12px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden aspect-[9/19.5] w-full z-20">
                <div className="absolute top-0 inset-x-0 h-6 bg-slate-900 rounded-b-3xl w-[140px] mx-auto z-30" />
                <img
                  src="/screen-dashboard.png"
                  alt="Dashboard ChantierPV"
                  className="w-full h-full object-cover object-top rounded-[2rem] bg-white relative z-20"
                />
              </div>

              {/* Badge anomalie */}
              <div className="absolute top-1/4 -right-12 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 flex items-center space-x-3 z-30 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="bg-rose-100 p-2 rounded-full text-rose-500"><AlertTriangle className="w-4 h-4" /></div>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-none">Anomalie signalée</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Gravité haute</p>
                </div>
              </div>

              {/* Badge étape */}
              <div className="absolute bottom-1/4 -left-12 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 flex items-center space-x-3 z-30 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-500"><Check className="w-4 h-4" /></div>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-none">Étape validée</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">Mise en service</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-y border-slate-100 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-10">
            Pensé pour les équipes qui travaillent sur le terrain
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100">
            {[
              { num: '< 30s', label: 'de saisie par étape' },
              { num: '100%', label: 'mobile, fonctionne partout' },
              { num: '1 clic', label: 'pour générer le rapport PDF' },
              { num: '0', label: 'formation requise' },
            ].map(item => (
              <div key={item.label} className="text-center px-4">
                <p className="text-5xl font-black text-slate-900 mb-2">{item.num}</p>
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────────────────────── */}
      <section id="fonctionnalites" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-3">Fonctionnalités</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">
              Tout ce dont votre entreprise a besoin
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              Une seule app pour le manager au bureau et les techniciens sur le terrain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group">
                  <div className={`w-14 h-14 rounded-2xl ${f.bg} ${f.color} flex items-center justify-center mb-6 transition-transform group-hover:scale-110`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{f.title}</h3>
                  <p className="text-slate-500 leading-relaxed font-medium text-sm">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Aperçu ────────────────────────────────────────────────────────── */}
      <section id="apercu" className="py-24 bg-slate-50 border-t border-slate-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-3">Aperçu</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              L'app telle qu'elle est vraiment
            </h2>
            <p className="text-lg text-slate-500 font-medium">
              Conçue pour être utilisée sur le terrain, en deux clics, même avec des gants.
            </p>
          </div>

          {/* Desktop — planning */}
          <div className="mx-auto max-w-5xl mb-16">
            <div className="rounded-2xl border border-slate-200 shadow-2xl shadow-slate-300/50 overflow-hidden bg-white">
              <div className="bg-slate-100 px-4 py-3 flex items-center border-b border-slate-200">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="mx-auto bg-white px-4 py-1.5 rounded-md text-xs text-slate-400 font-medium flex items-center justify-center w-full max-w-md border border-slate-200 shadow-sm">
                  app.chantierpv.fr — Planning équipe
                </div>
              </div>
              <img src="/screen-planning.png" alt="Planning équipe ChantierPV" className="w-full h-auto object-cover" />
            </div>
          </div>

          {/* 4 mobiles en cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {MOBILES.map(item => (
              <div key={item.label} className={`flex flex-col items-center ${item.offset}`}>
                <div className="relative rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl overflow-hidden aspect-[9/19.5] w-full max-w-[260px] mb-6 transition-transform hover:-translate-y-2">
                  <div className="absolute top-0 inset-x-0 h-5 bg-slate-900 rounded-b-2xl w-[120px] mx-auto z-10" />
                  <img src={item.src} alt={item.label} className="w-full h-full object-cover object-top" />
                </div>
                <h4 className="font-bold text-slate-900">{item.label}</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ─────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-3">Comment ça marche</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
              Opérationnel en 5 minutes
            </h2>
          </div>

          <div className="space-y-6 relative">
            <div className="hidden sm:block absolute left-10 top-10 bottom-10 w-0.5 bg-orange-100" />
            {STEPS.map(step => (
              <div key={step.num}
                className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/5 transition-all relative z-10">
                <div className="w-14 h-14 shrink-0 bg-orange-500 text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-md shadow-orange-500/30">
                  {step.num}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs ────────────────────────────────────────────────────────── */}
      <section id="tarifs" className="py-24 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-3">Tarifs</p>
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">Simple et transparent</h2>
            <p className="text-lg text-slate-500 font-medium">Sans engagement. Annulez à tout moment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            {PRICING.map(plan => (
              <div key={plan.name}
                className={`bg-white rounded-3xl p-8 flex flex-col h-full ${
                  plan.highlight
                    ? 'shadow-2xl shadow-orange-500/10 border-2 border-orange-500 relative md:-translate-y-4'
                    : 'shadow-sm border border-slate-200'
                }`}>

                {plan.highlight && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    Recommandé
                  </div>
                )}

                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="text-4xl font-black text-slate-900 mb-1">{plan.price}</div>
                <p className="text-sm text-slate-500 font-medium mb-8">{plan.sub}</p>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center text-slate-700 text-sm font-medium">
                      <Check className="w-5 h-5 text-emerald-500 mr-3 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.href.startsWith('mailto') ? (
                  <a href={plan.href}
                    className="w-full block text-center bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-800 font-bold py-3.5 rounded-xl transition-colors">
                    {plan.cta}
                  </a>
                ) : (
                  <Link to={plan.href}
                    className={`w-full block text-center font-bold py-3.5 rounded-xl transition-all ${
                      plan.highlight
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20'
                        : 'bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-800'
                    }`}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold tracking-widest uppercase text-xs mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Questions fréquentes</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-orange-200 transition-colors shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex justify-between items-center p-6 text-left focus:outline-none">
                  <span className="font-semibold text-slate-800">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-orange-500' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-500 font-medium leading-relaxed border-t border-slate-50 pt-4 text-sm">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      <section className="bg-orange-500 py-20 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <Sun className="w-12 h-12 text-white/90 mx-auto mb-6" />
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Prêt à moderniser la gestion de vos chantiers ?
          </h2>
          <p className="text-xl text-orange-100 mb-10 font-medium">
            Rejoignez les installateurs PV qui ont dit adieu aux tableaux Excel et aux appels terrain.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/signup"
              className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-4 rounded-full text-base font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center">
              Commencer gratuitement <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <a href="mailto:contact@chantierpv.fr"
              className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-full text-base font-bold transition-all flex items-center justify-center">
              Demander une démo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0f172a] py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                  <Sun className="text-white w-5 h-5" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white">ChantierPV</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">
                La solution de pilotage de chantiers photovoltaïques conçue par et pour les installateurs.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Produit</h4>
              <ul className="space-y-3">
                <li><a href="#fonctionnalites" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Fonctionnalités</a></li>
                <li><a href="#apercu" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Aperçu</a></li>
                <li><a href="#tarifs" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Tarifs</a></li>
                <li><Link to="/signup" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Inscription</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Support & Légal</h4>
              <ul className="space-y-3">
                <li><a href="#faq" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">FAQ</a></li>
                <li><a href="mailto:contact@chantierpv.fr" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Contact</a></li>
                <li><Link to="/cgu" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">CGU</Link></li>
                <li><Link to="/confidentialite" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Confidentialité</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm font-medium">© 2026 ChantierPV. Tous droits réservés.</p>
            <p className="text-slate-500 text-sm font-medium flex items-center gap-1">
              Fait avec <Sun className="w-3.5 h-3.5 text-orange-500" /> pour les installateurs PV
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}

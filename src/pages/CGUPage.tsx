import { Link } from 'react-router-dom'
import { Sun, ArrowLeft } from 'lucide-react'

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">

      {/* Navbar minimaliste */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
              <Sun className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight">ChantierPV</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-orange-500 font-bold text-xs uppercase tracking-widest mb-3">Légal</p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Conditions Générales d'Utilisation</h1>
          <p className="text-slate-400 text-sm">Dernière mise à jour : 15 mai 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-10">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">1. Présentation de ChantierPV</h2>
            <p className="text-slate-600 leading-relaxed">
              ChantierPV est une application web de gestion et de pilotage de chantiers photovoltaïques, éditée et exploitée par Tom Romand Malaure (ci-après « l'Éditeur »), joignable à l'adresse <a href="mailto:contact@mypvpilot.fr" className="text-orange-500 hover:underline">contact@mypvpilot.fr</a>.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              L'application est accessible à l'adresse <span className="font-medium text-slate-800">app.mypvpilot.fr</span> et destinée exclusivement aux professionnels du secteur de l'installation photovoltaïque (managers, techniciens et administrateurs).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">2. Acceptation des conditions</h2>
            <p className="text-slate-600 leading-relaxed">
              L'utilisation de ChantierPV implique l'acceptation pleine et entière des présentes Conditions Générales d'Utilisation (CGU). Si vous n'acceptez pas ces conditions, vous devez cesser d'utiliser l'application immédiatement.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email ou via une notification dans l'application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">3. Description du service</h2>
            <p className="text-slate-600 leading-relaxed">ChantierPV propose les fonctionnalités suivantes :</p>
            <ul className="mt-3 space-y-2">
              {[
                'Gestion et suivi de chantiers photovoltaïques',
                'Planning équipe avec saisie des heures',
                'Messagerie interne par chantier et chat global d\'équipe',
                'Génération de rapports PDF automatisés',
                'Gestion des anomalies et suivi qualité',
                'Formulaires d\'auto-contrôle avec signature numérique',
                'Import de listes de matériaux par fichier Excel ou photo (traitement par IA)',
                'Notifications push personnalisables',
                'Gestion multi-entreprises avec isolation des données',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600">
                  <span className="text-orange-400 mt-1 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Accès et inscription</h2>
            <p className="text-slate-600 leading-relaxed">
              L'accès à ChantierPV nécessite la création d'un compte. Le compte manager est créé avec un code d'accès fourni par l'Éditeur. Les comptes techniciens sont créés par le manager de l'entreprise.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              L'utilisateur s'engage à fournir des informations exactes lors de son inscription et à maintenir la confidentialité de ses identifiants de connexion. Toute utilisation du compte par un tiers sous la responsabilité de l'utilisateur engage sa responsabilité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">5. Obligations de l'utilisateur</h2>
            <p className="text-slate-600 leading-relaxed">L'utilisateur s'engage à :</p>
            <ul className="mt-3 space-y-2">
              {[
                'Utiliser l\'application conformément à sa destination professionnelle',
                'Ne pas tenter d\'accéder aux données d\'autres entreprises',
                'Ne pas diffuser de contenu illicite, diffamatoire ou contraire aux bonnes mœurs via le chat ou les rapports',
                'Respecter les droits de propriété intellectuelle de l\'Éditeur',
                'Signaler tout dysfonctionnement ou faille de sécurité constatée',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600">
                  <span className="text-orange-400 mt-1 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">6. Propriété intellectuelle</h2>
            <p className="text-slate-600 leading-relaxed">
              L'ensemble des éléments constituant ChantierPV (code source, design, logo, base de données, algorithmes, etc.) est protégé par les lois françaises et européennes en matière de propriété intellectuelle. Toute reproduction, modification ou exploitation sans autorisation expresse de l'Éditeur est interdite.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Les données saisies par l'utilisateur (chantiers, photos, rapports, etc.) restent la propriété exclusive de l'utilisateur ou de son entreprise.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">7. Disponibilité et maintenance</h2>
            <p className="text-slate-600 leading-relaxed">
              L'Éditeur s'efforce d'assurer la disponibilité de ChantierPV 24h/24 et 7j/7 mais ne peut garantir une disponibilité sans interruption. Des opérations de maintenance pourront être effectuées, avec ou sans préavis selon leur urgence.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              L'Éditeur ne saurait être tenu responsable des interruptions de service liées à des causes extérieures (pannes réseau, défaillances des services tiers, cas de force majeure, etc.).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">8. Limitation de responsabilité</h2>
            <p className="text-slate-600 leading-relaxed">
              ChantierPV est un outil d'aide à la gestion de chantiers. L'Éditeur ne saurait être tenu responsable des décisions prises par l'utilisateur sur la base des informations contenues dans l'application, ni des préjudices directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">9. Résiliation</h2>
            <p className="text-slate-600 leading-relaxed">
              L'utilisateur peut supprimer son compte à tout moment en contactant l'Éditeur à <a href="mailto:contact@mypvpilot.fr" className="text-orange-500 hover:underline">contact@mypvpilot.fr</a>. L'Éditeur se réserve le droit de suspendre ou supprimer tout compte ne respectant pas les présentes CGU, sans préavis ni remboursement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">10. Droit applicable</h2>
            <p className="text-slate-600 leading-relaxed">
              Les présentes CGU sont soumises au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut d'accord amiable, les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">11. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              Pour toute question relative aux présentes CGU : <a href="mailto:contact@mypvpilot.fr" className="text-orange-500 hover:underline">contact@mypvpilot.fr</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-slate-100 py-8 mt-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <p>© 2026 ChantierPV. Tous droits réservés.</p>
          <div className="flex gap-6">
            <Link to="/cgu" className="hover:text-slate-600 transition-colors">CGU</Link>
            <Link to="/confidentialite" className="hover:text-slate-600 transition-colors">Confidentialité</Link>
            <a href="mailto:contact@mypvpilot.fr" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

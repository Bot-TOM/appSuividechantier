import { Link } from 'react-router-dom'
import { Sun, ArrowLeft } from 'lucide-react'

export default function ConfidentialitePage() {
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
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Politique de Confidentialité</h1>
          <p className="text-slate-400 text-sm">Dernière mise à jour : 15 mai 2026</p>
        </div>

        <div className="prose prose-slate max-w-none space-y-10">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">1. Responsable du traitement</h2>
            <p className="text-slate-600 leading-relaxed">
              Le responsable du traitement des données personnelles collectées via ChantierPV est Tom Romand Malaure, joignable à <a href="mailto:contact@chantierpv.fr" className="text-orange-500 hover:underline">contact@chantierpv.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">2. Données collectées</h2>
            <p className="text-slate-600 leading-relaxed">Dans le cadre de l'utilisation de ChantierPV, les données suivantes peuvent être collectées :</p>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">Données de compte</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Prénom, nom, adresse email, photo de profil, rôle (manager / technicien), poste, identifiant entreprise.</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">Données de chantier</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Informations clients (nom, adresse), étapes de travaux, photos terrain, rapports rédigés, notes, anomalies signalées, matériaux utilisés.</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">Données de planning & heures</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Activités planifiées par jour (type, note), heures d'arrivée, de départ et de pause saisies par technicien.</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">Données de messagerie</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Messages échangés dans les chats de chantier et le chat global d'équipe, fichiers et images partagés.</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-5">
                <h3 className="font-bold text-slate-800 mb-2">Données techniques</h3>
                <p className="text-slate-600 text-sm leading-relaxed">Tokens de notifications push (pour l'envoi d'alertes sur votre appareil), préférences de notifications, journaux d'activité anonymisés.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">3. Finalités du traitement</h2>
            <p className="text-slate-600 leading-relaxed">Les données collectées sont utilisées exclusivement pour :</p>
            <ul className="mt-3 space-y-2">
              {[
                'Fournir et améliorer le service ChantierPV',
                'Authentifier les utilisateurs et gérer les accès',
                'Permettre la collaboration entre membres d\'une même équipe',
                'Envoyer des notifications push selon les préférences choisies',
                'Générer les rapports PDF à partir des données terrain',
                'Assurer la sécurité et prévenir les abus',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600">
                  <span className="text-orange-400 mt-1 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Aucune donnée n'est vendue, louée ou partagée à des fins commerciales avec des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Hébergement et sous-traitants</h2>
            <p className="text-slate-600 leading-relaxed">ChantierPV utilise les services tiers suivants :</p>
            <div className="mt-4 space-y-3">
              {[
                { name: 'Supabase', role: 'Base de données, authentification, stockage de fichiers', location: 'Europe (AWS Frankfurt)' },
                { name: 'Vercel', role: 'Hébergement de l\'application web', location: 'Europe' },
                { name: 'Anthropic (Claude)', role: 'Traitement IA pour l\'import de matériaux (données transmises temporairement, non conservées)', location: 'USA — traitement ponctuel' },
              ].map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-bold text-slate-800 w-28 shrink-0">{s.name}</span>
                  <span className="text-slate-600 text-sm flex-1">{s.role}</span>
                  <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-200 shrink-0">{s.location}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">5. Durée de conservation</h2>
            <p className="text-slate-600 leading-relaxed">
              Les données sont conservées pendant toute la durée d'utilisation active du compte. En cas de suppression du compte, les données sont supprimées dans un délai de 30 jours, à l'exception des données nécessaires au respect des obligations légales (durée légale de conservation applicable).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">6. Isolation des données entre entreprises</h2>
            <p className="text-slate-600 leading-relaxed">
              Chaque entreprise dispose d'un espace de données strictement isolé grâce à un système de règles de sécurité au niveau de la base de données (Row Level Security). Un utilisateur d'une entreprise ne peut en aucun cas accéder aux données d'une autre entreprise.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">7. Vos droits (RGPD)</h2>
            <p className="text-slate-600 leading-relaxed">Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
            <ul className="mt-3 space-y-2">
              {[
                'Droit d\'accès — consulter les données que nous détenons sur vous',
                'Droit de rectification — corriger des données inexactes',
                'Droit à l\'effacement — demander la suppression de vos données',
                'Droit à la portabilité — recevoir vos données dans un format lisible',
                'Droit d\'opposition — vous opposer à certains traitements',
                'Droit à la limitation — restreindre le traitement de vos données',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-slate-600">
                  <span className="text-orange-400 mt-1 shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Pour exercer ces droits, contactez-nous à <a href="mailto:contact@chantierpv.fr" className="text-orange-500 hover:underline">contact@chantierpv.fr</a>. Nous répondrons dans un délai de 30 jours. Vous disposez également du droit d'introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">8. Cookies et stockage local</h2>
            <p className="text-slate-600 leading-relaxed">
              ChantierPV utilise le stockage local du navigateur (localStorage) uniquement pour maintenir votre session d'authentification et vos préférences d'affichage. Aucun cookie publicitaire ou de traçage tiers n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">9. Notifications push</h2>
            <p className="text-slate-600 leading-relaxed">
              Si vous activez les notifications push, un token d'identification de votre appareil est enregistré en base de données pour vous permettre de recevoir des alertes. Ce token est supprimé si vous désactivez les notifications ou supprimez votre compte. Vous pouvez gérer vos préférences de notifications à tout moment depuis votre profil dans l'application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">10. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              Pour toute question relative à la protection de vos données : <a href="mailto:contact@chantierpv.fr" className="text-orange-500 hover:underline">contact@chantierpv.fr</a>
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
            <a href="mailto:contact@chantierpv.fr" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

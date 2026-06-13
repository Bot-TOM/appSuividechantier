import CroquisCanvas from '@/components/croquis/CroquisCanvas'

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — page de test isolée pour l'éditeur de croquis (/proto-croquis).
// Toute la logique vit désormais dans le composant réutilisable CroquisCanvas,
// qui sera branché dans les VT. Cette page sert juste à tester l'ergonomie.
// ─────────────────────────────────────────────────────────────────────────────

export default function ProtoCroquis() {
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-slate-900 text-white text-center text-xs font-bold py-2 tracking-widest uppercase shrink-0">
        Prototype croquis — test ergonomie (rien n'est enregistré)
      </div>
      <div className="flex-1 min-h-0">
        <CroquisCanvas />
      </div>
    </div>
  )
}

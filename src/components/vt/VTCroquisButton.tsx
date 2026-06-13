import { useState } from 'react'
import { Map, X } from 'lucide-react'
import CroquisManager, { type CroquisDoc } from '@/components/croquis/CroquisManager'

// ─────────────────────────────────────────────────────────────────────────────
// VTCroquisButton — bouton flottant « Croquis » toujours visible pendant la
// saisie d'une VT. Ouvre le gestionnaire multi-croquis en superposition ;
// la fermeture ramène exactement à l'étape de la VT en cours.
// Les croquis sont stockés dans data.__croquis de la VT (auto-save existant).
// ─────────────────────────────────────────────────────────────────────────────

interface VTCroquisButtonProps {
  value: CroquisDoc[]
  onChange: (docs: CroquisDoc[]) => void
}

export default function VTCroquisButton({ value, onChange }: VTCroquisButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Bouton flottant — au-dessus du header VT (z-20), sous l'éditeur (z-50) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold pl-4 pr-5 py-3.5 rounded-full shadow-lg shadow-orange-500/30 transition-colors"
        aria-label="Ouvrir les croquis de calepinage"
      >
        <Map className="w-5 h-5" />
        Croquis
        {value.length > 0 && (
          <span className="ml-0.5 bg-white text-orange-600 text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
            {value.length}
          </span>
        )}
      </button>

      {/* Gestionnaire en superposition plein écran */}
      {open && (
        <div className="fixed inset-0 z-40 bg-[#F8FAFC] flex flex-col">
          <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
            <button
              onClick={() => setOpen(false)}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
              aria-label="Fermer et revenir à la VT"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-slate-900">Croquis de calepinage</h2>
          </header>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg w-full mx-auto p-4">
              <CroquisManager value={value} onChange={onChange} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

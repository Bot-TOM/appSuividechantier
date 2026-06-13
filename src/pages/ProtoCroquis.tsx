import { useState } from 'react'
import CroquisManager, { type CroquisDoc } from '@/components/croquis/CroquisManager'

// ─────────────────────────────────────────────────────────────────────────────
// PROTOTYPE — page de test isolée (/proto-croquis).
// Teste le flux complet multi-croquis (CroquisManager + CroquisCanvas).
// Persistance localStorage pour vérifier que rien ne se perd au rechargement —
// dans les VT, ce sera la base de données à la place.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'proto-croquis-docs'

function loadDocs(): CroquisDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CroquisDoc[]) : []
  } catch {
    return []
  }
}

export default function ProtoCroquis() {
  const [docs, setDocs] = useState<CroquisDoc[]>(loadDocs)

  function update(next: CroquisDoc[]) {
    setDocs(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* quota */ }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="bg-slate-900 text-white text-center text-xs font-bold py-2 tracking-widest uppercase shrink-0">
        Prototype croquis — test ergonomie (sauvegarde locale)
      </div>
      <div className="max-w-lg w-full mx-auto p-4">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Croquis de calepinage</h1>
        <p className="text-sm text-slate-500 font-medium mb-5">
          Crée plusieurs croquis (ex « Toiture bas », « Toiture haut »). Ils sont
          sauvegardés automatiquement et restent après rechargement de la page.
        </p>
        <CroquisManager value={docs} onChange={update} />
      </div>
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function BugReportButton({ hasBottomNav = false }: { hasBottomNav?: boolean }) {
  const { profile } = useAuth()
  const [open, setOpen]               = useState(false)
  const [description, setDescription] = useState('')
  const [severite, setSeverite]       = useState<'mineur' | 'bloquant'>('mineur')
  const [photo, setPhoto]             = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [sending, setSending]         = useState(false)
  const [sent, setSent]               = useState(false)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoPreview(null)
  }

  function handleClose() {
    setOpen(false)
    setDescription('')
    setSeverite('mineur')
    setPhoto(null)
    setPhotoPreview(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSending(true)

    // Upload photo si présente
    let photo_url: string | null = null
    if (photo) {
      const ext = photo.name.split('.').pop() ?? 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData } = await supabase.storage.from('bug-photos').upload(path, photo)
      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('bug-photos').getPublicUrl(path)
        photo_url = publicUrl
      }
    }

    // Insérer le signalement
    const { data: reportData } = await supabase.from('bug_reports').insert({
      user_id:       profile?.id ?? null,
      entreprise_id: profile?.entreprise_id ?? null,
      page_url:      window.location.pathname,
      description:   description.trim(),
      severite,
      photo_url,
    }).select().single()

    // Envoyer notification push à l'admin
    if (reportData) {
      supabase.functions.invoke('send-push', {
        body: { table: 'bug_reports', record: reportData },
      }).catch(() => {}) // silencieux si échec
    }

    setSending(false)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      handleClose()
    }, 2000)
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(true)}
        title="Signaler un problème"
        className="fixed right-4 z-40 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-all duration-200 sm:right-6 sm:w-11 sm:h-11"
        style={{ bottom: hasBottomNav ? 'calc(env(safe-area-inset-bottom) + 72px)' : '1.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}>

            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Signaler un problème</p>
                  <p className="text-xs text-gray-400">{window.location.pathname}</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">Merci pour le signalement !</p>
                <p className="text-xs text-gray-400">On s'en occupe dès que possible.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">

                {/* Sévérité */}
                <div className="flex gap-2">
                  {([
                    { value: 'mineur',   label: '🟡 Mineur',  desc: 'Gêne mais ne bloque pas' },
                    { value: 'bloquant', label: '🔴 Bloquant', desc: 'Impossible de continuer' },
                  ] as const).map(s => (
                    <button key={s.value} type="button" onClick={() => setSeverite(s.value)}
                      className={`flex-1 text-left px-4 py-3 rounded-xl border-2 transition-all text-xs ${
                        severite === s.value
                          ? s.value === 'bloquant' ? 'border-red-400 bg-red-50' : 'border-orange-400 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
                      <p className="text-gray-400 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Décris le problème <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ex : Quand je clique sur 'Créer un chantier', la page devient blanche..."
                    rows={3}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-gray-300"
                  />
                </div>

                {/* Photo optionnelle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Photo <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  {photoPreview ? (
                    <div className="relative">
                      <img src={photoPreview} alt="Aperçu" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                      <button type="button" onClick={removePhoto}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs hover:bg-black/70 transition-colors">
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-all">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M9 9.75h.008v.008H9V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span className="text-sm text-gray-400">Ajouter une capture d'écran</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>

                <button type="submit" disabled={sending || !description.trim()}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}>
                  {sending ? 'Envoi...' : 'Envoyer le signalement'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { MessageSquareWarning, X, Paperclip, CheckCircle2 } from 'lucide-react'

export default function BugReportButton({ hasBottomNav = false }: { hasBottomNav?: boolean }) {
  const { profile } = useAuth()
  const [open, setOpen]               = useState(false)
  const [titre, setTitre]             = useState('')
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
    setTitre('')
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

    // Combiner titre + description
    const fullDescription = titre.trim()
      ? `${titre.trim()}\n\n${description.trim()}`
      : description.trim()

    // Insérer le signalement
    const { data: reportData } = await supabase.from('bug_reports').insert({
      user_id:       profile?.id ?? null,
      entreprise_id: profile?.entreprise_id ?? null,
      page_url:      window.location.pathname,
      description:   fullDescription,
      severite,
      photo_url,
    }).select().single()

    // Envoyer notification push à l'admin
    if (reportData) {
      supabase.functions.invoke('send-push', {
        body: { table: 'bug_reports', record: reportData },
      }).catch(() => {})
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
      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOpen(true)}
        title="Signaler un problème"
        className="fixed right-4 z-40 w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-orange-500 hover:border-orange-300 transition-colors sm:right-6"
        style={{
          bottom: hasBottomNav ? 'calc(env(safe-area-inset-bottom) + 72px)' : '1.5rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}
      >
        <MessageSquareWarning className="w-5 h-5" />
      </button>

      {/* ── Drawer ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">

          {/* Overlay */}
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          {/* Panneau */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col border-l border-slate-200">

            {/* Header */}
            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-50 text-orange-500 rounded-lg">
                  <MessageSquareWarning className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-none">Signaler un problème</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1">L'équipe technique sera notifiée.</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps */}
            {sent ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-slate-900">Merci pour le signalement !</p>
                <p className="text-sm text-slate-400 text-center">On s'en occupe dès que possible.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                  {/* Impact */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-3">Impact du problème</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-xl">
                      {([
                        { value: 'mineur'   as const, label: 'Mineur',   dot: 'bg-amber-400', activeTxt: 'text-slate-800' },
                        { value: 'bloquant' as const, label: 'Bloquant', dot: 'bg-rose-500',  activeTxt: 'text-rose-600'  },
                      ]).map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setSeverite(s.value)}
                          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg transition-all ${
                            severite === s.value
                              ? 'bg-white shadow-sm ring-1 ring-slate-200/50'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${severite === s.value ? s.dot : 'bg-slate-300'}`} />
                          <span className={`text-sm font-bold ${severite === s.value ? s.activeTxt : ''}`}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      {severite === 'mineur'
                        ? 'Gênant, mais vous pouvez continuer à travailler.'
                        : "Empêche complètement l'utilisation de l'application."}
                    </p>
                  </div>

                  {/* Titre */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Titre court <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={titre}
                      onChange={e => setTitre(e.target.value)}
                      placeholder="Ex : Bouton manquant sur la page devis"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Description détaillée <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={5}
                      placeholder="Que faisiez-vous quand le problème est survenu ? Que s'est-il passé exactement ?"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none"
                    />
                  </div>

                  {/* Pièces jointes */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Pièces jointes <span className="text-slate-400 font-normal">(Optionnel)</span>
                    </label>
                    {photoPreview ? (
                      <div className="relative rounded-xl overflow-hidden">
                        <img src={photoPreview} alt="Aperçu" className="w-full h-40 object-cover" />
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="w-full border-2 border-dashed border-slate-200 hover:border-orange-300 bg-slate-50 hover:bg-orange-50/30 rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer group">
                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                        <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:text-orange-500 text-slate-400 transition-colors">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-orange-700 text-center">
                          Glissez vos captures d'écran ici
                        </span>
                        <span className="text-xs text-slate-400 mt-1">PNG, JPG, PDF jusqu'à 10MB</span>
                      </label>
                    )}
                  </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-xl transition-all shadow-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={sending || !description.trim()}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-orange-500/20"
                  >
                    {sending ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

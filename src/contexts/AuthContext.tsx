import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserProfile, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (fullName: string, email: string, password: string, managerCode: string, entrepriseNom?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // Timeout de sécurité : si Supabase ne répond pas en 6s, on débloque le chargement
    const timeout = setTimeout(() => setLoading(false), 6000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Recharge le profil quand l'onglet redevient visible (ex: manager a modifié le poste)
  useEffect(() => {
    if (!user) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchProfile(user.id)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Email ou mot de passe incorrect' }
    return { error: null }
  }

  async function signUp(fullName: string, email: string, password: string, accessCode: string, entrepriseNom?: string) {
    // 1. Vérifier le code d'accès en base (obligatoire)
    if (!accessCode.trim()) {
      return { error: 'Un code d\'accès PVPilot est requis pour créer un compte' }
    }

    // Vérification préalable : le code existe-t-il et est-il disponible ?
    const { data: codeCheck } = await supabase
      .from('access_codes')
      .select('id, status')
      .eq('status', 'available')
      .filter('code', 'ilike', accessCode.trim())
      .maybeSingle()

    if (!codeCheck) {
      return { error: 'Code d\'accès invalide ou déjà utilisé' }
    }

    // 2. Créer le compte Supabase Auth
    const role: UserRole = 'manager'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, entreprise_nom: entrepriseNom?.trim() ?? '' } },
    })

    if (error) return { error: error.message }
    if (!data.user) return { error: 'Erreur lors de la création du compte' }

    // 3. Consommer le code atomiquement (SECURITY DEFINER — pas de race condition)
    const { data: result } = await supabase.rpc('verify_and_use_code', {
      p_code: accessCode.trim(),
      p_user_id: data.user.id,
    })

    if (result !== 'ok') {
      // Cas rare : code consommé entre la vérification et l'inscription
      return { error: 'Code d\'accès invalide ou déjà utilisé' }
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    // Force la navigation même en contexte PWA avec service worker
    window.location.href = '/login'
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserProfile, UserRole } from '@/types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: string | null }>
  signUp: (fullName: string, email: string, password: string, entrepriseNom?: string) => Promise<{ error: string | null }>
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
    return data
  }

  // Envoie l'email de bienvenue une seule fois, après la 1ère connexion post-confirmation
  async function maybeSendWelcomeEmail(profileData: UserProfile | null, session: Session | null) {
    if (!profileData || !session) return
    if (profileData.welcome_email_sent) return

    try {
      // Marque en base avant l'envoi pour éviter les doublons en cas de retry
      await supabase
        .from('profiles')
        .update({ welcome_email_sent: true })
        .eq('id', profileData.id)

      await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: profileData.full_name, email: profileData.email }),
      })
    } catch {
      // Silencieux — l'email de bienvenue n'est pas critique
    }
  }

  useEffect(() => {
    // onAuthStateChange émet INITIAL_SESSION au démarrage → remplace getSession()
    // Cela évite la race condition : deux fetchProfile() en parallèle qui
    // s'annulent mutuellement et laissent profile=null pour tous les hooks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        if (_event === 'SIGNED_IN') {
          await maybeSendWelcomeEmail(profileData, session)
        }
      } else {
        setProfile(null)
      }

      // Loading se lève une seule fois, après INITIAL_SESSION
      setLoading(false)
    })

    // Filet de sécurité : si onAuthStateChange ne se déclenche jamais (> 8s)
    const timeout = setTimeout(() => setLoading(false), 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Email ou mot de passe incorrect', role: null }
    const role = (data.user?.user_metadata?.role ?? null) as string | null
    return { error: null, role }
  }

  async function signUp(fullName: string, email: string, password: string, entrepriseNom?: string) {
    const role: UserRole = 'manager'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, entreprise_nom: entrepriseNom?.trim() ?? '' } },
    })

    if (error) return { error: error.message }
    if (!data.user) return { error: 'Erreur lors de la création du compte' }

    return { error: null }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // Déconnexion forcée même en cas d'erreur réseau
    }
    // Vider tout le stockage local pour garantir la déconnexion
    // (Supabase peut stocker la session sous plusieurs clés selon la version)
    localStorage.clear()
    sessionStorage.clear()
    // Redirection forcée — remplace l'historique pour empêcher le retour arrière
    window.location.replace('/login')
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

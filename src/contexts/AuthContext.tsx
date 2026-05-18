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
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
      return data
    } catch {
      setProfile(null)
      return null
    }
  }

  // Envoie l'email de bienvenue une seule fois, après la 1ère connexion post-confirmation
  async function maybeSendWelcomeEmail(profileData: UserProfile | null, session: Session | null) {
    if (!profileData || !session) return
    if (profileData.welcome_email_sent) return

    try {
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
    // Timeout de sécurité : si Supabase ne répond pas en 8s, on débloque quand même
    const timeout = setTimeout(() => setLoading(false), 8000)

    // Un seul point d'entrée pour l'auth — onAuthStateChange gère tout :
    // INITIAL_SESSION (chargement initial), SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[AUTH]', _event, session?.user?.email ?? 'no user')
      clearTimeout(timeout)
      setSession(session)
      setUser(session?.user ?? null)

      try {
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id)
          console.log('[AUTH] profile loaded:', profileData?.role ?? 'NULL')
          if (_event === 'SIGNED_IN') {
            await maybeSendWelcomeEmail(profileData, session)
          }
        } else {
          setProfile(null)
          console.log('[AUTH] no session → profile null')
        }
      } catch (e) {
        console.error('[AUTH] fetchProfile error:', e)
      } finally {
        setLoading(false)
        console.log('[AUTH] loading done')
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  // Recharge le profil quand l'onglet redevient visible
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
    localStorage.clear()
    sessionStorage.clear()
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

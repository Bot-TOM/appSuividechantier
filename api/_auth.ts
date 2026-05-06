/**
 * Vérifie le JWT Supabase passé dans l'en-tête Authorization.
 * Retourne { userId } si valide, { error } sinon.
 */
export async function verifyAuth(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return { error: 'Non authentifié', status: 401 }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  if (!supabaseUrl) {
    return { error: 'Config serveur manquante', status: 500 }
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY ?? '',
      },
    })

    if (!res.ok) {
      return { error: 'Token invalide ou expiré', status: 401 }
    }

    const user = await res.json() as { id: string }
    return { userId: user.id }
  } catch {
    return { error: 'Erreur vérification auth', status: 500 }
  }
}

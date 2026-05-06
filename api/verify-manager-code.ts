export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let code: string
  try {
    const body = await req.json() as { code?: string }
    code = body.code ?? ''
  } catch {
    return new Response(JSON.stringify({ error: 'body invalide' }), { status: 400 })
  }

  const MANAGER_CODE = process.env.MANAGER_CODE
  if (!MANAGER_CODE) {
    return new Response(JSON.stringify({ error: 'config manquante' }), { status: 500 })
  }

  const isManager = code === MANAGER_CODE
  return new Response(JSON.stringify({ isManager }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

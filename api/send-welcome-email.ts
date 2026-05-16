export const config = { runtime: 'edge' }

import { verifyAuth } from './_auth'

const WELCOME_HTML = (fullName: string) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue sur ChantierPV</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- HEADER HERO -->
          <tr>
            <td style="background:linear-gradient(135deg,#C2410C 0%,#EA580C 40%,#F97316 75%,#FB923C 100%);border-radius:20px 20px 0 0;padding:48px 40px 40px;text-align:center;position:relative;">
              <!-- Logo -->
              <div style="display:inline-block;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.3);border-radius:20px;padding:14px 20px;margin-bottom:24px;">
                <span style="font-size:36px;">☀️</span>
              </div>
              <!-- Titre -->
              <h1 style="margin:0 0 8px;color:#fff;font-size:30px;font-weight:900;letter-spacing:-0.5px;line-height:1.1;">
                Bienvenue ${fullName.split(' ')[0]} ! 🎉
              </h1>
              <p style="margin:0 0 28px;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.5;">
                Votre espace <strong>ChantierPV</strong> est activé et prêt à l'emploi.
              </p>
              <!-- CTA Hero -->
              <a href="https://chantierpv.fr/manager"
                 style="display:inline-block;background:#fff;color:#EA580C;font-size:15px;font-weight:800;padding:14px 36px;border-radius:14px;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,0.2);letter-spacing:0.1px;">
                Accéder à mon espace →
              </a>
            </td>
          </tr>

          <!-- BANDE STATS -->
          <tr>
            <td style="background:#1C1917;padding:18px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;padding:0 8px;border-right:1px solid #44403C;">
                    <p style="margin:0 0 2px;color:#F97316;font-size:18px;font-weight:800;">100%</p>
                    <p style="margin:0;color:#A8A29E;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Mobile</p>
                  </td>
                  <td style="text-align:center;padding:0 8px;border-right:1px solid #44403C;">
                    <p style="margin:0 0 2px;color:#F97316;font-size:18px;font-weight:800;">0 papier</p>
                    <p style="margin:0;color:#A8A29E;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Tout numérique</p>
                  </td>
                  <td style="text-align:center;padding:0 8px;">
                    <p style="margin:0 0 2px;color:#F97316;font-size:18px;font-weight:800;">IA incluse</p>
                    <p style="margin:0;color:#A8A29E;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">Rapports auto</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background:#fff;padding:40px 40px 32px;">

              <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:800;text-align:center;">
                Démarrez en 3 étapes
              </h2>
              <p style="margin:0 0 28px;color:#9CA3AF;font-size:13px;text-align:center;">Moins de 5 minutes pour avoir votre premier chantier en ligne</p>

              <!-- STEP 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF5;border:1.5px solid #FED7AA;border-radius:16px;margin-bottom:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="52" valign="top">
                          <div style="width:44px;height:44px;background:linear-gradient(135deg,#EA580C,#F97316);border-radius:12px;text-align:center;line-height:44px;color:#fff;font-size:20px;font-weight:900;">1</div>
                        </td>
                        <td style="padding-left:14px;" valign="middle">
                          <p style="margin:0 0 3px;color:#111827;font-size:14px;font-weight:700;">📋 Créez votre premier chantier</p>
                          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Client, adresse, type d'installation, nombre de panneaux, date prévue.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- STEP 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:16px;margin-bottom:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="52" valign="top">
                          <div style="width:44px;height:44px;background:linear-gradient(135deg,#16A34A,#22C55E);border-radius:12px;text-align:center;line-height:44px;color:#fff;font-size:20px;font-weight:900;">2</div>
                        </td>
                        <td style="padding-left:14px;" valign="middle">
                          <p style="margin:0 0 3px;color:#111827;font-size:14px;font-weight:700;">👥 Invitez vos techniciens</p>
                          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Depuis "Gestion d'équipe" — ils reçoivent leurs identifiants par email.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- STEP 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="52" valign="top">
                          <div style="width:44px;height:44px;background:linear-gradient(135deg,#2563EB,#3B82F6);border-radius:12px;text-align:center;line-height:44px;color:#fff;font-size:20px;font-weight:900;">3</div>
                        </td>
                        <td style="padding-left:14px;" valign="middle">
                          <p style="margin:0 0 3px;color:#111827;font-size:14px;font-weight:700;">🎙️ Testez le rapport vocal IA</p>
                          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">Dictez un compte-rendu terrain — l'IA rédige le rapport en 10 secondes.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA SECONDAIRE -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="https://chantierpv.fr/manager"
                   style="display:inline-block;background:linear-gradient(135deg,#EA580C 0%,#F97316 100%);color:#fff;font-size:15px;font-weight:700;padding:15px 40px;border-radius:14px;text-decoration:none;box-shadow:0 6px 20px rgba(249,115,22,0.4);">
                  C'est parti →
                </a>
              </div>

              <hr style="border:none;border-top:1px solid #F3F4F6;margin:0 0 28px;" />

              <!-- TIP -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#FFF7ED,#FFEDD5);border-left:4px solid #F97316;border-radius:0 12px 12px 0;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#92400E;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">💡 Bon à savoir</p>
                    <p style="margin:0;color:#9A3412;font-size:13px;line-height:1.6;">
                      Vos techniciens <strong>ne créent pas leur compte eux-mêmes</strong> — c'est vous qui le faites pour eux depuis votre espace manager.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- HELP -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:14px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:22px;padding-right:12px;" valign="top">💬</td>
                        <td valign="middle">
                          <p style="margin:0 0 2px;color:#111827;font-size:14px;font-weight:700;">Une question ? On est là.</p>
                          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">
                            Répondez directement à cet email ou écrivez à <a href="mailto:contact@chantierpv.fr" style="color:#EA580C;font-weight:600;text-decoration:none;">contact@chantierpv.fr</a> — réponse sous 24h.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#1C1917;border-radius:0 0 20px 20px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#fff;font-size:14px;font-weight:700;">☀️ ChantierPV</p>
              <p style="margin:0 0 16px;color:#A8A29E;font-size:12px;">Le suivi de chantier PV fait pour le terrain</p>
              <p style="margin:0;color:#57534E;font-size:11px;">
                <a href="https://chantierpv.fr/cgu" style="color:#78716C;text-decoration:none;">CGU</a>
                &nbsp;·&nbsp;
                <a href="https://chantierpv.fr/confidentialite" style="color:#78716C;text-decoration:none;">Confidentialité</a>
                &nbsp;·&nbsp;
                <a href="https://chantierpv.fr" style="color:#78716C;text-decoration:none;">chantierpv.fr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Vérification JWT
  const auth = await verifyAuth(req)
  if ('error' in auth) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Clé Resend manquante' }), { status: 500 })
  }

  let fullName = 'là'
  let email = ''
  try {
    const body = await req.json() as { full_name?: string; email?: string }
    fullName = body.full_name?.trim() || 'là'
    email = body.email?.trim() || ''
  } catch {
    return new Response(JSON.stringify({ error: 'Body invalide' }), { status: 400 })
  }

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email manquant' }), { status: 400 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'ChantierPV <contact@chantierpv.fr>',
      to: [email],
      subject: '🎉 Votre espace ChantierPV est prêt !',
      html: WELCOME_HTML(fullName),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: 'Erreur envoi email', detail: err }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}

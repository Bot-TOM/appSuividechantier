import { test, expect, Page } from '@playwright/test'

const TECH_EMAIL    = process.env.TEST_TECH_EMAIL       ?? 'technicien.test@pvpilot.fr'
const TECH_PWD      = process.env.TEST_TECH_PASSWORD    ?? 'TestTech2026!'
const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL    ?? 'manager.test@pvpilot.fr'
const MANAGER_PWD   = process.env.TEST_MANAGER_PASSWORD ?? 'TestManager2026!'
const CHANTIER_1    = 'bbbbbbbb-0000-0000-0000-000000000001'

async function loginAs(page: Page, email: string, pwd: string, role: 'manager' | 'technicien') {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(pwd)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(new RegExp(`/${role}`), { timeout: 15000 })
}

test.describe('Anomalies', () => {

  test('Technicien peut signaler une anomalie', async ({ page }) => {
    await loginAs(page, TECH_EMAIL, TECH_PWD, 'technicien')
    await page.goto(`/chantier/${CHANTIER_1}`)

    // Ouvre l'onglet anomalies
    const anomalieTab = page.getByRole('button', { name: /anomalie/i }).or(
      page.getByText(/anomalie/i).first()
    )
    await anomalieTab.click()

    // Clique sur "Signaler"
    await page.getByRole('button', { name: /signaler/i }).click()

    // Remplit le formulaire
    await page.getByPlaceholder(/titre court du problème/i).fill('Câble DC endommagé — Test Playwright')
    await page.getByPlaceholder(/décrivez en détail/i).fill('Le câble DC entre le panneau 3 et le coffret présente une gaine abîmée sur 10 cm.')

    // Sélectionne la gravité "Haute priorité"
    await page.getByRole('button', { name: /haute priorité/i }).click()

    // Soumet
    await page.getByRole('button', { name: /créer le ticket/i }).click()

    // Vérifie que l'anomalie apparaît
    await expect(page.getByText('Câble DC endommagé')).toBeVisible({ timeout: 10000 })
  })

  test('Manager peut voir les anomalies sur le dashboard', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL, MANAGER_PWD, 'manager')
    // Navigue vers l'onglet anomalies
    await page.goto('/manager?tab=anomalies')
    // Un des éléments d'anomalie doit être visible
    await expect(
      page.getByText(/anomalie/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

})

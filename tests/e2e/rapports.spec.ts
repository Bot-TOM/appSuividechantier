import { test, expect, Page } from '@playwright/test'

const TECH_EMAIL = process.env.TEST_TECH_EMAIL       ?? 'technicien.test@pvpilot.fr'
const TECH_PWD   = process.env.TEST_TECH_PASSWORD    ?? 'TestTech2026!'
const CHANTIER_1 = 'bbbbbbbb-0000-0000-0000-000000000001'

async function loginTech(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(TECH_EMAIL)
  await page.getByPlaceholder('••••••••').fill(TECH_PWD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/technicien/, { timeout: 15000 })
}

test.describe('Technicien — Rapports', () => {

  test('Peut accéder à l\'onglet rapport d\'un chantier', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)
    // Cherche l'onglet "Rapport"
    const rapportTab = page.getByRole('button', { name: /rapport/i }).or(
      page.getByText(/rapport/i).first()
    )
    await expect(rapportTab).toBeVisible({ timeout: 10000 })
    await rapportTab.click()
    // Le textarea doit apparaître
    await expect(page.getByPlaceholder(/décrivez l'avancement/i)).toBeVisible({ timeout: 5000 })
  })

  test('Peut publier un rapport de chantier', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)

    // Navigue vers l'onglet rapport
    const rapportTab = page.getByRole('button', { name: /rapport/i }).or(
      page.getByText(/rapport/i).first()
    )
    await rapportTab.click()

    // Remplit le rapport
    const textarea = page.getByPlaceholder(/décrivez l'avancement/i)
    await expect(textarea).toBeVisible({ timeout: 5000 })
    await textarea.fill('Rapport de test Playwright — Pose des panneaux terminée, câblage DC en cours.')

    // Publie
    await page.getByRole('button', { name: /publier/i }).click()

    // Vérifie que le rapport apparaît dans la liste
    await expect(page.getByText('Rapport de test Playwright')).toBeVisible({ timeout: 10000 })
  })

})

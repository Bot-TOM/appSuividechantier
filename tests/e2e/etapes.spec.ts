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

test.describe('Technicien — Étapes', () => {

  test('Peut voir les étapes du chantier assigné', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)
    // Les étapes du seed sont visibles
    await expect(page.getByText('Pose des rails')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Pose des panneaux')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Câblage DC')).toBeVisible({ timeout: 5000 })
  })

  test('Peut avancer l\'étape "Pose des panneaux" (en_cours → fait)', async ({ page }) => {
    await loginTech(page)
    await page.goto(`/chantier/${CHANTIER_1}`)
    await expect(page.getByText('Pose des panneaux')).toBeVisible({ timeout: 10000 })

    // Cherche le bouton "Terminer →" (état en_cours)
    const terminerBtn = page.getByRole('button', { name: /terminer/i }).first()
    await expect(terminerBtn).toBeVisible({ timeout: 5000 })
    await terminerBtn.click()

    // Vérifie que l'étape est maintenant terminée (bouton ↺ ou état "fait")
    await expect(page.getByRole('button', { name: /↺/ }).or(
      page.getByText(/terminé|fait/i).first()
    )).toBeVisible({ timeout: 8000 })
  })

})

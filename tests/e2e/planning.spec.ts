import { test, expect, Page } from '@playwright/test'

const MANAGER_EMAIL = process.env.TEST_MANAGER_EMAIL    ?? 'manager.test@pvpilot.fr'
const MANAGER_PWD   = process.env.TEST_MANAGER_PASSWORD ?? 'TestManager2026!'

async function loginManager(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('votre@email.com').fill(MANAGER_EMAIL)
  await page.getByPlaceholder('••••••••').fill(MANAGER_PWD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/manager/, { timeout: 15000 })
}

test.describe('Manager — Planning', () => {

  test('Peut accéder au planning', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=planning')
    // Le planning doit se charger avec des éléments de navigation (semaine/mois)
    await expect(
      page.getByRole('button', { name: /semaine|mois|aujourd'hui/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('Les techniciens apparaissent dans le planning', async ({ page }) => {
    await loginManager(page)
    await page.goto('/manager?tab=planning')
    // Sam Technicien (notre seed) doit apparaître
    await expect(
      page.getByText('Sam').or(page.getByText('Sam Technicien'))
    ).toBeVisible({ timeout: 10000 })
  })

})

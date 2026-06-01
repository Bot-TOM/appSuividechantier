import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Charge .env.test
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Dossiers HORS OneDrive pour éviter les blocages EPERM
const TEMP = 'C:/Users/tomro/AppData/Local/Temp/pvpilot-tests';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: `${TEMP}/results`,         // résultats hors OneDrive
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: `${TEMP}/report`, open: 'never' }],
    ['line'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Utilise le serveur Vite déjà lancé manuellement
  // → dans un 2ème terminal : npx vite --mode test --cacheDir C:/Users/tomro/AppData/Local/Temp/vite-pvpilot
  webServer: {
    command: 'npx vite --mode test',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

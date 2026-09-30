const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node app.js',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 30_000,
        env: {
          CADASTRO_MAX_TENTATIVAS: '200',
          RECUPERACAO_MAX_TENTATIVAS: '200',
          SUPORTE_MAX_TENTATIVAS: '200',
          OTP_COOLDOWN_SEGUNDOS: '8',
          OTP_VERIFICAR_MAX_TENTATIVAS: '150',
        },
      },
});

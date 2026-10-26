import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit and security tests run without a network or database: Supabase points at a fake host and
// tests/setup.ts makes any unmocked fetch fail. .env.local (the live database) is never loaded.
// tests/live/ calls a deployed site instead, only when BASE_URL is set (npm run test:live).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: process.env.BASE_URL ? [] : ['tests/live/**'],
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      ADMIN_2FA_SECRET: 'test-2fa-secret',
      IP_HASH_SALT: 'test-salt',
      CRON_SECRET: 'test-cron-secret',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      TURNSTILE_SECRET_KEY: '',
      RESEND_API_KEY: '',
      DATABASE_URL: '',
      NEXT_PUBLIC_SITE_URL: '',
      BASE_URL: process.env.BASE_URL ?? '',
    },
  },
});

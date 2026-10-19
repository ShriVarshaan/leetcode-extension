// Deploys the weekly-summary Edge Function and its secrets. Needs `npx supabase login` once.
// Usage: pnpm deploy-weekly            (deploy)
//        pnpm deploy-weekly --send     (also send a test email to the first user now)
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name} in scripts/.env`);
  return v;
};

const url = need('SUPABASE_URL').replace(/\/$/, '');
const dbUrl = need('SUPABASE_DB_URL');
const ref = new URL(url).hostname.split('.')[0]!;
const smtp = {
  SMTP_HOST: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  SMTP_PORT: process.env.SMTP_PORT ?? '465',
  SMTP_USER: need('SMTP_USER'),
  SMTP_PASS: need('SMTP_PASS'),
  SMTP_FROM: process.env.SMTP_FROM ?? `LeetCode Revision Buddy <${need('SMTP_USER')}>`,
};

let cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  cronSecret = randomBytes(24).toString('hex');
  appendFileSync(new URL('../.env', import.meta.url), `\nCRON_SECRET=${cronSecret}\n`);
  console.log('Generated CRON_SECRET and saved it to scripts/.env');
}

function run(cmd: string, args: string[], input?: string) {
  const r = spawnSync(cmd, args, { stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit', input, shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} failed`);
}

// 1. Vault secrets read by the pg_cron job. Values go through psql variables, not string concatenation.
run(
  'psql',
  [dbUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-v', `url=${url}`, '-v', `secret=${cronSecret}`],
  `delete from vault.secrets where name in ('project_url', 'weekly_summary_cron_secret');
   select vault.create_secret(:'url', 'project_url');
   select vault.create_secret(:'secret', 'weekly_summary_cron_secret');`,
);
console.log('Vault secrets set');

// 2. Function secrets, via a temporary env file so they don't appear in the process list.
const dir = mkdtempSync(join(tmpdir(), 'weekly-'));
try {
  const envFile = join(dir, 'secrets.env');
  writeFileSync(
    envFile,
    Object.entries({ ...smtp, CRON_SECRET: cronSecret })
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('\n'),
  );
  run('npx', ['-y', 'supabase@2', 'secrets', 'set', '--project-ref', ref, '--env-file', envFile]);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 3. Deploy. JWT verification is off because pg_cron authenticates with x-cron-secret instead.
run('npx', ['-y', 'supabase@2', 'functions', 'deploy', 'weekly-summary', '--project-ref', ref, '--no-verify-jwt', '--use-api', '--workdir', '..']);

if (process.argv.includes('--send')) {
  const users = await fetch(`${url}/rest/v1/user_settings?select=user_id&limit=1`, {
    headers: { apikey: need('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${need('SUPABASE_SERVICE_ROLE_KEY')}` },
  }).then((r) => r.json() as Promise<{ user_id: string }[]>);
  if (!users[0]) throw new Error('No users yet');
  const res = await fetch(`${url}/functions/v1/weekly-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
    body: JSON.stringify({ user_id: users[0].user_id }),
  });
  console.log(`Test send: HTTP ${res.status}`, await res.text());
}

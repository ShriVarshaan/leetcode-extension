// Verifies scripts/.env without printing secrets.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in scripts/.env');
if (url.includes('your-project-ref') || key.includes('your-service-role-key')) {
  throw new Error('scripts/.env still has the placeholder values');
}

let keyType = 'unknown';
if (key.startsWith('sb_secret_')) keyType = 'secret key';
else if (key.startsWith('sb_publishable_')) keyType = 'publishable key (wrong one: use the secret/service_role key)';
else if (key.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')) as { role?: string };
  keyType = `legacy JWT, role=${payload.role}`;
}
console.log('Key type:', keyType);

// Only a service-role key can call the auth admin API.
const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/admin/users?per_page=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
console.log(res.ok ? 'Service role key works' : `Admin API returned HTTP ${res.status}`);

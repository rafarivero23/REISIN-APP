import bcrypt from 'bcryptjs';

// Creates the tables (if needed) and the first admin login.
// Runs standalone via tsx, so load .env ourselves (Node 20.6+ built-in).
try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file — fine if DATABASE_URL is already exported in the shell.
}

import { findUserByEmail, createUser } from '../src/lib/repo';
import { pool } from '../src/lib/db';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'rr@optimistinc.mx';
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  const name = process.env.SEED_ADMIN_NAME || 'Rafa';
  if (await findUserByEmail(email)) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }
  await createUser({ name, email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
  console.log(`Created admin ${email} with password "${password}". Change it after your first login by adding a new user in Equipo Reisin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

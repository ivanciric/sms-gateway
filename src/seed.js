import db from './db/index.js';
import { generateApiKey, hashPassword } from './auth/index.js';

const users = [
  {
    name: 'Admin Korisnik',
    email: 'admin@sms-gateway.local',
    project: 'Administracija',
    password: 'admin123',
    role: 'admin',
  },
  {
    name: 'Marko Petrović',
    email: 'marko@example.com',
    project: 'Parking Sistem',
    password: 'marko123',
    role: 'user',
  },
  {
    name: 'Ana Jovanović',
    email: 'ana@example.com',
    project: 'Alarm Notifikacije',
    password: 'ana123',
    role: 'user',
  },
];

const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get();
if (existing.count > 0) {
  console.log('Database already seeded, skipping.');
  process.exit(0);
}

const insertUser = db.prepare(
  `INSERT INTO users (name, email, project, password_hash, role) VALUES (?, ?, ?, ?, ?)`
);
const insertKey = db.prepare(
  `INSERT INTO api_keys (user_id, key_hash, key_prefix, label, callback_url) VALUES (?, ?, ?, ?, ?)`
);

const seed = db.transaction(() => {
  for (const u of users) {
    const result = insertUser.run(u.name, u.email, u.project, hashPassword(u.password), u.role);
    const userId = result.lastInsertRowid;

    const { fullKey, keyHash, keyPrefix } = generateApiKey();
    insertKey.run(userId, keyHash, keyPrefix, 'Default', null);

    console.log(`Created user: ${u.email} (${u.role})`);
    console.log(`  Password: ${u.password}`);
    console.log(`  API Key:  ${fullKey}`);
    console.log('');
  }
});

seed();
console.log('Seed completed.');

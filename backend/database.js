const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'biofarma.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    ruolo TEXT NOT NULL DEFAULT 'user' CHECK(ruolo IN ('admin', 'user')),
    attivo INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_jti TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    logout_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sezione_id TEXT NOT NULL,
    sezione_titolo TEXT,
    ingresso_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uscita_at DATETIME,
    durata_secondi INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics(user_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_sezione ON analytics(sezione_id);
  CREATE INDEX IF NOT EXISTS idx_sessioni_user ON sessioni(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessioni_jti ON sessioni(token_jti);
`);

// Create default admin if not exists
const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@biofarma.it');
if (!admin) {
  const hash = bcrypt.hashSync('Admin2026!', 12);
  db.prepare(
    'INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)'
  ).run('Amministratore', 'admin@biofarma.it', hash, 'admin');
  console.log('[DB] Utente admin creato: admin@biofarma.it');
}

module.exports = db;

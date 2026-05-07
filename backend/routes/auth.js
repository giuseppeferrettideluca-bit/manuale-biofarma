const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('crypto');
const db = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'biofarma_sap_wm_secret_2026_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

function generateJTI() {
  return require('crypto').randomUUID();
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password obbligatorie.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND attivo = 1').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenziali non valide.' });
  }

  const jti = generateJTI();
  const token = jwt.sign(
    { sub: user.id, email: user.email, ruolo: user.ruolo, nome: user.nome, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  db.prepare(
    'INSERT INTO sessioni (user_id, token_jti, ip_address, user_agent) VALUES (?, ?, ?, ?)'
  ).run(user.id, jti, ip, ua);

  res.json({
    token,
    user: { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo }
  });
});

// POST /api/auth/bypass  — accesso diretto per ruolo (nessuna password richiesta)
router.post('/bypass', (req, res) => {
  const { ruolo } = req.body;
  if (!['admin', 'user'].includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido.' });
  }

  let user;
  if (ruolo === 'admin') {
    user = db.prepare('SELECT * FROM users WHERE ruolo = ? AND attivo = 1 LIMIT 1').get('admin');
  } else {
    user = db.prepare('SELECT * FROM users WHERE ruolo = ? AND attivo = 1 LIMIT 1').get('user');
    if (!user) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('utente', 10);
      db.prepare('INSERT OR IGNORE INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)').run('Utente Demo', 'utente@biofarma.it', hash, 'user');
      user = db.prepare('SELECT * FROM users WHERE email = ?').get('utente@biofarma.it');
    }
  }

  if (!user) return res.status(500).json({ error: 'Nessun utente disponibile.' });

  const jti = generateJTI();
  const token = jwt.sign(
    { sub: user.id, email: user.email, ruolo: user.ruolo, nome: user.nome, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ua = req.headers['user-agent'] || '';
  db.prepare('INSERT INTO sessioni (user_id, token_jti, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(user.id, jti, ip, ua);

  res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, ruolo: user.ruolo } });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE sessioni SET logout_at = CURRENT_TIMESTAMP WHERE token_jti = ?')
    .run(req.user.jti);
  res.json({ message: 'Logout effettuato.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, nome, email, ruolo, created_at FROM users WHERE id = ?').get(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
  res.json(user);
});

// Middleware: verifica JWT
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante.' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token non valido o scaduto.' });
  }
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.JWT_SECRET = JWT_SECRET;

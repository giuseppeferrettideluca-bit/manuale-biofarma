const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

// Middleware: solo admin
function requireAdmin(req, res, next) {
  if (req.user.ruolo !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
  }
  next();
}

// GET /api/admin/utenti — lista tutti gli utenti
router.get('/utenti', requireAuth, requireAdmin, (req, res) => {
  const utenti = db.prepare(`
    SELECT
      u.id, u.nome, u.email, u.ruolo, u.attivo, u.created_at,
      MAX(s.login_at) as ultima_sessione,
      COUNT(DISTINCT s.id) as num_sessioni,
      SUM(COALESCE(a.durata_secondi, 0)) as tempo_totale_secondi,
      COUNT(DISTINCT a.sezione_id) as sezioni_lette
    FROM users u
    LEFT JOIN sessioni s ON s.user_id = u.id
    LEFT JOIN analytics a ON a.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(utenti);
});

// GET /api/admin/utenti/:id/dettaglio — dettaglio letture di un utente
router.get('/utenti/:id/dettaglio', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.prepare('SELECT id, nome, email, ruolo, attivo, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Utente non trovato.' });

  const sezioni = db.prepare(`
    SELECT
      sezione_id, sezione_titolo,
      COUNT(*) as visite,
      MAX(ingresso_at) as ultima_visita,
      SUM(COALESCE(durata_secondi, 0)) as tempo_totale_secondi
    FROM analytics
    WHERE user_id = ?
    GROUP BY sezione_id
    ORDER BY ultima_visita DESC
  `).all(userId);

  const sessioni = db.prepare(`
    SELECT id, ip_address, login_at, logout_at, user_agent
    FROM sessioni
    WHERE user_id = ?
    ORDER BY login_at DESC
    LIMIT 20
  `).all(userId);

  res.json({ user, sezioni, sessioni });
});

// POST /api/admin/utenti — crea nuovo utente
router.post('/utenti', requireAuth, requireAdmin, (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e password obbligatori.' });
  }
  if (ruolo && !['admin', 'user'].includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email già registrata.' });

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (nome, email, password, ruolo) VALUES (?, ?, ?, ?)'
  ).run(nome, email.toLowerCase().trim(), hash, ruolo || 'user');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Utente creato.' });
});

// PATCH /api/admin/utenti/:id — modifica utente (attivo, ruolo, nome)
router.patch('/utenti/:id', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { nome, ruolo, attivo, password } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Utente non trovato.' });

  // Prevent admin from disabling themselves
  if (req.user.sub === userId && attivo === 0) {
    return res.status(400).json({ error: 'Non puoi disattivare il tuo account.' });
  }

  if (nome !== undefined) db.prepare('UPDATE users SET nome = ? WHERE id = ?').run(nome, userId);
  if (ruolo !== undefined && ['admin', 'user'].includes(ruolo)) {
    db.prepare('UPDATE users SET ruolo = ? WHERE id = ?').run(ruolo, userId);
  }
  if (attivo !== undefined) db.prepare('UPDATE users SET attivo = ? WHERE id = ?').run(attivo ? 1 : 0, userId);
  if (password) {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
  }

  res.json({ message: 'Utente aggiornato.' });
});

// DELETE /api/admin/utenti/:id — elimina utente
router.delete('/utenti/:id', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  if (req.user.sub === userId) {
    return res.status(400).json({ error: 'Non puoi eliminare il tuo account.' });
  }
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Utente non trovato.' });
  res.json({ message: 'Utente eliminato.' });
});

// GET /api/admin/statistiche — statistiche globali per dashboard
router.get('/statistiche', requireAuth, requireAdmin, (req, res) => {
  const totaleUtenti = db.prepare('SELECT COUNT(*) as n FROM users WHERE ruolo = ?').get('user').n;
  const utentiAttivi = db.prepare('SELECT COUNT(*) as n FROM users WHERE attivo = 1').get().n;

  const sezioniPopolare = db.prepare(`
    SELECT sezione_id, sezione_titolo,
           COUNT(*) as visite,
           COUNT(DISTINCT user_id) as utenti_unici,
           AVG(COALESCE(durata_secondi, 0)) as durata_media
    FROM analytics
    GROUP BY sezione_id
    ORDER BY visite DESC
    LIMIT 15
  `).all();

  const accessiUltime24h = db.prepare(`
    SELECT COUNT(*) as n FROM sessioni
    WHERE login_at >= datetime('now', '-24 hours')
  `).get().n;

  const accessiPerGiorno = db.prepare(`
    SELECT date(login_at) as giorno, COUNT(*) as accessi
    FROM sessioni
    WHERE login_at >= datetime('now', '-30 days')
    GROUP BY giorno
    ORDER BY giorno
  `).all();

  res.json({
    totaleUtenti,
    utentiAttivi,
    sezioniPopolare,
    accessiUltime24h,
    accessiPerGiorno
  });
});

module.exports = router;

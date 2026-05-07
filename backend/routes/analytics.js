const express = require('express');
const db = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

// POST /api/analytics/ingresso — utente entra in una sezione
router.post('/ingresso', requireAuth, (req, res) => {
  const { sezione_id, sezione_titolo } = req.body;
  if (!sezione_id) return res.status(400).json({ error: 'sezione_id obbligatorio.' });

  const result = db.prepare(
    'INSERT INTO analytics (user_id, sezione_id, sezione_titolo) VALUES (?, ?, ?)'
  ).run(req.user.sub, sezione_id, sezione_titolo || sezione_id);

  res.json({ id: result.lastInsertRowid, message: 'Ingresso registrato.' });
});

// POST /api/analytics/uscita — utente lascia una sezione
router.post('/uscita', requireAuth, (req, res) => {
  const { record_id } = req.body;
  if (!record_id) return res.status(400).json({ error: 'record_id obbligatorio.' });

  db.prepare(`
    UPDATE analytics
    SET uscita_at = CURRENT_TIMESTAMP,
        durata_secondi = CAST((julianday('now') - julianday(ingresso_at)) * 86400 AS INTEGER)
    WHERE id = ? AND user_id = ? AND uscita_at IS NULL
  `).run(record_id, req.user.sub);

  res.json({ message: 'Uscita registrata.' });
});

// GET /api/analytics/mio-progresso — progresso dell'utente loggato
router.get('/mio-progresso', requireAuth, (req, res) => {
  const sezioni = db.prepare(`
    SELECT
      sezione_id,
      sezione_titolo,
      COUNT(*) as visite,
      MAX(ingresso_at) as ultima_visita,
      SUM(COALESCE(durata_secondi, 0)) as tempo_totale_secondi
    FROM analytics
    WHERE user_id = ?
    GROUP BY sezione_id
    ORDER BY ultima_visita DESC
  `).all(req.user.sub);

  res.json(sezioni);
});

module.exports = router;

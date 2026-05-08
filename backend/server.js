try { require('dotenv').config(); } catch {}
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend statico
app.use(express.static(path.join(__dirname, 'frontend')));

// --- Routes API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback SPA: serve index (login) per tutte le rotte non-API
app.get(/^(?!\/api).*/, (req, res) => {
  const file = req.path === '/admin' ? 'admin.html'
             : req.path === '/manuale' ? 'manuale.html'
             : 'login.html';
  res.sendFile(path.join(__dirname, 'frontend', file));
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Errore interno del server.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Manuale Biofarma in ascolto su http://localhost:${PORT}`);
});

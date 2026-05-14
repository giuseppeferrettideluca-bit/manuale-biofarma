const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'ideas.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and file exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
}

function readIdeas() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function writeIdeas(ideas) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(ideas, null, 2));
}

// GET /api/ideas — returns all ideas, newest first
app.get('/api/ideas', (req, res) => {
    const ideas = readIdeas();
    res.json(ideas.reverse());
});

// POST /api/ideas — adds a new idea
app.post('/api/ideas', (req, res) => {
    const { author, text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Il testo dell\'idea è obbligatorio.' });
    }

    const ideas = readIdeas();
    const newIdea = {
        id: Date.now(),
        author: (author || '').trim() || 'Anonimo',
        text: text.trim(),
        created_at: new Date().toISOString()
    };
    ideas.push(newIdea);
    writeIdeas(ideas);

    res.status(201).json(newIdea);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[SERVER] AI Mockup Academy in ascolto su http://localhost:${PORT}`);
});

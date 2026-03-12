const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'data', 'games.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    UNIQUE(game_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(date);
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Games CRUD
app.get('/api/games', (req, res) => {
  res.json(db.prepare('SELECT * FROM games ORDER BY name').all());
});

app.post('/api/games', (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) return res.status(400).json({ error: 'name and color required' });
  try {
    const result = db.prepare('INSERT INTO games (name, color) VALUES (?, ?)').run(name.trim(), color);
    res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Game already exists' });
    throw e;
  }
});

app.delete('/api/games/:id', (req, res) => {
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Logs
app.get('/api/logs', (req, res) => {
  res.json(db.prepare(`
    SELECT l.date, l.game_id, g.name, g.color
    FROM logs l JOIN games g ON l.game_id = g.id
    ORDER BY l.date DESC
  `).all());
});

app.post('/api/logs', (req, res) => {
  const { game_id, date } = req.body;
  if (!game_id || !date) return res.status(400).json({ error: 'game_id and date required' });
  try {
    db.prepare('INSERT INTO logs (game_id, date) VALUES (?, ?)').run(game_id, date);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.json({ ok: true, duplicate: true });
    throw e;
  }
});

app.delete('/api/logs', (req, res) => {
  const { game_id, date } = req.body;
  db.prepare('DELETE FROM logs WHERE game_id = ? AND date = ?').run(game_id, date);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => console.log(`Game Tracker running on http://localhost:${PORT}`));

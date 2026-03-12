# Game Tracker

A minimal, self-hosted game tracking app. Each day is a colored dot representing what you played. Multiple games show as a split dot.

![Dark theme, dot calendar layout](https://img.shields.io/badge/theme-dark-1a1a1a)

## Quick Start

```bash
git clone <repo-url>
cd game-tracker
npm install
npm start
```

Open `http://localhost:3300` in your browser.

## How It Works

- On load, a modal asks what you played today
- Select games or add new ones with a custom color
- The calendar shows 6 months of history as colored dots
- Click any dot to edit that day's log
- Hover a dot to see game names

## Stack

- **Backend:** Node.js + Express + SQLite (via better-sqlite3)
- **Frontend:** Vanilla JS + CSS (no build step)
- **Database:** SQLite file stored in `data/games.db` (auto-created on first run)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3300`  | Server port |

```bash
PORT=8080 npm start
```

## Project Structure

```
game-tracker/
├── server.js          # Express API server + SQLite setup
├── public/
│   ├── index.html     # Single page app
│   ├── style.css      # Dark theme styles
│   └── app.js         # Client-side logic
├── data/              # SQLite database (gitignored)
├── package.json
└── .gitignore
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List all games |
| POST | `/api/games` | Add game `{name, color}` |
| DELETE | `/api/games/:id` | Delete game + history |
| GET | `/api/logs` | All play logs |
| POST | `/api/logs` | Log a game `{game_id, date}` |
| DELETE | `/api/logs` | Remove log `{game_id, date}` |

## Notes

- No authentication — designed for personal/homelab use
- No external dependencies at runtime (no CDN, no build tools)
- Database is auto-created on first run, no setup needed
- The `data/` directory is gitignored to keep your history private

const COLORS = [
  '#7c5cfc', '#fc5c7c', '#5cfc7c', '#fcb85c', '#5cbdfc',
  '#fc5cdc', '#5cfcec', '#fce45c', '#b85cfc', '#5cfc9e',
  '#fc8c5c', '#5c6dfc', '#e05cfc', '#5cfcb8', '#fc5c5c',
];

let games = [];
let logs = [];
let selectedDate = todayStr();
let selectedGameIds = new Set();
let gameNotes = {};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

async function api(path, opts) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
}

async function loadData() {
  [games, logs] = await Promise.all([api('/games'), api('/logs')]);
}

// --- View Modal (read-only) ---
function openView(date) {
  const logsForDate = logs.filter(l => l.date === date);
  const viewGames = document.getElementById('view-games');
  const isToday = date === todayStr();

  document.getElementById('view-title').textContent = isToday ? 'Today' : formatDate(date).split(',')[0];
  document.getElementById('view-date').textContent = formatDate(date);

  if (logsForDate.length === 0) {
    viewGames.innerHTML = '<div class="view-empty">Nothing logged</div>';
  } else {
    viewGames.innerHTML = logsForDate.map(l => `
      <div class="view-game">
        <div class="view-game-header">
          <div class="dot" style="background: ${l.color}"></div>
          <span class="name">${esc(l.name)}</span>
        </div>
        ${l.note ? `<div class="view-game-note">${esc(l.note)}</div>` : ''}
      </div>
    `).join('');
  }

  // Wire edit button to open edit modal for this date
  document.getElementById('view-edit-btn').onclick = () => {
    closeView();
    openEditModal(date);
  };

  document.getElementById('view-overlay').classList.add('active');
}

function closeView() {
  document.getElementById('view-overlay').classList.remove('active');
}

// --- Edit Modal ---
function openEditModal(date) {
  selectedDate = date || todayStr();
  const isToday = selectedDate === todayStr();
  document.getElementById('edit-title').textContent = isToday ? 'What did you play today?' : 'Edit ' + formatDate(selectedDate).split(',')[0];
  document.getElementById('modal-date').textContent = formatDate(selectedDate);

  const logsForDate = logs.filter(l => l.date === selectedDate);
  selectedGameIds = new Set(logsForDate.map(l => l.game_id));
  gameNotes = {};
  logsForDate.forEach(l => { if (l.note) gameNotes[l.game_id] = l.note; });

  renderGameList();
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('new-game-name').focus();
}

function closeEditModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function renderGameList() {
  const list = document.getElementById('game-list');
  const isSelected = id => selectedGameIds.has(id);
  list.innerHTML = games.map(g => `
    <div class="game-item ${isSelected(g.id) ? 'selected' : ''}" data-id="${g.id}">
      <div class="game-item-header">
        <div class="dot" style="background: ${g.color}"></div>
        <span class="name">${esc(g.name)}</span>
        <button class="delete-game" data-id="${g.id}" title="Delete game">&times;</button>
      </div>
      <input type="text" class="note-input ${isSelected(g.id) ? 'visible' : ''}" data-id="${g.id}"
        placeholder="Add a note..." value="${esc(gameNotes[g.id] || '')}">
    </div>
  `).join('');

  list.querySelectorAll('.game-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-game')) return;
      const el = header.closest('.game-item');
      const id = Number(el.dataset.id);
      const noteInput = el.querySelector('.note-input');
      if (selectedGameIds.has(id)) {
        selectedGameIds.delete(id);
        delete gameNotes[id];
        noteInput.value = '';
      } else {
        selectedGameIds.add(id);
      }
      el.classList.toggle('selected');
      noteInput.classList.toggle('visible');
      if (selectedGameIds.has(id)) noteInput.focus();
    });
  });

  list.querySelectorAll('.note-input').forEach(input => {
    input.addEventListener('input', () => {
      gameNotes[Number(input.dataset.id)] = input.value;
    });
    input.addEventListener('click', e => e.stopPropagation());
  });

  list.querySelectorAll('.delete-game').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.id);
      const game = games.find(g => g.id === id);
      if (!confirm(`Delete "${game.name}"? This removes all its history.`)) return;
      await api(`/games/${id}`, { method: 'DELETE' });
      await loadData();
      selectedGameIds.delete(id);
      renderGameList();
      renderCalendar();
      renderLegend();
    });
  });
}

async function addGame() {
  const nameInput = document.getElementById('new-game-name');
  const colorInput = document.getElementById('new-game-color');
  const name = nameInput.value.trim();
  if (!name) return;

  const color = colorInput.value;
  const result = await api('/games', { method: 'POST', body: { name, color } });
  if (result.error) return alert(result.error);

  await loadData();
  selectedGameIds.add(result.id);
  nameInput.value = '';
  const nextIdx = (COLORS.indexOf(color) + 1) % COLORS.length;
  colorInput.value = COLORS[nextIdx >= 0 ? nextIdx : Math.floor(Math.random() * COLORS.length)];
  renderGameList();
  renderLegend();
}

async function saveLogs() {
  const existingForDate = logs.filter(l => l.date === selectedDate);
  const existingIds = new Set(existingForDate.map(l => l.game_id));

  const toAdd = [...selectedGameIds].filter(id => !existingIds.has(id));
  const toRemove = [...existingIds].filter(id => !selectedGameIds.has(id));
  const toUpdate = [...selectedGameIds].filter(id => existingIds.has(id));

  await Promise.all([
    ...toAdd.map(game_id => api('/logs', { method: 'POST', body: { game_id, date: selectedDate, note: gameNotes[game_id] || '' } })),
    ...toUpdate.map(game_id => api('/logs', { method: 'POST', body: { game_id, date: selectedDate, note: gameNotes[game_id] || '' } })),
    ...toRemove.map(game_id => api('/logs', { method: 'DELETE', body: { game_id, date: selectedDate } })),
  ]);

  const scrollY = window.scrollY;
  await loadData();
  renderCalendar();
  renderLegend();
  window.scrollTo({ top: scrollY });
  closeEditModal();
}

// --- Calendar ---
function renderCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayS = todayStr();

  const start = new Date(today);
  start.setMonth(start.getMonth() - 6);
  const dayOfWeek = start.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + diffToMon);

  const logsByDate = {};
  logs.forEach(l => {
    if (!logsByDate[l.date]) logsByDate[l.date] = [];
    logsByDate[l.date].push(l);
  });

  let currentMonth = -1;
  const cursor = new Date(start);

  while (cursor <= today || cursor.getDay() !== 1) {
    if (cursor > today && cursor.getDay() === 1) break;

    if (cursor.getMonth() !== currentMonth && cursor.getDay() === 1) {
      currentMonth = cursor.getMonth();
      const label = document.createElement('div');
      label.className = 'month-label';
      label.textContent = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      cal.appendChild(label);
    }

    const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    const dayLogs = logsByDate[dateStr] || [];
    const isFuture = cursor > today;
    const isToday = dateStr === todayS;

    const dot = document.createElement('div');
    dot.className = 'day' + (isToday ? ' today' : '') + (isFuture ? ' future' : '');
    dot.dataset.date = dateStr;

    if (dayLogs.length === 1) {
      dot.style.background = dayLogs[0].color;
    } else if (dayLogs.length > 1) {
      const stops = dayLogs.map((l, i) => {
        const pct1 = (i / dayLogs.length) * 100;
        const pct2 = ((i + 1) / dayLogs.length) * 100;
        return `${l.color} ${pct1}% ${pct2}%`;
      }).join(', ');
      dot.style.background = `conic-gradient(${stops})`;
    }

    if (dayLogs.length > 0) {
      dot.dataset.tooltip = dayLogs.map(l => l.note ? `${l.name}: ${l.note}` : l.name).join(' | ');
    }

    // Click: show view modal (info), not edit
    dot.addEventListener('click', () => openView(dateStr));
    cal.appendChild(dot);

    cursor.setDate(cursor.getDate() + 1);
  }
}

function renderLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = games.map(g =>
    `<div class="legend-item"><div class="dot" style="background:${g.color}"></div>${esc(g.name)}</div>`
  ).join('');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Init ---
document.getElementById('view-close-btn').addEventListener('click', closeView);
document.getElementById('view-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeView();
});
document.getElementById('cancel-btn').addEventListener('click', closeEditModal);
document.getElementById('save-btn').addEventListener('click', saveLogs);
document.getElementById('add-game-btn').addEventListener('click', addGame);
document.getElementById('open-modal-btn').addEventListener('click', () => openEditModal());
document.getElementById('new-game-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addGame();
});
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

(async () => {
  await loadData();
  renderLegend();
  renderCalendar();
  // Scroll to bottom (most recent) on initial load
  window.scrollTo({ top: document.body.scrollHeight });
  // Auto-open edit modal on first visit
  openEditModal();
})();

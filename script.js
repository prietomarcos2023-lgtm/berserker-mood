/* ============================================================
   BITÁCORA DEL SOBERANO — motor de puntaje
   Filosofía: el número sube por el proceso, no por el resultado.
   ============================================================ */

const STORAGE_KEY = "bitacora-soberano-v1";

/* ============================================================
   NIVEL 1-100 (estilo Solo Leveling) — calculado directo de
   4 stats ancla, no de un contador de XP acumulado por clics.
   Pesos: el retiro de trading es el que más pesa (40 pts),
   porque es lo que más lo va a levelear a futuro.
   ============================================================ */
const LEVEL_WEIGHTS = { bench: 33, payout: 40, english: 17, sprint: 10 };

const ENGLISH_LEVELS = [
  { key: "none",      label: "Sin empezar", pts: 0 },
  { key: "A1",         label: "A1",          pts: 3 },
  { key: "A2",         label: "A2",          pts: 6 },
  { key: "B1",         label: "B1",          pts: 9 },
  { key: "B2",         label: "B2",          pts: 13 },
  { key: "Avanzado",   label: "Avanzado",    pts: 17 }
];

const HUNTER_RANKS = [
  { min: 0,  label: "E-Rank Hunter",           desc: "Apenas despertaste. Todo lo demás se construye desde acá." },
  { min: 15, label: "D-Rank Hunter",            desc: "El sistema empieza a reconocerte." },
  { min: 30, label: "C-Rank Hunter",            desc: "Ya no es casualidad. Es método." },
  { min: 45, label: "B-Rank Hunter",            desc: "El cuerpo y el capital empiezan a moverse juntos." },
  { min: 60, label: "A-Rank Hunter",            desc: "Pocos llegan acá sin romperse antes." },
  { min: 75, label: "S-Rank Hunter",            desc: "Nivel de élite. El sistema sos vos." },
  { min: 90, label: "Monarca de las Sombras",   desc: "No queda nada que demostrar. Solo ejecutar." }
];

function englishPts(key) {
  const e = ENGLISH_LEVELS.find(x => x.key === key) || ENGLISH_LEVELS[0];
  return e.pts;
}

function sprintPts(time) {
  if (!time || time <= 0) return 0;
  return Math.max(0, Math.min(LEVEL_WEIGHTS.sprint, Math.round(21 - time)));
}

function computeLevel(s) {
  const benchPts   = Math.min(LEVEL_WEIGHTS.bench, (s.benchBest / 100) * LEVEL_WEIGHTS.bench);
  const payoutPts  = Math.min(LEVEL_WEIGHTS.payout, (s.payoutTotal / 1000) * LEVEL_WEIGHTS.payout);
  const engPts     = englishPts(s.englishLevel);
  const sprPts     = sprintPts(s.sprintTime);
  const total = benchPts + payoutPts + engPts + sprPts;
  return Math.max(1, Math.min(100, Math.round(total)));
}

function getRank(level) {
  let current = HUNTER_RANKS[0];
  for (const r of HUNTER_RANKS) if (level >= r.min) current = r;
  return current;
}

const HABITS = [
  { id: "entreno",  label: "Entreno del día (fuerza o cardio bajo impacto)" },
  { id: "trading",  label: "Sesión Londres 3am (protocolo circadiano)" },
  { id: "ayuno",    label: "Ayuno luna llena (48/72hs)" },
  { id: "meditacion", label: "Meditación en el alba" }
];

const DAY_MS = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY_MS);

function defaultState() {
  const habits = {};
  HABITS.forEach(h => { habits[h.id] = { streak: 0, lives: 2, lastDate: null }; });
  return {
    xp: 0,
    habits,
    payoutTotal: 0,
    benchBest: 0,
    weightCurrent: 98,
    englishLevel: "none",
    sprintTime: null,
    trades: [],
    gymSessions: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const merged = { ...defaultState(), ...parsed };
    // asegura que cualquier hábito nuevo agregado al sistema exista en el estado guardado
    const defaultHabits = defaultState().habits;
    merged.habits = { ...defaultHabits, ...(parsed.habits || {}) };
    return merged;
  } catch { return defaultState(); }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---------- Cofre: recompensa variable ---------- */
function maybeChest(baseLabel) {
  if (Math.random() < 0.22) {
    const bonus = Math.floor(Math.random() * 16) + 5; // 5-20
    state.xp += bonus;
    showChest(`Cofre — ${baseLabel} +${bonus} XP extra`);
  }
}

function showChest(msg) {
  const el = document.getElementById("chest-toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- Nivel ---------- */
function renderStage() {
  const level = computeLevel(state);
  const rank = getRank(level);
  document.getElementById("stage-numeral").textContent = level;
  document.getElementById("stage-name").textContent = `Nivel ${level} / 100`;
  document.getElementById("stage-desc").textContent = `${rank.label} — ${rank.desc}`;
  document.getElementById("xp-fill").style.width = level + "%";
  document.getElementById("xp-label").textContent = `${level} / 100`;
}

/* ---------- Hábitos: procesar días perdidos ---------- */
function reconcileHabit(id) {
  const h = state.habits[id];
  if (!h.lastDate) return;
  const gap = daysBetween(h.lastDate, todayStr());
  if (gap <= 1) return; // al día o hoy mismo
  let missed = gap - 1;
  while (missed > 0) {
    if (h.lives > 0) {
      h.lives -= 1;
    } else {
      h.streak = 0;
      h.lives = 2;
    }
    missed -= 1;
  }
}

function renderHabits() {
  const grid = document.getElementById("habits-grid");
  grid.innerHTML = "";
  HABITS.forEach(hDef => {
    reconcileHabit(hDef.id);
    const h = state.habits[hDef.id];
    const doneToday = h.lastDate === todayStr();

    const card = document.createElement("div");
    card.className = "habit";
    card.innerHTML = `
      <div class="habit-header">
        <span class="habit-label">${hDef.label}</span>
        <span class="streak-count">${h.streak}<span style="font-size:0.6em;color:var(--parchment-dim)">d</span></span>
      </div>
      <div class="lives">
        ${[0, 1].map(i => `<span class="life-dot ${i < h.lives ? "" : "spent"}"></span>`).join("")}
      </div>
      <button class="habit-check ${doneToday ? "done" : ""}" data-habit="${hDef.id}">
        ${doneToday ? "✓ hecho hoy" : "Marcar hecho hoy"}
      </button>
    `;
    grid.appendChild(card);
  });
  saveState();
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".habit-check");
  if (!btn) return;
  const id = btn.dataset.habit;
  const h = state.habits[id];
  if (h.lastDate === todayStr()) return; // ya marcado

  const wasYesterday = h.lastDate && daysBetween(h.lastDate, todayStr()) === 1;
  h.streak = wasYesterday || h.streak === 0 ? h.streak + 1 : 1;
  h.lastDate = todayStr();

  const multiplier = Math.min(2, 1 + Math.floor(h.streak / 7) * 0.1);
  const gained = Math.round(10 * multiplier);
  state.xp += gained;

  const label = HABITS.find(x => x.id === id).label;
  showChest(`+${gained} XP — racha x${h.streak}`);
  maybeChest(label);

  renderHabits();
  renderStage();
});

/* ---------- Metas macro ---------- */
function renderGoals() {
  document.getElementById("payout-current").textContent = "$" + state.payoutTotal;
  document.getElementById("payout-bar").style.width = Math.min(100, (state.payoutTotal / 1000) * 100) + "%";

  document.getElementById("bench-current").textContent = state.benchBest;
  document.getElementById("bench-bar").style.width = Math.min(100, (state.benchBest / 100) * 100) + "%";

  document.getElementById("weight-current").textContent = state.weightCurrent;
  const wPct = Math.min(100, Math.max(0, ((98 - state.weightCurrent) / (98 - 85)) * 100));
  document.getElementById("weight-bar").style.width = wPct + "%";

  const eng = ENGLISH_LEVELS.find(x => x.key === state.englishLevel) || ENGLISH_LEVELS[0];
  document.getElementById("english-current").textContent = eng.label;
  document.getElementById("english-bar").style.width =
    (eng.pts / LEVEL_WEIGHTS.english) * 100 + "%";

  document.getElementById("sprint-current").textContent =
    state.sprintTime ? state.sprintTime + " s" : "— s";
  document.getElementById("sprint-bar").style.width =
    (sprintPts(state.sprintTime) / LEVEL_WEIGHTS.sprint) * 100 + "%";
}

document.querySelector('[data-action="add-payout"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Monto retirado en USD:"));
  if (!val || val <= 0) return;
  state.payoutTotal += val;
  state.xp += Math.round(val * 0.5); // el retiro también alimenta XP, no solo la barra
  renderGoals(); renderStage(); saveState();
  showChest(`Retiro registrado — +${Math.round(val * 0.5)} XP`);
});

document.querySelector('[data-action="add-bench"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Nuevo PR de press de banca (kg):"));
  if (!val || val <= 0) return;
  if (val > state.benchBest) {
    const bonus = Math.round((val - state.benchBest) * 5);
    state.benchBest = val;
    state.xp += bonus;
    showChest(`Nuevo PR — +${bonus} XP`);
  }
  renderGoals(); renderStage(); saveState();
});

document.querySelector('[data-action="add-weight"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Peso actual (kg):"));
  if (!val || val <= 0) return;
  state.weightCurrent = val;
  renderGoals(); saveState();
});

document.querySelector('[data-action="add-english"]').addEventListener("click", () => {
  const opts = ENGLISH_LEVELS.filter(x => x.key !== "none").map(x => x.key).join(" / ");
  const val = (prompt(`Nuevo nivel de inglés (${opts}):`) || "").trim().toUpperCase();
  const match = ENGLISH_LEVELS.find(x => x.key.toUpperCase() === val || x.label.toUpperCase() === val);
  if (!match) return;
  const before = englishPts(state.englishLevel);
  state.englishLevel = match.key;
  if (englishPts(match.key) > before) showChest(`Inglés ${match.label} — nivel actualizado`);
  renderGoals(); renderStage(); saveState();
});

document.querySelector('[data-action="add-sprint"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Tiempo en 100m (segundos):"));
  if (!val || val <= 0) return;
  const improved = !state.sprintTime || val < state.sprintTime;
  state.sprintTime = val;
  if (improved) showChest(`Nuevo tiempo en 100m — ${val}s`);
  renderGoals(); renderStage(); saveState();
});

/* ---------- Trading ---------- */
document.getElementById("trade-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const account = document.getElementById("trade-account").value;
  const rules = document.getElementById("trade-rules").value;
  const result = document.getElementById("trade-result").value;
  const rr = parseFloat(document.getElementById("trade-rr").value) || 0;

  let pts = 0;
  if (rules === "yes") {
    pts += 15;
    if (result === "win" && rr >= 2) pts += 25;
  } else {
    pts -= 30;
  }
  state.xp = Math.max(0, state.xp + pts);
  state.trades.unshift({ account, rules, result, rr, pts, date: todayStr() });
  if (pts > 0) maybeChest("operación disciplinada");

  renderTradeLog(); renderStage(); saveState();
  e.target.reset();
});

function renderTradeLog() {
  const log = document.getElementById("trade-log");
  log.innerHTML = state.trades.slice(0, 12).map(t => `
    <div class="log-row">
      <span>${t.date} · ${t.account} · ${t.result}${t.rr ? " · RR " + t.rr : ""}</span>
      <span class="pts ${t.pts >= 0 ? "pos" : "neg"}">${t.pts >= 0 ? "+" : ""}${t.pts}</span>
    </div>
  `).join("");
}

/* ---------- Gimnasio ---------- */
document.getElementById("gym-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("gym-type").value;
  const note = document.getElementById("gym-note").value;
  const pts = 20;
  state.xp += pts;
  state.gymSessions.unshift({ type, note, pts, date: todayStr() });
  maybeChest("sesión completada");

  renderGymLog(); renderStage(); saveState();
  e.target.reset();
});

function renderGymLog() {
  const log = document.getElementById("gym-log");
  log.innerHTML = state.gymSessions.slice(0, 12).map(g => `
    <div class="log-row">
      <span>${g.date} · ${g.type}${g.note ? " · " + g.note : ""}</span>
      <span class="pts pos">+${g.pts}</span>
    </div>
  `).join("");
}

/* ---------- Utilidades ---------- */
document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Esto borra todo el progreso guardado en este navegador. ¿Seguro?")) return;
  state = defaultState();
  saveState();
  renderAll();
});

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bitacora-backup-${todayStr()}.json`;
  a.click();
});

function renderAll() {
  renderStage();
  renderHabits();
  renderGoals();
  renderTradeLog();
  renderGymLog();
}

renderAll();

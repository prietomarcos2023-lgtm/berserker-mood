/* ============================================================
   BERSERKER MOOD — motor de progresión
   Filosofía: el nivel sube por HITOS REALES Y VERIFICABLES,
   no por actividad ni por planear cosas.
   ============================================================ */

const STORAGE_KEY = "bitacora-soberano-v1";

/* ---------- Trading: sistema de récord mensual ---------- */
const TRADING_MILESTONES = [
  { level: 1, target: 250,   xp: 100,  stacks: 1 },
  { level: 2, target: 500,   xp: 250,  stacks: 2 },
  { level: 3, target: 1000,  xp: 500,  stacks: 3 },
  { level: 4, target: 5000,  xp: 1500, stacks: 5 },
  { level: 5, target: 10000, xp: 3000, stacks: 8 }
];

function recomputeTrading(s) {
  const values = Object.values(s.monthlyPayouts || {});
  const record = values.length ? Math.max(0, ...values) : 0;
  s.tradingRecord = record;
  let level = 0, xp = 0, stacks = 0;
  TRADING_MILESTONES.forEach(m => {
    if (record >= m.target) { level = m.level; xp += m.xp; stacks += m.stacks; }
  });
  s.tradingLevel = level;
  s.tradingXP = xp;
  s.tradingStacks = stacks;
}

function nextTradingMilestone(s) {
  return TRADING_MILESTONES.find(m => s.tradingRecord < m.target) || null;
}

/* ---------- XP fijo por quest única ---------- */
const STRENGTH_TARGET = 100;
const STRENGTH_XP = 2000;
const STRENGTH_STACKS = 3;

const BODY_START = 90;
const BODY_TARGET = 85;
const BODY_XP = 1500;
const BODY_STACKS = 2;

const CAR_XP = 5000;
const CAR_STACKS = 4;

const PARENTS_XP = 10000;
const PARENTS_STACKS = 6;

/* ---------- Nivel global: curva triangular sobre XP real ---------- */
function xpForLevel(L) { return 50 * L * (L + 1); }
function levelFromXP(xp) {
  let L = 0;
  while (xpForLevel(L + 1) <= xp) L++;
  return L;
}

function computeGlobalXP(s) {
  recomputeTrading(s);
  let xp = s.tradingXP;
  let stacks = s.tradingStacks;
  if (s.strengthCompleted) { xp += STRENGTH_XP; stacks += STRENGTH_STACKS; }
  if (s.bodyCompleted)     { xp += BODY_XP;     stacks += BODY_STACKS; }
  if (s.carCompleted)      { xp += CAR_XP;      stacks += CAR_STACKS; }
  if (s.parentsCompleted)  { xp += PARENTS_XP;  stacks += PARENTS_STACKS; }
  s.totalStacks = stacks;
  return xp;
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function buildMonthKeys() {
  // setiembre 2026 -> diciembre 2027
  const keys = [];
  let y = 2026, m = 8; // índice 8 = setiembre (0-based)
  while (!(y === 2027 && m === 11)) {
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m > 11) { m = 0; y++; }
  }
  keys.push("2027-12");
  return keys;
}
const MONTH_KEYS = buildMonthKeys();

const ENGLISH_LEVELS = [
  { key: "none",      label: "Sin empezar" },
  { key: "A1",        label: "A1" },
  { key: "A2",        label: "A2" },
  { key: "B1",        label: "B1" },
  { key: "B2",        label: "B2" },
  { key: "Avanzado",  label: "Avanzado" }
];

const HABITS = [
  { id: "entreno",  label: "Entreno del día (fuerza o cardio bajo impacto)" },
  { id: "trading",  label: "Trading Londres and NY", note: "Los 5 días hábiles de la semana — repetición y probabilidad estadística." },
  { id: "meditacion", label: "Meditación en el alba" }
];

const DAY_MS = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY_MS);

function defaultState() {
  const habits = {};
  HABITS.forEach(h => { habits[h.id] = { streak: 0, lives: 2, lastDate: null }; });
  return {
    habits,
    monthlyPayouts: {},
    tradingRecord: 0, tradingLevel: 0, tradingXP: 0, tradingStacks: 0,
    hakiLog: [],
    benchBest: 0,
    strengthCompleted: false,
    weightCurrent: BODY_START,
    bodyCompleted: false,
    carCompleted: false,
    parentsCompleted: false,
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

function showChest(msg) {
  const el = document.getElementById("chest-toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------- Nivel global ---------- */
function renderStage() {
  const totalXP = computeGlobalXP(state);
  const level = levelFromXP(totalXP);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const pct = ceil > floor ? Math.min(100, ((totalXP - floor) / (ceil - floor)) * 100) : 0;

  document.getElementById("stage-numeral").textContent = level;
  document.getElementById("stage-name").textContent = `LEVEL ${level}`;
  document.getElementById("stage-desc").textContent =
    totalXP === 0
      ? "Cero hitos completados todavía. El sistema no miente."
      : "No sos level alto por planear cosas. Sos level alto por haberlas conseguido.";
  document.getElementById("xp-fill").style.width = pct + "%";
  document.getElementById("xp-label").textContent = `${totalXP} / ${ceil} XP`;
  document.getElementById("total-stacks").textContent = state.totalStacks;
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
      ${hDef.note ? `<p class="habit-note">${hDef.note}</p>` : ""}
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

  renderHabits();
  saveState();
});

/* ---------- Quests principales ---------- */
function renderQuests() {
  // Strength
  document.getElementById("bench-current").textContent = state.benchBest;
  document.getElementById("bench-bar").style.width = Math.min(100, (state.benchBest / STRENGTH_TARGET) * 100) + "%";
  document.getElementById("strength-status").textContent = state.strengthCompleted ? "✓ QUEST COMPLETED" : "";

  // Body
  document.getElementById("weight-current").textContent = state.weightCurrent;
  const wPct = Math.min(100, Math.max(0, ((BODY_START - state.weightCurrent) / (BODY_START - BODY_TARGET)) * 100));
  document.getElementById("weight-bar").style.width = wPct + "%";
  document.getElementById("body-status").textContent = state.bodyCompleted ? "✓ QUEST COMPLETED" : "";

  // Car
  document.getElementById("car-status").textContent = state.carCompleted ? "✓ QUEST COMPLETED" : "";
  document.getElementById("car-btn").disabled = state.carCompleted;
  if (state.carCompleted) document.getElementById("car-btn").textContent = "Ya conseguido";

  document.getElementById("parents-status").textContent = state.parentsCompleted ? "✓ QUEST COMPLETED" : "";
  document.getElementById("parents-btn").disabled = state.parentsCompleted;
  if (state.parentsCompleted) document.getElementById("parents-btn").textContent = "Ya conseguido";

  // Trading
  recomputeTrading(state);
  document.getElementById("trading-record").textContent = state.tradingRecord;
  document.getElementById("trading-level").textContent = state.tradingLevel;
  document.getElementById("trading-xp").textContent = state.tradingXP;
  document.getElementById("trading-stacks").textContent = state.tradingStacks;
  const next = nextTradingMilestone(state);
  const titles = { 0: "FIRST PAYOUT", 1: "PAYOUT $500", 2: "PAYOUT $1.000", 3: "PAYOUT $5.000", 4: "PAYOUT $10.000" };
  document.getElementById("trading-quest-title").textContent = next ? titles[TRADING_MILESTONES.indexOf(next)] : "MAX TRADING LEVEL";
  document.getElementById("trading-next").textContent = next ? `Próximo hito: $${next.target}` : "Todos los hitos desbloqueados";
  const target = next ? next.target : TRADING_MILESTONES[TRADING_MILESTONES.length - 1].target;
  document.getElementById("payout-bar").style.width = Math.min(100, (state.tradingRecord / target) * 100) + "%";
}

/* ---------- Skills en pausa (0 XP) ---------- */
function renderSkills() {
  const eng = ENGLISH_LEVELS.find(x => x.key === state.englishLevel) || ENGLISH_LEVELS[0];
  document.getElementById("english-current").textContent = eng.label;
  document.getElementById("sprint-current").textContent =
    state.sprintTime ? state.sprintTime + " s" : "— s";
}

/* ---------- Retiros mensuales ---------- */
function renderMonths() {
  const grid = document.getElementById("months-grid");
  grid.innerHTML = "";
  MONTH_KEYS.forEach(key => {
    const [y, m] = key.split("-");
    const label = `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
    const amount = state.monthlyPayouts[key] || 0;
    const div = document.createElement("div");
    div.className = "goal month-card";
    div.innerHTML = `
      <span class="goal-label">${label}</span>
      <div class="goal-value">$${amount}</div>
      <button class="mini-btn" data-month="${key}">+ registrar retiro</button>
    `;
    grid.appendChild(div);
  });
}

document.getElementById("months-grid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-month]");
  if (!btn) return;
  const key = btn.dataset.month;
  const val = parseFloat(prompt(`Monto retirado en ${key} (USD) — reemplaza el valor de ese mes:`));
  if (!val || val <= 0) return;
  const prevRecord = state.tradingRecord;
  state.monthlyPayouts[key] = val;
  recomputeTrading(state);
  renderMonths(); renderQuests(); renderStage(); saveState();
  if (state.tradingRecord > prevRecord) {
    const hit = TRADING_MILESTONES.find(m => state.tradingRecord >= m.target && prevRecord < m.target);
    if (hit) {
      showChest(`TRADING LEVEL ${hit.level} — $${hit.target} WITHDRAWN — +${hit.xp} XP — +${hit.stacks} STACK${hit.stacks > 1 ? "S" : ""}`);
    } else {
      showChest(`Nuevo récord: $${state.tradingRecord} (sin nuevo hito todavía)`);
    }
  }
});

/* ---------- Haki del Rey ---------- */
function renderHaki() {
  document.getElementById("haki-count").textContent = state.hakiLog.length;
  const last = state.hakiLog[state.hakiLog.length - 1];
  document.getElementById("haki-last").textContent = last ? `${last.date} (${last.hours}hs)` : "—";
}

document.querySelector('[data-action="add-haki"]').addEventListener("click", () => {
  const hours = prompt("¿48 o 72 horas de ayuno?", "48");
  if (hours !== "48" && hours !== "72") return;
  state.hakiLog.push({ date: todayStr(), hours });
  renderHaki(); saveState();
  showChest(`Haki del Rey completado — ${hours}hs`);
});

document.querySelector('[data-action="add-bench"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Nuevo PR de press de banca (kg):"));
  if (!val || val <= 0) return;
  state.benchBest = val;
  if (val >= STRENGTH_TARGET && !state.strengthCompleted) {
    state.strengthCompleted = true;
    showChest(`STRENGTH QUEST COMPLETED — 100KG BENCH PRESS — +${STRENGTH_XP} XP — +${STRENGTH_STACKS} STACKS`);
  }
  renderQuests(); renderStage(); saveState();
});

document.querySelector('[data-action="add-weight"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Peso actual (kg):"));
  if (!val || val <= 0) return;
  state.weightCurrent = val;
  if (val <= BODY_TARGET && !state.bodyCompleted) {
    state.bodyCompleted = true;
    showChest(`BODY QUEST COMPLETED — 85KG — +${BODY_XP} XP — +${BODY_STACKS} STACKS`);
  }
  renderQuests(); renderStage(); saveState();
});

document.querySelector('[data-action="add-car"]').addEventListener("click", () => {
  if (state.carCompleted) return;
  if (!confirm("¿Confirmás que ya conseguiste tu primer auto? Esto se marca una sola vez.")) return;
  state.carCompleted = true;
  renderQuests(); renderStage(); saveState();
  showChest(`QUEST COMPLETED — MI PRIMER AUTO — +${CAR_XP} XP — +${CAR_STACKS} STACKS`);
});

document.querySelector('[data-action="add-parents"]').addEventListener("click", () => {
  if (state.parentsCompleted) return;
  if (!confirm("¿Confirmás que ya lograste retirar a tus padres? Esto se marca una sola vez.")) return;
  state.parentsCompleted = true;
  renderQuests(); renderStage(); saveState();
  showChest(`QUEST COMPLETED — RETIRAR A MIS PADRES — +${PARENTS_XP} XP — +${PARENTS_STACKS} STACKS`);
});

document.querySelector('[data-action="add-english"]').addEventListener("click", () => {
  const opts = ENGLISH_LEVELS.filter(x => x.key !== "none").map(x => x.key).join(" / ");
  const val = (prompt(`Nuevo nivel de inglés (${opts}):`) || "").trim().toUpperCase();
  const match = ENGLISH_LEVELS.find(x => x.key.toUpperCase() === val || x.label.toUpperCase() === val);
  if (!match) return;
  state.englishLevel = match.key;
  renderSkills(); saveState();
});

document.querySelector('[data-action="add-sprint"]').addEventListener("click", () => {
  const val = parseFloat(prompt("Tiempo en 100m (segundos):"));
  if (!val || val <= 0) return;
  state.sprintTime = val;
  renderSkills(); saveState();
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
  state.trades.unshift({ account, rules, result, rr, pts, date: todayStr() });

  renderTradeLog(); saveState();
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
  state.gymSessions.unshift({ type, note, date: todayStr() });

  renderGymLog(); saveState();
  e.target.reset();
});

function renderGymLog() {
  const log = document.getElementById("gym-log");
  log.innerHTML = state.gymSessions.slice(0, 12).map(g => `
    <div class="log-row">
      <span>${g.date} · ${g.type}${g.note ? " · " + g.note : ""}</span>
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
  renderQuests();
  renderSkills();
  renderMonths();
  renderHaki();
  renderTradeLog();
  renderGymLog();
}

renderAll();

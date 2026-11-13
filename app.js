/* DoneSchool — habit & subject tracker for students and teachers.
   Everything is stored in localStorage, so it works offline with no server. */

const K = {
  p: "doneschool_profile",   // { name, role: "student" | "teacher" }
  h: "doneschool_habits",    // student habits
  s: "doneschool_subjects",  // shared subject catalog
  st: "doneschool_students", // teacher's class list
  e: "doneschool_entries",   // teacher's grade entries
};

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const get = (k, fallback = "[]") => {
  try { return JSON.parse(localStorage.getItem(k) ?? fallback); }
  catch { return JSON.parse(fallback); }
};
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const getProfile  = () => get(K.p, "null");
const getHabits   = () => get(K.h);
const getSubjects = () => get(K.s);
const getStudents = () => get(K.st);
const getEntries  = () => get(K.e);

const saveHabits   = (v) => set(K.h, v);
const saveSubjects = (v) => set(K.s, v);
const saveStudents = (v) => set(K.st, v);
const saveEntries  = (v) => set(K.e, v);

/* ---------- Dates ---------- */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dkey(d = new Date()) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d = new Date()) { return addDays(d, -((d.getDay() + 6) % 7)); }
function last7() { const t = new Date(); return Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)); }
const fmtDate = (k) => { const [y, m, d] = k.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

/* ---------- Seed data (first run only) ---------- */
function seed() {
  if (localStorage.getItem(K.s)) return;
  saveSubjects([
    { id: "s1", name: "Mathematics", color: "#4ea8ff", goalHrs: 6 },
    { id: "s2", name: "English",     color: "#b07dff", goalHrs: 4 },
    { id: "s3", name: "Science",     color: "#5fd39a", goalHrs: 5 },
    { id: "s4", name: "History",     color: "#ffb43a", goalHrs: 3 },
  ]);
  saveHabits([
    { id: "h1", name: "Read 20 pages", emoji: "📖", color: "#4ea8ff", days: [1,2,3,4,5], log: {} },
    { id: "h2", name: "Practice math problems", emoji: "✏️", color: "#5fd39a", days: [1,3,5], log: {} },
    { id: "h3", name: "Sleep by 10 PM", emoji: "😴", color: "#b07dff", days: [0,1,2,3,4,5,6], log: {} },
  ]);
  saveStudents([
    { id: "st1", name: "Ava Thompson",  cls: "10-A", att: {} },
    { id: "st2", name: "Liam Carter",   cls: "10-A", att: {} },
    { id: "st3", name: "Maya Rodriguez", cls: "10-A", att: {} },
  ]);
  saveEntries([]);
}

/* ---------- Streaks ---------- */
const isScheduled = (h, d) => h.days.includes(d.getDay());
const isDone = (h, k) => !!h.log[k];

function streak(h) {
  let d = new Date();
  // start from the most recent scheduled day
  while (!isScheduled(h, d)) d = addDays(d, -1);
  // if it isn't done yet, the streak is the run before it
  if (!isDone(h, dkey(d))) {
    d = addDays(d, -1);
    while (!isScheduled(h, d)) d = addDays(d, -1);
  }
  let n = 0;
  while (isScheduled(h, d) && isDone(h, dkey(d))) {
    n++;
    d = addDays(d, -1);
    while (!isScheduled(h, d)) d = addDays(d, -1);
  }
  return n;
}
function bestStreak(h) {
  let best = 0;
  for (const k of Object.keys(h.log).filter((k) => h.log[k])) {
    const [y, m, d] = k.split("-").map(Number);
    let run = 0, day = new Date(y, m - 1, d);
    while (isScheduled(h, day) && isDone(h, dkey(day))) {
      run++;
      day = addDays(day, -1);
      while (!isScheduled(h, day)) day = addDays(day, -1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/* ---------- Study time ---------- */
function weekMinutes(sub) {
  const mon = dkey(mondayOf());
  return (sub.sessions || []).filter((s) => s.date >= mon).reduce((a, s) => a + s.minutes, 0);
}
function minutesOn(sub, k) {
  return (sub.sessions || []).filter((s) => s.date === k).reduce((a, s) => a + s.minutes, 0);
}

/* ---------- Grade helpers ---------- */
const studentAvg = (id) => {
  const g = getEntries().filter((e) => e.studentId === id);
  return g.length ? Math.round(g.reduce((a, e) => a + e.score, 0) / g.length) : null;
};
const subjectAvg = (id) => {
  const g = getEntries().filter((e) => e.subjectId === id);
  return g.length ? Math.round(g.reduce((a, e) => a + e.score, 0) / g.length) : null;
};
const attPct = (st) => {
  const vals = Object.values(st.att || {});
  return vals.length ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : null;
};
const gradeColor = (n) => (n >= 80 ? "#5fd39a" : n >= 60 ? "#ffb43a" : "#ff5d73");

/* ---------- Navigation ---------- */
const NAVS = {
  student: [["Today", "Today"], ["Stats", "My Stats"], ["Subjects", "Subjects"]],
  teacher: [["Dashboard", "Dashboard"], ["Students", "Students"], ["Subjects", "Subjects"]],
};

function buildNav() {
  const p = getProfile();
  if (!p) { $("nav").innerHTML = ""; return; }
  $("nav").innerHTML = NAVS[p.role]
    .map(([v, label]) => `<button class="nav-btn" data-view="${v}">${label}</button>`)
    .join("");
}

function showView(name) {
  // hide every view from both roles so switching roles never leaves stale sections visible
  const allViews = [...new Set([...NAVS.student, ...NAVS.teacher].map(([v]) => v))];
  const p = getProfile();
  const views = (p ? NAVS[p.role] : NAVS.student).map(([v]) => v);
  allViews.forEach((v) => {
    $("view" + v).classList.toggle("hidden", v !== name);
    const btn = document.querySelector(`.nav-btn[data-view="${v}"]`);
    if (btn) btn.classList.toggle("active", v === name);
  });
}

/* ---------- Renderers ---------- */
function renderAll() { renderToday(); renderStats(); renderDashboard(); renderStudents(); renderSubjects(); }

/* ----- Student: Today ----- */
function renderToday() {
  const t = new Date();
  $("todayTitle").textContent = `${DAYS[t.getDay()]}, ${t.getDate()} ${MONTHS[t.getMonth()]}`;
  const habits = getHabits();
  const doneCount = habits.filter((h) => isScheduled(h, t) && isDone(h, dkey(t))).length;
  const dueCount = habits.filter((h) => isScheduled(h, t)).length;
  $("todaySub").innerHTML = `Stay consistent like <strong>Done</strong> — check off habits and log study time. Today: <strong>${doneCount}/${dueCount || 0}</strong> habits done.`;

  /* week strip (Mon .. Sun) */
  const mon = mondayOf(t);
  $("weekStrip").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    const k = dkey(d);
    const due = habits.filter((h) => isScheduled(h, d)).length;
    const done = habits.filter((h) => isScheduled(h, d) && isDone(h, k)).length;
    const cls = dkey(d) === dkey(t) ? "today" : done === due && due > 0 ? "full" : done > 0 ? "part" : "";
    return `<div class="wk-day ${cls}"><span class="wk-label">${DAYS[d.getDay()]}</span><span class="wk-num">${d.getDate()}</span><span class="wk-frac">${due ? done + "/" + due : "–"}</span></div>`;
  }).join("");

  /* habit rows */
  $("habitList").innerHTML = habits.length
    ? habits.map((h) => {
        const todayDone = isDone(h, dkey(t));
        const s = streak(h);
        const dots = Array.from({ length: 7 }, (_, i) => {
          const d = addDays(mon, i), k = dkey(d);
          const cls = isDone(h, k) ? "on" : isScheduled(h, d) ? "due" : "off";
          return `<span class="dot ${cls}"></span>`;
        }).join("");
        return `
        <div class="habit-row" style="border-left:5px solid ${h.color}">
          <span class="h-emoji">${esc(h.emoji)}</span>
          <div class="h-info">
            <b>${esc(h.name)}</b>
            <span class="h-dots">${dots}</span>
          </div>
          ${s > 0 ? `<span class="streak">🔥 ${s}</span>` : ""}
          <button class="check ${todayDone ? "done" : ""}" data-action="check" data-id="${h.id}"
                  title="${todayDone ? "Undo" : "Mark done"}">${todayDone ? "✓" : ""}</button>
          <button class="icon-btn" data-action="edit-habit" data-id="${h.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="del-habit" data-id="${h.id}" title="Delete">🗑</button>
        </div>`;
      }).join("")
    : `<p class="empty">No habits yet — add your first one! 🎯</p>`;

  /* subject cards with study logging */
  const subs = getSubjects();
  $("studentSubjects").innerHTML = subs.length
    ? subs.map((sub) => {
        const wk = weekMinutes(sub);
        const goal = (sub.goalHrs || 0) * 60;
        const pct = goal ? Math.min(100, Math.round((wk / goal) * 100)) : 0;
        const today = minutesOn(sub, dkey(t));
        return `
        <div class="card subject-card">
          <div class="sc-head">
            <span class="sc-dot" style="background:${sub.color}"></span>
            <b>${esc(sub.name)}</b>
            <span class="sc-goal">goal ${sub.goalHrs}h/wk</span>
          </div>
          <div class="progress"><div class="progress-fill" style="width:${pct}%;background:${sub.color}"></div></div>
          <div class="sc-meta"><span>${Math.floor(wk / 60)}h ${wk % 60}m this week</span><span>${pct}%</span></div>
          <div class="sc-today">Today: ${today} min</div>
          <div class="sc-actions">
            <button class="btn chip" data-action="log" data-id="${sub.id}" data-extra="15">+15m</button>
            <button class="btn chip" data-action="log" data-id="${sub.id}" data-extra="30">+30m</button>
            <button class="btn chip" data-action="log" data-id="${sub.id}" data-extra="60">+1h</button>
          </div>
        </div>`;
      }).join("")
    : `<p class="empty">No subjects yet — add one below or in the Subjects tab.</p>`;
}

/* ----- Student: Stats ----- */
function renderStats() {
  const habits = getHabits(), subs = getSubjects();
  const days = last7();
  const weekMin = subs.reduce((a, s) => a + weekMinutes(s), 0);
  const t = new Date();
  const doneToday = habits.filter((h) => isScheduled(h, t) && isDone(h, dkey(t))).length;
  const dueToday = habits.filter((h) => isScheduled(h, t)).length;
  const best = habits.reduce((a, h) => Math.max(a, bestStreak(h)), 0);

  $("statSummary").innerHTML = `
    ${statCard("🔥", "Best streak", best + " days")}
    ${statCard("✅", "Today", `${doneToday}/${dueToday || 0} habits`)}
    ${statCard("📚", "Study this week", `${Math.floor(weekMin / 60)}h ${weekMin % 60}m`)}
    ${statCard("🗂", "Subjects", subs.length)}`;

  $("habitStats").innerHTML = habits.length
    ? habits.map((h) => {
        const dots = days.map((d) => {
          const k = dkey(d);
          const cls = isDone(h, k) ? "on" : isScheduled(h, d) ? "due" : "off";
          return `<span class="dot lg ${cls}" title="${k}"></span>`;
        }).join("");
        return `<div class="stat-row" style="border-left:5px solid ${h.color}">
          <b>${esc(h.emoji)} ${esc(h.name)}</b>
          <span class="h-dots">${dots}</span>
          <span class="muted">🔥 streak ${streak(h)} · best ${bestStreak(h)}</span>
        </div>`;
      }).join("")
    : `<p class="empty">No habits yet.</p>`;

  const maxMin = Math.max(60, ...subs.map((s) => days.reduce((a, d) => a + minutesOn(s, dkey(d)), 0)));
  $("subjectStats").innerHTML = subs.length
    ? subs.map((sub) => {
        const bars = days.map((d) => {
          const m = minutesOn(sub, dkey(d));
          const hPct = Math.round((m / maxMin) * 100);
          return `<div class="bar-col"><div class="bar" style="height:${hPct}%;background:${sub.color}" title="${m} min"></div><span class="bar-day">${DAYS[d.getDay()][0]}</span></div>`;
        }).join("");
        return `<div class="stat-row">
          <b><span class="sc-dot" style="background:${sub.color}"></span> ${esc(sub.name)}</b>
          <div class="bar-chart">${bars}</div>
          <span class="muted">${Math.floor(weekMinutes(sub) / 60)}h ${weekMinutes(sub) % 60}m this week</span>
        </div>`;
      }).join("")
    : `<p class="empty">No subjects yet.</p>`;
}
const statCard = (ico, label, value) =>
  `<div class="card stat-card"><span class="stat-ico">${ico}</span><div><b>${value}</b><span class="muted">${label}</span></div></div>`;

/* ----- Teacher: Dashboard ----- */
function renderDashboard() {
  const students = getStudents(), subs = getSubjects(), entries = getEntries();
  const t = dkey();
  const marked = students.filter((s) => s.att?.[t] !== undefined);
  const present = students.filter((s) => s.att?.[t] === true).length;
  const avgs = students.map((s) => studentAvg(s.id)).filter((v) => v !== null);
  const classAvg = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
  const attPctToday = marked.length ? Math.round((present / marked.length) * 100) : null;

  $("dashSub").textContent = `Overview for ${fmtDate(t)}`;
  $("teachSummary").innerHTML = `
    ${statCard("🧑‍🎓", "Students", students.length)}
    ${statCard("📗", "Subjects", subs.length)}
    ${statCard("🙋", "Present today", attPctToday === null ? "—" : `${present}/${marked.length} (${attPctToday}%)`)}
    ${statCard("📊", "Class average", classAvg === null ? "—" : classAvg + "%")}`;

  $("attDate").textContent = fmtDate(t);
  $("attendanceList").innerHTML = students.length
    ? students.map((s) => {
        const a = s.att?.[t];
        return `<div class="row">
          <div class="row-info"><b>${esc(s.name)}</b><span>Class ${esc(s.cls || "—")}</span></div>
          <div class="row-actions">
            <button class="btn chip ${a === true ? "good" : ""}" data-action="attend" data-id="${s.id}" data-extra="1">Present</button>
            <button class="btn chip ${a === false ? "bad" : ""}" data-action="attend" data-id="${s.id}" data-extra="0">Absent</button>
          </div>
        </div>`;
      }).join("")
    : `<p class="empty">No students yet — add them in the Students tab.</p>`;

  const recent = entries.slice().reverse().slice(0, 8);
  $("recentGrades").innerHTML = recent.length
    ? recent.map((e) => {
        const st = students.find((s) => s.id === e.studentId);
        const sub = subs.find((x) => x.id === e.subjectId);
        return `<div class="row">
          <div class="row-info"><b>${esc(st ? st.name : "?")}</b><span>${esc(sub ? sub.name : "?")} · ${esc(e.date)}</span></div>
          <span class="pill" style="background:${gradeColor(e.score)}">${e.score}%</span>
        </div>`;
      }).join("")
    : `<p class="empty">No grades recorded yet.</p>`;
}

/* ----- Teacher: Students ----- */
function renderStudents() {
  const students = getStudents(), subs = getSubjects();
  $("studentList").innerHTML = students.length
    ? students.map((s) => {
        const avg = studentAvg(s.id), att = attPct(s);
        return `<div class="row">
          <div class="row-info">
            <b>${esc(s.name)}</b>
            <span>Class ${esc(s.cls || "—")} · avg ${avg === null ? "—" : avg + "%"} · attendance ${att === null ? "—" : att + "%"}</span>
          </div>
          <div class="row-actions">
            <button class="btn secondary" data-action="grade" data-id="${s.id}">+ Grade</button>
            <button class="btn danger" data-action="del-student" data-id="${s.id}">Delete</button>
          </div>
        </div>`;
      }).join("")
    : `<p class="empty">No students yet. Add your first student above. 🧑‍🎓</p>`;
}

/* ----- Subjects (both roles) ----- */
function renderSubjects() {
  const p = getProfile() || { role: "student" }, subs = getSubjects();
  $("subjectsSub").textContent = p.role === "student"
    ? "Your subjects and weekly study goals. Log time from the Today tab."
    : "The subject catalog for your class. Students track their own study time against these.";
  $("subjectManage").innerHTML = subs.length
    ? subs.map((sub) => {
        const extra = p.role === "student"
          ? `<div class="sc-meta"><span>${Math.floor(weekMinutes(sub) / 60)}h ${weekMinutes(sub) % 60}m this week</span><span>${weekMinutes(sub) >= sub.goalHrs * 60 ? "🎉 goal met" : ""}</span></div>`
          : `<div class="sc-meta"><span>class avg: ${subjectAvg(sub.id) === null ? "—" : subjectAvg(sub.id) + "%"}</span></div>`;
        return `<div class="card subject-card">
          <div class="sc-head">
            <span class="sc-dot" style="background:${sub.color}"></span>
            <b>${esc(sub.name)}</b>
            <span class="sc-goal">goal ${sub.goalHrs}h/wk</span>
          </div>
          ${extra}
          <div class="row-actions">
            <button class="btn secondary" data-action="edit-subject" data-id="${sub.id}">Edit</button>
            <button class="btn danger" data-action="del-subject" data-id="${sub.id}">Delete</button>
          </div>
        </div>`;
      }).join("")
    : `<p class="empty">No subjects yet — add one above. 📗</p>`;
}

/* ---------- Modal ---------- */
const PALETTE = ["#4ea8ff", "#5fd39a", "#ffb43a", "#ff5d73", "#b07dff", "#ff9f6e"];

function openModal(html, dismissable = true) {
  $("modalBox").innerHTML = html;
  $("modal").dataset.dismiss = dismissable ? "1" : "0";
  $("modal").classList.remove("hidden");
}
function closeModal() { $("modal").classList.add("hidden"); renderAll(); }

function onboardingModal() {
  openModal(`
    <h2>Welcome to DoneSchool 🎯</h2>
    <p class="muted" style="margin-bottom:14px">Who is using this device?</p>
    <div class="role-picker">
      <button class="role-btn ${onboardRole === "student" ? "picked" : ""}" data-action="choose-role" data-extra="student">
        <span class="big">🎒</span><b>Student</b><span class="muted">Habits + study tracking</span>
      </button>
      <button class="role-btn ${onboardRole === "teacher" ? "picked" : ""}" data-action="choose-role" data-extra="teacher">
        <span class="big">🧑‍🏫</span><b>Teacher</b><span class="muted">Class, attendance, grades</span>
      </button>
    </div>
    <form id="profileForm">
      <input type="hidden" id="pfRole" value="${onboardRole}" />
      <label>Your name
        <input id="pfName" placeholder="e.g. Alex Kim" required />
      </label>
      <button type="submit" class="btn primary wide" style="margin-top:16px">Start</button>
    </form>`, false);
}

function profileModal() {
  const p = getProfile();
  openModal(`
    <div class="modal-head"><h2>Profile</h2><button class="modal-x" data-action="close-modal">✕</button></div>
    <form id="profileForm">
      <input type="hidden" id="pfRole" value="${p.role}" />
      <label>Name<input id="pfName" value="${esc(p.name)}" required /></label>
      <label>Role
        <select id="pfRoleSel">
          <option value="student" ${p.role === "student" ? "selected" : ""}>Student</option>
          <option value="teacher" ${p.role === "teacher" ? "selected" : ""}>Teacher</option>
        </select>
      </label>
      <button type="submit" class="btn primary wide" style="margin-top:16px">Save</button>
    </form>`);
}

let onboardRole = "student";

function habitModal(id) {
  const h = id ? getHabits().find((x) => x.id === id) : null;
  const dayBoxes = [1,2,3,4,5,6,0].map((d) =>
    `<label class="day-chk"><input type="checkbox" name="days" value="${d}" ${!h || h.days.includes(d) ? "checked" : ""}/>${DAYS[d]}</label>`).join("");
  const colors = PALETTE.map((c) =>
    `<label class="swatch"><input type="radio" name="color" value="${c}" ${(h ? h.color : PALETTE[0]) === c ? "checked" : ""}/><span style="background:${c}"></span></label>`).join("");
  openModal(`
    <div class="modal-head"><h2>${h ? "Edit habit" : "New habit"}</h2><button class="modal-x" data-action="close-modal">✕</button></div>
    <form id="habitForm">
      <input type="hidden" id="hfId" value="${h ? h.id : ""}" />
      <label>Emoji
        <input id="hfEmoji" maxlength="3" value="${h ? esc(h.emoji) : "✅"}" />
      </label>
      <label>Habit name
        <input id="hfName" placeholder="e.g. Review flashcards" value="${h ? esc(h.name) : ""}" required />
      </label>
      <label>Days of the week
        <div class="day-row">${dayBoxes}</div>
      </label>
      <label>Color
        <div class="swatch-row">${colors}</div>
      </label>
      <button type="submit" class="btn primary wide" style="margin-top:16px">Save habit</button>
    </form>`);
}

function subjectModal(id) {
  const sub = id ? getSubjects().find((x) => x.id === id) : null;
  const colors = PALETTE.map((c) =>
    `<label class="swatch"><input type="radio" name="color" value="${c}" ${(sub ? sub.color : PALETTE[0]) === c ? "checked" : ""}/><span style="background:${c}"></span></label>`).join("");
  openModal(`
    <div class="modal-head"><h2>${sub ? "Edit subject" : "New subject"}</h2><button class="modal-x" data-action="close-modal">✕</button></div>
    <form id="subjectForm">
      <input type="hidden" id="sfId" value="${sub ? sub.id : ""}" />
      <label>Subject name
        <input id="sfName" placeholder="e.g. Biology" value="${sub ? esc(sub.name) : ""}" required />
      </label>
      <label>Weekly study goal (hours)
        <input id="sfGoal" type="number" min="1" max="60" value="${sub ? sub.goalHrs : 4}" required />
      </label>
      <label>Color
        <div class="swatch-row">${colors}</div>
      </label>
      <button type="submit" class="btn primary wide" style="margin-top:16px">Save subject</button>
    </form>`);
}

function gradeModal(studentId) {
  const students = getStudents(), subs = getSubjects();
  if (!students.length) { alert("Add a student first!"); return; }
  if (!subs.length) { alert("Add a subject first!"); return; }
  openModal(`
    <div class="modal-head"><h2>Record grade</h2><button class="modal-x" data-action="close-modal">✕</button></div>
    <form id="gradeForm">
      <label>Student
        <select id="gfStudent">${students.map((s) => `<option value="${s.id}" ${s.id === studentId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>
      </label>
      <label>Subject
        <select id="gfSubject">${subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
      </label>
      <label>Score (0–100)
        <input id="gfScore" type="number" min="0" max="100" required />
      </label>
      <label>Date
        <input id="gfDate" type="date" value="${dkey()}" required />
      </label>
      <button type="submit" class="btn primary wide" style="margin-top:16px">Save grade</button>
    </form>`);
}

/* ---------- Actions ---------- */
function toggleHabit(id) {
  const habits = getHabits();
  const h = habits.find((x) => x.id === id);
  if (!h) return;
  const k = dkey();
  if (h.log[k]) delete h.log[k]; else h.log[k] = true;
  saveHabits(habits);
  renderAll();
}

function logStudy(id, minutes) {
  const subs = getSubjects();
  const sub = subs.find((x) => x.id === id);
  if (!sub) return;
  sub.sessions = sub.sessions || [];
  sub.sessions.push({ date: dkey(), minutes: Number(minutes) });
  saveSubjects(subs);
  renderAll();
}

function setAttendance(id, val) {
  const students = getStudents();
  const s = students.find((x) => x.id === id);
  if (!s) return;
  s.att = s.att || {};
  if (s.att[dkey()] === (val === "1")) delete s.att[dkey()]; // tap again to unmark
  else s.att[dkey()] = val === "1";
  saveStudents(students);
  renderAll();
}

function addStudent() {
  const name = $("newStudentName").value.trim();
  const cls = $("newStudentClass").value.trim();
  if (!name) return;
  const students = getStudents();
  students.push({ id: "st" + Date.now(), name, cls, att: {} });
  saveStudents(students);
  $("newStudentName").value = ""; $("newStudentClass").value = "";
  renderAll();
}

function addSubjectQuick() {
  const name = $("newSubjectName").value.trim();
  const goal = parseInt($("newSubjectGoal").value, 10) || 4;
  if (!name) return;
  const subs = getSubjects();
  subs.push({ id: "s" + Date.now(), name, goalHrs: goal, color: PALETTE[subs.length % PALETTE.length] });
  saveSubjects(subs);
  $("newSubjectName").value = ""; $("newSubjectGoal").value = "";
  renderAll();
}

function saveHabitForm(f) {
  const habits = getHabits();
  const id = $("hfId").value;
  const days = [...f.querySelectorAll('input[name="days"]:checked')].map((c) => Number(c.value));
  const color = f.querySelector('input[name="color"]:checked')?.value || PALETTE[0];
  const data = { name: $("hfName").value.trim(), emoji: $("hfEmoji").value.trim() || "✅", days, color };
  if (!data.name || !days.length) { if (!days.length) alert("Pick at least one day."); return; }
  if (id) Object.assign(habits.find((x) => x.id === id), data);
  else habits.push({ id: "h" + Date.now(), log: {}, ...data });
  saveHabits(habits);
  closeModal();
}

function saveSubjectForm() {
  const subs = getSubjects();
  const id = $("sfId").value;
  const data = {
    name: $("sfName").value.trim(),
    goalHrs: Math.max(1, parseInt($("sfGoal").value, 10) || 4),
    color: document.querySelector('input[name="color"]:checked')?.value || PALETTE[0],
  };
  if (!data.name) return;
  if (id) Object.assign(subs.find((x) => x.id === id), data);
  else subs.push({ id: "s" + Date.now(), ...data });
  saveSubjects(subs);
  closeModal();
}

function saveGradeForm() {
  const entries = getEntries();
  entries.push({
    id: "e" + Date.now(),
    studentId: $("gfStudent").value,
    subjectId: $("gfSubject").value,
    score: Math.max(0, Math.min(100, parseInt($("gfScore").value, 10) || 0)),
    date: $("gfDate").value || dkey(),
  });
  saveEntries(entries);
  closeModal();
}

function saveProfileForm() {
  const name = $("pfName").value.trim();
  if (!name) return;
  const prev = getProfile();
  const role = $("pfRoleSel") ? $("pfRoleSel").value : $("pfRole").value;
  set(K.p, { name, role });
  if (!prev || prev.role !== role) { buildNav(); showView(role === "student" ? "Today" : "Dashboard"); }
  closeModal();
}

/* ---------- Events ---------- */
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const { action, id, extra } = t.dataset;
  switch (action) {
    case "check": toggleHabit(id); break;
    case "log": logStudy(id, extra); break;
    case "add-habit": habitModal(); break;
    case "edit-habit": habitModal(id); break;
    case "del-habit":
      if (confirm("Delete this habit? Its history will be lost.")) {
        saveHabits(getHabits().filter((h) => h.id !== id)); renderAll();
      }
      break;
    case "add-subject-modal": subjectModal(); break;
    case "add-subject-form": addSubjectQuick(); break;
    case "edit-subject": subjectModal(id); break;
    case "del-subject":
      if (confirm("Delete this subject? Logged study time will be lost.")) {
        saveSubjects(getSubjects().filter((s) => s.id !== id)); renderAll();
      }
      break;
    case "attend": setAttendance(id, extra); break;
    case "add-student": addStudent(); break;
    case "del-student":
      if (confirm("Remove this student?")) {
        saveStudents(getStudents().filter((s) => s.id !== id));
        saveEntries(getEntries().filter((x) => x.studentId !== id));
        renderAll();
      }
      break;
    case "grade": gradeModal(id); break;
    case "choose-role": onboardRole = extra; $("pfRole").value = extra; onboardingModal(); break;
    case "close-modal": closeModal(); break;
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target;
  if (f.id === "habitForm") { e.preventDefault(); saveHabitForm(f); }
  else if (f.id === "subjectForm") { e.preventDefault(); saveSubjectForm(); }
  else if (f.id === "gradeForm") { e.preventDefault(); saveGradeForm(); }
  else if (f.id === "profileForm") { e.preventDefault(); saveProfileForm(); }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "pfRoleSel") $("pfRole").value = e.target.value;
});

$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal") && $("modal").dataset.dismiss === "1") closeModal();
});

$("nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b) showView(b.dataset.view);
});

$("profileBtn").onclick = profileModal;

/* ---------- Init ---------- */
seed();
const profile = getProfile();
if (!profile) { onboardRole = "student"; onboardingModal(); buildNav(); showView("Today"); }
else { buildNav(); showView(profile.role === "student" ? "Today" : "Dashboard"); }
renderAll();

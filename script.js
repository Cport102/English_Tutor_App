/*
How it works:
- Hash-based SPA, no page reloads.
- Data persists in localStorage (users, sessions, lessons, chats, whiteboard, exercises, progress).

Main modules/functions:
- State/storage: S, loadDB, saveDB, seed
- Auth: hashPw, currentUser, signOut
- Routing/UI: parseRoute, navTo, render, toast
- Features: lessons, room, exercises, progress
*/
(() => {
  "use strict";

  const K = { db: "oe_tutor_db_v1", session: "oe_tutor_session_v1" };
  const EX = {
    cards: [
      { t: "resilient", d: "able to recover quickly" },
      { t: "nevertheless", d: "in spite of that" },
      { t: "meticulous", d: "very careful and precise" }
    ],
    quiz: [
      { id: "q1", q: "She ___ to class every day.", o: ["go", "goes", "going"], a: 1 },
      { id: "q2", q: "I have lived here ___ 2020.", o: ["for", "since", "at"], a: 1 },
      { id: "q3", q: "If I had time, I ___ join.", o: ["will", "would", "am"], a: 1 },
      { id: "q4", q: "They ___ dinner when I arrived.", o: ["are having", "were having", "have"], a: 1 },
      { id: "q5", q: "He is interested ___ learning Spanish.", o: ["in", "on", "at"], a: 0 }
    ],
    prompts: [
      "Describe a memorable trip and what you learned.",
      "Is online learning better than classroom learning? Why?",
      "Write an email asking your tutor for exam help."
    ]
  };

  const S = {
    db: null,
    session: { currentUserId: null },
    route: { name: "landing", param: null },
    ui: {
      authTab: "signin",
      cardIdx: 0,
      flipped: false,
      timer: { id: null, left: 1500 },
      trial: { idx: 0, score: 0, left: 60, timerId: null, done: false, congratsShown: false }
    }
  };

  const el = {
    app: document.getElementById("app"),
    nav: document.getElementById("topNav"),
    bc: document.getElementById("breadcrumb"),
    authBtn: document.getElementById("authAction"),
    themeBtn: document.getElementById("themeToggle"),
    toast: document.getElementById("toastRegion")
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    S.db = loadDB();
    if (!S.db) {
      S.db = await seed();
      saveDB();
    }
    shape();
    S.session = loadSession();
    applyTheme();
    bindGlobal();
    if (!location.hash) navTo(currentUser() ? "dashboard" : "landing"); else render();
  }

  function bindGlobal() {
    window.addEventListener("hashchange", render);
    el.authBtn.addEventListener("click", () => currentUser() ? signOut() : navTo("auth"));
    el.themeBtn.addEventListener("click", () => {
      S.db.darkMode = !S.db.darkMode;
      saveDB();
      applyTheme();
      toast(`Theme: ${S.db.darkMode ? "Dark" : "Light"}`);
    });
  }

  function loadDB() { try { const r = localStorage.getItem(K.db); return r ? JSON.parse(r) : null; } catch { return null; } }
  function saveDB() { localStorage.setItem(K.db, JSON.stringify(S.db)); }
  function loadSession() { try { const r = localStorage.getItem(K.session); return r ? JSON.parse(r) : { currentUserId: null }; } catch { return { currentUserId: null }; } }
  function saveSession() { localStorage.setItem(K.session, JSON.stringify(S.session)); }

  function shape() {
    const d = { users: [], lessons: [], chats: {}, lessonNotes: {}, whiteboards: {}, lessonTools: {}, progress: {}, darkMode: false };
    Object.keys(d).forEach(k => { if (S.db[k] == null) S.db[k] = d[k]; });
    saveDB();
  }

  async function seed() {
    const tutor = { id: id("u"), name: "Emma Clark", email: "tutor@example.com", role: "Tutor", passwordHash: await hashPw("demo123"), createdAt: iso() };
    const student = { id: id("u"), name: "Liam Chen", email: "student@example.com", role: "Student", passwordHash: await hashPw("demo123"), createdAt: iso() };
    const l1 = { id: id("l"), studentId: student.id, tutorId: tutor.id, datetime: addHours(30), type: "Conversation", duration: 45, status: "accepted", createdAt: iso() };
    const l2 = { id: id("l"), studentId: student.id, tutorId: tutor.id, datetime: addHours(54), type: "Grammar", duration: 60, status: "pending", createdAt: iso() };
    return {
      users: [tutor, student],
      lessons: [l1, l2],
      chats: { [l1.id]: [{ id: id("m"), senderId: tutor.id, text: "Welcome!", ts: iso() }] },
      lessonNotes: { [l1.id]: "Warm-up: speak for 2 minutes." },
      whiteboards: { [l1.id]: { strokes: [], snapshots: [] } },
      lessonTools: { [l1.id]: { vocab: [{ term: "confident", definition: "sure about your ability" }], corrections: [{ text: "Use: I have been learning..." }] } },
      progress: {
        [student.id]: {
          quizResults: [{ score: 2, total: 3, date: iso() }],
          vocabKnown: { resilient: true },
          writingSubmissions: [{
            id: id("w"),
            prompt: EX.prompts[0],
            text: "I traveled and learned patience.",
            date: iso(),
            feedback: "Good start.",
            rubric: { clarity: 4, grammar: 4, vocabulary: 3 }
          }]
        }
      },
      darkMode: false
    };
  }

  async function hashPw(p) {
    if (crypto?.subtle && window.TextEncoder) {
      const b = new TextEncoder().encode(p);
      const h = await crypto.subtle.digest("SHA-256", b);
      return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("");
    }
    return `fallback_${btoa(unescape(encodeURIComponent(p)))}`; // demo fallback
  }

  function currentUser() { return S.db.users.find(u => u.id === S.session.currentUserId) || null; }
  function signOut() { S.session.currentUserId = null; saveSession(); navTo("landing"); toast("Signed out"); }
  function navTo(p) { location.hash = p.startsWith("#/") ? p : `#/${p}`; }
  function parseRoute() { const p = location.hash.replace(/^#\/?/, "").trim(); const [name = "landing", param = null] = p.split("/"); return { name, param }; }

  function render() {
    stopTrialTimer();
    S.route = parseRoute();
    const u = currentUser();
    const protectedRoutes = ["dashboard", "lessons", "room", "exercises", "progress"];
    if (protectedRoutes.includes(S.route.name) && !u) return navTo("auth");
    if (S.route.name === "auth" && u) return navTo("dashboard");

    renderNav();
    el.authBtn.textContent = u ? "Sign out" : "Sign in";
    ({ landing, auth, trial, dashboard, lessons, room, exercises, progress }[S.route.name] || landing)();
    el.app.focus();
  }

  function renderNav() {
    const u = currentUser();
    const links = u
      ? [["dashboard", "Dashboard"], ["lessons", "Lessons"], ["exercises", "Exercises"], ["progress", "Progress"]]
      : [["landing", "Home"], ["auth", "Sign In"]];
    el.nav.innerHTML = links
      .map(([r, t]) => `<a class="nav-link ${S.route.name === r ? "active" : ""}" href="#/${r}">${esc(t)}</a>`)
      .join("");
  }

  function crumb(parts) { el.bc.innerHTML = parts.map((p, i) => `<span>${i ? " / " : ""}${esc(p)}</span>`).join(""); }
  function applyTheme() { document.documentElement.setAttribute("data-theme", S.db.darkMode ? "dark" : "light"); el.themeBtn.textContent = S.db.darkMode ? "Light mode" : "Dark mode"; }
  function toast(msg, t = 2200) { const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; el.toast.appendChild(d); setTimeout(() => d.remove(), t); }

  function landing() {
    crumb(["Home"]);
    el.app.innerHTML = `
      <section class="hero card" aria-labelledby="heroTitle">
        <h1 id="heroTitle">Online English Tutoring</h1>
        <p>Schedule lessons, chat live, practice exercises, and track progress.</p>
        <div class="btn-row">
          <a class="btn" href="#/auth">Start Learning</a>
          <a class="btn btn-secondary" href="#/trial">Try Free Grammar Game</a>
        </div>
      </section>
      <section class="card" style="margin-top:12px;">
        <h3>Demo accounts</h3>
        <p><strong>Student:</strong> student@example.com / demo123</p>
        <p><strong>Tutor:</strong> tutor@example.com / demo123</p>
      </section>`;
  }

  function auth() {
    crumb(["Sign In"]);
    el.app.innerHTML = `
      <section class="card">
        <div class="btn-row" role="tablist">
          <button id="tIn" class="btn ${S.ui.authTab === "signin" ? "" : "btn-ghost"}" type="button">Sign In</button>
          <button id="tUp" class="btn ${S.ui.authTab === "signup" ? "" : "btn-ghost"}" type="button">Sign Up</button>
        </div>
        <div id="authPanel"></div>
        <div class="btn-row" style="margin-top: 10px;">
          <button id="guestTrialBtn" class="btn btn-ghost" type="button">Access free trial language game as guest</button>
        </div>
        <p class="inline-msg">No account required for this trial game.</p>
      </section>`;
    const p = document.getElementById("authPanel");

    if (S.ui.authTab === "signin") {
      p.innerHTML = `
        <form id="signInForm" class="grid two" style="margin-top:12px;">
          <div><label>Email</label><input name="email" type="email" required /></div>
          <div><label>Password</label><input name="password" type="password" required /></div>
          <div class="btn-row" style="grid-column:1/-1;"><button class="btn" type="submit">Sign In</button></div>
          <p id="inMsg" class="error-msg" style="grid-column:1/-1;"></p>
        </form>`;
      document.getElementById("signInForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email") || "").trim().toLowerCase();
        const pw = String(f.get("password") || "");
        const m = document.getElementById("inMsg");
        if (!email || !pw) return m.textContent = "Email and password required.";
        const u = S.db.users.find(x => x.email.toLowerCase() === email);
        if (!u) return m.textContent = "No account found.";
        if (await hashPw(pw) !== u.passwordHash) return m.textContent = "Incorrect password.";
        S.session.currentUserId = u.id; saveSession(); toast(`Welcome back, ${u.name}`); navTo("dashboard");
      });
    } else {
      p.innerHTML = `
        <form id="signUpForm" class="grid two" style="margin-top:12px;">
          <div><label>Full name</label><input name="name" required /></div>
          <div><label>Email</label><input name="email" type="email" required /></div>
          <div><label>Password</label><input name="password" type="password" minlength="6" required /></div>
          <div><label>Role</label><select name="role"><option>Student</option><option>Tutor</option></select></div>
          <div class="btn-row" style="grid-column:1/-1;"><button class="btn" type="submit">Create Account</button></div>
          <p id="upMsg" class="error-msg" style="grid-column:1/-1;"></p>
        </form>`;
      document.getElementById("signUpForm").addEventListener("submit", async e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const name = String(f.get("name") || "").trim();
        const email = String(f.get("email") || "").trim().toLowerCase();
        const pw = String(f.get("password") || "");
        const role = String(f.get("role") || "Student");
        const m = document.getElementById("upMsg");
        if (!name || !email || !pw) return m.textContent = "Complete all fields.";
        if (pw.length < 6) return m.textContent = "Password must be at least 6 characters.";
        if (S.db.users.some(u => u.email.toLowerCase() === email)) return m.textContent = "Email already in use.";
        const u = { id: id("u"), name, email, role, passwordHash: await hashPw(pw), createdAt: iso() };
        S.db.users.push(u); ensureProgress(u.id); saveDB();
        S.session.currentUserId = u.id; saveSession();
        toast("Account created"); navTo("dashboard");
      });
    }

    document.getElementById("tIn").addEventListener("click", () => { S.ui.authTab = "signin"; auth(); });
    document.getElementById("tUp").addEventListener("click", () => { S.ui.authTab = "signup"; auth(); });
    document.getElementById("guestTrialBtn").addEventListener("click", () => {
      resetTrialState();
      navTo("trial");
    });
  }

  function trial() {
    const questions = EX.quiz;
    const t = S.ui.trial;
    crumb(["Guest Free Trial"]);

    if (t.done || t.idx >= questions.length) {
      t.done = true;
      if (t.score === questions.length && !t.congratsShown) {
        t.congratsShown = true;
        window.alert("you have now met the minimum bar to be a megafund private equity investor underwriting mid-teens IRR LBOs");
      }
      el.app.innerHTML = `
        <section class="card">
          <h2>Free Trial Complete</h2>
          <p>Your score: <strong>${t.score}/${questions.length}</strong></p>
          <div class="btn-row">
            <button id="trialRestart" class="btn" type="button">Try Again</button>
            <a href="#/auth" class="btn btn-secondary">Sign In / Sign Up</a>
          </div>
        </section>`;
      document.getElementById("trialRestart").addEventListener("click", () => {
        resetTrialState();
        trial();
      });
      return;
    }

    const q = questions[t.idx];
    el.app.innerHTML = `
      <section class="card">
        <h2>Free Trial Language Game</h2>
        <p class="meta">Question ${t.idx + 1}/${questions.length} • 60 seconds each</p>
        <p class="kpi" id="trialTimer">00:${String(t.left).padStart(2, "0")}</p>
        <fieldset style="margin-top: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 10px;">
          <legend><strong>${esc(q.q)}</strong></legend>
          ${q.o.map((opt, i) => `<label style="display:block; margin:6px 0; font-weight:400;"><input type="radio" name="trialAnswer" value="${i}" /> ${esc(opt)}</label>`).join("")}
        </fieldset>
        <div class="btn-row" style="margin-top: 10px;">
          <button id="trialSubmit" class="btn" type="button">Submit Answer</button>
        </div>
        <p class="inline-msg">Score so far: ${t.score}</p>
      </section>`;

    startTrialTimer();
    document.getElementById("trialSubmit").addEventListener("click", submitTrialAnswer);
  }

  function startTrialTimer() {
    stopTrialTimer();
    const timerEl = document.getElementById("trialTimer");
    if (!timerEl) return;
    S.ui.trial.timerId = setInterval(() => {
      S.ui.trial.left -= 1;
      if (S.ui.trial.left <= 0) {
        stopTrialTimer();
        nextTrialQuestion(false);
        return;
      }
      timerEl.textContent = `00:${String(S.ui.trial.left).padStart(2, "0")}`;
    }, 1000);
  }

  function stopTrialTimer() {
    if (S.ui.trial.timerId) {
      clearInterval(S.ui.trial.timerId);
      S.ui.trial.timerId = null;
    }
  }

  function submitTrialAnswer() {
    const q = EX.quiz[S.ui.trial.idx];
    const pick = document.querySelector('input[name="trialAnswer"]:checked');
    const isCorrect = !!pick && Number(pick.value) === q.a;
    nextTrialQuestion(isCorrect);
  }

  function nextTrialQuestion(isCorrect) {
    if (isCorrect) S.ui.trial.score += 1;
    S.ui.trial.idx += 1;
    S.ui.trial.left = 60;
    if (S.ui.trial.idx >= EX.quiz.length) S.ui.trial.done = true;
    trial();
  }

  function resetTrialState() {
    stopTrialTimer();
    S.ui.trial = { idx: 0, score: 0, left: 60, timerId: null, done: false, congratsShown: false };
  }

  function dashboard() {
    const u = currentUser();
    const ls = userLessons(u);
    const up = ls
      .filter(l => l.status === "accepted" && new Date(l.datetime) > new Date())
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
      .slice(0, 3);

    crumb(["Dashboard"]);
    el.app.innerHTML = `
      <section class="grid two">
        <article class="card">
          <h2>Hello, ${esc(u.name)}</h2>
          <p class="meta">Role: ${u.role}</p>
          <div class="btn-row">
            <a href="#/lessons" class="btn">Scheduling</a>
            <a href="#/progress" class="btn btn-secondary">Progress</a>
          </div>
        </article>
        <article class="card">
          <h3>Upcoming Lessons</h3>
          ${up.length ? `<ul class="list">${up.map(l => lessonItem(l, u)).join("")}</ul>` : `<div class="empty">No upcoming accepted lessons.</div>`}
        </article>
      </section>`;
  }

  function lessons() {
    const u = currentUser();
    const all = userLessons(u).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    const now = new Date();
    const end = new Date(); end.setDate(end.getDate() + 7);
    const week = all.filter(l => { const d = new Date(l.datetime); return d >= now && d <= end; });
    const up = all.filter(l => l.status === "accepted" && new Date(l.datetime) > now).slice(0, 5);

    crumb(["Lessons", "Scheduling"]);
    el.app.innerHTML = `
      <section class="grid two">
        <article class="card">
          <h2>Weekly Schedule</h2>
          ${week.length ? `<ul class="list">${week.map(l => lessonItem(l, u, true)).join("")}</ul>` : `<div class="empty">No lessons in next 7 days.</div>`}
        </article>
        <article class="card">
          <h2>Upcoming</h2>
          ${up.length ? `<ul class="list">${up.map(l => `<li class="list-item">${lessonInner(l, u)}<div class="btn-row" style="margin-top:8px;"><a class="btn btn-secondary" href="#/room/${l.id}">Open Room</a></div></li>`).join("")}</ul>` : `<div class="empty">No upcoming accepted lessons.</div>`}
        </article>
      </section>
      ${u.role === "Student" ? bookingHtml() : tutorReqHtml(all)}`;

    u.role === "Student" ? bindBooking() : bindTutorReq();
  }

  function bookingHtml() {
    const ts = S.db.users.filter(u => u.role === "Tutor");
    return `
      <section class="card" style="margin-top:14px;">
        <h2>Request a Lesson</h2>
        <form id="bookForm" class="grid two">
          <div><label>Tutor</label><select name="tutorId">${ts.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div>
          <div><label>Date & Time</label><input name="datetime" type="datetime-local" required /></div>
          <div><label>Lesson Type</label><select name="type"><option>Conversation</option><option>Grammar</option><option>Exam Prep</option></select></div>
          <div><label>Duration</label><select name="duration"><option value="30">30</option><option value="45">45</option><option value="60">60</option></select></div>
          <div class="btn-row" style="grid-column:1/-1;"><button class="btn" type="submit">Submit Request</button></div>
          <p id="bookMsg" class="error-msg" style="grid-column:1/-1;"></p>
        </form>
      </section>`;
  }

  function bindBooking() {
    const u = currentUser();
    const f = document.getElementById("bookForm");
    if (!f) return;
    f.addEventListener("submit", e => {
      e.preventDefault();
      const m = document.getElementById("bookMsg");
      m.textContent = "";
      const d = new FormData(f);
      const tutorId = String(d.get("tutorId") || "");
      const raw = String(d.get("datetime") || "");
      const type = String(d.get("type") || "Conversation");
      const dur = Number(d.get("duration") || 45);
      const dt = new Date(raw);
      if (!raw || Number.isNaN(dt.getTime())) return m.textContent = "Please choose a valid date/time.";
      if (dt <= new Date()) return m.textContent = "Lesson must be in the future.";

      S.db.lessons.push({
        id: id("l"), studentId: u.id, tutorId, datetime: dt.toISOString(),
        type, duration: dur, status: "pending", createdAt: iso()
      });
      saveDB(); toast("Lesson request submitted"); lessons();
    });
  }

  function tutorReqHtml(all) {
    const p = all.filter(l => l.status === "pending");
    return `
      <section class="card" style="margin-top:14px;">
        <h2>Pending Requests</h2>
        ${p.length ? `<ul class="list">${p.map(l => {
          const s = userById(l.studentId);
          return `<li class="list-item">
            <strong>${esc(s ? s.name : "Student")}</strong>
            <div class="meta">${fmt(l.datetime)} • ${l.type} • ${l.duration} min</div>
            <div class="btn-row" style="margin-top:8px;">
              <button class="btn" data-a="accept" data-id="${l.id}">Accept</button>
              <button class="btn btn-danger" data-a="decline" data-id="${l.id}">Decline</button>
            </div>
          </li>`;
        }).join("")}</ul>` : `<div class="empty">No pending requests.</div>`}
      </section>`;
  }

  function bindTutorReq() {
    el.app.querySelectorAll("button[data-a]").forEach(b => b.addEventListener("click", () => {
      const l = S.db.lessons.find(x => x.id === b.dataset.id);
      if (!l) return;
      l.status = b.dataset.a === "accept" ? "accepted" : "declined";
      saveDB(); toast(`Request ${l.status}`); lessons();
    }));
  }

  function room() {
    const u = currentUser();
    const lid = S.route.param;
    const l = S.db.lessons.find(x => x.id === lid);

    if (!l || l.status !== "accepted") {
      crumb(["Lesson Room"]);
      el.app.innerHTML = `<section class="card"><div class="empty">This lesson room is unavailable.</div></section>`;
      return;
    }
    if (u.id !== l.studentId && u.id !== l.tutorId) {
      el.app.innerHTML = `<section class="card"><div class="empty">You do not have access.</div></section>`;
      return;
    }

    ensureTools(l.id);
    const chat = S.db.chats[l.id] || [];
    const notes = S.db.lessonNotes[l.id] || "";
    const tools = S.db.lessonTools[l.id];
    const snaps = wb(l.id).snapshots || [];

    crumb(["Lessons", "Live Room"]);
    el.app.innerHTML = `
      <section class="card">
        <h2>Live Lesson Room</h2>
        <p class="meta">${fmt(l.datetime)} • ${l.type} • ${l.duration} min</p>
      </section>

      <section class="room-grid" style="margin-top:12px;">
        <article class="card chat-wrap">
          <div>
            <h3>Lesson Chat</h3>
            <div id="chatLog" class="chat-log">
              ${chat.length ? chat.map(m => `<div class="msg"><strong>${esc(nameById(m.senderId))}:</strong> ${esc(m.text)} <span class="meta">${time(m.ts)}</span></div>`).join("") : `<div class="empty">No messages yet.</div>`}
            </div>
          </div>
          <form id="chatForm" class="btn-row">
            <input id="chatInput" name="message" placeholder="Type a message" required />
            <button class="btn" type="submit">Send</button>
          </form>
        </article>

        <article class="card">
          <h3>Lesson Notes</h3>
          <textarea id="lessonNotes">${esc(notes)}</textarea>
          <div class="btn-row" style="margin-top:8px;"><button id="saveNotes" class="btn btn-secondary" type="button">Save Notes</button></div>
          <h3 style="margin-top:16px;">Timer</h3>
          <div id="timerReadout" class="kpi">25:00</div>
          <div class="btn-row">
            <input id="timerMin" type="number" min="1" max="120" value="25" style="max-width:120px;" />
            <button id="timerStart" class="btn" type="button">Start</button>
            <button id="timerPause" class="btn btn-ghost" type="button">Pause</button>
            <button id="timerReset" class="btn btn-ghost" type="button">Reset</button>
          </div>
        </article>
      </section>

      <section class="grid two" style="margin-top:12px;">
        <article class="card whiteboard">
          <h3>Shared Whiteboard</h3>
          <canvas id="wbCanvas" width="900" height="300" aria-label="Shared whiteboard"></canvas>
          <div class="btn-row" style="margin-top:8px;">
            <label for="pen" style="margin:0;align-self:center;">Pen</label>
            <input id="pen" type="range" min="1" max="12" value="3" style="max-width:160px;" />
            <button id="wbUndo" class="btn btn-ghost" type="button">Undo</button>
            <button id="wbClear" class="btn btn-danger" type="button">Clear</button>
            <button id="wbSave" class="btn btn-secondary" type="button">Save Snapshot</button>
          </div>
          <p class="meta">Snapshots saved: <span id="snapCount">${snaps.length}</span></p>
        </article>

        <article class="card">
          <h3>Vocabulary</h3>
          <form id="vocabForm" class="grid">
            <input name="term" placeholder="Term" required />
            <input name="definition" placeholder="Definition" required />
            <button class="btn" type="submit">Add Term</button>
          </form>
          ${tools.vocab.length ? `<ul class="list" style="margin-top:8px;">${tools.vocab.map(v => `<li class="list-item"><strong>${esc(v.term)}</strong><div class="meta">${esc(v.definition)}</div></li>`).join("")}</ul>` : `<div class="empty" style="margin-top:8px;">No terms yet.</div>`}

          <h3 style="margin-top:16px;">Corrections</h3>
          <form id="corrForm" class="btn-row">
            <input name="correction" placeholder="Add correction note" required />
            <button class="btn" type="submit">Add</button>
          </form>
          ${tools.corrections.length ? `<ul class="list" style="margin-top:8px;">${tools.corrections.map(c => `<li class="list-item">${esc(c.text)}</li>`).join("")}</ul>` : `<div class="empty" style="margin-top:8px;">No corrections yet.</div>`}
        </article>
      </section>`;

    bindRoom(l);
    initWb(l.id);
  }

  function bindRoom(l) {
    const u = currentUser();

    document.getElementById("chatForm").addEventListener("submit", e => {
      e.preventDefault();
      const inp = document.getElementById("chatInput");
      const text = inp.value.trim();
      if (!text) return;
      if (!S.db.chats[l.id]) S.db.chats[l.id] = [];
      S.db.chats[l.id].push({ id: id("m"), senderId: u.id, text, ts: iso() });
      saveDB(); room();
    });

    document.getElementById("saveNotes").addEventListener("click", () => {
      S.db.lessonNotes[l.id] = document.getElementById("lessonNotes").value;
      saveDB(); toast("Notes saved");
    });

    document.getElementById("vocabForm").addEventListener("submit", e => {
      e.preventDefault();
      const d = new FormData(e.currentTarget);
      const term = String(d.get("term") || "").trim();
      const definition = String(d.get("definition") || "").trim();
      if (!term || !definition) return;
      S.db.lessonTools[l.id].vocab.push({ term, definition });
      saveDB(); toast("Vocabulary item added"); room();
    });

    document.getElementById("corrForm").addEventListener("submit", e => {
      e.preventDefault();
      const d = new FormData(e.currentTarget);
      const text = String(d.get("correction") || "").trim();
      if (!text) return;
      S.db.lessonTools[l.id].corrections.push({ text });
      saveDB(); toast("Correction added"); room();
    });

    timerBind();
    const c = document.getElementById("chatLog");
    c.scrollTop = c.scrollHeight;
  }

  function timerBind() {
    const r = document.getElementById("timerReadout");
    const mi = document.getElementById("timerMin");
    const draw = () => {
      const t = Math.max(0, S.ui.timer.left);
      r.textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    };
    const stop = () => { if (S.ui.timer.id) { clearInterval(S.ui.timer.id); S.ui.timer.id = null; } };

    document.getElementById("timerStart").addEventListener("click", () => {
      if (!S.ui.timer.id) {
        S.ui.timer.id = setInterval(() => {
          S.ui.timer.left -= 1;
          draw();
          if (S.ui.timer.left <= 0) { stop(); toast("Timer finished"); }
        }, 1000);
      }
    });
    document.getElementById("timerPause").addEventListener("click", stop);
    document.getElementById("timerReset").addEventListener("click", () => { stop(); S.ui.timer.left = Math.max(1, Number(mi.value || 25)) * 60; draw(); });
    draw();
  }

  function wb(lid) { if (!S.db.whiteboards[lid]) S.db.whiteboards[lid] = { strokes: [], snapshots: [] }; return S.db.whiteboards[lid]; }

  function initWb(lid) {
    const c = document.getElementById("wbCanvas");
    const x = c.getContext("2d");
    const p = document.getElementById("pen");
    const u = document.getElementById("wbUndo");
    const clr = document.getElementById("wbClear");
    const s = document.getElementById("wbSave");
    const cnt = document.getElementById("snapCount");

    const w = wb(lid);
    let drawOn = false;
    let st = null;
    x.lineJoin = "round";
    x.lineCap = "round";

    const pt = e => {
      const r = c.getBoundingClientRect();
      const sx = c.width / r.width;
      const sy = c.height / r.height;
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };

    const drawStroke = ss => {
      if (!ss.points.length) return;
      x.strokeStyle = "#111";
      x.lineWidth = ss.size;
      x.beginPath();
      x.moveTo(ss.points[0].x, ss.points[0].y);
      for (let i = 1; i < ss.points.length; i += 1) x.lineTo(ss.points[i].x, ss.points[i].y);
      x.stroke();
    };

    const redraw = () => { x.clearRect(0, 0, c.width, c.height); w.strokes.forEach(drawStroke); };

    c.addEventListener("pointerdown", e => { e.preventDefault(); drawOn = true; st = { size: Number(p.value || 3), points: [pt(e)] }; });
    c.addEventListener("pointermove", e => {
      if (!drawOn || !st) return;
      e.preventDefault();
      const q = pt(e);
      st.points.push(q);
      const a = st.points;
      if (a.length > 1) {
        x.strokeStyle = "#111";
        x.lineWidth = st.size;
        x.beginPath();
        x.moveTo(a[a.length - 2].x, a[a.length - 2].y);
        x.lineTo(a[a.length - 1].x, a[a.length - 1].y);
        x.stroke();
      }
    });

    window.addEventListener("pointerup", () => {
      if (!drawOn || !st) return;
      drawOn = false;
      w.strokes.push(st);
      st = null;
      saveDB();
    });

    u.addEventListener("click", () => { w.strokes.pop(); saveDB(); redraw(); toast("Whiteboard undo"); });
    clr.addEventListener("click", () => { w.strokes = []; saveDB(); redraw(); toast("Whiteboard cleared"); });
    s.addEventListener("click", () => {
      w.snapshots.push(c.toDataURL("image/png"));
      if (w.snapshots.length > 20) w.snapshots.shift();
      saveDB();
      cnt.textContent = String(w.snapshots.length);
      toast("Snapshot saved");
    });

    redraw();
  }

  function exercises() {
    const u = currentUser();
    const p = ensureProgress(u.id);
    const card = EX.cards[S.ui.cardIdx % EX.cards.length];
    const known = p.vocabKnown[card.t] === true ? "Known" : p.vocabKnown[card.t] === false ? "Unknown" : "Unmarked";

    crumb(["Exercises"]);
    el.app.innerHTML = `
      <section class="grid two">
        <article class="card">
          <h2>Vocabulary Flashcards</h2>
          <div class="flashcard" role="button" tabindex="0" id="flash">
            ${S.ui.flipped ? `<div><strong>${esc(card.t)}</strong><div class="meta" style="margin-top:8px;">${esc(card.d)}</div></div>` : `<div><strong>${esc(card.t)}</strong><div class="meta" style="margin-top:8px;">Click flip to see definition</div></div>`}
          </div>
          <p class="meta">Card ${S.ui.cardIdx + 1}/${EX.cards.length} • ${known}</p>
          <div class="btn-row">
            <button id="prev" class="btn btn-ghost" type="button">Prev</button>
            <button id="flip" class="btn btn-secondary" type="button">Flip</button>
            <button id="next" class="btn btn-ghost" type="button">Next</button>
            <button id="markK" class="btn" type="button">Known</button>
            <button id="markU" class="btn btn-danger" type="button">Unknown</button>
          </div>
        </article>

        <article class="card">
          <h2>Grammar Quiz</h2>
          <form id="quizForm">
            ${EX.quiz.map((q, i) => `
              <fieldset style="margin-bottom:12px;border:1px solid var(--border);border-radius:10px;padding:10px;">
                <legend><strong>${i + 1}. ${esc(q.q)}</strong></legend>
                ${q.o.map((o, j) => `<label style="display:block;margin:6px 0;font-weight:400;"><input type="radio" name="q_${q.id}" value="${j}" /> ${esc(o)}</label>`).join("")}
              </fieldset>`).join("")}
            <div class="btn-row"><button class="btn" type="submit">Submit Quiz</button></div>
            <p id="quizMsg" class="inline-msg"></p>
          </form>
        </article>
      </section>

      <section class="card" style="margin-top:14px;">
        <h2>Writing Prompt</h2>
        ${u.role === "Student" ? writingStudent(p) : writingTutor()}
      </section>`;

    bindExercises();
  }

  function writingStudent(p) {
    const s = p.writingSubmissions || [];
    return `
      <form id="writeForm" class="grid">
        <label>Prompt</label>
        <select name="prompt">${EX.prompts.map(pp => `<option>${esc(pp)}</option>`).join("")}</select>
        <label>Your response</label>
        <textarea name="text" required></textarea>
        <div class="btn-row"><button class="btn" type="submit">Submit Writing</button></div>
        <p id="wMsg" class="inline-msg"></p>
      </form>
      <h3 style="margin-top:12px;">Your submissions</h3>
      ${s.length ? `<ul class="list">${s.map(w => `<li class="list-item"><div class="meta">${fmt(w.date)}</div><div><strong>Prompt:</strong> ${esc(w.prompt)}</div><div>${esc(w.text)}</div><div class="meta" style="margin-top:6px;"><strong>Feedback:</strong> ${esc(w.feedback || "Pending tutor feedback")}</div></li>`).join("")}</ul>` : `<div class="empty">No writing submissions yet.</div>`}`;
  }

  function writingTutor() {
    const students = S.db.users.filter(u => u.role === "Student");
    return `
      <p class="meta">Review student writing and add rubric feedback.</p>
      ${students.map(st => {
        const p = ensureProgress(st.id);
        const sub = p.writingSubmissions || [];
        return `<section class="card" style="margin-top:10px;">
          <h3>${esc(st.name)}</h3>
          ${sub.length ? `<ul class="list">${sub.map(w => `<li class="list-item">
            <div class="meta">${fmt(w.date)}</div>
            <div><strong>Prompt:</strong> ${esc(w.prompt)}</div>
            <div style="margin:6px 0;">${esc(w.text)}</div>
            <label for="fb_${w.id}">Feedback</label>
            <textarea id="fb_${w.id}">${esc(w.feedback || "")}</textarea>
            <div class="grid three">
              <div><label>Clarity (1-5)</label><input id="cl_${w.id}" type="number" min="1" max="5" value="${w.rubric?.clarity || ""}" /></div>
              <div><label>Grammar (1-5)</label><input id="gr_${w.id}" type="number" min="1" max="5" value="${w.rubric?.grammar || ""}" /></div>
              <div><label>Vocabulary (1-5)</label><input id="vo_${w.id}" type="number" min="1" max="5" value="${w.rubric?.vocabulary || ""}" /></div>
            </div>
            <div class="btn-row" style="margin-top:8px;"><button class="btn saveFb" data-student="${st.id}" data-sub="${w.id}" type="button">Save Feedback</button></div>
          </li>`).join("")}</ul>` : `<div class="empty">No writing submissions yet.</div>`}
        </section>`;
      }).join("")}`;
  }

  function bindExercises() {
    const u = currentUser();
    const p = ensureProgress(u.id);

    const move = d => { const n = EX.cards.length; S.ui.cardIdx = (S.ui.cardIdx + d + n) % n; S.ui.flipped = false; exercises(); };
    document.getElementById("prev").addEventListener("click", () => move(-1));
    document.getElementById("next").addEventListener("click", () => move(1));
    document.getElementById("flip").addEventListener("click", () => { S.ui.flipped = !S.ui.flipped; exercises(); });
    document.getElementById("flash").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.ui.flipped = !S.ui.flipped; exercises(); } });
    document.getElementById("markK").addEventListener("click", () => { p.vocabKnown[EX.cards[S.ui.cardIdx].t] = true; saveDB(); toast("Marked as known"); exercises(); });
    document.getElementById("markU").addEventListener("click", () => { p.vocabKnown[EX.cards[S.ui.cardIdx].t] = false; saveDB(); toast("Marked as unknown"); exercises(); });

    document.getElementById("quizForm").addEventListener("submit", e => {
      e.preventDefault();
      let score = 0;
      EX.quiz.forEach(q => {
        const pick = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (pick && Number(pick.value) === q.a) score += 1;
      });
      p.quizResults.push({ score, total: EX.quiz.length, date: iso() });
      saveDB();
      document.getElementById("quizMsg").textContent = `Your score: ${score}/${EX.quiz.length}`;
      toast("Quiz submitted");
    });

    if (u.role === "Student") {
      document.getElementById("writeForm").addEventListener("submit", e => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const prompt = String(d.get("prompt") || "").trim();
        const text = String(d.get("text") || "").trim();
        if (!text) return document.getElementById("wMsg").textContent = "Please write a response before submitting.";
        p.writingSubmissions.push({ id: id("w"), prompt, text, date: iso(), feedback: "", rubric: { clarity: null, grammar: null, vocabulary: null } });
        saveDB(); toast("Writing submitted"); exercises();
      });
    } else {
      el.app.querySelectorAll(".saveFb").forEach(b => b.addEventListener("click", () => {
        const sid = b.dataset.student;
        const wid = b.dataset.sub;
        const sp = ensureProgress(sid);
        const w = sp.writingSubmissions.find(x => x.id === wid);
        if (!w) return;
        w.feedback = document.getElementById(`fb_${wid}`).value.trim();
        w.rubric = {
          clarity: score(document.getElementById(`cl_${wid}`).value),
          grammar: score(document.getElementById(`gr_${wid}`).value),
          vocabulary: score(document.getElementById(`vo_${wid}`).value)
        };
        saveDB(); toast("Feedback saved");
      }));
    }
  }

  function progress() {
    const u = currentUser();
    crumb(["Progress"]);

    if (u.role === "Student") {
      const st = stats(u.id);
      el.app.innerHTML = `
        <section class="grid three">
          <article class="card"><div class="meta">Lessons Attended</div><div class="kpi">${st.lessonsAttended}</div></article>
          <article class="card"><div class="meta">Average Quiz Score</div><div class="kpi">${st.avg.toFixed(1)}%</div></article>
          <article class="card"><div class="meta">Vocabulary Known</div><div class="kpi">${st.vocab}</div></article>
        </section>
        <section class="card" style="margin-top:14px;">
          <h3>Quiz Trend</h3>
          ${st.bars.length ? `<div class="bars">${st.bars.map((b, i) => `<div class="bar-row"><div>#${i + 1}</div><div class="bar-track"><div class="bar-fill" style="width:${b}%;"></div></div><div>${b}%</div></div>`).join("")}</div>` : `<div class="empty">No quiz attempts yet.</div>`}
        </section>
        <section class="card" style="margin-top:14px;">
          <h3>Writing Feedback</h3>
          ${st.writing.length ? `<ul class="list">${st.writing.map(w => `<li class="list-item"><div class="meta">${fmt(w.date)}</div><div><strong>Prompt:</strong> ${esc(w.prompt)}</div><div>${esc(w.text)}</div><div class="meta" style="margin-top:6px;"><strong>Feedback:</strong> ${esc(w.feedback || "Pending")}</div></li>`).join("")}</ul>` : `<div class="empty">No writing submissions yet.</div>`}
        </section>`;
      return;
    }

    const students = S.db.users.filter(x => x.role === "Student");
    el.app.innerHTML = `
      <section class="card">
        <h2>Student Overview</h2>
        ${students.length ? `<table class="table"><thead><tr><th>Student</th><th>Lessons</th><th>Avg Quiz</th><th>Vocab Known</th><th>Writings</th></tr></thead><tbody>${students.map(s => { const st = stats(s.id); return `<tr><td>${esc(s.name)}</td><td>${st.lessonsAttended}</td><td>${st.avg.toFixed(1)}%</td><td>${st.vocab}</td><td>${st.writing.length}</td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">No students available.</div>`}
      </section>`;
  }

  function stats(studentId) {
    const p = ensureProgress(studentId);
    const now = new Date();
    const lessonsAttended = S.db.lessons.filter(l => l.studentId === studentId && l.status === "accepted" && new Date(l.datetime) < now).length;
    const qr = p.quizResults || [];
    const avg = qr.length ? qr.reduce((s, q) => s + (q.score / q.total) * 100, 0) / qr.length : 0;
    const vocab = Object.values(p.vocabKnown || {}).filter(Boolean).length;
    const bars = qr.slice(-8).map(q => Math.round((q.score / q.total) * 100));
    return { lessonsAttended, avg, vocab, writing: p.writingSubmissions || [], bars };
  }

  function userLessons(u) { return u.role === "Tutor" ? S.db.lessons.filter(l => l.tutorId === u.id) : S.db.lessons.filter(l => l.studentId === u.id); }
  function ensureTools(lid) { if (!S.db.lessonTools[lid]) { S.db.lessonTools[lid] = { vocab: [], corrections: [] }; saveDB(); } }
  function ensureProgress(uid) { if (!S.db.progress[uid]) { S.db.progress[uid] = { quizResults: [], vocabKnown: {}, writingSubmissions: [] }; saveDB(); } return S.db.progress[uid]; }
  function userById(uid) { return S.db.users.find(u => u.id === uid) || null; }
  function nameById(uid) { const u = userById(uid); return u ? u.name : "Unknown"; }

  function lessonItem(l, u, st = false) { return `<li class="list-item">${lessonInner(l, u, st)}</li>`; }
  function lessonInner(l, u, st = false) {
    const c = u.role === "Tutor" ? userById(l.studentId) : userById(l.tutorId);
    return `<div><strong>${esc(c ? c.name : "Unknown")}</strong></div><div class="meta">${fmt(l.datetime)} • ${l.type} • ${l.duration} min</div>${st ? `<span class="badge status-${l.status}">${l.status}</span>` : ""}`;
  }

  function id(p) { return `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`; }
  function iso() { return new Date().toISOString(); }
  function addHours(h) { const d = new Date(); d.setHours(d.getHours() + h); return d.toISOString(); }
  function time(i) { return new Date(i).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function fmt(i) { return new Date(i).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

  function score(v) { const n = Number(v); if (Number.isNaN(n)) return null; return Math.max(1, Math.min(5, Math.round(n))); }
  function esc(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
})();



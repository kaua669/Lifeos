/* ═══════════════════════════════════════════════
   LifeOS — app.js
   Complete SPA logic with Spring Boot API integration
═══════════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────
// In production, change to your deployed backend URL
// e.g. 'https://lifeos-api.onrender.com/api'
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api'; // same-origin when deployed on same server

// ─── PWA SERVICE WORKER ───────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[PWA] Service worker registered:', reg.scope);
    }).catch(err => console.warn('[PWA] SW registration failed:', err));
  });
}

// ─── PWA INSTALL PROMPT ───────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.remove('hidden');
});
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('pwa-banner')?.classList.add('hidden');
      }
      deferredInstallPrompt = null;
    });
  }
});

/* ──────────────── STATE ──────────────── */
let currentUser = null;
let authToken   = null;
let currentPage = 'dashboard';
let appData = {
  schedule: [],
  subjects: [],
  notes: [],
  workouts: [],
  nutrition: [],
  transactions: [],
  salaries: []
};

/* ──────────────── UTILS ──────────────── */
function fmt(n) { return parseFloat(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'; }
function today() { return new Date().toISOString().split('T')[0]; }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function uid() { return Math.random().toString(36).slice(2,9); }

function showToast(msg, type = 'info') {
  const tc = document.getElementById('toast-container');
  const t  = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: '●' };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function togglePw(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

/* ──────────────── API WRAPPER ──────────────── */
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) { handleLogout(); return null; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Erro no servidor' }));
      throw new Error(err.message || 'Erro no servidor');
    }
    if (res.status === 204) return {};
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    throw e;
  }
}

/* ──────────────── AUTH ──────────────── */
function switchAuth(mode) {
  document.getElementById('login-form').classList.toggle('active', mode === 'login');
  document.getElementById('register-form').classList.toggle('active', mode === 'register');
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !password) { errEl.textContent = 'Preencha e-mail e senha.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('POST', '/auth/login', { email, password });
    if (!data) return;
    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem('lifeos_token', authToken);
    localStorage.setItem('lifeos_user', JSON.stringify(currentUser));
    initApp();
  } catch (e) {
    errEl.textContent = e.message || 'Credenciais inválidas.';
    errEl.classList.remove('hidden');
  }
}

async function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const errEl    = document.getElementById('reg-error');
  errEl.classList.add('hidden');
  if (!name || !email || !password) { errEl.textContent = 'Preencha todos os campos.'; errEl.classList.remove('hidden'); return; }
  if (password.length < 8) { errEl.textContent = 'Senha deve ter pelo menos 8 caracteres.'; errEl.classList.remove('hidden'); return; }
  if (password !== confirm) { errEl.textContent = 'As senhas não coincidem.'; errEl.classList.remove('hidden'); return; }
  try {
    const data = await api('POST', '/auth/register', { name, email, password });
    if (!data) return;
    authToken   = data.token;
    currentUser = data.user;
    localStorage.setItem('lifeos_token', authToken);
    localStorage.setItem('lifeos_user', JSON.stringify(currentUser));
    initApp();
  } catch (e) {
    errEl.textContent = e.message || 'Erro ao criar conta.';
    errEl.classList.remove('hidden');
  }
}

function handleLogout() {
  authToken   = null;
  currentUser = null;
  appData     = { schedule: [], subjects: [], notes: [], workouts: [], nutrition: [], transactions: [], salaries: [] };
  localStorage.removeItem('lifeos_token');
  localStorage.removeItem('lifeos_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display = 'flex';
  switchAuth('login');
}

/* ──────────────── APP INIT ──────────────── */
async function initApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('hidden');
  updateUserUI();
  await loadAllData();
  navigateTo('dashboard');
}

function updateUserUI() {
  if (!currentUser) return;
  const letter = (currentUser.name || 'U').charAt(0).toUpperCase();
  ['sidebar-avatar-letter','topbar-avatar-letter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = letter;
  });
  const avatarSrc = currentUser.avatarUrl || localStorage.getItem('lifeos_avatar');
  if (avatarSrc) {
    ['sidebar-avatar-img','topbar-avatar-img'].forEach(id => {
      const img = document.getElementById(id);
      if (img) { img.src = avatarSrc; img.style.display = 'block'; }
    });
  }
  const nameEl = document.getElementById('sidebar-name');
  if (nameEl) nameEl.textContent = currentUser.name || 'Usuário';
  const emailEl = document.getElementById('sidebar-email-display');
  if (emailEl) emailEl.textContent = currentUser.email || '';
}

async function loadAllData() {
  try {
    const [schedule, subjects, notes, workouts, nutrition, transactions, salaries] = await Promise.all([
      api('GET', '/schedule').catch(() => []),
      api('GET', '/study/subjects').catch(() => []),
      api('GET', '/study/notes').catch(() => []),
      api('GET', '/gym/workouts').catch(() => []),
      api('GET', '/gym/nutrition').catch(() => []),
      api('GET', '/finance/transactions').catch(() => []),
      api('GET', '/finance/salaries').catch(() => [])
    ]);
    appData.schedule     = schedule || [];
    appData.subjects     = subjects || [];
    appData.notes        = notes || [];
    appData.workouts     = workouts || [];
    appData.nutrition    = nutrition || [];
    appData.transactions = transactions || [];
    appData.salaries     = salaries || [];
  } catch (e) {
    console.warn('Erro ao carregar dados:', e);
  }
}

/* ──────────────── NAVIGATION ──────────────── */
function navigateTo(page) {
  currentPage = page;
  // Update sidebar nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // Update bottom nav items
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  // Page titles
  const titles = { dashboard:'Dashboard', schedule:'Cronograma', study:'Estudos', gym:'Academia', finance:'Finanças', profile:'Perfil' };
  document.getElementById('page-title').textContent = titles[page] || page;
  // Render
  const pages = { dashboard: renderDashboard, schedule: renderSchedule, study: renderStudy, gym: renderGym, finance: renderFinance, profile: renderProfile };
  const content = document.getElementById('page-content');
  content.innerHTML = '';
  if (pages[page]) pages[page](content);
  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  s.classList.toggle('open');
  o.classList.toggle('active');
}

/* ══════════════════════════════════════════════
   PAGE: DASHBOARD
══════════════════════════════════════════════ */
function renderDashboard(container) {
  const now  = new Date();
  const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  // Finances summary
  const income  = appData.transactions.filter(t => t.type === 'INCOME').reduce((a,b) => a + (b.amount||0), 0)
                + appData.salaries.reduce((a,b) => a + (b.amount||0), 0);
  const expense = appData.transactions.filter(t => t.type === 'EXPENSE').reduce((a,b) => a + (b.amount||0), 0);
  const balance = income - expense;

  // Study summary
  const totalNotes     = appData.notes.length;
  const totalSubjects  = appData.subjects.length;

  // Gym summary
  const totalWorkouts  = appData.workouts.length;
  const recentWorkouts = appData.workouts.slice(-7).length;

  // Today's events
  const todayStr    = today();
  const todayEvents = appData.schedule.filter(e => e.date === todayStr);

  container.innerHTML = `
    <div class="dashboard-greeting">${greeting}, ${(currentUser?.name || 'usuário').split(' ')[0]}! 👋</div>
    <div class="dashboard-date">${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}</div>

    <div class="grid-4" style="margin-bottom:24px">
      <div class="stat-card" style="--accent-color:var(--accent-green)">
        <div class="stat-label">Saldo Atual</div>
        <div class="stat-value" style="color:${balance>=0?'var(--accent-green)':'var(--accent-red)'}">R$${fmt(balance)}</div>
        <div class="stat-sub">Receita: R$${fmt(income)} · Gasto: R$${fmt(expense)}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-2)">
        <div class="stat-label">Estudos</div>
        <div class="stat-value">${totalNotes}</div>
        <div class="stat-sub">${totalSubjects} matéria${totalSubjects!==1?'s':''} · ${totalNotes} nota${totalNotes!==1?'s':''}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-green)">
        <div class="stat-label">Treinos</div>
        <div class="stat-value">${totalWorkouts}</div>
        <div class="stat-sub">${recentWorkouts} nos últimos 7 dias</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-yellow)">
        <div class="stat-label">Eventos Hoje</div>
        <div class="stat-value">${todayEvents.length}</div>
        <div class="stat-sub">na agenda de hoje</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:24px">
      <div class="card">
        <div class="card-header"><span class="card-title">Finanças — Últimos 6 meses</span></div>
        <div class="chart-wrap"><canvas id="chart-finance"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Gastos por Categoria</span></div>
        <div class="chart-wrap"><canvas id="chart-categories"></canvas></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Eventos de Hoje</span>
          <button class="btn btn-outline btn-sm" onclick="navigateTo('schedule')">Ver Agenda</button>
        </div>
        ${todayEvents.length === 0
          ? `<div class="empty-state"><div class="empty-state-icon">📅</div><p>Nenhum evento hoje</p></div>`
          : todayEvents.map(e => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="width:36px;height:36px;border-radius:8px;background:rgba(34,211,238,0.1);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🕐</div>
                <div>
                  <div style="font-size:14px;font-weight:600">${e.title}</div>
                  <div style="font-size:12px;color:var(--text-2)">${e.time || ''} · <span class="badge badge-blue">${e.category||'Geral'}</span></div>
                </div>
              </div>`).join('')}
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Últimas Transações</span>
          <button class="btn btn-outline btn-sm" onclick="navigateTo('finance')">Ver Finanças</button>
        </div>
        ${appData.transactions.length === 0
          ? `<div class="empty-state"><div class="empty-state-icon">💰</div><p>Nenhuma transação</p></div>`
          : appData.transactions.slice(-5).reverse().map(t => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:13px;font-weight:600">${t.description}</div>
                  <div style="font-size:11px;color:var(--text-2)">${fmtDate(t.date)} · ${t.category||'—'}</div>
                </div>
                <div class="${t.type==='INCOME'?'fin-amount-pos':'fin-amount-neg'}">${t.type==='INCOME'?'+':'-'}R$${fmt(t.amount)}</div>
              </div>`).join('')}
      </div>
    </div>`;

  // Charts
  requestAnimationFrame(() => {
    buildFinanceChart();
    buildCategoryChart();
  });
}

function buildFinanceChart() {
  const ctx = document.getElementById('chart-finance');
  if (!ctx) return;
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun'];
  const now    = new Date();
  const labels = Array.from({length:6},(_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return months[d.getMonth()];
  });
  const incomeData  = labels.map((_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return appData.transactions.filter(t => t.type==='INCOME' && (t.date||'').startsWith(m)).reduce((a,b)=>a+b.amount,0);
  });
  const expenseData = labels.map((_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return appData.transactions.filter(t => t.type==='EXPENSE' && (t.date||'').startsWith(m)).reduce((a,b)=>a+b.amount,0);
  });
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Receita', data: incomeData, backgroundColor: 'rgba(74,222,128,0.7)', borderRadius: 6 },
        { label: 'Gastos',  data: expenseData, backgroundColor: 'rgba(248,113,113,0.7)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color:'#94a3b8', font:{size:11} } } },
      scales: {
        x: { grid:{color:'rgba(99,179,237,0.05)'}, ticks:{color:'#94a3b8',font:{size:11}} },
        y: { grid:{color:'rgba(99,179,237,0.05)'}, ticks:{color:'#94a3b8',font:{size:11}} }
      }
    }
  });
}

function buildCategoryChart() {
  const ctx = document.getElementById('chart-categories');
  if (!ctx) return;
  const expenses = appData.transactions.filter(t => t.type === 'EXPENSE');
  const cats = {};
  expenses.forEach(t => { cats[t.category||'Outros'] = (cats[t.category||'Outros'] || 0) + (t.amount||0); });
  const labels = Object.keys(cats);
  const data   = Object.values(cats);
  const colors = ['#22d3ee','#818cf8','#f472b6','#4ade80','#fbbf24','#f87171','#a78bfa'];
  if (labels.length === 0) { labels.push('Sem dados'); data.push(1); }
  new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'right', labels: { color:'#94a3b8', font:{size:11}, padding:12, boxWidth:12 } } }
    }
  });
}

/* ══════════════════════════════════════════════
   PAGE: SCHEDULE
══════════════════════════════════════════════ */
function renderSchedule(container) {
  const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const now = new Date();
  // Build current week dates
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  container.innerHTML = `
    <div class="section-head">
      <span class="section-title">Cronograma Semanal</span>
      <button class="btn btn-accent" onclick="openAddEventModal()">+ Adicionar Evento</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div class="week-grid" style="padding:16px 16px 0">
        ${weekDays.map((d,i) => {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const isToday = dateStr === today();
          const events  = appData.schedule.filter(e => e.date === dateStr);
          return `
            <div class="day-col ${isToday?'today':''}">
              <div class="day-label">${d}<br/><span style="font-size:14px;font-weight:700;color:${isToday?'var(--accent)':'var(--text-1)'}">${date.getDate()}</span></div>
              ${events.map(e => `
                <div class="event-chip cat-${(e.category||'').toLowerCase()}" onclick="openEventDetail('${e.id}')">
                  <div style="font-weight:600">${e.title}</div>
                  ${e.time?`<div style="opacity:0.7">${e.time}</div>`:''}
                </div>`).join('')}
              <div class="event-chip" style="opacity:0.3;border-style:dashed;cursor:pointer" onclick="openAddEventModal('${dateStr}')">+ evento</div>
            </div>`;
        }).join('')}
      </div>
      <div style="padding:16px">
        <div class="section-head" style="margin-top:16px"><span class="section-title">Todos os Eventos</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Título</th><th>Data</th><th>Hora</th><th>Categoria</th><th>Descrição</th><th></th></tr></thead>
            <tbody>
              ${appData.schedule.length===0
                ? `<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:30px">Nenhum evento ainda</td></tr>`
                : appData.schedule.sort((a,b)=>(a.date+a.time||'').localeCompare(b.date+b.time||'')).map(e => `
                  <tr>
                    <td style="font-weight:600">${e.title}</td>
                    <td>${fmtDate(e.date)}</td>
                    <td>${e.time||'—'}</td>
                    <td><span class="badge badge-blue">${e.category||'Geral'}</span></td>
                    <td style="color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.description||'—'}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">Excluir</button></td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function openAddEventModal(prefillDate) {
  openModal('Novo Evento', `
    <div class="form-grid">
      <div><label class="input-label">Título</label><input class="input-field" id="ev-title" placeholder="Ex: Reunião, Estudar Cálculo..." /></div>
      <div class="form-row">
        <div><label class="input-label">Data</label><input class="input-field" id="ev-date" type="date" value="${prefillDate||today()}" /></div>
        <div><label class="input-label">Hora</label><input class="input-field" id="ev-time" type="time" /></div>
      </div>
      <div>
        <label class="input-label">Categoria</label>
        <select class="input-field" id="ev-cat">
          <option value="Geral">Geral</option>
          <option value="study">Estudos</option>
          <option value="gym">Academia</option>
          <option value="personal">Pessoal</option>
          <option value="work">Trabalho</option>
        </select>
      </div>
      <div><label class="input-label">Descrição (opcional)</label><textarea class="input-field" id="ev-desc" rows="2" placeholder="Detalhes..."></textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveEvent()">Salvar</button>
    </div>`);
}

async function saveEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const date  = document.getElementById('ev-date').value;
  const time  = document.getElementById('ev-time').value;
  const cat   = document.getElementById('ev-cat').value;
  const desc  = document.getElementById('ev-desc').value.trim();
  if (!title || !date) { showToast('Preencha título e data.', 'error'); return; }
  try {
    const ev = await api('POST', '/schedule', { title, date, time, category: cat, description: desc });
    appData.schedule.push(ev);
    closeModal();
    showToast('Evento adicionado!', 'success');
    navigateTo('schedule');
  } catch (e) { showToast(e.message, 'error'); }
}

function openEventDetail(id) {
  const ev = appData.schedule.find(e => e.id == id);
  if (!ev) return;
  openModal(ev.title, `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div><span style="color:var(--text-2);font-size:12px">DATA</span><br/><strong>${fmtDate(ev.date)}</strong></div>
      <div><span style="color:var(--text-2);font-size:12px">HORA</span><br/><strong>${ev.time||'Não definida'}</strong></div>
      <div><span style="color:var(--text-2);font-size:12px">CATEGORIA</span><br/><span class="badge badge-blue">${ev.category||'Geral'}</span></div>
      ${ev.description?`<div><span style="color:var(--text-2);font-size:12px">DESCRIÇÃO</span><br/><p style="font-size:13px;color:var(--text-1)">${ev.description}</p></div>`:''}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-danger" onclick="deleteEvent(${ev.id});closeModal()">Excluir</button>
      <button class="btn btn-outline" onclick="closeModal()">Fechar</button>
    </div>`);
}

async function deleteEvent(id) {
  try {
    await api('DELETE', `/schedule/${id}`);
    appData.schedule = appData.schedule.filter(e => e.id != id);
    showToast('Evento removido.', 'info');
    navigateTo('schedule');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════
   PAGE: STUDY
══════════════════════════════════════════════ */
const SUBJECT_COLORS = ['#22d3ee','#818cf8','#f472b6','#4ade80','#fbbf24','#f87171'];

function renderStudy(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" onclick="studyTab('subjects',this)">Matérias</button>
      <button class="tab-btn" onclick="studyTab('notes',this)">Anotações</button>
    </div>
    <div id="study-subjects" class="tab-panel active">${renderSubjectsPanel()}</div>
    <div id="study-notes" class="tab-panel">${renderNotesPanel()}</div>`;
}

function studyTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`study-${tab}`).classList.add('active');
}

function renderSubjectsPanel() {
  return `
    <div class="section-head" style="margin-top:0">
      <span class="section-title">Minhas Matérias</span>
      <button class="btn btn-accent" onclick="openAddSubjectModal()">+ Nova Matéria</button>
    </div>
    ${appData.subjects.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📚</div><p>Nenhuma matéria ainda. Adicione sua primeira!</p></div>`
      : `<div class="grid-auto">${appData.subjects.map((s,i) => `
          <div class="subject-card" style="--subj-color:${SUBJECT_COLORS[i%SUBJECT_COLORS.length]}">
            <div class="subject-name">${s.name}</div>
            <div class="subject-meta">${appData.notes.filter(n => n.subjectId == s.id).length} anotações</div>
            ${s.description?`<div style="font-size:12px;color:var(--text-2);margin-top:6px">${s.description}</div>`:''}
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-outline btn-sm" onclick="filterNotesBySubject(${s.id})">Ver Notas</button>
              <button class="btn btn-danger btn-sm" onclick="deleteSubject(${s.id})">Excluir</button>
            </div>
          </div>`).join('')}</div>`}`;
}

function renderNotesPanel(filterSubjectId) {
  const notes = filterSubjectId ? appData.notes.filter(n => n.subjectId == filterSubjectId) : appData.notes;
  const subjectMap = {};
  appData.subjects.forEach(s => subjectMap[s.id] = s.name);
  return `
    <div class="section-head" style="margin-top:0">
      <span class="section-title">${filterSubjectId ? `Notas — ${subjectMap[filterSubjectId]||''}` : 'Todas as Anotações'}</span>
      <button class="btn btn-accent" onclick="openAddNoteModal()">+ Nova Nota</button>
    </div>
    ${notes.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">📝</div><p>Nenhuma anotação ainda.</p></div>`
      : `<div class="notes-list">${notes.map(n => `
          <div class="note-item">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
              <div>
                <div class="note-title">${n.title}</div>
                ${subjectMap[n.subjectId]?`<span class="badge badge-purple" style="margin-top:4px">${subjectMap[n.subjectId]}</span>`:''}
              </div>
              <button class="btn btn-danger btn-sm" onclick="deleteNote(${n.id})">Excluir</button>
            </div>
            <div class="note-content">${n.content}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:8px">${fmtDate(n.createdAt?.split('T')[0] || n.createdAt)}</div>
          </div>`).join('')}</div>`}`;
}

function filterNotesBySubject(id) {
  document.querySelector('[onclick="studyTab(\'notes\',this)"]').click();
  document.getElementById('study-notes').innerHTML = renderNotesPanel(id);
}

function openAddSubjectModal() {
  openModal('Nova Matéria', `
    <div class="form-grid">
      <div><label class="input-label">Nome da Matéria</label><input class="input-field" id="subj-name" placeholder="Ex: Matemática, Inglês..." /></div>
      <div><label class="input-label">Descrição (opcional)</label><textarea class="input-field" id="subj-desc" rows="2"></textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveSubject()">Salvar</button>
    </div>`);
}

async function saveSubject() {
  const name = document.getElementById('subj-name').value.trim();
  const desc = document.getElementById('subj-desc').value.trim();
  if (!name) { showToast('Preencha o nome.', 'error'); return; }
  try {
    const s = await api('POST', '/study/subjects', { name, description: desc });
    appData.subjects.push(s);
    closeModal();
    showToast('Matéria adicionada!', 'success');
    navigateTo('study');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteSubject(id) {
  if (!confirm('Excluir matéria e todas as notas relacionadas?')) return;
  try {
    await api('DELETE', `/study/subjects/${id}`);
    appData.subjects = appData.subjects.filter(s => s.id != id);
    appData.notes    = appData.notes.filter(n => n.subjectId != id);
    showToast('Matéria excluída.', 'info');
    navigateTo('study');
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddNoteModal() {
  openModal('Nova Anotação', `
    <div class="form-grid">
      <div><label class="input-label">Título</label><input class="input-field" id="note-title" placeholder="Título da anotação" /></div>
      <div>
        <label class="input-label">Matéria</label>
        <select class="input-field" id="note-subject">
          <option value="">— Sem matéria —</option>
          ${appData.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div><label class="input-label">Conteúdo</label><textarea class="input-field" id="note-content" rows="5" placeholder="Escreva sua anotação..."></textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveNote()">Salvar</button>
    </div>`);
}

async function saveNote() {
  const title     = document.getElementById('note-title').value.trim();
  const content   = document.getElementById('note-content').value.trim();
  const subjectId = document.getElementById('note-subject').value || null;
  if (!title || !content) { showToast('Preencha título e conteúdo.', 'error'); return; }
  try {
    const n = await api('POST', '/study/notes', { title, content, subjectId: subjectId ? parseInt(subjectId) : null });
    appData.notes.push(n);
    closeModal();
    showToast('Anotação salva!', 'success');
    navigateTo('study');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteNote(id) {
  try {
    await api('DELETE', `/study/notes/${id}`);
    appData.notes = appData.notes.filter(n => n.id != id);
    showToast('Nota excluída.', 'info');
    navigateTo('study');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════
   PAGE: GYM
══════════════════════════════════════════════ */
function renderGym(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn active" onclick="gymTab('workouts',this)">Treinos</button>
      <button class="tab-btn" onclick="gymTab('nutrition',this)">Alimentação</button>
    </div>
    <div id="gym-workouts" class="tab-panel active">${renderWorkoutsPanel()}</div>
    <div id="gym-nutrition" class="tab-panel">${renderNutritionPanel()}</div>`;
}

function gymTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`gym-${tab}`).classList.add('active');
}

function renderWorkoutsPanel() {
  const totalVolume = appData.workouts.reduce((a,w) => a + ((w.sets||0)*(w.reps||0)*(w.weight||0)), 0);
  return `
    <div class="grid-3" style="margin-bottom:20px">
      <div class="stat-card" style="--accent-color:var(--accent-green)">
        <div class="stat-label">Total de Treinos</div>
        <div class="stat-value">${appData.workouts.length}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent)">
        <div class="stat-label">Volume Total</div>
        <div class="stat-value">${(totalVolume/1000).toFixed(1)}t</div>
        <div class="stat-sub">kg·reps·sets</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-2)">
        <div class="stat-label">Tipos de Exercício</div>
        <div class="stat-value">${[...new Set(appData.workouts.map(w=>w.exerciseType))].length}</div>
      </div>
    </div>
    <div class="section-head" style="margin-top:0">
      <span class="section-title">Histórico de Treinos</span>
      <button class="btn btn-accent" onclick="openAddWorkoutModal()">+ Registrar Treino</button>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Exercício</th><th>Tipo</th><th>Séries</th><th>Reps</th><th>Carga (kg)</th><th>Data</th><th></th></tr></thead>
          <tbody>
            ${appData.workouts.length===0
              ? `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:30px">Nenhum treino registrado</td></tr>`
              : appData.workouts.sort((a,b)=>b.date?.localeCompare(a.date||'')).map(w => `
                <tr>
                  <td style="font-weight:600">${w.exerciseName}</td>
                  <td><span class="badge badge-green">${w.exerciseType||'—'}</span></td>
                  <td>${w.sets||'—'}</td>
                  <td>${w.reps||'—'}</td>
                  <td>${w.weight||'—'} ${w.weight?'kg':''}</td>
                  <td>${fmtDate(w.date)}</td>
                  <td><button class="btn btn-danger btn-sm" onclick="deleteWorkout(${w.id})">Excluir</button></td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderNutritionPanel() {
  const todayNutr   = appData.nutrition.filter(n => n.date === today());
  const totalCal    = todayNutr.reduce((a,n)=>a+(n.calories||0), 0);
  const totalProt   = todayNutr.reduce((a,n)=>a+(n.protein||0), 0);
  const totalCarbs  = todayNutr.reduce((a,n)=>a+(n.carbs||0), 0);
  const totalFats   = todayNutr.reduce((a,n)=>a+(n.fats||0), 0);
  return `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><span class="card-title">Resumo de Hoje</span></div>
      <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
        <div style="text-align:center">
          <div style="font-family:var(--font-display);font-size:32px;font-weight:800;color:var(--accent)">${totalCal}</div>
          <div style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px">kcal</div>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap">
          ${[['Proteína','#4ade80',totalProt,'g'],['Carboidrato','#fbbf24',totalCarbs,'g'],['Gordura','#f472b6',totalFats,'g']].map(([l,c,v,u]) => `
            <div style="text-align:center">
              <div style="font-size:20px;font-weight:700;color:${c}">${v}${u}</div>
              <div style="font-size:11px;color:var(--text-2)">${l}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="section-head" style="margin-top:0">
      <span class="section-title">Registro Alimentar</span>
      <button class="btn btn-accent" onclick="openAddNutritionModal()">+ Adicionar Refeição</button>
    </div>
    <div class="card" style="padding:0">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Refeição</th><th>Kcal</th><th>Proteína</th><th>Carbs</th><th>Gordura</th><th>Data</th><th></th></tr></thead>
          <tbody>
            ${appData.nutrition.length===0
              ? `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:30px">Nenhuma refeição registrada</td></tr>`
              : appData.nutrition.sort((a,b)=>b.date?.localeCompare(a.date||'')).map(n => `
                <tr>
                  <td style="font-weight:600">${n.mealName}</td>
                  <td>${n.calories||0} kcal</td>
                  <td>${n.protein||0}g</td>
                  <td>${n.carbs||0}g</td>
                  <td>${n.fats||0}g</td>
                  <td>${fmtDate(n.date)}</td>
                  <td><button class="btn btn-danger btn-sm" onclick="deleteNutrition(${n.id})">Excluir</button></td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function openAddWorkoutModal() {
  openModal('Registrar Treino', `
    <div class="form-grid">
      <div><label class="input-label">Nome do Exercício</label><input class="input-field" id="w-name" placeholder="Ex: Supino, Agachamento..." /></div>
      <div>
        <label class="input-label">Tipo</label>
        <select class="input-field" id="w-type">
          <option>Musculação</option><option>Cardio</option><option>Funcional</option>
          <option>Crossfit</option><option>Yoga</option><option>Outro</option>
        </select>
      </div>
      <div class="form-row">
        <div><label class="input-label">Séries</label><input class="input-field" id="w-sets" type="number" min="1" placeholder="4" /></div>
        <div><label class="input-label">Repetições</label><input class="input-field" id="w-reps" type="number" min="1" placeholder="12" /></div>
      </div>
      <div class="form-row">
        <div><label class="input-label">Carga (kg)</label><input class="input-field" id="w-weight" type="number" min="0" step="0.5" placeholder="80" /></div>
        <div><label class="input-label">Data</label><input class="input-field" id="w-date" type="date" value="${today()}" /></div>
      </div>
      <div><label class="input-label">Observações</label><textarea class="input-field" id="w-obs" rows="2" placeholder="Notas do treino..."></textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveWorkout()">Salvar</button>
    </div>`);
}

async function saveWorkout() {
  const exerciseName = document.getElementById('w-name').value.trim();
  const exerciseType = document.getElementById('w-type').value;
  const sets         = parseInt(document.getElementById('w-sets').value) || null;
  const reps         = parseInt(document.getElementById('w-reps').value) || null;
  const weight       = parseFloat(document.getElementById('w-weight').value) || null;
  const date         = document.getElementById('w-date').value;
  const notes        = document.getElementById('w-obs').value.trim();
  if (!exerciseName) { showToast('Preencha o nome do exercício.', 'error'); return; }
  try {
    const w = await api('POST', '/gym/workouts', { exerciseName, exerciseType, sets, reps, weight, date, notes });
    appData.workouts.push(w);
    closeModal();
    showToast('Treino registrado!', 'success');
    navigateTo('gym');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteWorkout(id) {
  try {
    await api('DELETE', `/gym/workouts/${id}`);
    appData.workouts = appData.workouts.filter(w => w.id != id);
    showToast('Treino excluído.', 'info');
    navigateTo('gym');
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddNutritionModal() {
  openModal('Adicionar Refeição', `
    <div class="form-grid">
      <div><label class="input-label">Refeição</label><input class="input-field" id="n-meal" placeholder="Ex: Almoço, Café da manhã..." /></div>
      <div class="form-row">
        <div><label class="input-label">Calorias (kcal)</label><input class="input-field" id="n-cal" type="number" min="0" placeholder="500" /></div>
        <div><label class="input-label">Data</label><input class="input-field" id="n-date" type="date" value="${today()}" /></div>
      </div>
      <div class="form-row">
        <div><label class="input-label">Proteína (g)</label><input class="input-field" id="n-prot" type="number" min="0" step="0.1" placeholder="30" /></div>
        <div><label class="input-label">Carboidratos (g)</label><input class="input-field" id="n-carbs" type="number" min="0" step="0.1" placeholder="60" /></div>
      </div>
      <div class="form-row">
        <div><label class="input-label">Gorduras (g)</label><input class="input-field" id="n-fats" type="number" min="0" step="0.1" placeholder="15" /></div>
        <div></div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveNutrition()">Salvar</button>
    </div>`);
}

async function saveNutrition() {
  const mealName = document.getElementById('n-meal').value.trim();
  const calories = parseFloat(document.getElementById('n-cal').value) || 0;
  const protein  = parseFloat(document.getElementById('n-prot').value) || 0;
  const carbs    = parseFloat(document.getElementById('n-carbs').value) || 0;
  const fats     = parseFloat(document.getElementById('n-fats').value) || 0;
  const date     = document.getElementById('n-date').value;
  if (!mealName) { showToast('Preencha o nome da refeição.', 'error'); return; }
  try {
    const n = await api('POST', '/gym/nutrition', { mealName, calories, protein, carbs, fats, date });
    appData.nutrition.push(n);
    closeModal();
    showToast('Refeição adicionada!', 'success');
    navigateTo('gym');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteNutrition(id) {
  try {
    await api('DELETE', `/gym/nutrition/${id}`);
    appData.nutrition = appData.nutrition.filter(n => n.id != id);
    showToast('Refeição excluída.', 'info');
    navigateTo('gym');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════
   PAGE: FINANCE
══════════════════════════════════════════════ */
const FIN_CATEGORIES = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Roupas','Serviços','Investimento','Outros'];

function renderFinance(container) {
  const income   = appData.transactions.filter(t=>t.type==='INCOME').reduce((a,b)=>a+b.amount,0)
                 + appData.salaries.reduce((a,b)=>a+b.amount,0);
  const expense  = appData.transactions.filter(t=>t.type==='EXPENSE').reduce((a,b)=>a+b.amount,0);
  const balance  = income - expense;

  container.innerHTML = `
    <div class="grid-3" style="margin-bottom:24px">
      <div class="stat-card" style="--accent-color:${balance>=0?'var(--accent-green)':'var(--accent-red)'}">
        <div class="stat-label">Saldo</div>
        <div class="stat-value" style="color:${balance>=0?'var(--accent-green)':'var(--accent-red)'}">R$${fmt(balance)}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-green)">
        <div class="stat-label">Receitas</div>
        <div class="stat-value" style="color:var(--accent-green)">R$${fmt(income)}</div>
      </div>
      <div class="stat-card" style="--accent-color:var(--accent-red)">
        <div class="stat-label">Gastos</div>
        <div class="stat-value" style="color:var(--accent-red)">R$${fmt(expense)}</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="finTab('transactions',this)">Transações</button>
      <button class="tab-btn" onclick="finTab('salary',this)">Salários</button>
    </div>

    <div id="fin-transactions" class="tab-panel active">
      <div class="section-head" style="margin-top:0">
        <span class="section-title">Transações</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="exportFinanceExcel()">📥 Exportar Excel</button>
          <button class="btn btn-accent" onclick="openAddTransactionModal()">+ Adicionar</button>
        </div>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Data</th><th>Frequência</th><th></th></tr></thead>
            <tbody>
              ${appData.transactions.length===0
                ? `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:30px">Nenhuma transação ainda</td></tr>`
                : appData.transactions.sort((a,b)=>b.date?.localeCompare(a.date||'')).map(t => `
                  <tr>
                    <td style="font-weight:600">${t.description}</td>
                    <td><span class="badge ${t.type==='INCOME'?'badge-green':'badge-red'}">${t.type==='INCOME'?'Receita':'Gasto'}</span></td>
                    <td>${t.category||'—'}</td>
                    <td class="${t.type==='INCOME'?'fin-amount-pos':'fin-amount-neg'}">${t.type==='INCOME'?'+':'-'}R$${fmt(t.amount)}</td>
                    <td>${fmtDate(t.date)}</td>
                    <td><span class="badge badge-blue">${t.frequency||'Único'}</span></td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteTransaction(${t.id})">Excluir</button></td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="fin-salary" class="tab-panel">
      <div class="section-head" style="margin-top:0">
        <span class="section-title">Salários / Renda Fixa</span>
        <button class="btn btn-accent" onclick="openAddSalaryModal()">+ Adicionar Salário</button>
      </div>
      <div class="card" style="padding:0">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Fonte</th><th>Valor</th><th>Dia de Recebimento</th><th>Observação</th><th></th></tr></thead>
            <tbody>
              ${appData.salaries.length===0
                ? `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:30px">Nenhum salário cadastrado</td></tr>`
                : appData.salaries.map(s => `
                  <tr>
                    <td style="font-weight:600">${s.source}</td>
                    <td class="fin-amount-pos">R$${fmt(s.amount)}</td>
                    <td>Dia ${s.dayOfMonth||'—'}</td>
                    <td style="color:var(--text-2)">${s.notes||'—'}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteSalary(${s.id})">Excluir</button></td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function finTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`fin-${tab}`).classList.add('active');
}

function openAddTransactionModal() {
  openModal('Nova Transação', `
    <div class="form-grid">
      <div><label class="input-label">Descrição</label><input class="input-field" id="tr-desc" placeholder="Ex: Mercado, Freelance..." /></div>
      <div>
        <label class="input-label">Tipo</label>
        <select class="input-field" id="tr-type">
          <option value="EXPENSE">Gasto</option>
          <option value="INCOME">Receita</option>
        </select>
      </div>
      <div>
        <label class="input-label">Categoria</label>
        <select class="input-field" id="tr-cat">
          ${FIN_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div><label class="input-label">Valor (R$)</label><input class="input-field" id="tr-amount" type="number" min="0" step="0.01" placeholder="0.00" /></div>
        <div><label class="input-label">Data</label><input class="input-field" id="tr-date" type="date" value="${today()}" /></div>
      </div>
      <div>
        <label class="input-label">Frequência</label>
        <select class="input-field" id="tr-freq">
          <option value="Único">Único</option>
          <option value="Semanal">Semanal</option>
          <option value="Mensal">Mensal</option>
          <option value="Anual">Anual</option>
        </select>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveTransaction()">Salvar</button>
    </div>`);
}

async function saveTransaction() {
  const description = document.getElementById('tr-desc').value.trim();
  const type        = document.getElementById('tr-type').value;
  const category    = document.getElementById('tr-cat').value;
  const amount      = parseFloat(document.getElementById('tr-amount').value);
  const date        = document.getElementById('tr-date').value;
  const frequency   = document.getElementById('tr-freq').value;
  if (!description || !amount || isNaN(amount)) { showToast('Preencha descrição e valor.', 'error'); return; }
  try {
    const t = await api('POST', '/finance/transactions', { description, type, category, amount, date, frequency });
    appData.transactions.push(t);
    closeModal();
    showToast('Transação adicionada!', 'success');
    navigateTo('finance');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteTransaction(id) {
  try {
    await api('DELETE', `/finance/transactions/${id}`);
    appData.transactions = appData.transactions.filter(t => t.id != id);
    showToast('Transação excluída.', 'info');
    navigateTo('finance');
  } catch(e) { showToast(e.message, 'error'); }
}

function openAddSalaryModal() {
  openModal('Novo Salário', `
    <div class="form-grid">
      <div><label class="input-label">Fonte / Empresa</label><input class="input-field" id="sal-source" placeholder="Ex: Empresa X, Freelance..." /></div>
      <div class="form-row">
        <div><label class="input-label">Valor (R$)</label><input class="input-field" id="sal-amount" type="number" min="0" step="0.01" placeholder="0.00" /></div>
        <div><label class="input-label">Dia de Recebimento</label><input class="input-field" id="sal-day" type="number" min="1" max="31" placeholder="5" /></div>
      </div>
      <div><label class="input-label">Observações</label><textarea class="input-field" id="sal-notes" rows="2"></textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="saveSalary()">Salvar</button>
    </div>`);
}

async function saveSalary() {
  const source     = document.getElementById('sal-source').value.trim();
  const amount     = parseFloat(document.getElementById('sal-amount').value);
  const dayOfMonth = parseInt(document.getElementById('sal-day').value) || null;
  const notes      = document.getElementById('sal-notes').value.trim();
  if (!source || !amount) { showToast('Preencha fonte e valor.', 'error'); return; }
  try {
    const s = await api('POST', '/finance/salaries', { source, amount, dayOfMonth, notes });
    appData.salaries.push(s);
    closeModal();
    showToast('Salário adicionado!', 'success');
    navigateTo('finance');
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteSalary(id) {
  try {
    await api('DELETE', `/finance/salaries/${id}`);
    appData.salaries = appData.salaries.filter(s => s.id != id);
    showToast('Salário excluído.', 'info');
    navigateTo('finance');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─── EXCEL EXPORT ─── */
function exportFinanceExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const income  = appData.transactions.filter(t=>t.type==='INCOME').reduce((a,b)=>a+b.amount,0)
                + appData.salaries.reduce((a,b)=>a+b.amount,0);
  const expense = appData.transactions.filter(t=>t.type==='EXPENSE').reduce((a,b)=>a+b.amount,0);
  const summaryData = [
    ['LifeOS — Relatório Financeiro'],
    ['Gerado em:', new Date().toLocaleDateString('pt-BR')],
    [''],
    ['RESUMO GERAL'],
    ['Total de Receitas', `R$ ${fmt(income)}`],
    ['Total de Gastos', `R$ ${fmt(expense)}`],
    ['Saldo', `R$ ${fmt(income-expense)}`],
    [''],
    ['SALÁRIOS / RENDA FIXA'],
    ['Fonte', 'Valor Mensal', 'Dia de Recebimento', 'Observações'],
    ...appData.salaries.map(s => [s.source, s.amount, s.dayOfMonth||'—', s.notes||'']),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{wch:30},{wch:20},{wch:20},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');

  // Sheet 2: Transactions
  const transData = [
    ['Descrição','Tipo','Categoria','Valor (R$)','Data','Frequência'],
    ...appData.transactions.map(t => [
      t.description,
      t.type==='INCOME'?'Receita':'Gasto',
      t.category||'—',
      t.amount,
      fmtDate(t.date),
      t.frequency||'Único'
    ])
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(transData);
  ws2['!cols'] = [{wch:30},{wch:12},{wch:18},{wch:15},{wch:15},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Transações');

  // Sheet 3: By Category
  const cats = {};
  appData.transactions.filter(t=>t.type==='EXPENSE').forEach(t => {
    cats[t.category||'Outros'] = (cats[t.category||'Outros']||0) + t.amount;
  });
  const catData = [
    ['Categoria','Total Gasto (R$)','% do Total'],
    ...Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat, val]) => [
      cat, val, `${((val/expense)*100).toFixed(1)}%`
    ])
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(catData);
  ws3['!cols'] = [{wch:20},{wch:20},{wch:15}];
  XLSX.utils.book_append_sheet(wb, ws3, 'Por Categoria');

  XLSX.writeFile(wb, `LifeOS_Financas_${today()}.xlsx`);
  showToast('Excel exportado com sucesso!', 'success');
}

/* ══════════════════════════════════════════════
   PAGE: PROFILE
══════════════════════════════════════════════ */
function renderProfile(container) {
  const avatarSrc = currentUser?.avatarUrl || localStorage.getItem('lifeos_avatar') || '';
  container.innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <div class="card" style="margin-bottom:20px;text-align:center">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar" id="profile-avatar">
            ${avatarSrc ? `<img id="profile-avatar-img" src="${avatarSrc}" alt="Avatar" />` : ''}
            <span id="profile-avatar-letter" style="${avatarSrc?'display:none':''}">${(currentUser?.name||'U').charAt(0).toUpperCase()}</span>
          </div>
          <label class="avatar-edit-btn" for="avatar-file-input" title="Alterar foto">✏️</label>
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" onchange="handleAvatarUpload(event)" />
        <div style="font-family:var(--font-display);font-size:22px;font-weight:700;margin-bottom:4px">${currentUser?.name||'Usuário'}</div>
        <div style="color:var(--text-2);font-size:14px">${currentUser?.email||''}</div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <h3 style="font-family:var(--font-display);font-size:16px;font-weight:700;margin-bottom:18px">Editar Perfil</h3>
        <div class="form-grid">
          <div><label class="input-label">Nome completo</label><input class="input-field" id="prof-name" value="${currentUser?.name||''}" /></div>
          <div><label class="input-label">E-mail</label><input class="input-field" id="prof-email" type="email" value="${currentUser?.email||''}" /></div>
          <div><label class="input-label">Bio (opcional)</label><textarea class="input-field" id="prof-bio" rows="2" placeholder="Uma frase sobre você...">${currentUser?.bio||''}</textarea></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-accent" onclick="saveProfile()">Salvar Alterações</button>
        </div>
      </div>

      <div class="card">
        <h3 style="font-family:var(--font-display);font-size:16px;font-weight:700;margin-bottom:18px">Alterar Senha</h3>
        <div class="form-grid">
          <div>
            <label class="input-label">Senha Atual</label>
            <div class="password-wrap">
              <input class="input-field" id="pw-current" type="password" placeholder="Senha atual" />
              <button type="button" class="toggle-pw" onclick="togglePw('pw-current',this)">👁</button>
            </div>
          </div>
          <div>
            <label class="input-label">Nova Senha</label>
            <div class="password-wrap">
              <input class="input-field" id="pw-new" type="password" placeholder="Mínimo 8 caracteres" />
              <button type="button" class="toggle-pw" onclick="togglePw('pw-new',this)">👁</button>
            </div>
          </div>
          <div>
            <label class="input-label">Confirmar Nova Senha</label>
            <input class="input-field" id="pw-confirm" type="password" placeholder="Repita a nova senha" />
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-accent" onclick="savePassword()">Alterar Senha</button>
        </div>
      </div>
    </div>`;
}

function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Imagem muito grande. Máximo 5MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    localStorage.setItem('lifeos_avatar', dataUrl);
    // Update all avatar displays
    ['sidebar-avatar-img','topbar-avatar-img','profile-avatar-img'].forEach(id => {
      let img = document.getElementById(id);
      if (!img) { img = document.createElement('img'); img.id = id; }
      img.src = dataUrl;
      img.style.display = 'block';
    });
    ['sidebar-avatar-letter','topbar-avatar-letter','profile-avatar-letter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    try {
      await api('POST', '/user/avatar', { avatarUrl: dataUrl });
      showToast('Foto de perfil atualizada!', 'success');
    } catch(e) {
      showToast('Foto salva localmente.', 'info');
    }
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  const name  = document.getElementById('prof-name').value.trim();
  const email = document.getElementById('prof-email').value.trim();
  const bio   = document.getElementById('prof-bio').value.trim();
  if (!name || !email) { showToast('Nome e e-mail são obrigatórios.', 'error'); return; }
  try {
    const updated = await api('PUT', '/user/profile', { name, email, bio });
    currentUser = { ...currentUser, ...updated };
    localStorage.setItem('lifeos_user', JSON.stringify(currentUser));
    updateUserUI();
    showToast('Perfil atualizado!', 'success');
    navigateTo('profile');
  } catch(e) { showToast(e.message, 'error'); }
}

async function savePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  if (!current || !newPw) { showToast('Preencha todos os campos.', 'error'); return; }
  if (newPw.length < 8) { showToast('Nova senha deve ter pelo menos 8 caracteres.', 'error'); return; }
  if (newPw !== confirm) { showToast('As senhas não coincidem.', 'error'); return; }
  try {
    await api('PUT', '/user/password', { currentPassword: current, newPassword: newPw });
    showToast('Senha alterada com sucesso!', 'success');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value     = '';
    document.getElementById('pw-confirm').value = '';
  } catch(e) { showToast(e.message, 'error'); }
}

/* ──────────────── KEYBOARD SHORTCUTS ──────────────── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.altKey) {
    const map = { '1':'dashboard','2':'schedule','3':'study','4':'gym','5':'finance','6':'profile' };
    if (map[e.key]) navigateTo(map[e.key]);
  }
});

/* ──────────────── BOOT ──────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('lifeos_token');
  const user  = localStorage.getItem('lifeos_user');
  if (token && user) {
    authToken   = token;
    currentUser = JSON.parse(user);
    initApp();
  }
});

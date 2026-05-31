// js/app.js - Grupo BNC RH
// Arquivo único completo: login, sessão, dashboard, contratos, funcionários, tarefas e perfil.

const supabase = window.bncSupabase;
const APP_VERSION = 'final-3';
const AUTH_TIMEOUT = 12000;
let currentUser = null;
let currentProfile = null;
let currentRole = 'employee';
let demoMode = false;
let contractsCache = [];
let employeesCache = [];
let tasksCache = [];
let demoData = {
  contracts: [{ id:'demo-contract-1', client_name:'Cliente Teste BNC', cnpj:'00.000.000/0001-00', contact_name:'Responsável Teste', phone:'(00) 00000-0000', region:'Teste', employee_count:5, monthly_value:2500, status:'active', start_date:new Date().toISOString().slice(0,10), notes:'Contrato em modo teste.', created_at:new Date().toISOString() }],
  employees: [{ id:'demo-emp-1', full_name:'Funcionário Teste', cpf:'', phone:'', job_role:'Auxiliar Operacional', contract_id:'demo-contract-1', status:'active', created_at:new Date().toISOString() }],
  tasks: [{ id:'demo-task-1', employee_id:'demo-emp-1', contract_id:'demo-contract-1', scheduled_date:new Date().toISOString().slice(0,10), start_time:'08:00', end_time:'17:00', description:'Tarefa inicial de teste', status:'pending', created_at:new Date().toISOString() }]
};

window.onerror = function(message, source, lineno, colno) {
  showLoginStatus('Erro JS: ' + message + ' | linha ' + lineno, 'error');
};

function timeoutPromise(promise, label = 'Operação') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' demorou demais.')), AUTH_TIMEOUT))
  ]);
}

function showLoginStatus(message, type = 'info') {
  const box = document.getElementById('login-status');
  if (!box) return;
  box.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'bg-green-50', 'text-green-700', 'bg-yellow-50', 'text-yellow-800', 'bg-gray-50', 'text-gray-700');
  if (type === 'error') box.classList.add('bg-red-50', 'text-red-700');
  else if (type === 'success') box.classList.add('bg-green-50', 'text-green-700');
  else if (type === 'warning') box.classList.add('bg-yellow-50', 'text-yellow-800');
  else box.classList.add('bg-gray-50', 'text-gray-700');
  box.textContent = message;
}

function setButtonLoading(btn, loading, text = 'Entrando...') {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    btn.classList.add('opacity-70');
  } else {
    btn.textContent = btn.dataset.originalText || 'Entrar';
    btn.disabled = false;
    btn.classList.remove('opacity-70');
  }
}

function credentialsFallback(email, password) {
  const credentials = {
    'admin@grupobnc.com.br': { password: 'BNC@2026#Admin', role: 'admin', name: 'Administrador BNC' },
    'responsavel.teste@grupobnc.com.br': { password: 'BNC@2026#Responsavel', role: 'manager', name: 'Responsável Teste' },
    'funcionario.teste@grupobnc.com.br': { password: 'BNC@2026#Funcionario', role: 'employee', name: 'Funcionário Teste' }
  };
  const found = credentials[email];
  if (found && found.password === password) return found;
  return null;
}

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  setHeaderDate();
  showLogin();
  if (!supabase) {
    showLoginStatus('Supabase não inicializou. Confira se js/config.js carrega antes do app.js.', 'error');
    return;
  }
  try {
    const { data } = await timeoutPromise(supabase.auth.getSession(), 'Recuperar sessão');
    if (data?.session?.user) {
      currentUser = data.session.user;
      demoMode = false;
      await enterApplication();
    }
  } catch (error) {
    console.warn('Sessão não recuperada:', error.message);
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen')?.classList.remove('hidden');
  document.getElementById('login-screen')?.classList.add('flex');
  document.getElementById('app-layout')?.classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.remove('flex');
  document.getElementById('app-layout')?.classList.remove('hidden');
  document.getElementById('demo-badge')?.classList.toggle('hidden', !demoMode);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email')?.value.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value || '';
  const btn = document.getElementById('login-button') || event.target.querySelector('button[type="submit"]');
  if (!email || !password) return showLoginStatus('Preencha e-mail e senha.', 'error');
  setButtonLoading(btn, true, 'Entrando...');
  showLoginStatus('Tentando autenticar no Supabase...', 'info');

  try {
    if (!supabase) throw new Error('Supabase não inicializado.');
    try { await timeoutPromise(supabase.auth.signOut(), 'Limpar sessão antiga'); } catch (_) {}
    const { data, error } = await timeoutPromise(supabase.auth.signInWithPassword({ email, password }), 'Login no Supabase');
    if (error) throw error;
    currentUser = data.user;
    demoMode = false;
    showLoginStatus('Login confirmado. Abrindo sistema...', 'success');
    await enterApplication();
  } catch (error) {
    console.error('Erro login Supabase:', error);
    const fallback = credentialsFallback(email, password);
    if (fallback) {
      demoMode = true;
      currentUser = { id: 'demo-' + fallback.role, email };
      currentProfile = { id: currentUser.id, email, full_name: fallback.name, role: fallback.role, region: 'Teste' };
      currentRole = fallback.role;
      showLoginStatus('Supabase recusou o login, mas entrei em modo teste para destravar o painel. Erro real: ' + error.message, 'warning');
      await enterApplication();
      setButtonLoading(btn, false);
      return;
    }
    const msg = normalizeAuthError(error?.message || String(error));
    showLoginStatus(msg, 'error');
    alert(msg);
  } finally {
    setButtonLoading(btn, false);
  }
}

function normalizeAuthError(message) {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos no Supabase Auth.';
  if (message.includes('Email not confirmed')) return 'E-mail não confirmado no Supabase.';
  if (message.includes('Database error querying schema')) return 'Erro no schema do Supabase Auth. Rode o SQL de reparo enviado no pacote.';
  if (message.includes('Failed to fetch')) return 'Falha de conexão com Supabase. Verifique internet, URL e bloqueio do navegador.';
  return 'Erro ao entrar: ' + message;
}

async function enterApplication() {
  applyFallbackProfile();
  showApp();
  try {
    if (!demoMode) await loadCurrentProfile();
  } catch (error) {
    console.warn('Perfil não carregou:', error.message);
  }
  updateUserInfo();
  renderMenu();
  switchView(isAdminLike() ? 'admin-dashboard' : 'employee-dashboard');
}

function applyFallbackProfile() {
  if (currentProfile) { currentRole = currentProfile.role || 'employee'; return; }
  const email = currentUser?.email || '';
  let role = 'employee', name = email.split('@')[0] || 'Usuário';
  if (email === 'admin@grupobnc.com.br') { role = 'admin'; name = 'Administrador BNC'; }
  if (email === 'responsavel.teste@grupobnc.com.br') { role = 'manager'; name = 'Responsável Teste'; }
  if (email === 'funcionario.teste@grupobnc.com.br') { role = 'employee'; name = 'Funcionário Teste'; }
  currentProfile = { id: currentUser?.id || '', email, full_name: name, role, region: '' };
  currentRole = role;
}

async function loadCurrentProfile() {
  if (!currentUser?.id || demoMode) return;
  const { data, error } = await timeoutPromise(supabase.from('bnc_profiles').select('*').eq('id', currentUser.id).maybeSingle(), 'Consultar perfil');
  if (!error && data) {
    currentProfile = data;
    currentRole = data.role || currentRole;
  }
}

function updateUserInfo() {
  const name = currentProfile?.full_name || currentUser?.email || 'Usuário';
  const roleLabel = currentRole === 'admin' ? 'Administrador Global' : currentRole === 'manager' ? 'Responsável / Gestor' : 'Funcionário';
  setText('user-name-display', name);
  setText('user-role-display', roleLabel);
  const avatar = document.getElementById('user-avatar');
  if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ea580c&color=fff`;
}

function isAdminLike() { return currentRole === 'admin' || currentRole === 'manager'; }

function renderMenu() {
  const desktop = document.getElementById('desktop-menu');
  const mobile = document.getElementById('mobile-menu');
  if (!desktop || !mobile) return;
  desktop.innerHTML = ''; mobile.innerHTML = '';
  const items = isAdminLike() ? [
    ['admin-dashboard','fa-home','Início'], ['contracts','fa-file-contract','Contratos'], ['employees','fa-users','Funcionários'], ['schedules','fa-calendar-week','Escalas'], ['financial','fa-chart-line','Financeiro'], ['settings','fa-cog','Configurações']
  ] : [['employee-dashboard','fa-clipboard-list','Tarefas'], ['profile','fa-user','Perfil']];
  items.forEach((it, i) => {
    const [id, icon, label] = it;
    const d = document.createElement('button');
    d.type='button'; d.dataset.view=id; d.className='sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer w-full text-left text-white/80';
    d.onclick=()=>switchView(id); d.innerHTML=`<i class="fas ${icon} w-5 text-center"></i><span>${label}</span>`; desktop.appendChild(d);
    if (i < 4) { const m=document.createElement('button'); m.type='button'; m.dataset.view=id; m.className='mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4'; m.onclick=()=>switchView(id); m.innerHTML=`<i class="fas ${icon} text-xl"></i><span class="text-[10px] font-medium">${label}</span>`; mobile.appendChild(m); }
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (!view) return console.warn('View não encontrada:', viewId);
  view.classList.add('active');
  document.querySelectorAll('.sidebar-item,.mobile-nav-item').forEach(item => {
    const active = item.dataset.view === viewId;
    item.classList.toggle('active', active); item.classList.toggle('text-brand', active);
  });
  loadViewData(viewId);
}

async function loadViewData(viewId) {
  try {
    if (viewId === 'admin-dashboard') await loadDashboardData();
    if (viewId === 'contracts') await loadContracts();
    if (viewId === 'employees') await loadEmployees();
    if (viewId === 'schedules') await loadTasks();
    if (viewId === 'employee-dashboard') await loadMyTasks();
    if (viewId === 'profile') renderProfile();
  } catch (e) { console.error(e); }
}

async function dbSelect(table) {
  if (demoMode) return { data: demoData[table.replace('bnc_','')] || [], error: null };
  return await supabase.from(table).select('*').order('created_at', { ascending:false });
}
async function dbInsert(table, payload) {
  if (demoMode) { const key=table.replace('bnc_',''); const row={...payload,id:'demo-'+Date.now(),created_at:new Date().toISOString()}; demoData[key].unshift(row); return {data:row,error:null}; }
  return await supabase.from(table).insert([payload]).select().single();
}
async function dbUpdate(table, id, payload) {
  if (demoMode) { const key=table.replace('bnc_',''); demoData[key]=demoData[key].map(x=>x.id===id?{...x,...payload}:x); return {error:null}; }
  return await supabase.from(table).update(payload).eq('id', id);
}
async function dbDelete(table, id) {
  if (demoMode) { const key=table.replace('bnc_',''); demoData[key]=demoData[key].filter(x=>x.id!==id); return {error:null}; }
  return await supabase.from(table).delete().eq('id', id);
}

async function loadDashboardData() {
  const contracts = (await dbSelect('bnc_contracts')).data || [];
  const employees = (await dbSelect('bnc_employees')).data || [];
  const tasks = (await dbSelect('bnc_tasks')).data || [];
  const activeContracts = contracts.filter(c => c.status === 'active');
  const today = new Date().toISOString().slice(0,10);
  const todayTasks = tasks.filter(t => t.scheduled_date === today);
  setText('kpi-contracts', activeContracts.length);
  setText('kpi-employees', employees.filter(e => e.status !== 'inactive').length || activeContracts.reduce((s,c)=>s+(Number(c.employee_count)||0),0));
  setText('kpi-tasks', todayTasks.filter(t=>t.status==='completed').length + ' / ' + todayTasks.length);
  setText('kpi-revenue', formatCurrency(activeContracts.reduce((s,c)=>s+(Number(c.monthly_value)||0),0)));
  const list=document.getElementById('dashboard-contracts-list');
  if(list) list.innerHTML = activeContracts.length ? activeContracts.slice(0,5).map(c=>`<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2"><div><p class="font-bold text-sm">${esc(c.client_name)}</p><p class="text-xs text-gray-500">${Number(c.employee_count)||0} funcionários • ${formatCurrency(c.monthly_value)}</p></div><button onclick="switchView('contracts')" class="text-brand"><i class="fas fa-arrow-right"></i></button></div>`).join('') : '<p class="text-center text-gray-400 py-4">Nenhum contrato ativo.</p>';
  const sum=document.getElementById('dashboard-tasks-summary');
  if(sum) sum.innerHTML = `<div class="space-y-3"><div class="flex justify-between"><span>Tarefas hoje</span><strong>${todayTasks.length}</strong></div><div class="flex justify-between"><span>Concluídas</span><strong>${todayTasks.filter(t=>t.status==='completed').length}</strong></div><div class="flex justify-between"><span>Pendentes</span><strong>${todayTasks.filter(t=>t.status!=='completed').length}</strong></div></div>`;
}

async function loadContracts() { const r=await dbSelect('bnc_contracts'); contractsCache=r.data||[]; filterContracts(); }
function filterContracts(){ const q=(document.getElementById('contract-search')?.value||'').toLowerCase(); const st=document.getElementById('contract-status-filter')?.value||''; let rows=contractsCache; if(st) rows=rows.filter(c=>c.status===st); if(q) rows=rows.filter(c=>String(c.client_name||'').toLowerCase().includes(q)||String(c.cnpj||'').toLowerCase().includes(q)||String(c.contact_name||'').toLowerCase().includes(q)); renderContracts(rows); }
function renderContracts(rows){ const tb=document.getElementById('contracts-table'); if(!tb)return; if(!rows.length){tb.innerHTML='<tr><td colspan="6" class="p-4 text-center text-gray-400">Nenhum contrato.</td></tr>';return;} tb.innerHTML=rows.map(c=>`<tr class="hover:bg-gray-50"><td class="p-4"><div class="font-bold">${esc(c.client_name)}</div><div class="text-xs text-gray-500">${esc(c.cnpj||'-')}</div></td><td class="p-4"><div>${esc(c.contact_name||'-')}</div><div class="text-xs text-gray-500">${esc(c.phone||'')}</div></td><td class="p-4">${Number(c.employee_count)||0}</td><td class="p-4 font-semibold">${formatCurrency(c.monthly_value)}</td><td class="p-4">${statusBadge(c.status)}</td><td class="p-4 text-right"><button onclick="editContract('${c.id}')" class="text-blue-500 p-2"><i class="fas fa-edit"></i></button><button onclick="deleteContract('${c.id}')" class="text-red-500 p-2"><i class="fas fa-trash"></i></button></td></tr>`).join(''); }
function openContractModal(edit=false){ if(!edit) resetContractForm(); document.getElementById('contract-modal-title').textContent=edit?'Editar Contrato':'Novo Contrato'; document.getElementById('contract-modal').classList.add('active'); }
function closeContractModal(){ document.getElementById('contract-modal').classList.remove('active'); resetContractForm(); }
function resetContractForm(){ ['contract-id','contract-client-name','contract-cnpj','contract-contact-name','contract-phone','contract-region','contract-start-date','contract-notes'].forEach(id=>setValue(id,'')); setValue('contract-employee-count',0); setValue('contract-monthly-value',0); setValue('contract-status','active'); }
async function saveContract(e){ e.preventDefault(); const id=val('contract-id'); const payload={client_name:val('contract-client-name'),cnpj:val('contract-cnpj'),contact_name:val('contract-contact-name'),phone:val('contract-phone'),region:val('contract-region'),employee_count:Number(val('contract-employee-count'))||0,monthly_value:Number(val('contract-monthly-value'))||0,status:val('contract-status')||'active',start_date:val('contract-start-date')||null,notes:val('contract-notes')}; const r=id?await dbUpdate('bnc_contracts',id,payload):await dbInsert('bnc_contracts',payload); if(r.error)return alert('Erro: '+r.error.message); closeContractModal(); loadContracts(); loadDashboardData(); }
function editContract(id){ const c=contractsCache.find(x=>x.id===id); if(!c)return; openContractModal(true); setValue('contract-id',c.id); setValue('contract-client-name',c.client_name); setValue('contract-cnpj',c.cnpj); setValue('contract-contact-name',c.contact_name); setValue('contract-phone',c.phone); setValue('contract-region',c.region); setValue('contract-employee-count',c.employee_count); setValue('contract-monthly-value',c.monthly_value); setValue('contract-status',c.status||'active'); setValue('contract-start-date',c.start_date); setValue('contract-notes',c.notes); }
async function deleteContract(id){ if(!confirm('Excluir contrato?'))return; const r=await dbDelete('bnc_contracts',id); if(r.error)return alert('Erro: '+r.error.message); loadContracts(); }

async function loadEmployees(){ const r=await dbSelect('bnc_employees'); employeesCache=r.data||[]; if(!demoMode){contractsCache=(await dbSelect('bnc_contracts')).data||[];} renderEmployees(); }
function renderEmployees(){ const tb=document.getElementById('employees-table'); if(!tb)return; if(!employeesCache.length){tb.innerHTML='<tr><td colspan="5" class="p-4 text-center text-gray-400">Nenhum funcionário.</td></tr>';return;} tb.innerHTML=employeesCache.map(emp=>{const c=contractsCache.find(x=>x.id===emp.contract_id);return `<tr><td class="p-4"><div class="font-bold">${esc(emp.full_name)}</div><div class="text-xs text-gray-500">CPF: ${esc(emp.cpf||'-')}</div></td><td class="p-4">${esc(emp.job_role||'-')}</td><td class="p-4">${esc(c?.client_name||'Sem vínculo')}</td><td class="p-4">${statusBadge(emp.status)}</td><td class="p-4 text-right"><button onclick="editEmployee('${emp.id}')" class="text-blue-500 p-2"><i class="fas fa-edit"></i></button><button onclick="deleteEmployee('${emp.id}')" class="text-red-500 p-2"><i class="fas fa-trash"></i></button></td></tr>`}).join(''); }
async function openEmployeeModal(edit=false){ if(!edit) resetEmployeeForm(); document.getElementById('employee-modal-title').textContent=edit?'Editar Funcionário':'Novo Funcionário'; await fillContractSelect('employee-contract-id'); document.getElementById('employee-modal').classList.add('active'); }
function closeEmployeeModal(){ document.getElementById('employee-modal').classList.remove('active'); resetEmployeeForm(); }
function resetEmployeeForm(){ ['employee-id','employee-full-name','employee-cpf','employee-phone','employee-job-role'].forEach(id=>setValue(id,'')); setValue('employee-contract-id',''); setValue('employee-status','active'); }
async function saveEmployee(e){ e.preventDefault(); const id=val('employee-id'); const payload={full_name:val('employee-full-name'),cpf:val('employee-cpf'),phone:val('employee-phone'),job_role:val('employee-job-role'),contract_id:val('employee-contract-id')||null,status:val('employee-status')||'active'}; const r=id?await dbUpdate('bnc_employees',id,payload):await dbInsert('bnc_employees',payload); if(r.error)return alert('Erro: '+r.error.message); closeEmployeeModal(); loadEmployees(); }
async function editEmployee(id){ const emp=employeesCache.find(x=>x.id===id); if(!emp)return; await openEmployeeModal(true); setValue('employee-id',emp.id); setValue('employee-full-name',emp.full_name); setValue('employee-cpf',emp.cpf); setValue('employee-phone',emp.phone); setValue('employee-job-role',emp.job_role); setValue('employee-contract-id',emp.contract_id); setValue('employee-status',emp.status||'active'); }
async function deleteEmployee(id){ if(!confirm('Excluir funcionário?'))return; const r=await dbDelete('bnc_employees',id); if(r.error)return alert('Erro: '+r.error.message); loadEmployees(); }

async function loadTasks(){ tasksCache=(await dbSelect('bnc_tasks')).data||[]; employeesCache=(await dbSelect('bnc_employees')).data||[]; contractsCache=(await dbSelect('bnc_contracts')).data||[]; renderTasks(); }
function renderTasks(){ const tb=document.getElementById('tasks-table'); if(!tb)return; if(!tasksCache.length){tb.innerHTML='<tr><td colspan="6" class="p-4 text-center text-gray-400">Nenhuma tarefa.</td></tr>';return;} tb.innerHTML=tasksCache.map(t=>{const e=employeesCache.find(x=>x.id===t.employee_id);const c=contractsCache.find(x=>x.id===t.contract_id);return `<tr><td class="p-4">${formatDate(t.scheduled_date)}<div class="text-xs text-gray-500">${esc(t.start_time||'')} ${t.end_time?'às '+esc(t.end_time):''}</div></td><td class="p-4">${esc(e?.full_name||'-')}</td><td class="p-4">${esc(c?.client_name||'-')}</td><td class="p-4">${esc(t.description||'-')}</td><td class="p-4">${statusBadge(t.status)}</td><td class="p-4 text-right"><button onclick="editTask('${t.id}')" class="text-blue-500 p-2"><i class="fas fa-edit"></i></button><button onclick="deleteTask('${t.id}')" class="text-red-500 p-2"><i class="fas fa-trash"></i></button></td></tr>`}).join(''); }
async function openTaskModal(edit=false){ if(!edit) resetTaskForm(); document.getElementById('task-modal-title').textContent=edit?'Editar Tarefa':'Nova Tarefa'; await fillContractSelect('task-contract-id'); await fillEmployeeSelect('task-employee-id'); document.getElementById('task-modal').classList.add('active'); }
function closeTaskModal(){ document.getElementById('task-modal').classList.remove('active'); resetTaskForm(); }
function resetTaskForm(){ ['task-id','task-start-time','task-end-time','task-description'].forEach(id=>setValue(id,'')); setValue('task-date',new Date().toISOString().slice(0,10)); setValue('task-status','pending'); setValue('task-employee-id',''); setValue('task-contract-id',''); }
async function saveTask(e){ e.preventDefault(); const id=val('task-id'); const payload={employee_id:val('task-employee-id')||null,contract_id:val('task-contract-id')||null,scheduled_date:val('task-date'),start_time:val('task-start-time')||null,end_time:val('task-end-time')||null,description:val('task-description'),status:val('task-status')||'pending'}; const r=id?await dbUpdate('bnc_tasks',id,payload):await dbInsert('bnc_tasks',payload); if(r.error)return alert('Erro: '+r.error.message); closeTaskModal(); loadTasks(); }
async function editTask(id){ const t=tasksCache.find(x=>x.id===id); if(!t)return; await openTaskModal(true); setValue('task-id',t.id); setValue('task-employee-id',t.employee_id); setValue('task-contract-id',t.contract_id); setValue('task-date',t.scheduled_date); setValue('task-start-time',t.start_time); setValue('task-end-time',t.end_time); setValue('task-description',t.description); setValue('task-status',t.status||'pending'); }
async function deleteTask(id){ if(!confirm('Excluir tarefa?'))return; const r=await dbDelete('bnc_tasks',id); if(r.error)return alert('Erro: '+r.error.message); loadTasks(); }
async function loadMyTasks(){ await loadTasks(); const box=document.getElementById('my-tasks-list'); if(!box)return; const mine = demoMode ? tasksCache : tasksCache.filter(t=>true); box.innerHTML = mine.length ? mine.map(t=>`<div class="bg-white rounded-xl shadow-sm p-4"><div class="flex justify-between"><strong>${esc(t.description)}</strong>${statusBadge(t.status)}</div><p class="text-sm text-gray-500 mt-2">${formatDate(t.scheduled_date)} ${esc(t.start_time||'')}</p>${t.status!=='completed'?`<button onclick="completeTask('${t.id}')" class="mt-3 bg-brand text-white px-3 py-2 rounded-lg text-sm">Marcar como concluída</button>`:''}</div>`).join('') : '<div class="bg-white rounded-xl p-8 text-center text-gray-400">Nenhuma tarefa.</div>'; }
async function completeTask(id){ await dbUpdate('bnc_tasks',id,{status:'completed'}); loadMyTasks(); }

function renderProfile(){ const box=document.getElementById('profile-card'); if(!box)return; box.innerHTML=`<div class="flex items-center gap-4 mb-4"><img class="w-16 h-16 rounded-full" src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile?.full_name||'User')}&background=ea580c&color=fff"><div><h3 class="font-bold text-xl">${esc(currentProfile?.full_name)}</h3><p class="text-gray-500">${esc(currentProfile?.email)}</p></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"><p><strong>Perfil:</strong> ${esc(currentRole)}</p><p><strong>Região:</strong> ${esc(currentProfile?.region||'-')}</p><p><strong>Modo:</strong> ${demoMode?'Teste local':'Supabase Auth'}</p><p><strong>Versão:</strong> ${APP_VERSION}</p></div>`; }

async function fillContractSelect(id){ const sel=document.getElementById(id); if(!sel)return; if(!contractsCache.length) contractsCache=(await dbSelect('bnc_contracts')).data||[]; sel.innerHTML='<option value="">Contrato...</option>'+contractsCache.map(c=>`<option value="${c.id}">${esc(c.client_name)}</option>`).join(''); }
async function fillEmployeeSelect(id){ const sel=document.getElementById(id); if(!sel)return; if(!employeesCache.length) employeesCache=(await dbSelect('bnc_employees')).data||[]; sel.innerHTML='<option value="">Funcionário...</option>'+employeesCache.map(e=>`<option value="${e.id}">${esc(e.full_name)}</option>`).join(''); }
async function logout(){ try{ if(supabase && !demoMode) await supabase.auth.signOut(); }catch(e){} currentUser=null;currentProfile=null;currentRole='employee';demoMode=false;showLogin(); }
function toggleResetForm(){ document.getElementById('reset-form')?.classList.toggle('hidden'); }
async function handleResetPassword(event){ event.preventDefault(); const email=val('reset-email').trim().toLowerCase(); if(!email)return alert('Digite seu e-mail.'); const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin}); if(error)return alert('Erro: '+error.message); alert('Link enviado.'); }
function setHeaderDate(){ setText('header-date', new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})); }
function setText(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }
function setValue(id,v){ const el=document.getElementById(id); if(el)el.value=v??''; }
function val(id){ return document.getElementById(id)?.value || ''; }
function esc(t){ return String(t??'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function formatCurrency(v){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0); }
function formatDate(d){ if(!d)return '-'; return new Date(d+'T00:00:00').toLocaleDateString('pt-BR'); }
function statusBadge(st){ const map={active:['Ativo','bg-green-100 text-green-700'],paused:['Pausado','bg-yellow-100 text-yellow-700'],closed:['Encerrado','bg-gray-200 text-gray-700'],inactive:['Inativo','bg-red-100 text-red-700'],pending:['Pendente','bg-yellow-100 text-yellow-700'],in_progress:['Em andamento','bg-blue-100 text-blue-700'],completed:['Concluída','bg-green-100 text-green-700'],canceled:['Cancelada','bg-red-100 text-red-700']}; const [label,cls]=map[st]||[st||'-','bg-gray-100 text-gray-600']; return `<span class="px-2 py-1 rounded-full text-xs font-bold ${cls}">${label}</span>`; }

Object.assign(window,{handleLogin,logout,toggleResetForm,handleResetPassword,switchView,openContractModal,closeContractModal,saveContract,editContract,deleteContract,filterContracts,openEmployeeModal,closeEmployeeModal,saveEmployee,editEmployee,deleteEmployee,openTaskModal,closeTaskModal,saveTask,editTask,deleteTask,completeTask});

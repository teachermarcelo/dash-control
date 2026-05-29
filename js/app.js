// js/app.js
// Grupo BNC RH - App completo e robusto para GitHub
// Mantém autenticação, sessão, dashboard, contratos, funcionários e tarefas em um único arquivo.

const supabase = window.bncSupabase;

let currentUser = null;
let currentProfile = null;
let currentRole = 'employee';

let contractsCache = [];
let employeesCache = [];
let tasksCache = [];

const APP_TIMEOUT_MS = 8000;

function withTimeout(promise, label = 'operação') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' demorou demais. Verifique conexão, Supabase, RLS ou cache do GitHub.')), APP_TIMEOUT_MS))
  ]);
}

// ============================================
// BOOT / SESSÃO
// ============================================

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  setHeaderDate();
  hideBoot();
  showLogin();

  if (!supabase) {
    alert('Erro: Supabase não inicializado. Confira se js/config.js está carregando antes de js/app.js.');
    return;
  }

  try {
    const { data, error } = await withTimeout(supabase.auth.getSession(), 'Recuperar sessão');
    if (error) {
      console.warn('Erro ao recuperar sessão:', error);
      await forceLogout(false);
      return;
    }

    const session = data?.session;
    if (session?.user) {
      currentUser = session.user;
      await withTimeout(enterApplication(), 'Entrar no sistema');
    }
  } catch (error) {
    console.error('Erro no boot:', error);
    showLogin();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      currentRole = 'employee';
      showLogin();
    }

    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      try {
        await withTimeout(enterApplication(), 'Entrar no sistema');
      } catch (error) {
        console.error('Erro pós-login:', error);
        alert('Erro ao abrir o sistema: ' + error.message);
        showLogin();
      }
    }
  });
}

function hideBoot() {
  const boot = document.getElementById('boot-screen');
  if (boot) boot.classList.add('hidden');
}

function showLogin() {
  const login = document.getElementById('login-screen');
  const app = document.getElementById('app-layout');

  if (login) {
    login.classList.remove('hidden');
    login.classList.add('flex');
  }
  if (app) app.classList.add('hidden');
}

function showApp() {
  const login = document.getElementById('login-screen');
  const app = document.getElementById('app-layout');

  if (login) {
    login.classList.add('hidden');
    login.classList.remove('flex');
  }
  if (app) app.classList.remove('hidden');
}

async function enterApplication() {
  await loadCurrentProfile();
  updateUserInfo();
  renderMenu(currentRole);
  showApp();

  const initialView = isAdminLike() ? 'admin-dashboard' : 'employee-dashboard';
  switchView(initialView);
}

async function loadCurrentProfile() {
  if (!currentUser?.id) return;

  const { data, error } = await withTimeout(
    supabase
      .from('bnc_profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle(),
    'Consultar perfil'
  );

  if (error) {
    console.warn('Perfil não encontrado ou sem permissão:', error.message);
    currentProfile = {
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.email?.split('@')[0] || 'Usuário',
      role: 'employee',
      region: ''
    };
  } else {
    currentProfile = data || {
      id: currentUser.id,
      email: currentUser.email,
      full_name: currentUser.email?.split('@')[0] || 'Usuário',
      role: 'employee',
      region: ''
    };
  }

  currentRole = currentProfile?.role || 'employee';
}

async function handleLogin(e) {
  e.preventDefault();

  if (!supabase) {
    alert('Erro: Supabase não inicializado.');
    return;
  }

  const email = document.getElementById('login-email')?.value?.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value || '';
  const btn = document.getElementById('login-button') || e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    alert('Preencha e-mail e senha.');
    return;
  }

  setButtonLoading(btn, true, 'Entrando...');

  try {
    // Limpa qualquer sessão antiga presa no navegador.
    await supabase.auth.signOut();

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      'Login no Supabase'
    );
    if (error) throw error;

    currentUser = data.user;
    await withTimeout(enterApplication(), 'Carregar dashboard');
  } catch (error) {
    console.error('Erro no login:', error);

    let message = error?.message || 'Erro desconhecido.';
    if (message.includes('Invalid login credentials')) {
      message = 'E-mail ou senha incorretos.';
    } else if (message.includes('Email not confirmed')) {
      message = 'E-mail ainda não confirmado no Supabase.';
    } else if (message.includes('Database error querying schema')) {
      message = 'Erro no banco ao consultar o usuário. Verifique se os usuários foram criados corretamente em auth.users, auth.identities e bnc_profiles.';
    }

    alert('Erro ao entrar: ' + message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function logout() {
  await forceLogout(true);
}

async function forceLogout(reload = false) {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    console.warn('Erro ao sair:', e);
  }
  currentUser = null;
  currentProfile = null;
  currentRole = 'employee';
  if (reload) location.reload();
  else showLogin();
}

function toggleResetForm() {
  const form = document.getElementById('reset-form');
  if (form) form.classList.toggle('hidden');
}

async function handleResetPassword(event) {
  if (event) event.preventDefault();

  const email = document.getElementById('reset-email')?.value?.trim().toLowerCase();
  if (!email) return alert('Digite seu e-mail.');

  const btn = event?.target;
  setButtonLoading(btn, true, 'Enviando...');

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;

    alert('Link enviado. Verifique seu e-mail.');
    toggleResetForm();
  } catch (error) {
    alert('Erro: ' + error.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

// ============================================
// MENU / ROTAS
// ============================================

function isAdminLike() {
  return currentRole === 'admin' || currentRole === 'manager';
}

function renderMenu(role) {
  const desktopNav = document.getElementById('desktop-menu');
  const mobileNav = document.getElementById('mobile-menu');
  if (!desktopNav || !mobileNav) return;

  desktopNav.innerHTML = '';
  mobileNav.innerHTML = '';

  const menuItems = isAdminLike() ? [
    { id: 'admin-dashboard', icon: 'fa-home', label: 'Início' },
    { id: 'contracts', icon: 'fa-file-contract', label: 'Contratos' },
    { id: 'employees', icon: 'fa-users', label: 'Funcionários' },
    { id: 'schedules', icon: 'fa-calendar-week', label: 'Escalas' },
    { id: 'financial', icon: 'fa-chart-line', label: 'Financeiro' },
    { id: 'settings', icon: 'fa-cog', label: 'Configurações' }
  ] : [
    { id: 'employee-dashboard', icon: 'fa-clipboard-list', label: 'Tarefas' },
    { id: 'profile', icon: 'fa-user', label: 'Perfil' }
  ];

  menuItems.forEach((item, index) => {
    const desktopItem = document.createElement('button');
    desktopItem.type = 'button';
    desktopItem.dataset.view = item.id;
    desktopItem.className = 'sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer w-full text-left text-white/80';
    desktopItem.onclick = () => switchView(item.id);
    desktopItem.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i><span>${item.label}</span>`;
    desktopNav.appendChild(desktopItem);

    if (index < 4) {
      const mobileItem = document.createElement('button');
      mobileItem.type = 'button';
      mobileItem.dataset.view = item.id;
      mobileItem.className = 'mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4';
      mobileItem.onclick = () => switchView(item.id);
      mobileItem.innerHTML = `<i class="fas ${item.icon} text-xl"></i><span class="text-[10px] font-medium">${item.label}</span>`;
      mobileNav.appendChild(mobileItem);
    }
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));

  const target = document.getElementById(`view-${viewId}`);
  if (!target) {
    console.warn(`View não encontrada: view-${viewId}`);
    return;
  }
  target.classList.add('active');

  document.querySelectorAll('.sidebar-item, .mobile-nav-item').forEach(item => {
    const active = item.dataset.view === viewId;
    item.classList.toggle('active', active);
    item.classList.toggle('text-brand', active);
    if (item.classList.contains('mobile-nav-item')) {
      item.classList.toggle('text-gray-400', !active);
    }
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
  } catch (error) {
    console.error(`Erro ao carregar ${viewId}:`, error);
  }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboardData() {
  const contractsResult = await safeSelect('bnc_contracts', '*', { order: ['created_at', false] });
  const contracts = contractsResult.data || [];
  const activeContracts = contracts.filter(c => c.status === 'active');
  const employeesCount = activeContracts.reduce((sum, c) => sum + (Number(c.employee_count) || 0), 0);
  const revenue = activeContracts.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);

  setText('kpi-contracts', activeContracts.length);
  setText('kpi-employees', employeesCount);
  setText('kpi-revenue', formatCurrency(revenue));

  const today = new Date().toISOString().slice(0, 10);
  const tasksResult = await safeSelect('bnc_tasks', 'status,scheduled_date', { eq: ['scheduled_date', today] });
  const tasks = tasksResult.data || [];
  const completed = tasks.filter(t => t.status === 'completed').length;

  setText('kpi-tasks', `${completed} / ${tasks.length}`);

  const list = document.getElementById('dashboard-contracts-list');
  if (list) {
    if (!activeContracts.length) {
      list.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contrato ativo.</p>';
    } else {
      list.innerHTML = activeContracts.slice(0, 5).map(c => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition mb-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-building"></i></div>
            <div>
              <p class="font-bold text-sm text-gray-800">${escapeHtml(c.client_name)}</p>
              <p class="text-xs text-gray-500">${Number(c.employee_count) || 0} funcionários • ${formatCurrency(c.monthly_value)}</p>
            </div>
          </div>
          <button onclick="editContract('${c.id}')" class="text-gray-400 hover:text-brand"><i class="fas fa-edit"></i></button>
        </div>
      `).join('');
    }
  }

  const summary = document.getElementById('dashboard-tasks-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="space-y-3">
        <div class="flex justify-between"><span>Tarefas hoje</span><strong>${tasks.length}</strong></div>
        <div class="flex justify-between"><span>Concluídas</span><strong>${completed}</strong></div>
        <div class="flex justify-between"><span>Pendentes</span><strong>${Math.max(tasks.length - completed, 0)}</strong></div>
      </div>
    `;
  }
}

// ============================================
// CONTRATOS CRUD
// ============================================

async function loadContracts() {
  const tbody = document.getElementById('contracts-table');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Carregando...</td></tr>';

  const { data, error } = await supabase
    .from('bnc_contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Erro ao carregar contratos: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  contractsCache = data || [];
  filterContracts();
}

function filterContracts() {
  const search = (document.getElementById('contract-search')?.value || '').toLowerCase();
  const status = document.getElementById('contract-status-filter')?.value || '';

  let rows = contractsCache;
  if (status) rows = rows.filter(c => c.status === status);
  if (search) {
    rows = rows.filter(c =>
      String(c.client_name || '').toLowerCase().includes(search) ||
      String(c.cnpj || '').toLowerCase().includes(search) ||
      String(c.contact_name || '').toLowerCase().includes(search)
    );
  }

  renderContractsTable(rows);
}

function renderContractsTable(rows) {
  const tbody = document.getElementById('contracts-table');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Nenhum contrato encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const badge = statusBadge(c.status, {
      active: ['Ativo', 'bg-green-100 text-green-700'],
      paused: ['Pausado', 'bg-yellow-100 text-yellow-700'],
      closed: ['Encerrado', 'bg-gray-200 text-gray-700']
    });

    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="p-4">
          <div class="font-bold text-gray-800">${escapeHtml(c.client_name)}</div>
          <div class="text-xs text-gray-500">${escapeHtml(c.cnpj || '-')}</div>
        </td>
        <td class="p-4">
          <div class="text-gray-700">${escapeHtml(c.contact_name || '-')}</div>
          <div class="text-xs text-gray-500">${escapeHtml(c.phone || '')}</div>
        </td>
        <td class="p-4 text-gray-600">${Number(c.employee_count) || 0}</td>
        <td class="p-4 text-gray-600 font-semibold">${formatCurrency(c.monthly_value)}</td>
        <td class="p-4">${badge}</td>
        <td class="p-4 text-right">
          <button onclick="editContract('${c.id}')" class="text-blue-500 hover:text-blue-700 mr-2 p-2 hover:bg-blue-50 rounded"><i class="fas fa-edit"></i></button>
          <button onclick="deleteContract('${c.id}')" class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function openContractModal(isEdit = false) {
  const modal = document.getElementById('contract-modal');
  const title = document.getElementById('contract-modal-title');
  if (title) title.textContent = isEdit ? 'Editar Contrato' : 'Novo Contrato';
  if (!isEdit) resetContractForm();
  if (modal) modal.classList.add('active');
}

function closeContractModal() {
  const modal = document.getElementById('contract-modal');
  if (modal) modal.classList.remove('active');
  resetContractForm();
}

function resetContractForm() {
  const ids = [
    'contract-id','contract-client-name','contract-cnpj','contract-contact-name','contract-phone',
    'contract-region','contract-start-date','contract-notes'
  ];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setValue('contract-employee-count', 0);
  setValue('contract-monthly-value', 0);
  setValue('contract-status', 'active');
}

async function saveContract(event) {
  event.preventDefault();

  const id = getValue('contract-id');
  const payload = {
    client_name: getValue('contract-client-name'),
    cnpj: getValue('contract-cnpj') || null,
    contact_name: getValue('contract-contact-name') || null,
    phone: getValue('contract-phone') || null,
    region: getValue('contract-region') || null,
    employee_count: Number(getValue('contract-employee-count')) || 0,
    monthly_value: Number(getValue('contract-monthly-value')) || 0,
    status: getValue('contract-status') || 'active',
    start_date: getValue('contract-start-date') || null,
    notes: getValue('contract-notes') || null,
    updated_at: new Date().toISOString()
  };

  if (!payload.client_name) return alert('Informe o nome do cliente.');

  const btn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Salvando...');

  try {
    const response = id
      ? await supabase.from('bnc_contracts').update(payload).eq('id', id)
      : await supabase.from('bnc_contracts').insert([payload]);

    if (response.error) throw response.error;

    closeContractModal();
    await loadContracts();
    alert('Contrato salvo com sucesso.');
  } catch (error) {
    alert('Erro ao salvar contrato: ' + error.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function editContract(id) {
  let contract = contractsCache.find(c => c.id === id);

  if (!contract) {
    const { data, error } = await supabase.from('bnc_contracts').select('*').eq('id', id).maybeSingle();
    if (error || !data) return alert('Contrato não encontrado.');
    contract = data;
  }

  openContractModal(true);

  setValue('contract-id', contract.id);
  setValue('contract-client-name', contract.client_name);
  setValue('contract-cnpj', contract.cnpj || '');
  setValue('contract-contact-name', contract.contact_name || '');
  setValue('contract-phone', contract.phone || '');
  setValue('contract-region', contract.region || '');
  setValue('contract-employee-count', contract.employee_count || 0);
  setValue('contract-monthly-value', contract.monthly_value || 0);
  setValue('contract-status', contract.status || 'active');
  setValue('contract-start-date', contract.start_date || '');
  setValue('contract-notes', contract.notes || '');
}

async function deleteContract(id) {
  if (!confirm('Tem certeza que deseja excluir este contrato?')) return;

  const { error } = await supabase.from('bnc_contracts').delete().eq('id', id);
  if (error) return alert('Erro ao excluir contrato: ' + error.message);

  await loadContracts();
}

// ============================================
// FUNCIONÁRIOS CRUD
// ============================================

async function loadEmployees() {
  const list = document.getElementById('employees-list');
  if (!list) return;

  list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Carregando...</td></tr>';

  const { data, error } = await supabase
    .from('bnc_employees')
    .select('*, bnc_contracts(client_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar funcionários: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  employeesCache = data || [];

  if (!employeesCache.length) {
    list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Nenhum funcionário cadastrado.</td></tr>';
    return;
  }

  list.innerHTML = employeesCache.map(emp => {
    const status = statusBadge(emp.status, {
      active: ['Ativo', 'bg-green-100 text-green-700'],
      inactive: ['Inativo', 'bg-red-100 text-red-700']
    });

    return `
      <tr class="hover:bg-gray-50 transition">
        <td class="p-4">
          <div class="font-bold text-gray-800">${escapeHtml(emp.full_name)}</div>
          <div class="text-xs text-gray-500">CPF: ${escapeHtml(emp.cpf || '-')}</div>
        </td>
        <td class="p-4 text-gray-600">${escapeHtml(emp.job_role || '-')}</td>
        <td class="p-4 text-gray-600">${escapeHtml(emp.bnc_contracts?.client_name || 'Sem vínculo')}</td>
        <td class="p-4">${status}</td>
        <td class="p-4 text-right">
          <button onclick="editEmployee('${emp.id}')" class="text-blue-500 hover:text-blue-700 mr-2 p-2 hover:bg-blue-50 rounded"><i class="fas fa-edit"></i></button>
          <button onclick="deleteEmployee('${emp.id}')" class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openEmployeeModal(isEdit = false) {
  const modal = document.getElementById('employee-modal');
  const title = document.getElementById('employee-modal-title');
  if (title) title.textContent = isEdit ? 'Editar Funcionário' : 'Novo Funcionário';
  if (!isEdit) resetEmployeeForm();
  await loadContractOptions('emp-contract');
  if (modal) modal.classList.add('active');
}

function closeEmployeeModal() {
  const modal = document.getElementById('employee-modal');
  if (modal) modal.classList.remove('active');
  resetEmployeeForm();
}

function resetEmployeeForm() {
  ['emp-id', 'emp-name', 'emp-cpf', 'emp-phone', 'emp-role'].forEach(id => setValue(id, ''));
  setValue('emp-contract', '');
  setValue('emp-status', 'active');
}

async function loadContractOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">Carregando...</option>';

  const { data, error } = await supabase
    .from('bnc_contracts')
    .select('id, client_name')
    .eq('status', 'active')
    .order('client_name', { ascending: true });

  if (error) {
    select.innerHTML = '<option value="">Erro ao carregar contratos</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione...</option>' +
    (data || []).map(c => `<option value="${c.id}">${escapeHtml(c.client_name)}</option>`).join('');
}

async function saveEmployee(event) {
  event.preventDefault();

  const id = getValue('emp-id');
  const payload = {
    full_name: getValue('emp-name'),
    cpf: getValue('emp-cpf') || null,
    phone: getValue('emp-phone') || null,
    job_role: getValue('emp-role') || null,
    contract_id: getValue('emp-contract') || null,
    status: getValue('emp-status') || 'active',
    updated_at: new Date().toISOString()
  };

  if (!payload.full_name) return alert('Informe o nome do funcionário.');

  const btn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Salvando...');

  try {
    const response = id
      ? await supabase.from('bnc_employees').update(payload).eq('id', id)
      : await supabase.from('bnc_employees').insert([payload]);

    if (response.error) throw response.error;

    closeEmployeeModal();
    await loadEmployees();
    alert('Funcionário salvo com sucesso.');
  } catch (error) {
    alert('Erro ao salvar funcionário: ' + error.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function editEmployee(id) {
  const { data, error } = await supabase.from('bnc_employees').select('*').eq('id', id).maybeSingle();
  if (error || !data) return alert('Funcionário não encontrado.');

  await openEmployeeModal(true);

  setValue('emp-id', data.id);
  setValue('emp-name', data.full_name || '');
  setValue('emp-cpf', data.cpf || '');
  setValue('emp-phone', data.phone || '');
  setValue('emp-role', data.job_role || '');
  setValue('emp-contract', data.contract_id || '');
  setValue('emp-status', data.status || 'active');
}

async function deleteEmployee(id) {
  if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;

  const { error } = await supabase.from('bnc_employees').delete().eq('id', id);
  if (error) return alert('Erro ao excluir funcionário: ' + error.message);

  await loadEmployees();
}

// ============================================
// TAREFAS CRUD
// ============================================

async function loadTasks() {
  const list = document.getElementById('tasks-list');
  if (!list) return;

  list.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Carregando...</td></tr>';

  const { data, error } = await supabase
    .from('bnc_tasks')
    .select('*, bnc_employees(full_name), bnc_contracts(client_name)')
    .order('scheduled_date', { ascending: false });

  if (error) {
    console.error(error);
    list.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Erro ao carregar tarefas: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  tasksCache = data || [];

  if (!tasksCache.length) {
    list.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-gray-400">Nenhuma tarefa cadastrada.</td></tr>';
    return;
  }

  list.innerHTML = tasksCache.map(task => `
    <tr class="hover:bg-gray-50 transition">
      <td class="p-4 text-gray-600">${formatDate(task.scheduled_date)}</td>
      <td class="p-4 text-gray-600">${escapeHtml(task.bnc_employees?.full_name || '-')}</td>
      <td class="p-4 text-gray-600">${escapeHtml(task.bnc_contracts?.client_name || '-')}</td>
      <td class="p-4 text-gray-800">${escapeHtml(task.description || '-')}</td>
      <td class="p-4">${taskStatusBadge(task.status)}</td>
      <td class="p-4 text-right">
        <button onclick="editTask('${task.id}')" class="text-blue-500 hover:text-blue-700 mr-2 p-2 hover:bg-blue-50 rounded"><i class="fas fa-edit"></i></button>
        <button onclick="deleteTask('${task.id}')" class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function openTaskModal(isEdit = false) {
  const modal = document.getElementById('task-modal');
  const title = document.getElementById('task-modal-title');
  if (title) title.textContent = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';
  if (!isEdit) resetTaskForm();

  await loadEmployeeOptions('task-employee');
  await loadContractOptions('task-contract');

  if (!getValue('task-date')) setValue('task-date', new Date().toISOString().slice(0, 10));
  if (modal) modal.classList.add('active');
}

function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  if (modal) modal.classList.remove('active');
  resetTaskForm();
}

function resetTaskForm() {
  ['task-id', 'task-date', 'task-employee', 'task-contract', 'task-description'].forEach(id => setValue(id, ''));
  setValue('task-status', 'pending');
}

async function loadEmployeeOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">Carregando...</option>';

  const { data, error } = await supabase
    .from('bnc_employees')
    .select('id, full_name')
    .eq('status', 'active')
    .order('full_name', { ascending: true });

  if (error) {
    select.innerHTML = '<option value="">Erro ao carregar funcionários</option>';
    return;
  }

  select.innerHTML = '<option value="">Selecione...</option>' +
    (data || []).map(e => `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`).join('');
}

async function saveTask(event) {
  event.preventDefault();

  const id = getValue('task-id');
  const payload = {
    scheduled_date: getValue('task-date'),
    employee_id: getValue('task-employee') || null,
    contract_id: getValue('task-contract') || null,
    description: getValue('task-description'),
    status: getValue('task-status') || 'pending',
    updated_at: new Date().toISOString()
  };

  if (!payload.scheduled_date) return alert('Informe a data.');
  if (!payload.description) return alert('Informe a descrição.');

  const btn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Salvando...');

  try {
    const response = id
      ? await supabase.from('bnc_tasks').update(payload).eq('id', id)
      : await supabase.from('bnc_tasks').insert([payload]);

    if (response.error) throw response.error;

    closeTaskModal();
    await loadTasks();
    alert('Tarefa salva com sucesso.');
  } catch (error) {
    alert('Erro ao salvar tarefa: ' + error.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function editTask(id) {
  const { data, error } = await supabase.from('bnc_tasks').select('*').eq('id', id).maybeSingle();
  if (error || !data) return alert('Tarefa não encontrada.');

  await openTaskModal(true);

  setValue('task-id', data.id);
  setValue('task-date', data.scheduled_date || '');
  setValue('task-employee', data.employee_id || '');
  setValue('task-contract', data.contract_id || '');
  setValue('task-description', data.description || '');
  setValue('task-status', data.status || 'pending');
}

async function deleteTask(id) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

  const { error } = await supabase.from('bnc_tasks').delete().eq('id', id);
  if (error) return alert('Erro ao excluir tarefa: ' + error.message);

  await loadTasks();
}

async function loadMyTasks() {
  const box = document.getElementById('my-tasks-list');
  if (!box) return;

  box.innerHTML = 'Carregando...';

  // Tenta achar funcionário com mesmo e-mail do profile. Se a coluna email não existir, cai no fallback.
  let employeeId = null;

  try {
    const { data: employee } = await supabase
      .from('bnc_employees')
      .select('id')
      .eq('email', currentUser.email)
      .maybeSingle();

    employeeId = employee?.id || null;
  } catch (_) {
    employeeId = null;
  }

  let query = supabase
    .from('bnc_tasks')
    .select('*, bnc_contracts(client_name)')
    .order('scheduled_date', { ascending: true });

  if (employeeId) query = query.eq('employee_id', employeeId);

  const { data, error } = await query;

  if (error) {
    box.innerHTML = `<p class="text-red-500">Erro ao carregar tarefas: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const tasks = data || [];

  if (!tasks.length) {
    box.innerHTML = '<p class="text-gray-400 text-center py-6">Nenhuma tarefa encontrada.</p>';
    return;
  }

  box.innerHTML = tasks.map(t => `
    <div class="border rounded-lg p-4 flex items-start justify-between gap-3">
      <div>
        <p class="font-bold text-gray-800">${escapeHtml(t.description)}</p>
        <p class="text-xs text-gray-500 mt-1">${formatDate(t.scheduled_date)} • ${escapeHtml(t.bnc_contracts?.client_name || 'Sem contrato')}</p>
      </div>
      <div>${taskStatusBadge(t.status)}</div>
    </div>
  `).join('');
}

// ============================================
// PERFIL
// ============================================

function updateUserInfo() {
  const fullName = currentProfile?.full_name || currentUser?.email?.split('@')[0] || 'Usuário';
  const roleLabel = currentRole === 'admin' ? 'Administrador Global'
    : currentRole === 'manager' ? 'Gestor Regional'
    : 'Colaborador';

  setText('user-name-display', fullName);
  setText('user-role-display', roleLabel);

  const avatar = document.getElementById('user-avatar');
  if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=ea580c&color=fff`;
}

function renderProfile() {
  const box = document.getElementById('profile-box');
  if (!box) return;

  const roleLabel = currentRole === 'admin' ? 'Administrador Global'
    : currentRole === 'manager' ? 'Gestor Regional'
    : 'Colaborador';

  box.innerHTML = `
    <div class="space-y-3">
      <div><strong>Nome:</strong> ${escapeHtml(currentProfile?.full_name || '-')}</div>
      <div><strong>E-mail:</strong> ${escapeHtml(currentProfile?.email || currentUser?.email || '-')}</div>
      <div><strong>Função:</strong> ${escapeHtml(roleLabel)}</div>
      <div><strong>Região:</strong> ${escapeHtml(currentProfile?.region || '-')}</div>
    </div>
  `;
}

// ============================================
// HELPERS
// ============================================

async function safeSelect(table, columns = '*', options = {}) {
  try {
    let query = supabase.from(table).select(columns);

    if (options.eq) query = query.eq(options.eq[0], options.eq[1]);
    if (options.order) query = query.order(options.order[0], { ascending: options.order[1] });

    const { data, error } = await query;
    if (error) {
      console.warn(`Tabela ${table}:`, error.message);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.warn(`Tabela ${table}:`, error.message);
    return { data: [], error };
  }
}

function setHeaderDate() {
  const headerDate = document.getElementById('header-date');
  if (headerDate) {
    headerDate.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getValue(id) {
  return document.getElementById(id)?.value ?? '';
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function setButtonLoading(btn, loading, text = 'Carregando...') {
  if (!btn) return;

  if (loading) {
    btn.dataset.originalText = btn.innerText;
    btn.innerText = text;
    btn.disabled = true;
  } else {
    btn.innerText = btn.dataset.originalText || btn.innerText || 'Salvar';
    btn.disabled = false;
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function statusBadge(status, map) {
  const fallback = ['Indefinido', 'bg-gray-100 text-gray-700'];
  const [label, classes] = map?.[status] || fallback;
  return `<span class="px-2 py-1 rounded-full text-xs font-bold ${classes}">${label}</span>`;
}

function taskStatusBadge(status) {
  return statusBadge(status, {
    pending: ['Pendente', 'bg-yellow-100 text-yellow-700'],
    in_progress: ['Em andamento', 'bg-blue-100 text-blue-700'],
    completed: ['Concluída', 'bg-green-100 text-green-700'],
    cancelled: ['Cancelada', 'bg-gray-200 text-gray-700']
  });
}

// ============================================
// EXPORTS GLOBAIS PARA O HTML
// ============================================

window.handleLogin = handleLogin;
window.logout = logout;
window.toggleResetForm = toggleResetForm;
window.handleResetPassword = handleResetPassword;
window.switchView = switchView;

window.openContractModal = openContractModal;
window.closeContractModal = closeContractModal;
window.saveContract = saveContract;
window.editContract = editContract;
window.deleteContract = deleteContract;
window.filterContracts = filterContracts;

window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.saveEmployee = saveEmployee;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;

window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.saveTask = saveTask;
window.editTask = editTask;
window.deleteTask = deleteTask;

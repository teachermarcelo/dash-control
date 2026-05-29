// js/app.js - VERSÃO FINAL CORRIGIDA E MODULAR
// Usa o cliente criado no config.js (window.bncSupabase)
const supabase = window.bncSupabase;

if (!supabase) {
    alert('Erro de configuração: Supabase não inicializado.');
}

let currentUser = null;
let currentRole = 'employee';

// ============================================
// 1. AUTENTICAÇÃO
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    
    if (!email || !password) {
        alert('Por favor, preencha o e-mail e a senha.');
        return;
    }
    
    const originalBtnText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        console.log('🔐 Tentando login...');
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;

        currentUser = data.user;
        console.log('✅ Usuário autenticado:', currentUser.id);
        
        // Buscar perfil na tabela bnc_profiles
        const { data: profile, error: profileError } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) {
            console.warn('️ Perfil não encontrado, usando padrão.', profileError);
        }
        
        currentRole = profile?.role || 'employee';
        console.log(' Role definida:', currentRole);
        
        // Atualizar Interface
        updateUserInfo(profile, email);
        
        // Trocar Telas
        const loginScreen = document.getElementById('login-screen');
        const appLayout = document.getElementById('app-layout');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appLayout) appLayout.classList.remove('hidden');
        
        renderMenu(currentRole);
        
        // Redirecionar para dashboard correto
        const initialView = (currentRole === 'admin' || currentRole === 'manager') ? 'admin-dashboard' : 'employee-dashboard';
        switchView(initialView);
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        let msg = 'Erro ao entrar.';
        if (error.message.includes('Invalid login credentials')) msg = 'E-mail ou senha incorretos.';
        else if (error.message.includes('Email not confirmed')) msg = 'E-mail não confirmado.';
        else msg = 'Erro: ' + error.message;
        alert(msg);
    } finally {
        if (btn) {
            btn.innerText = originalBtnText;
            btn.disabled = false;
        }
    }
}

function updateUserInfo(profile, emailFallback) {
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    const avatar = document.getElementById('user-avatar');
    
    const fullName = profile?.full_name || emailFallback.split('@')[0];
    const roleLabel = currentRole === 'admin' ? 'Administrador Global' : 
                      currentRole === 'manager' ? 'Gestor Regional' : 'Colaborador';

    if (nameDisplay) nameDisplay.textContent = fullName;
    if (roleDisplay) roleDisplay.textContent = roleLabel;
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=ea580c&color=fff`;
}

// ============================================
// 2. NAVEGAÇÃO E ROTEAMENTO
// ============================================

function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    
    if (!desktopNav || !mobileNav) return;
    
    desktopNav.innerHTML = ''; 
    mobileNav.innerHTML = '';

    let menuItems = [];
    
    if (role === 'admin' || role === 'manager') {
        menuItems = [
            { id: 'admin-dashboard', icon: 'fa-home', label: 'Início' },
            { id: 'contracts', icon: 'fa-file-contract', label: 'Contratos' },
            { id: 'employees', icon: 'fa-users', label: 'Funcionários' },
            { id: 'schedules', icon: 'fa-calendar-week', label: 'Escalas' },
            { id: 'financial', icon: 'fa-chart-line', label: 'Financeiro' },
            { id: 'settings', icon: 'fa-cog', label: 'Configurações' }
        ];
    } else {
        menuItems = [
            { id: 'employee-dashboard', icon: 'fa-clipboard-list', label: 'Tarefas' },
            { id: 'profile', icon: 'fa-user', label: 'Meu Perfil' }
        ];
    }

    menuItems.forEach((item, index) => {
        // Item Desktop
        const dLink = document.createElement('button');
        dLink.type = 'button';
        dLink.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer w-full text-left ${index === 0 ? 'active' : ''}`;
        dLink.dataset.view = item.id;
        dLink.onclick = () => switchView(item.id);
        dLink.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(dLink);

        // Item Mobile (apenas os 4 primeiros)
        if (index < 4) {
            const mBtn = document.createElement('button');
            mBtn.type = 'button';
            mBtn.className = `mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4 ${index === 0 ? 'active text-brand' : ''}`;
            mBtn.dataset.view = item.id;
            mBtn.onclick = () => switchView(item.id);
            mBtn.innerHTML = `<i class="fas ${item.icon} text-xl"></i><span class="text-[10px] font-medium">${item.label}</span>`;
            mobileNav.appendChild(mBtn);
        }
    });
}

function switchView(viewId) {
    // Esconder todas as views
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // Mostrar a view alvo
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // Atualizar estado ativo nos menus
    document.querySelectorAll('.sidebar-item, .mobile-nav-item').forEach(item => {
        const isActive = item.dataset.view === viewId;
        item.classList.toggle('active', isActive);
        item.classList.toggle('text-brand', isActive);
        item.classList.toggle('text-gray-400', !isActive);
    });

    // Carregar dados específicos da aba (Router)
    loadViewData(viewId);
}

async function loadViewData(viewId) {
    console.log(`📂 Carregando dados para: ${viewId}`);
    switch (viewId) {
        case 'admin-dashboard':
            await loadDashboardData();
            break;
        case 'employees':
            await loadEmployees();
            break;
        // Adicione novos cases aqui para futuras abas
    }
}

// ============================================
// 3. MÓDULO: DASHBOARD
// ============================================

async function loadDashboardData() {
    try {
        const { data: contracts } = await supabase
            .from('bnc_contracts')
            .select('*')
            .eq('status', 'active');
            
        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (Number(c.employee_count) || 0), 0) || 0;
        
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks } = await supabase
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);
            
        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const totalTasks = tasks?.length || 0;
        
        // Atualizar KPIs com segurança
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        setVal('kpi-contracts', totalContracts);
        setVal('kpi-employees', totalEmployees);
        setVal('kpi-tasks', `${completedTasks} / ${totalTasks}`);

        // Renderizar Lista de Contratos
        const listContainer = document.getElementById('contracts-list');
        if (listContainer && contracts) {
            if (contracts.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contrato ativo.</p>';
            } else {
                listContainer.innerHTML = contracts.map(c => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition mb-2">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center">
                                <i class="fas fa-building"></i>
                            </div>
                            <div>
                                <p class="font-bold text-sm text-gray-800">${escapeHtml(c.client_name)}</p>
                                <p class="text-xs text-gray-500">${c.employee_count} funcionários</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard:', error);
    }
}

// ============================================
// 4. MÓDULO: FUNCIONÁRIOS (CRUD)
// ============================================

async function loadEmployees() {
    const list = document.getElementById('employees-list');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Carregando...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('bnc_employees')
            .select(`*, bnc_contracts(client_name)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">Nenhum funcionário cadastrado.</td></tr>';
            return;
        }

        list.innerHTML = data.map(emp => {
            const statusClass = emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            const statusLabel = emp.status === 'active' ? 'Ativo' : 'Inativo';
            
            return `
                <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                    <td class="p-4">
                        <div class="font-bold text-gray-800">${escapeHtml(emp.full_name)}</div>
                        <div class="text-xs text-gray-500">CPF: ${emp.cpf || '-'}</div>
                    </td>
                    <td class="p-4 text-gray-600">${escapeHtml(emp.job_role) || '-'}</td>
                    <td class="p-4 text-gray-600">${emp.contract_id ? (emp.bnc_contracts?.client_name || 'Vínculo removido') : 'Sem vínculo'}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusLabel}</span></td>
                    <td class="p-4 text-right">
                        <button onclick="editEmployee('${emp.id}')" class="text-blue-500 hover:text-blue-700 mr-2 p-2 hover:bg-blue-50 rounded"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteEmployee('${emp.id}')" class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro Funcionários:', error);
        list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar dados.</td></tr>';
    }
}

function openEmployeeModal(isEdit = false) {
    const modal = document.getElementById('employee-modal');
    const title = document.getElementById('modal-title');
    title.innerText = isEdit ? 'Editar Funcionário' : 'Novo Funcionário';
    modal.classList.remove('hidden');
    loadContractOptions();
}

function closeEmployeeModal() {
    document.getElementById('employee-modal').classList.add('hidden');
    document.querySelector('#employee-modal form').reset();
    document.getElementById('emp-id').value = '';
}

async function loadContractOptions() {
    const select = document.getElementById('emp-contract');
    select.innerHTML = '<option value="">Carregando...</option>';
    const { data } = await supabase.from('bnc_contracts').select('id, client_name').eq('status', 'active');
    select.innerHTML = '<option value="">Selecione um contrato...</option>' + 
        (data || []).map(c => `<option value="${c.id}">${escapeHtml(c.client_name)}</option>`).join('');
}

async function saveEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('emp-id').value;
    const payload = {
        full_name: document.getElementById('emp-name').value,
        cpf: document.getElementById('emp-cpf').value,
        phone: document.getElementById('emp-phone').value,
        job_role: document.getElementById('emp-role').value,
        contract_id: document.getElementById('emp-contract').value || null,
        status: document.getElementById('emp-status').value
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...';
    btn.disabled = true;

    try {
        if (id) {
            const { error } = await supabase.from('bnc_employees').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('bnc_employees').insert([payload]);
            if (error) throw error;
        }
        alert('Sucesso!');
        closeEmployeeModal();
        loadEmployees();
    } catch (error) {
        alert('Erro: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function editEmployee(id) {
    const { data } = await supabase.from('bnc_employees').select('*').eq('id', id).single();
    if (!data) return;
    openEmployeeModal(true);
    document.getElementById('emp-id').value = data.id;
    document.getElementById('emp-name').value = data.full_name;
    document.getElementById('emp-cpf').value = data.cpf || '';
    document.getElementById('emp-phone').value = data.phone || '';
    document.getElementById('emp-role').value = data.job_role || '';
    document.getElementById('emp-contract').value = data.contract_id || '';
    document.getElementById('emp-status').value = data.status || 'active';
}

async function deleteEmployee(id) {
    if (!confirm('Tem certeza?')) return;
    const { error } = await supabase.from('bnc_employees').delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else loadEmployees();
}

// ============================================
// 5. UTILITÁRIOS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function logout() {
    supabase.auth.signOut().then(() => location.reload());
}

function toggleResetForm() {
    const form = document.getElementById('reset-form');
    if (form) form.classList.toggle('hidden');
}

async function handleResetPassword() {
    const email = document.getElementById('reset-email')?.value?.trim().toLowerCase();
    if (!email) return alert('Digite seu e-mail.');
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        alert('Link enviado! Verifique seu e-mail.');
        toggleResetForm();
    } catch (error) {
        alert('Erro: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const headerDate = document.getElementById('header-date');
    if (headerDate) {
        headerDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
});

// Exportar funções globais
window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.handleResetPassword = handleResetPassword;
window.switchView = switchView;
window.logout = logout;
window.openEmployeeModal = openEmployeeModal;
window.closeEmployeeModal = closeEmployeeModal;
window.saveEmployee = saveEmployee;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;

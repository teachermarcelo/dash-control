// js/app.js - Lógica Principal + Gestão de Funcionários
// Usa o cliente criado no config.js (window.bncSupabase)
const supabase = window.bncSupabase;

let currentUser = null;
let currentRole = 'employee';

// ============================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!emailInput || !passwordInput) return;
    
    const email = emailInput.value.trim();
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
        
        const { data: profile, error: profileError } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) {
            console.warn('⚠️ Perfil não encontrado, usando padrão.', profileError);
        }
        
        currentRole = profile?.role || 'employee';
        console.log('👤 Role definida:', currentRole);
        
        // Atualizar UI
        const nameDisplay = document.getElementById('user-name-display');
        const roleDisplay = document.getElementById('user-role-display');
        const avatar = document.getElementById('user-avatar');
        
        if (nameDisplay) nameDisplay.textContent = profile?.full_name || email.split('@')[0];
        if (roleDisplay) {
            roleDisplay.textContent = currentRole === 'admin' ? 'Administrador Global' : 
                                     currentRole === 'manager' ? 'Gestor Regional' : 'Colaborador';
        }
        if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=ea580c&color=fff`;
        
        // Trocar Telas
        const loginScreen = document.getElementById('login-screen');
        const appLayout = document.getElementById('app-layout');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appLayout) appLayout.classList.remove('hidden');
        
        renderMenu(currentRole);
        loadDashboardData();
        
    } catch (error) {
        console.error(' Erro no login:', error);
        alert('Erro ao entrar: ' + (error.message || 'Verifique suas credenciais.'));
    } finally {
        if (btn) {
            btn.innerText = originalBtnText;
            btn.disabled = false;
        }
    }
}

async function loadDashboardData() {
    try {
        const { data: contracts } = await supabase
            .from('bnc_contracts')
            .select('*')
            .eq('status', 'active');
            
        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (c.employee_count || 0), 0) || 0;
        
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks } = await supabase
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);
            
        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const totalTasks = tasks?.length || 0;
        
        const kpiContracts = document.getElementById('kpi-contracts');
        const kpiEmployees = document.getElementById('kpi-employees');
        const kpiTasks = document.getElementById('kpi-tasks');
        
        if (kpiContracts) kpiContracts.textContent = totalContracts;
        if (kpiEmployees) kpiEmployees.textContent = totalEmployees;
        if (kpiTasks) kpiTasks.textContent = `${completedTasks} / ${totalTasks}`;

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
                                <p class="font-bold text-sm text-gray-800">${c.client_name}</p>
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
        const dLink = document.createElement('a');
        dLink.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${index === 0 ? 'active' : ''}`;
        dLink.onclick = () => switchView(item.id);
        dLink.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(dLink);

        if (index < 4) {
            const mBtn = document.createElement('button');
            mBtn.className = `mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4 ${index === 0 ? 'active text-brand' : ''}`;
            mBtn.onclick = () => switchView(item.id);
            mBtn.innerHTML = `<i class="fas ${item.icon} text-xl"></i><span class="text-[10px] font-medium">${item.label}</span>`;
            mobileNav.appendChild(mBtn);
        }
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active', 'text-brand');
        item.classList.add('text-gray-400');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active', 'text-brand');
            item.classList.remove('text-gray-400');
        }
    });

    // Carregar dados específicos da aba
    if (viewId === 'employees') {
        loadEmployees();
    }
}

function logout() {
    supabase.auth.signOut().then(() => {
        location.reload();
    });
}

function toggleResetForm() {
    const form = document.getElementById('reset-form');
    if (form) form.classList.toggle('hidden');
}

async function handleResetPassword() {
    const emailInput = document.getElementById('reset-email');
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) return alert('Digite um e-mail válido.');

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        
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

// ============================================
// GESTÃO DE FUNCIONÁRIOS (NOVA FUNCIONALIDADE)
// ============================================

async function loadEmployees() {
    const list = document.getElementById('employees-list');
    if (!list) return;

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
                <tr class="hover:bg-gray-50 transition">
                    <td class="p-4">
                        <div class="font-bold text-gray-800">${emp.full_name}</div>
                        <div class="text-xs text-gray-500">CPF: ${emp.cpf || '-'}</div>
                    </td>
                    <td class="p-4 text-gray-600">${emp.job_role || '-'}</td>
                    <td class="p-4 text-gray-600">${emp.contract_id ? (emp.bnc_contracts?.client_name || 'Contrato removido') : 'Sem vínculo'}</td>
                    <td class="p-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${statusLabel}</span></td>
                    <td class="p-4 text-right">
                        <button onclick="editEmployee('${emp.id}')" class="text-blue-500 hover:text-blue-700 mr-2"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteEmployee('${emp.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar funcionários:', error);
        list.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Erro ao carregar dados. Verifique se a tabela bnc_employees existe.</td></tr>';
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
        (data || []).map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
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
    btn.disabled = true;
    btn.innerText = 'Salvando...';

    try {
        if (id) {
            const { error } = await supabase.from('bnc_employees').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('bnc_employees').insert([payload]);
            if (error) throw error;
        }
        
        alert('Funcionário salvo com sucesso!');
        closeEmployeeModal();
        loadEmployees();
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Salvar';
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
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;
    
    const { error } = await supabase.from('bnc_employees').delete().eq('id', id);
    if (error) {
        alert('Erro ao excluir: ' + error.message);
    } else {
        loadEmployees();
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const headerDate = document.getElementById('header-date');
    if (headerDate) {
        headerDate.textContent = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
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

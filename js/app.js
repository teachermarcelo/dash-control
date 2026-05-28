// js/app.js - VERSÃO FINAL CORRIGIDA E FUNCIONAL
// Usa o cliente criado no config.js (window.bncSupabase)
const supabase = window.bncSupabase;

let currentUser = null;
let currentRole = 'employee';

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
            console.warn('⚠️ Perfil não encontrado.', profileError);
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
        console.error('❌ Erro no login:', error);
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

document.addEventListener('DOMContentLoaded', () => {
    const headerDate = document.getElementById('header-date');
    if (headerDate) {
        headerDate.textContent = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
});

window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.handleResetPassword = handleResetPassword;
window.switchView = switchView;
window.logout = logout;

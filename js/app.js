// js/app.js
// Lógica Principal do Sistema Grupo BNC RH

// Recupera o cliente do Supabase criado no config.js
const supabase = window.bncSupabase;

let currentUser = null;
let currentRole = 'employee';

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const btn = e.target.querySelector('button[type="submit"]');
    
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    
    if (!email || !password) {
        alert('Por favor, preencha o e-mail e a senha.');
        return;
    }
    
    // Feedback visual de carregamento
    const originalBtnText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        console.log('🔐 Tentando autenticar usuário...');
        
        // 1. Login no Auth do Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;

        currentUser = data.user;
        console.log('✅ Usuário autenticado com ID:', currentUser.id);
        
        // 2. Buscar perfil e permissões na tabela bnc_profiles
        const { data: profile, error: profileError } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) {
            console.warn('⚠️ Perfil não encontrado no banco, usando padrão.', profileError);
        }
        
        currentRole = profile?.role || 'employee';
        console.log('👤 Role definida como:', currentRole);
        
        // 3. Atualizar Interface do Usuário
        updateUserInfo(profile, email);
        
        // 4. Trocar Telas (Esconder Login, Mostrar App)
        const loginScreen = document.getElementById('login-screen');
        const appLayout = document.getElementById('app-layout');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appLayout) appLayout.classList.remove('hidden');
        
        // 5. Carregar Menu e Dados Específicos da Role
        renderMenu(currentRole);
        loadDashboardData();
        
    } catch (error) {
        console.error('❌ Erro crítico no login:', error);
        alert('Erro ao entrar: ' + (error.message || 'Verifique suas credenciais ou conexão.'));
    } finally {
        // Restaurar botão
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
    if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${fullName}&background=ea580c&color=fff`;
}

// ============================================
// CARREGAMENTO DE DADOS (DASHBOARD)
// ============================================

async function loadDashboardData() {
    try {
        // Buscar Contratos Ativos
        const { data: contracts, error: cError } = await supabase
            .from('bnc_contracts')
            .select('*')
            .eq('status', 'active');
            
        if (cError) throw cError;
        
        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (c.employee_count || 0), 0) || 0;
        
        // Buscar Tarefas de Hoje
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks, error: tError } = await supabase
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);
            
        if (tError) throw tError;
        
        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const totalTasks = tasks?.length || 0;
        
        // Atualizar KPIs na Tela
        const kpiContracts = document.getElementById('kpi-contracts');
        const kpiEmployees = document.getElementById('kpi-employees');
        const kpiTasks = document.getElementById('kpi-tasks');
        
        if (kpiContracts) kpiContracts.textContent = totalContracts;
        if (kpiEmployees) kpiEmployees.textContent = totalEmployees;
        if (kpiTasks) kpiTasks.textContent = `${completedTasks} / ${totalTasks}`;

        // Renderizar Lista de Contratos
        const listContainer = document.getElementById('contracts-list');
        if (listContainer && contracts) {
            if (contracts.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contrato ativo encontrado.</p>';
            } else {
                listContainer.innerHTML = contracts.map(c => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition mb-2">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center">
                                <i class="fas fa-building"></i>
                            </div>
                            <div>
                                <p class="font-bold text-sm text-gray-800">${c.client_name}</p>
                                <p class="text-xs text-gray-500">${c.employee_count} funcionários ativos</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-gray-400"></i>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do dashboard:', error);
    }
}

// ============================================
// NAVEGAÇÃO E MENU
// ============================================

function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    
    if (!desktopNav || !mobileNav) return;
    
    desktopNav.innerHTML = ''; 
    mobileNav.innerHTML = '';

    // Definição dos itens do menu baseado na Role
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
        // Menu para Funcionários Comuns
        menuItems = [
            { id: 'employee-dashboard', icon: 'fa-clipboard-list', label: 'Tarefas' },
            { id: 'profile', icon: 'fa-user', label: 'Meu Perfil' }
        ];
    }

    // Criar elementos do menu
    menuItems.forEach((item, index) => {
        // Item Desktop
        const dLink = document.createElement('a');
        dLink.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${index === 0 ? 'active' : ''}`;
        dLink.onclick = () => switchView(item.id);
        dLink.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(dLink);

        // Item Mobile (apenas os 4 primeiros para não lotar a tela)
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
    // 1. Esconder todas as views
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    
    // 2. Mostrar a view alvo
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
    }
    
    // 3. Atualizar estado ativo na Sidebar Desktop
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        // Verifica se o onclick chama essa view
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active');
        }
    });
    
    // 4. Atualizar estado ativo na Nav Mobile
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active', 'text-brand');
        item.classList.add('text-gray-400');
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(viewId)) {
            item.classList.add('active', 'text-brand');
            item.classList.remove('text-gray-400');
        }
    });
}

// ============================================
// UTILITÁRIOS
// ============================================

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
    
    if (!email) return alert('Digite um e-mail válido para recuperação.');

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        
        if (error) throw error;
        
        alert('Link de redefinição enviado! Verifique sua caixa de entrada.');
        toggleResetForm();
    } catch (error) {
        alert('Erro ao enviar link: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // Atualizar data no header
    const headerDate = document.getElementById('header-date');
    if (headerDate) {
        headerDate.textContent = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
});

// Exportar funções para o escopo global (necessário para onclick no HTML)
window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.handleResetPassword = handleResetPassword;
window.switchView = switchView;
window.logout = logout;

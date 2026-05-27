// js/app.js
let currentUser = null;
let currentRole = 'employee';

// Verifica se o Supabase está carregado
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase não inicializado! Verifique se config.js está carregado antes de app.js');
}

// Toggle formulário de reset
function toggleResetForm() {
    const form = document.getElementById('reset-form');
    if (form) form.classList.toggle('hidden');
}

// Função de Resetar Senha
async function handleResetPassword() {
    const email = document.getElementById('reset-email')?.value.trim();
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
        alert('Link de redefinição enviado! Verifique sua caixa de entrada.');
        toggleResetForm();
    } catch (error) {
        alert('Erro: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = e.target.querySelector('button');
    
    if (!email || !password) return alert('Preencha e-mail e senha.');
    
    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        console.log('🔐 Tentando login com:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email, 
            password 
        });
        
        if (error) {
            console.error('❌ Erro no login:', error);
            throw error;
        }

        currentUser = data.user;
        console.log('✅ Login sucesso, user ID:', currentUser.id);
        
        // Buscar perfil na tabela bnc_profiles
        const { data: profile, error: profileError } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();
            
        if (profileError) {
            console.warn('⚠️ Perfil não encontrado, usando role padrão:', profileError);
        }
        
        currentRole = profile?.role || 'employee';
        
        // Atualizar UI
        const nameDisplay = document.getElementById('user-name-display');
        const roleDisplay = document.getElementById('user-role-display');
        const avatar = document.getElementById('user-avatar');
        
        if (nameDisplay) nameDisplay.textContent = profile?.full_name || email.split('@')[0];
        if (roleDisplay) {
            roleDisplay.textContent = currentRole === 'admin' ? 'Administrador' : 
                                     currentRole === 'manager' ? 'Gestor Regional' : 'Colaborador';
        }
        if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=ea580c&color=fff`;
        
        // Trocar telas
        const loginScreen = document.getElementById('login-screen');
        const appLayout = document.getElementById('app-layout');
        
        if (loginScreen) loginScreen.classList.add('hidden');
        if (appLayout) appLayout.classList.remove('hidden');
        
        renderMenu(currentRole);
        loadDashboardData();
        
    } catch (error) {
        console.error('❌ Erro no handleLogin:', error);
        alert('Erro ao entrar: ' + (error.message || 'Verifique suas credenciais.'));
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// Carregar Dashboard
async function loadDashboardData() {
    try {
        // Buscar contratos ativos
        const { data: contracts, error: contractsError } = await supabase
            .from('bnc_contracts')
            .select('*')
            .eq('status', 'active');
            
        if (contractsError) throw contractsError;
        
        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (c.employee_count || 0), 0) || 0;
        
        // Buscar tarefas do dia
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks, error: tasksError } = await supabase
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);
            
        if (tasksError) throw tasksError;
        
        const completed = tasks?.filter(t => t.status === 'completed').length || 0;
        
        // Atualizar KPIs
        const kpiContracts = document.getElementById('kpi-contracts');
        const kpiEmployees = document.getElementById('kpi-employees');
        const kpiTasks = document.getElementById('kpi-tasks');
        
        if (kpiContracts) kpiContracts.textContent = totalContracts;
        if (kpiEmployees) kpiEmployees.textContent = totalEmployees;
        if (kpiTasks) kpiTasks.textContent = `${completed} / ${tasks?.length || 0}`;

        // Renderizar lista de contratos
        const list = document.getElementById('contracts-list');
        if (list && contracts) {
            if (contracts.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 py-4">Nenhum contrato ativo</p>';
            } else {
                list.innerHTML = contracts.map(c => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-building"></i></div>
                            <div><p class="font-bold text-sm">${c.client_name}</p><p class="text-xs text-gray-500">${c.employee_count} funcionários</p></div>
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

// Menu e Navegação
function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    
    if (!desktopNav || !mobileNav) return;
    
    desktopNav.innerHTML = ''; 
    mobileNav.innerHTML = '';

    let items = (role === 'admin' || role === 'manager') ? [
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

    items.forEach((item, i) => {
        // Desktop
        const d = document.createElement('a');
        d.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${i===0?'active':''}`;
        d.onclick = () => switchView(item.id);
        d.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(d);

        // Mobile (apenas primeiros 4 itens)
        if (i < 4) {
            const m = document.createElement('button');
            m.className = `mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4 ${i===0?'active text-brand':''}`;
            m.onclick = () => switchView(item.id);
            m.innerHTML = `<i class="fas ${item.icon} text-xl"></i><span class="text-[10px] font-medium">${item.label}</span>`;
            mobileNav.appendChild(m);
        }
    });
}

function switchView(id) {
    // Esconder todas as views
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
    
    // Mostrar a view selecionada
    const target = document.getElementById(`view-${id}`);
    if (target) target.classList.add('active');
    
    // Atualizar sidebar desktop
    document.querySelectorAll('.sidebar-item').forEach(e => {
        e.classList.remove('active');
        if (e.getAttribute('onclick')?.includes(id)) e.classList.add('active');
    });
    
    // Atualizar nav mobile
    document.querySelectorAll('.mobile-nav-item').forEach(e => {
        e.classList.remove('active', 'text-brand'); 
        e.classList.add('text-gray-400');
        if (e.getAttribute('onclick')?.includes(id)) { 
            e.classList.add('active', 'text-brand'); 
            e.classList.remove('text-gray-400'); 
        }
    });
}

function logout() { 
    supabase.auth.signOut(); 
    location.reload(); 
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
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

// js/app.js

// Variáveis globais
let currentUser = null;
let currentRole = 'employee';

// ============================================
// AUTENTICAÇÃO
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    
    // Feedback visual
    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) throw error;

        currentUser = data.user;
        
        // Buscar perfil e role do usuário na tabela bnc_profiles
        const { data: profile } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();

        currentRole = profile?.role || 'employee';
        
        // Atualizar UI com dados reais
        document.getElementById('user-name-display').textContent = profile?.full_name || email.split('@')[0];
        document.getElementById('user-role-display').textContent = currentRole === 'admin' ? 'Administrador' : currentRole === 'manager' ? 'Gestor Regional' : 'Colaborador';
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=ea580c&color=fff`;
        
        // Trocar telas
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');
        
        renderMenu(currentRole);
        loadDashboardData(currentRole);

    } catch (error) {
        alert('Erro ao entrar: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ============================================
// CARREGAMENTO DE DADOS (Dashboard)
// ============================================
async function loadDashboardData(role) {
    const kpiContracts = document.getElementById('kpi-contracts');
    const kpiEmployees = document.getElementById('kpi-employees');
    const kpiTasks = document.getElementById('kpi-tasks');
    const contractsList = document.getElementById('contracts-list');

    if (!kpiContracts) return; 

    try {
        // Buscar contratos ativos
        const { data: contracts } = await supabase.from('bnc_contracts').select('*').eq('status', 'active');
        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (c.employee_count || 0), 0) || 0;
        
        // Buscar tarefas do dia
        const today = new Date().toISOString().split('T')[0];
        const { data: tasks } = await supabase
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);
        
        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const totalTasks = tasks?.length || 0;

        // Atualizar KPIs na tela
        if(kpiContracts) kpiContracts.textContent = totalContracts;
        if(kpiEmployees) kpiEmployees.textContent = totalEmployees;
        if(kpiTasks) kpiTasks.textContent = `${completedTasks} / ${totalTasks}`;

        // Renderizar lista de contratos (se existir o elemento)
        if(contractsList && contracts) {
            contractsList.innerHTML = contracts.map(c => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-building"></i></div>
                        <div><p class="font-bold text-sm">${c.client_name}</p><p class="text-xs text-gray-500">${c.employee_count} funcionários</p></div>
                    </div>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

// ============================================
// MENU E NAVEGAÇÃO
// ============================================
function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    desktopNav.innerHTML = '';
    mobileNav.innerHTML = '';

    let items = [];
    if (role === 'admin' || role === 'manager') {
        items = [
            { id: 'admin-dashboard', icon: 'fa-home', label: 'Início' },
            { id: 'contracts', icon: 'fa-file-contract', label: 'Contratos' },
            { id: 'employees', icon: 'fa-users', label: 'Funcionários' },
            { id: 'schedules', icon: 'fa-calendar-week', label: 'Escalas' },
            { id: 'financial', icon: 'fa-chart-line', label: 'Financeiro' },
            { id: 'settings', icon: 'fa-cog', label: 'Configurações' }
        ];
    } else {
        items = [
            { id: 'employee-dashboard', icon: 'fa-clipboard-list', label: 'Tarefas' },
            { id: 'profile', icon: 'fa-user', label: 'Perfil' }
        ];
    }

    items.forEach((item, index) => {
        // Desktop Item
        const dLink = document.createElement('a');
        dLink.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${index === 0 ? 'active' : ''}`;
        dLink.onclick = () => switchView(item.id);
        dLink.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(dLink);

        // Mobile Item
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
    const target = document.getElementById(`view-${viewId}`);
    if(target) target.classList.add('active');

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if(item.getAttribute('onclick')?.includes(viewId)) item.classList.add('active');
    });
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active', 'text-brand');
        item.classList.add('text-gray-400');
        if(item.getAttribute('onclick')?.includes(viewId)) {
            item.classList.add('active', 'text-brand');
            item.classList.remove('text-gray-400');
        }
    });
}

function logout() { 
    supabase.auth.signOut(); 
    location.reload(); 
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('header-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});

// Tornar funções globais para o HTML acessar
window.handleLogin = handleLogin;
window.switchView = switchView;
window.logout = logout;

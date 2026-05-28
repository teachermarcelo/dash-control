// js/app.js - VERSÃO FINAL FUNCIONAL
const supabase = window.supabase.createClient(
  'https://rvgcniaowzmsudzliozf.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2Z2NuaWFvd3ptc3Vkemxpb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxNzQsImV4cCI6MjA5MTQwMDE3NH0.uwwKFLuK-XyPoXPrB6_CseRTiD9d-iyMQSPWrFw-l-I'
);

let currentUser = null;
let currentRole = 'employee';

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    
    if (!email || !password) return alert('Preencha e-mail e senha.');
    
    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        currentUser = data.user;
        
        const { data: profile } = await supabase
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .single();
            
        currentRole = profile?.role || 'employee';
        
        // Atualizar UI
        document.getElementById('user-name-display').textContent = profile?.full_name || email.split('@')[0];
        document.getElementById('user-role-display').textContent = currentRole === 'admin' ? 'Administrador Global' : currentRole === 'manager' ? 'Gestor Regional' : 'Colaborador';
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=ea580c&color=fff`;
        
        // Trocar telas
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');
        
        renderMenu(currentRole);
        loadDashboardData();
        
    } catch (error) {
        alert('Erro ao entrar: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function loadDashboardData() {
    const { data: contracts } = await supabase.from('bnc_contracts').select('*').eq('status', 'active');
    const totalContracts = contracts?.length || 0;
    const totalEmployees = contracts?.reduce((sum, c) => sum + (c.employee_count || 0), 0) || 0;
    
    const today = new Date().toISOString().split('T')[0];
    const { data: tasks } = await supabase.from('bnc_tasks').select('status').eq('scheduled_date', today);
    const completed = tasks?.filter(t => t.status === 'completed').length || 0;
    
    if(document.getElementById('kpi-contracts')) document.getElementById('kpi-contracts').textContent = totalContracts;
    if(document.getElementById('kpi-employees')) document.getElementById('kpi-employees').textContent = totalEmployees;
    if(document.getElementById('kpi-tasks')) document.getElementById('kpi-tasks').textContent = `${completed} / ${tasks?.length || 0}`;

    const list = document.getElementById('contracts-list');
    if (list && contracts) {
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

function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    if (!desktopNav || !mobileNav) return;
    
    desktopNav.innerHTML = ''; mobileNav.innerHTML = '';

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
        const d = document.createElement('a');
        d.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${i===0?'active':''}`;
        d.onclick = () => switchView(item.id);
        d.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(d);

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
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
    const target = document.getElementById(`view-${id}`);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.sidebar-item').forEach(e => {
        e.classList.remove('active');
        if (e.getAttribute('onclick')?.includes(id)) e.classList.add('active');
    });
    
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

function toggleResetForm() {
    const form = document.getElementById('reset-form');
    if (form) form.classList.toggle('hidden');
}

window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.switchView = switchView;
window.logout = logout;

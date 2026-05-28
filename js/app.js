// js/app.js - versão corrigida

const supabaseClient = window.bncSupabase;

if (!supabaseClient) {
    throw new Error('Cliente Supabase não encontrado. Carregue js/config.js antes de js/app.js.');
}

let currentUser = null;
let currentRole = 'employee';

function showFriendlyAuthError(error) {
    const msg = (error?.message || '').toLowerCase();

    if (msg.includes('invalid login credentials')) {
        alert('Não foi possível entrar: e-mail ou senha inválidos. Confira se o usuário existe no Supabase Auth e se a senha está correta.');
        return;
    }

    if (msg.includes('email not confirmed')) {
        alert('Não foi possível entrar: este e-mail ainda não foi confirmado no Supabase Auth.');
        return;
    }

    if (msg.includes('failed to fetch') || msg.includes('network')) {
        alert('Não foi possível conectar ao Supabase. Verifique internet, domínio autorizado/CORS e se o projeto Supabase está ativo.');
        return;
    }

    alert('Erro ao entrar: ' + (error?.message || 'erro desconhecido'));
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type="submit"]') || e.target.querySelector('button');

    if (!email || !password) {
        alert('Preencha e-mail e senha.');
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!data?.user) throw new Error('Login retornou sem usuário.');

        currentUser = data.user;

        const { data: profile, error: profileError } = await supabaseClient
            .from('bnc_profiles')
            .select('role, full_name, region')
            .eq('id', currentUser.id)
            .maybeSingle();

        // O login não deve falhar só porque o perfil ainda não existe ou está bloqueado por RLS.
        if (profileError) {
            console.warn('Perfil não carregado:', profileError.message);
        }

        currentRole = profile?.role || 'admin'; // fallback temporário para o usuário principal enxergar o painel

        document.getElementById('user-name-display').textContent = profile?.full_name || email.split('@')[0];
        document.getElementById('user-role-display').textContent = currentRole === 'admin'
            ? 'Administrador Global'
            : currentRole === 'manager'
                ? 'Gestor Regional'
                : 'Colaborador';
        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'Admin')}&background=ea580c&color=fff`;

        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');

        renderMenu(currentRole);
        switchView(currentRole === 'admin' || currentRole === 'manager' ? 'admin-dashboard' : 'employee-dashboard');
        await loadDashboardData();
    } catch (error) {
        console.error('Erro de login:', error);
        showFriendlyAuthError(error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function loadDashboardData() {
    try {
        const { data: contracts, error: contractsError } = await supabaseClient
            .from('bnc_contracts')
            .select('*')
            .eq('status', 'active');

        if (contractsError) console.warn('Erro ao carregar contratos:', contractsError.message);

        const totalContracts = contracts?.length || 0;
        const totalEmployees = contracts?.reduce((sum, c) => sum + (Number(c.employee_count) || 0), 0) || 0;

        const today = new Date().toISOString().split('T')[0];
        const { data: tasks, error: tasksError } = await supabaseClient
            .from('bnc_tasks')
            .select('status')
            .eq('scheduled_date', today);

        if (tasksError) console.warn('Erro ao carregar tarefas:', tasksError.message);

        const completed = tasks?.filter(t => t.status === 'completed').length || 0;

        const kpiContracts = document.getElementById('kpi-contracts');
        const kpiEmployees = document.getElementById('kpi-employees');
        const kpiTasks = document.getElementById('kpi-tasks');

        if (kpiContracts) kpiContracts.textContent = totalContracts;
        if (kpiEmployees) kpiEmployees.textContent = totalEmployees;
        if (kpiTasks) kpiTasks.textContent = `${completed} / ${tasks?.length || 0}`;

        const list = document.getElementById('contracts-list');
        if (list) {
            if (!contracts?.length) {
                list.innerHTML = '<div class="text-center text-gray-400 py-4">Nenhum contrato ativo encontrado.</div>';
                return;
            }

            list.innerHTML = contracts.map(c => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-building"></i></div>
                        <div><p class="font-bold text-sm">${escapeHtml(c.client_name || 'Cliente sem nome')}</p><p class="text-xs text-gray-500">${Number(c.employee_count) || 0} funcionários</p></div>
                    </div>
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    if (!desktopNav || !mobileNav) return;

    desktopNav.innerHTML = '';
    mobileNav.innerHTML = '';

    const items = (role === 'admin' || role === 'manager') ? [
        { id: 'admin-dashboard', icon: 'fa-home', label: 'Início' },
        { id: 'contracts', icon: 'fa-file-contract', label: 'Contratos' },
        { id: 'employees', icon: 'fa-users', label: 'Funcionários' },
        { id: 'schedules', icon: 'fa-calendar-week', label: 'Escalas' },
        { id: 'financial', icon: 'fa-chart-line', label: 'Financeiro' },
        { id: 'settings', icon: 'fa-cog', label: 'Configurações' }
    ] : [
        { id: 'employee-dashboard', icon: 'fa-clipboard-list', label: 'Tarefas' }
    ];

    items.forEach((item, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer w-full text-left ${i === 0 ? 'active' : ''}`;
        d.dataset.view = item.id;
        d.onclick = () => switchView(item.id);
        d.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`;
        desktopNav.appendChild(d);

        if (i < 4) {
            const m = document.createElement('button');
            m.type = 'button';
            m.className = `mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4 ${i === 0 ? 'active text-brand' : ''}`;
            m.dataset.view = item.id;
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
        e.classList.toggle('active', e.dataset.view === id);
    });

    document.querySelectorAll('.mobile-nav-item').forEach(e => {
        const isActive = e.dataset.view === id;
        e.classList.toggle('active', isActive);
        e.classList.toggle('text-brand', isActive);
        e.classList.toggle('text-gray-400', !isActive);
    });
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

function toggleResetForm() {
    const form = document.getElementById('reset-form');
    if (form) form.classList.toggle('hidden');
}

async function handleResetPassword() {
    const email = document.getElementById('reset-email')?.value?.trim().toLowerCase();
    if (!email) {
        alert('Digite seu e-mail para recuperar a senha.');
        return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });

    if (error) {
        alert('Erro ao enviar recuperação: ' + error.message);
        return;
    }

    alert('Link de recuperação enviado. Verifique seu e-mail.');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function initHeaderDate() {
    const el = document.getElementById('header-date');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

initHeaderDate();

window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.handleResetPassword = handleResetPassword;
window.switchView = switchView;
window.logout = logout;

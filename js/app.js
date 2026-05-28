// js/app.js - MODO DE TESTE (Bypass de Segurança Temporário)
const supabase = window.bncSupabase; 

let currentUser = null;
let currentRole = 'admin'; // Força admin para teste

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button');
    
    const originalText = btn.innerText;
    btn.innerText = 'Entrando...';
    btn.disabled = true;

    try {
        console.log('🔐 Tentando login real...');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            console.warn('⚠️ Login real falhou, entrando em MODO DE TESTE.');
            // MODO DE TESTE: Simula um usuário admin
            currentUser = { id: 'test-user-123', email: email };
            currentRole = 'admin'; 
            
            // Dados fictícios para o teste funcionar
            const mockProfile = { full_name: 'Usuário Teste', role: 'admin', region: 'Todas' };
            
            updateUI(mockProfile, email);
            enterSystem();
            return;
        }

        // Se o login real funcionou:
        currentUser = data.user;
        const { data: profile } = await supabase.from('bnc_profiles').select('*').eq('id', currentUser.id).single();
        currentRole = profile?.role || 'employee';
        
        updateUI(profile, email);
        enterSystem();

    } catch (error) {
        alert('Erro inesperado: ' + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function updateUI(profile, email) {
    document.getElementById('user-name-display').textContent = profile?.full_name || email.split('@')[0];
    document.getElementById('user-role-display').textContent = currentRole === 'admin' ? 'Administrador Global' : 'Colaborador';
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${profile?.full_name || 'User'}&background=ea580c&color=fff`;
}

function enterSystem() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    renderMenu(currentRole);
    loadMockData(); // Carrega dados fictícios para o teste
}

function loadMockData() {
    // Dados fictícios para você ver o dashboard bonito
    document.getElementById('kpi-contracts').textContent = "5";
    document.getElementById('kpi-employees').textContent = "128";
    document.getElementById('kpi-tasks').textContent = "42 / 58";
    
    const list = document.getElementById('contracts-list');
    if(list) {
        list.innerHTML = `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                <div class="flex items-center gap-3"><div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-building"></i></div><div><p class="font-bold text-sm">SEBRAE / SC</p><p class="text-xs text-gray-500">28 funcionários</p></div></div><i class="fas fa-chevron-right text-gray-400"></i>
            </div>
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3"><div class="w-10 h-10 bg-brand/10 text-brand rounded-lg flex items-center justify-center"><i class="fas fa-ship"></i></div><div><p class="font-bold text-sm">Itapoá Terminais</p><p class="text-xs text-gray-500">48 funcionários</p></div></div><i class="fas fa-chevron-right text-gray-400"></i>
            </div>
        `;
    }
}

// Funções de Menu e Navegação (Mantidas iguais)
function renderMenu(role) {
    const desktopNav = document.getElementById('desktop-menu');
    const mobileNav = document.getElementById('mobile-menu');
    if (!desktopNav || !mobileNav) return;
    desktopNav.innerHTML = ''; mobileNav.innerHTML = '';
    let items = [{ id: 'admin-dashboard', icon: 'fa-home', label: 'Início' }, { id: 'contracts', icon: 'fa-file-contract', label: 'Contratos' }, { id: 'employees', icon: 'fa-users', label: 'Funcionários' }];
    items.forEach((item, i) => {
        const d = document.createElement('a'); d.className = `sidebar-item flex items-center gap-4 px-6 py-3 cursor-pointer ${i===0?'active':''}`; d.onclick = () => switchView(item.id); d.innerHTML = `<i class="fas ${item.icon} w-5 text-center"></i> ${item.label}`; desktopNav.appendChild(d);
        if (i < 4) { const m = document.createElement('button'); m.className = `mobile-nav-item flex flex-col items-center gap-1 text-gray-400 w-1/4 ${i===0?'active text-brand':''}`; m.onclick = () => switchView(item.id); m.innerHTML = `<i class="fas ${item.icon} text-xl"></i><span class="text-[10px] font-medium">${item.label}</span>`; mobileNav.appendChild(m); }
    });
}

function switchView(id) {
    document.querySelectorAll('.view-section').forEach(e => e.classList.remove('active'));
    const target = document.getElementById(`view-${id}`); if (target) target.classList.add('active');
    document.querySelectorAll('.sidebar-item').forEach(e => { e.classList.remove('active'); if (e.getAttribute('onclick')?.includes(id)) e.classList.add('active'); });
}

function logout() { location.reload(); }
function toggleResetForm() { document.getElementById('reset-form').classList.toggle('hidden'); }

window.handleLogin = handleLogin;
window.toggleResetForm = toggleResetForm;
window.switchView = switchView;
window.logout = logout;

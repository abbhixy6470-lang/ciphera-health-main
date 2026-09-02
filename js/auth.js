/* Ciphera Health+ — Real Account Login Gate
 * Requires an email + password account to unlock the app. Credentials are
 * validated by the /api/auth serverless function and stored (bcrypt) in
 * Vercel Postgres. A session token is kept in sessionStorage.
 */
(function () {
    'use strict';

    const OVERLAY_HTML = `
<div id="authOverlay" class="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-y-auto">
    <div class="absolute inset-0 bg-gradient-to-br from-[#0a1a4a] via-[#071028] to-[#04140e]"></div>
    <div class="absolute inset-0 hero-grid-overlay opacity-60"></div>
    <div class="absolute w-72 h-72 rounded-full bg-brand-500/25 blur-[100px] -top-10 -left-10 animate-float-slow"></div>
    <div class="absolute w-80 h-80 rounded-full bg-emerald-500/20 blur-[110px] top-1/3 -right-16 animate-float-slow" style="animation-delay:1.5s"></div>

    <div class="relative z-10 w-full max-w-md">
        <div class="glass-card border-white/10 rounded-3xl p-7 sm:p-9 bg-white/95 dark:bg-slate-900/95 shadow-2xl">
            <div class="text-center mb-6">
                <div class="inline-flex items-center gap-2 justify-center mb-3">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
                        <i data-lucide="shield-plus" class="w-6 h-6"></i>
                    </div>
                    <div class="text-left">
                        <h1 class="text-xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">Ciphera <span class="gradient-text-brand">Health+</span></h1>
                        <p class="text-[10px] tracking-[0.2em] uppercase text-slate-400 dark:text-white/40 font-semibold mt-0.5">Secure Account</p>
                    </div>
                </div>
                <h2 class="text-lg font-bold text-slate-900 dark:text-white">Welcome back</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">Sign in to access your health dashboard (cloud-synced).</p>
            </div>

            <!-- Tabs -->
            <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-5">
                <button id="authTabLogin" onclick="Auth.toggle('login')" class="auth-tab py-2 rounded-xl text-xs font-bold transition-all">Sign In</button>
                <button id="authTabRegister" onclick="Auth.toggle('register')" class="auth-tab py-2 rounded-xl text-xs font-bold transition-all">Create Account</button>
            </div>

            <!-- Login form -->
            <form id="authLoginForm" onsubmit="App.submitAuthLogin(event)" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Email</label>
                    <input id="authLoginEmail" type="email" required autocomplete="email"
                        class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        placeholder="you@example.com">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
                    <input id="authLoginPassword" type="password" required autocomplete="current-password" minlength="6"
                        class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        placeholder="••••••••">
                </div>
                <p id="authLoginError" class="hidden text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2"></p>
                <button type="submit" id="authLoginBtn"
                    class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-600 hover:to-emerald-600 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5">
                    <i data-lucide="log-in" class="w-4 h-4"></i><span>Sign In</span>
                </button>
            </form>

            <!-- Register form -->
            <form id="authRegisterForm" onsubmit="App.submitAuthRegister(event)" class="space-y-4 hidden">
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Name (optional)</label>
                    <input id="authRegName" type="text" autocomplete="name"
                        class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        placeholder="Family / Patient name">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Email</label>
                    <input id="authRegEmail" type="email" required autocomplete="email"
                        class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        placeholder="you@example.com">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
                    <input id="authRegPassword" type="password" required autocomplete="new-password" minlength="6"
                        class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        placeholder="At least 6 characters">
                </div>
                <p id="authRegError" class="hidden text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2"></p>
                <button type="submit" id="authRegBtn"
                    class="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-500 hover:from-brand-600 hover:to-emerald-600 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5">
                    <i data-lucide="user-plus" class="w-4 h-4"></i><span>Create Account</span>
                </button>
            </form>
        </div>
    </div>
</div>`;

    function injectOverlay() {
        if (document.getElementById('authOverlay')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = OVERLAY_HTML.trim();
        document.body.appendChild(wrap.firstChild);
        if (window.lucide) lucide.createIcons();
    }

    const Auth = {
        overlay() { return document.getElementById('authOverlay'); },

        isLoggedIn() {
            return window.CloudSync && CloudSync.isAuthed();
        },

        toggle(mode) {
            const loginBtn = document.getElementById('authTabLogin');
            const regBtn = document.getElementById('authTabRegister');
            const loginForm = document.getElementById('authLoginForm');
            const regForm = document.getElementById('authRegisterForm');
            const activeCls = ['bg-brand-500', 'text-white', 'shadow-md', 'shadow-brand-500/20'];
            const inactCls = ['text-slate-500', 'dark:text-slate-400'];

            const setActive = (a, i, af, rf) => {
                a.classList.add(...activeCls); a.classList.remove(...inactCls);
                i.classList.remove(...activeCls); i.classList.add(...inactCls);
                af.classList.toggle('hidden', false); af.classList.toggle('hidden', false);
                rf.classList.add('hidden');
                if (af.id === 'authLoginForm') { loginForm.classList.remove('hidden'); regForm.classList.add('hidden'); }
                else { regForm.classList.remove('hidden'); loginForm.classList.add('hidden'); }
            };
            if (mode === 'register') setActive(regBtn, loginBtn, regForm, loginForm);
            else setActive(loginBtn, regBtn, loginForm, regForm);
        },

        show() {
            injectOverlay();
            const o = this.overlay();
            o.classList.remove('hidden');
            o.classList.add('flex');
            this.toggle('login');
        },

        hide() {
            const o = this.overlay();
            if (o) { o.classList.add('hidden'); o.classList.remove('flex'); }
        },

        // Enter the app: requires an authenticated account.
        async enter() {
            if (this.isLoggedIn()) {
                // Start cloud sync in the background, then reveal the app.
                if (window.CloudSync) CloudSync.boot().then(() => {
                    if (window.App) { try { App.renderAllViews && App.renderAllViews(); } catch (e) {} }
                });
                this.hide();
                if (window.App) App.enterApp();
                return;
            }
            // Not logged in -> show login over the splash/app.
            this.show();
        },

        async submitLogin(email, password) {
            const result = await CloudSync.serverAuth('login', { email, password });
            if (!result.ok) throw new Error(result.error);
            CloudSync.setSession(result);
            this.hide();
            if (window.App) App.enterApp();
            return result;
        },

        async submitRegister(name, email, password) {
            const result = await CloudSync.serverAuth('register', { name, email, password });
            if (!result.ok) throw new Error(result.error);
            CloudSync.setSession(result);
            this.hide();
            if (window.App) App.enterApp();
            return result;
        },

        logout() {
            if (window.CloudSync) CloudSync.logout();
            this.show();
            if (window.App && App.showToast) App.showToast('Signed out.', 'info');
        }
    };

    window.Auth = Auth;
})();
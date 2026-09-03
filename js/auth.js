/* Ciphera Health+ — Optional Login / Registration.
 *
 * Login is NOT required: anyone can use the app anonymously (device-key sync).
 * Creating an account links your synced health data to a stable owner key so it
 * follows you across devices. This module is purely additive and never blocks
 * entry — the "Enter Health+" button always remains available.
 *
 * Loaded AFTER cloud-sync.js so Auth can drive CloudSync when signing in.
 */
(function () {
    'use strict';

    const STORE = {
        key: 'ciphera_account_key',
        email: 'ciphera_account_email',
        name: 'ciphera_account_name'
    };

    const API = '/api/auth';

    function storageGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
    function storageSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function storageDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

    // ── current session ─────────────────────────────────────────────────
    function isLoggedIn() {
        return !!storageGet(STORE.key);
    }
    function currentUser() {
        if (!isLoggedIn()) return null;
        return { key: storageGet(STORE.key), email: storageGet(STORE.email), name: storageGet(STORE.name) };
    }
    // The owner key sync should use: the account key when logged in, else null
    // (so cloud-sync falls back to the anonymous device key).
    function syncKey() {
        return isLoggedIn() ? storageGet(STORE.key) : null;
    }

    // ── modal open/close ────────────────────────────────────────────────
    function openModal() {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        updateButton();
    }
    function closeModal() {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    function switchForm(kind) {
        const lg = document.getElementById('authLoginForm');
        const rg = document.getElementById('authRegisterForm');
        const tl = document.getElementById('authTabLogin');
        const tr = document.getElementById('authTabRegister');
        if (kind === 'register') {
            lg && lg.classList.add('hidden');
            rg && rg.classList.remove('hidden');
            tl && tl.classList.remove('active', 'border-brand-600', 'text-brand-600');
            tr && tr.classList.add('active', 'border-brand-600', 'text-brand-600');
        } else {
            rg && rg.classList.add('hidden');
            lg && lg.classList.remove('hidden');
            tr && tr.classList.remove('active', 'border-brand-600', 'text-brand-600');
            tl && tl.classList.add('active', 'border-brand-600', 'text-brand-600');
        }
    }

    async function apiPost(action, payload) {
        const r = await fetch(API + '/' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await r.json().catch(() => ({}));
        return { status: r.status, data: d };
    }

    function setBusy(btn, busy, idleText) {
        if (!btn) return;
        if (busy) {
            btn.dataset.idle = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin align-middle"></span> Please wait…';
        } else {
            btn.disabled = false;
            if (btn.dataset.idle) btn.innerHTML = btn.dataset.idle;
        }
    }

    // On success, link the account key and pull/push so the account's cloud
    // data appears locally and the local data becomes reachable from the account.
    async function finalizeLogin(res, who) {
        storageSet(STORE.key, res.owner_key);
        storageSet(STORE.email, res.email);
        storageSet(STORE.name, res.name || '');
        updateButton();
        showToast(who + ' successful! Your health data is now linked to this account.', 'success');
        if (typeof window.CloudSync !== 'undefined') {
            // Pull the account's existing data, then push local so nothing is lost.
            try {
                await CloudSync.pull();
                await CloudSync.push();
                if (window.App && App.renderAllViews) App.renderAllViews();
            } catch (e) {}
        }
        closeModal();
    }

    async function register(e) {
        if (e) e.preventDefault();
        const name = document.getElementById('authName').value.trim();
        const email = document.getElementById('authRegEmail').value.trim();
        const pass = document.getElementById('authRegPass').value;
        const btn = document.getElementById('authRegBtn');
        if (!email || !pass) { showToast('Please enter your email and a password.', 'error'); return; }
        if (pass.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
        setBusy(btn, true);
        try {
            const { data } = await apiPost('register', { name, email, password: pass });
            if (data && data.owner_key) {
                await finalizeLogin(data, 'Registration');
            } else {
                showToast((data && data.error) || 'Registration failed. Please try again.', 'error');
            }
        } catch (err) {
            showToast('Cannot reach the server right now. Try again later.', 'error');
        } finally {
            setBusy(btn, false);
        }
        return false;
    }

    async function login(e) {
        if (e) e.preventDefault();
        const email = document.getElementById('authLoginEmail').value.trim();
        const pass = document.getElementById('authLoginPass').value;
        const btn = document.getElementById('authLoginBtn');
        if (!email || !pass) { showToast('Please enter your email and password.', 'error'); return; }
        setBusy(btn, true);
        try {
            const { status, data } = await apiPost('login', { email, password: pass });
            if (data && data.owner_key) {
                await finalizeLogin(data, 'Login');
            } else if (status === 401) {
                showToast((data && data.error) || 'Incorrect email or password.', 'error');
            } else {
                showToast((data && data.error) || 'Login failed. Please try again.', 'error');
            }
        } catch (err) {
            showToast('Cannot reach the server right now. Try again later.', 'error');
        } finally {
            setBusy(btn, false);
        }
        return false;
    }

    function signOut() {
        storageDel(STORE.key);
        storageDel(STORE.email);
        storageDel(STORE.name);
        updateButton();
        closeModal();
        showToast('Signed out. Your data stays on this device and syncs anonymously again.', 'info');
    }

    // ── button label / visibility ──────────────────────────────────────
    function updateButton() {
        const btn = document.getElementById('authNavBtn');
        if (!btn) return;
        if (isLoggedIn()) {
            const user = currentUser();
            btn.innerHTML = '<i data-lucide="user-check" class="w-4 h-4"></i><span class="max-w-[9rem] truncate">' + (user.name || user.email) + '</span>';
            btn.title = 'Account: ' + user.email + ' (click to manage)';
        } else {
            btn.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i><span>Login / Register</span>';
            btn.title = 'Optional: link your health data to an account';
        }
        if (window.lucide) { try { lucide.createIcons({ attrs: { class: undefined } }); } catch (e) {} }
    }

    // Render the signed-in state inside the modal (show account email + Sign out).
    function renderModalState() {
        const guest = document.getElementById('authGuestState');
        const account = document.getElementById('authAccountState');
        const accountInfo = document.getElementById('authAccountInfo');
        if (isLoggedIn()) {
            const user = currentUser();
            if (guest) guest.classList.add('hidden');
            if (account) account.classList.remove('hidden');
            if (accountInfo) accountInfo.textContent = (user.name ? user.name + ' · ' : '') + user.email;
        } else {
            if (account) account.classList.add('hidden');
            if (guest) guest.classList.remove('hidden');
        }
    }

    function showToast(msg, type) {
        if (window.App && App.showToast) { App.showToast(msg, type || 'info'); return; }
        const t = document.getElementById('appToast');
        if (t) { t.textContent = msg; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3000); }
    }

    function openModalWithState() {
        openModal();
        renderModalState();
        if (!isLoggedIn()) switchForm('login');
    }

    const Auth = {
        openModal: openModalWithState,
        closeModal,
        switchForm,
        register,
        login,
        signOut,
        isLoggedIn,
        currentUser,
        syncKey,
        updateButton
    };

    window.Auth = Auth;

    // Sync the header button (and any account-aware state) on load and on
    // any auth-relevant storage change from another tab.
    try { updateButton(); } catch (e) {}
    window.addEventListener('storage', function (ev) {
        if (ev.key === STORE.key) updateButton();
    });
})();

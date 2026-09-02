/* Ciphera Health+ — Caregiver Access & Authentication
 * Secure caregiver login that complements the opt-in patient experience.
 * - Patients can keep using the app without logging in.
 * - Caregivers register with an email + password + patient consent.
 * - Passwords are stored only as SHA-256 hashes (never plaintext).
 * - The current "actor" (patient or caregiver) is exposed for dose attribution.
 */
(function () {
    'use strict';

    const STORE_KEY = 'ciphera_caregivers';
    const SESSION_KEY = 'ciphera_caregiver_session';

    // SHA-256 digest via Web Crypto (async). Used to avoid storing plaintext passwords.
    async function hashPassword(password) {
        const data = new TextEncoder().encode('ciphera-salt::' + password);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const CaregiverAuth = {

        // -------- storage helpers --------
        getStore() {
            try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
        },
        saveStore(store) {
            localStorage.setItem(STORE_KEY, JSON.stringify(store));
        },
        getSession() {
            try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
        },
        setSession(session) {
            if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
            else sessionStorage.removeItem(SESSION_KEY);
        },

        // -------- actor API (used for dose attribution) --------
        isCaregiverLoggedIn() {
            return !!this.getSession();
        },
        currentActor() {
            const s = this.getSession();
            return s ? { role: 'caregiver', name: s.name, email: s.email } : { role: 'patient', name: 'Patient' };
        },

        // -------- registration (requires patient consent) --------
        async register(name, email, password, consent) {
            const store = this.getStore();
            const normalizedEmail = (email || '').trim().toLowerCase();
            if (!name || !normalizedEmail || !password) {
                return { ok: false, error: 'Please fill in all fields.' };
            }
            if (!consent) {
                return { ok: false, error: 'Caregiver access requires the patient’s consent. You must confirm it to continue.' };
            }
            if (store[normalizedEmail]) {
                return { ok: false, error: 'A caregiver account already exists for this email.' };
            }
            if (password.length < 6) {
                return { ok: false, error: 'Password must be at least 6 characters.' };
            }
            const hashed = await hashPassword(password);
            store[normalizedEmail] = { name: name.trim(), email: normalizedEmail, passwordHash: hashed, consentGiven: true, consentAt: Date.now() };
            this.saveStore(store);
            this.login(normalizedEmail, password);
            return { ok: true };
        },

        // -------- login --------
        async login(email, password) {
            const store = this.getStore();
            const normalizedEmail = (email || '').trim().toLowerCase();
            const acc = store[normalizedEmail];
            if (!acc) return { ok: false, error: 'No caregiver account found for this email.' };
            const hashed = await hashPassword(password);
            if (hashed !== acc.passwordHash) return { ok: false, error: 'Incorrect password.' };
            this.setSession({ name: acc.name, email: acc.email, since: Date.now() });
            return { ok: true };
        },

        logout() {
            this.setSession(null);
            if (window.App) App.syncCaregiverUI();
            return { ok: true };
        }
    };

    window.CaregiverAuth = CaregiverAuth;
})();
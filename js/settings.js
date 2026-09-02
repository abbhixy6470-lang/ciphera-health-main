/* Ciphera Health+ — Shared Settings & API Key Store */
(function () {
    'use strict';

    const KEY = 'ciphera_gemini_key';

    const Settings = {
        getGeminiKey() {
            try {
                return localStorage.getItem(KEY) || '';
            } catch (e) {
                return '';
            }
        },

        setGeminiKey(key) {
            try {
                localStorage.setItem(KEY, (key || '').trim());
            } catch (e) { /* ignore */ }
        },

        hasGeminiKey() {
            return !!this.getGeminiKey();
        },

        syncGeminiStatusBadge() {
            const el = document.getElementById('geminiKeyStatus');
            if (!el) return;
            el.textContent = this.hasGeminiKey() ? 'AI Key: Connected' : 'AI Key: Not Set';
        }
    };

    window.Settings = Settings;
})();

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
            if (el) el.textContent = this.hasGeminiKey() ? 'AI Key: Connected' : 'AI Key: Not Set';

            const scanEl = document.getElementById('scanAiStatus');
            const scanText = document.getElementById('scanAiStatusText');
            if (scanEl) {
                scanEl.className = this.hasGeminiKey()
                    ? 'mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                    : 'mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
            }
            if (scanText) scanText.textContent = this.hasGeminiKey() ? 'AI: Connected — enhanced extraction active' : 'AI: Not Set — connect for smarter extraction';
        }
    };

    window.Settings = Settings;
})();

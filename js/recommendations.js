/* Ciphera Health+ — Allergy-Aware Medicine Recommendation Module
 * Suggests medicines from the drug database and cross-checks them
 * against the selected patient's documented allergies. Any medicine that
 * contains a known allergen is excluded and flagged for safety.
 */
(function () {
    'use strict';

    const Rec = {

        // Normalize a string: lowercase, collapse whitespace, strip punctuation
        _norm(str) {
            return String(str || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        // Parse a patient's comma-separated allergy string into a list of tokens.
        // Each token may itself contain multiple words (e.g. "Penicillin", "NSAID").
        parseAllergies(allergiesStr) {
            if (!allergiesStr) return [];
            return String(allergiesStr)
                .split(',')
                .map(s => this._norm(s))
                .filter(Boolean);
        },

        // Return the first allergen (as typed) from the patient's list that
        // matches this drug's allergen names, or null if the drug is safe.
        findConflict(drug, allergyTokens) {
            const drugAllergens = (drug.allergens || []).map(a => this._norm(a));
            for (const token of allergyTokens) {
                // Exact allergen-name match against a recorded drug allergen
                if (drugAllergens.includes(token)) return token;
                // Partial inside-the-token match (handles hyphenated/multi-word entries)
                const inside = drugAllergens.find(a => a.includes(token) || token.includes(a));
                if (inside) return token;
                // Match against the drug display name / generic name too
                const drugText = this._norm(drug.name + ' / ' + drug.generic);
                if (drugText.includes(token)) return token;
            }
            return null;
        },

        // Classify the full drug database for a patient into { safe, blocked }
        // blocked items include which allergen triggered the exclusion.
        evaluate(patient) {
            const tokens = this.parseAllergies(patient && patient.allergies);
            const db = (typeof PRECAUTIONS_DATA !== 'undefined' && PRECAUTIONS_DATA.drugDatabase) || [];

            const safe = [];
            const blocked = [];

            db.forEach(drug => {
                const conflict = this.findConflict(drug, tokens);
                if (conflict) {
                    blocked.push({ drug, allergen: conflict });
                } else {
                    safe.push(drug);
                }
            });

            return { safe, blocked, total: db.length, hasAllergies: tokens.length > 0 };
        },

        // Render safe recommendations
        renderSafeCard(drug) {
            const icon = (PRECAUTIONS_DATA.categories[drug.category] && PRECAUTIONS_DATA.categories[drug.category].icon) || 'pill';
            return `
                <div class="glass-card rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 dark:border-slate-800/60 flex flex-col">
                    <div class="flex items-start gap-3 mb-3">
                        <div class="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-center shrink-0">
                            <i data-lucide="${icon}" class="w-5 h-5"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white leading-tight">${this._esc(drug.name)}</h4>
                            <p class="text-xs text-slate-500 mt-0.5">${this._esc(drug.generic)}</p>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 shrink-0">Safe</span>
                    </div>
                    <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 flex-1">
                        <div class="flex justify-between gap-2"><span class="text-slate-400 shrink-0">Category:</span><span class="text-right font-medium">${this._esc(drug.category)}</span></div>
                        <div class="flex justify-between gap-2"><span class="text-slate-400 shrink-0">Dose:</span><span class="text-right font-medium">${this._esc(drug.defaultDose)}</span></div>
                        <div class="flex justify-between gap-2"><span class="text-slate-400 shrink-0">Schedule:</span><span class="text-right font-medium">${this._esc(drug.scheduleRecommendation)}</span></div>
                        <div class="flex justify-between gap-2"><span class="text-slate-400 shrink-0">Meals:</span><span class="text-right font-medium">${this._esc(drug.mealRule)}</span></div>
                    </div>
                    <button onclick="App.prefillFromRecommendation('${this._escForAttr(drug.name)}')" class="mt-4 w-full px-3 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 transition">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add to Cabinet
                    </button>
                </div>
            `;
        },

        // Render a blocked (allergen-containing) medicine with the required warning
        renderBlockedCard(drug, allergen) {
            const rawAllergen = drug.allergens.find(a => this._norm(a) === allergen) || allergen;
            return `
                <div class="rounded-2xl p-4 flex items-start gap-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/40">
                    <div class="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <i data-lucide="shield-alert" class="w-5 h-5"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between gap-2 flex-wrap">
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white">${this._esc(drug.name)}</h4>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800 dark:bg-rose-800/60 dark:text-rose-200 shrink-0">Not Recommended</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">${this._esc(drug.generic)}</p>
                        <p class="mt-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">
                            ⚠ This medicine contains <strong>${this._esc(rawAllergen)}</strong>, which you are allergic to. Not recommended.
                        </p>
                    </div>
                </div>
            `;
        },

        // Populate the patient <select> for whom we are recommending
        populatePatientSelect(selectedId) {
            const select = document.getElementById('recPatientSelect');
            if (!select) return;

            const patients = (window.Care && Care.getAll()) || [];
            // Default to the primary caregiver / self relationship when present
            const defaultId = selectedId ||
                (patients.find(p => p.relation === 'Self' || p.id === 'p_self') || {}).id ||
                (patients[0] || {}).id;

            select.innerHTML = patients.map(p =>
                `<option value="${this._escForAttr(p.id)}" ${p.id === defaultId ? 'selected' : ''}>${this._esc(p.name)} (Age ${this._esc(p.age)})</option>`
            ).join('');

            if (patients.length === 0) select.innerHTML = '<option value="">No patients yet</option>';

            // Re-evaluate whenever the selection changes
            select.onchange = () => this.render(select.value);
            return defaultId;
        },

        render(selectedId) {
            const patients = (window.Care && Care.getAll()) || [];
            const select = document.getElementById('recPatientSelect');
            const activeId = selectedId || (select && select.value) || this.currentPatientId;
            const patient = patients.find(p => p.id === activeId) || patients[0];

            // Update the allergy summary panel
            const summary = document.getElementById('recAllergySummary');
            const parsed = this.parseAllergies(patient && patient.allergies);
            if (summary) {
                summary.textContent = parsed.length
                    ? patient.allergies
                    : 'No allergies on file for this patient.';
            }

            if (!patient && patients.length === 0) {
                const empty = document.getElementById('recEmptyState');
                if (empty) empty.classList.remove('hidden');
                this._setCounts(0, 0, 0);
                document.getElementById('recSafeList').innerHTML = '';
                document.getElementById('recBlockedList').innerHTML = '';
                return;
            }

            const empty = document.getElementById('recEmptyState');
            if (empty) empty.classList.add('hidden');

            const result = this.evaluate(patient);

            // Summary counts
            this._setCounts(result.safe.length, result.blocked.length, result.total);
            this.currentPatientId = patient.id;

            // Safe list
            document.getElementById('recSafeList').innerHTML = result.safe.length
                ? result.safe.map(d => this.renderSafeCard(d)).join('')
                : '<div class="col-span-full text-sm text-slate-500 dark:text-slate-400 text-center py-8">No safe matches in the database for this patient.</div>';

            // Blocked list
            document.getElementById('recBlockedList').innerHTML = result.blocked.length
                ? result.blocked.map(({ drug, allergen }) => this.renderBlockedCard(drug, allergen)).join('')
                : (result.hasAllergies
                    ? '<div class="text-sm text-emerald-600 dark:text-emerald-400 font-medium text-center py-6">All considered medicines are safe for this patient — no allergies triggered.</div>'
                    : '<div class="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No allergies on file, so nothing is excluded.</div>');

            // Highlight blocked section only when relevant
            const blockedSection = document.getElementById('recBlockedList').closest('div');
            if (blockedSection) blockedSection.style.display = result.blocked.length ? '' : 'none';

            if (window.lucide) lucide.createIcons();
        },

        _setCounts(safe, blocked, total) {
            const s = document.getElementById('recSafeCount');
            const b = document.getElementById('recBlockedCount');
            const t = document.getElementById('recTotalCount');
            if (s) s.textContent = safe;
            if (b) b.textContent = blocked;
            if (t) t.textContent = total;
        },

        _esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        },

        _escForAttr(str) {
            return this._esc(str).replace(/"/g, '&quot;');
        }
    };

    window.Recommendations = Rec;
})();
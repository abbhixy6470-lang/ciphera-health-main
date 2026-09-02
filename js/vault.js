/* Ciphera Health+ — Medical Record Vault
 * Secure storage for test results and past history. Persisted to localStorage
 * under `ciphera_medical_records` and auto-synced to the account's cloud
 * (Vercel Postgres) by js/cloud-sync.js.
 */
(function () {
    'use strict';

    const STORE_KEY = 'ciphera_medical_records';

    const TYPE_META = {
        'Lab Report':       { icon: 'flask-conical', tone: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-300' },
        'Imaging':          { icon: 'scan', tone: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300' },
        'Prescription':     { icon: 'file-text', tone: 'bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300' },
        'Discharge Summary':{ icon: 'hospital', tone: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300' },
        'Immunization':     { icon: 'syringe', tone: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' },
        'Vaccination':      { icon: 'syringe', tone: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300' },
        'Consultation':     { icon: 'stethoscope', tone: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300' },
        'Other':            { icon: 'archive', tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' }
    };

    const Vault = {
        getAll() {
            try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
            catch (e) { return []; }
        },

        save(records) {
            localStorage.setItem(STORE_KEY, JSON.stringify(records));
        },

        persist(records) {
            this.save(records);
            if (window.CloudSync) CloudSync.schedulePush(600);
        },

        // ---------------------------------------------------------------
        // Render
        // ---------------------------------------------------------------
        render() {
            const grid = document.getElementById('vaultGrid');
            const empty = document.getElementById('vaultEmpty');
            const countEl = document.getElementById('vaultCount');
            if (!grid) return;

            let records = this.getAll().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            const q = ((document.getElementById('vaultSearch') || {}).value || '').trim().toLowerCase();
            const f = ((document.getElementById('vaultFilter') || {}).value || '').trim();
            if (q) records = records.filter(r => (r.title + ' ' + (r.resultSummary || '') + ' ' + (r.facility || '')).toLowerCase().includes(q));
            if (f) records = records.filter(r => r.type === f);

            if (countEl) countEl.textContent = records.length ? (records.length + (records.length === 1 ? ' record' : ' records')) : '';

            if (records.length === 0) {
                grid.innerHTML = '';
                if (empty) empty.classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
                return;
            }
            if (empty) empty.classList.add('hidden');

            grid.innerHTML = records.map(r => {
                const meta = TYPE_META[r.type] || TYPE_META['Other'];
                const date = r.recordDate || '';
                return `
                    <div class="glass-card rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 dark:border-slate-800/60 flex flex-col cursor-pointer"
                         onclick="Vault.openDetail('${r.id}')">
                        <div class="flex items-start justify-between mb-3">
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-brand-600 text-white flex items-center justify-center shrink-0">
                                <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
                            </div>
                            <span class="px-2.5 py-1 rounded-lg ${meta.tone} text-[10px] font-bold border border-current/10">${this.esc(r.type || 'Report')}</span>
                        </div>
                        <h3 class="text-sm font-bold text-slate-900 dark:text-white leading-snug mb-1">${this.esc(r.title)}</h3>
                        ${date ? `<p class="text-[11px] text-slate-400 font-medium mb-2">${this.esc(date)}${r.facility ? ' · ' + this.esc(r.facility) : ''}</p>` : ''}
                        ${r.resultSummary ? `<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 flex-1">${this.esc(r.resultSummary)}</p>` : '<p class="text-xs text-slate-400 mb-3 flex-1">No summary provided.</p>'}
                        <div class="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400 font-medium">Click to view</span>
                            <button onclick="event.stopPropagation();Vault.deleteRecord('${r.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition" title="Delete">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },

        // ---------------------------------------------------------------
        // Patient select options (shared with modal)
        // ---------------------------------------------------------------
        patientOptions() {
            const patients = (window.Care && Care.getAll()) || [];
            return patients.map(p => `<option value="${this.esc(p.id)}">${this.esc(p.name)}</option>`).join('');
        },

        // ---------------------------------------------------------------
        // Modal open
        // ---------------------------------------------------------------
        _resetFormState(modal) {
            modal.querySelectorAll('input, textarea, select, button').forEach(el => {
                try { el.readOnly = false; } catch (e) {}
                el.disabled = false;
            });
            // Remove any injected Edit button from a prior detail view.
            modal.querySelectorAll('.vault-detail-edit').forEach(b => b.remove());
        },

        openAdd() {
            const modal = document.getElementById('vaultModal');
            this._resetFormState(modal);
            document.getElementById('vaultModalTitle').textContent = 'Add Medical Record';
            document.getElementById('vaultFormId').value = '';
            document.getElementById('vaultFormTitle').value = '';
            document.getElementById('vaultFormType').value = 'Lab Report';
            document.getElementById('vaultFormDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('vaultFormFacility').value = '';
            document.getElementById('vaultFormDoctor').value = '';
            document.getElementById('vaultFormPatient').innerHTML = this.patientOptions();
            document.getElementById('vaultFormSummary').value = '';
            document.getElementById('vaultFormNotes').value = '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (window.lucide) lucide.createIcons();
        },

        openEdit(id) {
            const r = this.getAll().find(x => x.id === id);
            if (!r) return;
            const modal = document.getElementById('vaultModal');
            this._resetFormState(modal);
            document.getElementById('vaultModalTitle').textContent = 'Edit Medical Record';
            document.getElementById('vaultFormId').value = r.id;
            document.getElementById('vaultFormTitle').value = r.title || '';
            document.getElementById('vaultFormType').value = r.type || 'Lab Report';
            document.getElementById('vaultFormDate').value = r.recordDate || '';
            document.getElementById('vaultFormFacility').value = r.facility || '';
            document.getElementById('vaultFormDoctor').value = r.doctor || '';
            document.getElementById('vaultFormPatient').innerHTML = this.patientOptions();
            const sel = document.getElementById('vaultFormPatient');
            if (r.patientId) sel.value = r.patientId;
            document.getElementById('vaultFormSummary').value = r.resultSummary || '';
            document.getElementById('vaultFormNotes').value = r.notes || '';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (window.lucide) lucide.createIcons();
        },

        closeModal() {
            const modal = document.getElementById('vaultModal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        // ---------------------------------------------------------------
        // Save / delete
        // ---------------------------------------------------------------
        saveRecord(event) {
            event.preventDefault();
            const id = document.getElementById('vaultFormId').value;
            const records = this.getAll();

            const data = {
                id: id || 'rec_' + Date.now(),
                title: document.getElementById('vaultFormTitle').value.trim(),
                type: document.getElementById('vaultFormType').value,
                recordDate: document.getElementById('vaultFormDate').value,
                facility: document.getElementById('vaultFormFacility').value.trim(),
                doctor: document.getElementById('vaultFormDoctor').value.trim(),
                patientId: document.getElementById('vaultFormPatient').value,
                resultSummary: document.getElementById('vaultFormSummary').value.trim(),
                notes: document.getElementById('vaultFormNotes').value.trim(),
                fields: [],
                createdAt: id ? (records.find(x => x.id === id)?.createdAt || Date.now()) : Date.now()
            };

            if (id) {
                const idx = records.findIndex(x => x.id === id);
                if (idx !== -1) records[idx] = data; else records.push(data);
            } else {
                records.push(data);
            }

            this.persist(records);
            this.render();
            this.closeModal();
            if (window.App && App.showToast) App.showToast('✅ Record saved!', 'success');
        },

        deleteRecord(id) {
            if (!confirm('Delete this medical record?')) return;
            const records = this.getAll().filter(x => x.id !== id);
            this.persist(records);
            this.render();
            if (window.App && App.showToast) App.showToast('Record deleted.', 'info');
        },

        // ---------------------------------------------------------------
        // Detail view (read-only expand)
        // ---------------------------------------------------------------
        openDetail(id) {
            const r = this.getAll().find(x => x.id === id);
            if (!r) return;
            const meta = TYPE_META[r.type] || TYPE_META['Other'];
            const dateStr = r.recordDate ? new Date(r.recordDate + 'T00:00:00').toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date';

            const modal = document.getElementById('vaultModal');
            document.getElementById('vaultModalTitle').textContent = 'View Medical Record';
            document.getElementById('vaultFormId').value = r.id;
            document.getElementById('vaultFormTitle').value = r.title || '';
            document.getElementById('vaultFormType').value = r.type || 'Report';
            document.getElementById('vaultFormDate').value = r.recordDate || '';
            document.getElementById('vaultFormFacility').value = r.facility || '';
            document.getElementById('vaultFormDoctor').value = r.doctor || '';
            document.getElementById('vaultFormNotes').value = r.notes || '';
            const sel = document.getElementById('vaultFormPatient');
            sel.innerHTML = this.patientOptions();
            if (r.patientId) sel.value = r.patientId;
            document.getElementById('vaultFormSummary').value = r.resultSummary || '';

            // Toggle all form fields read-only to make it a clean detail viewer.
            modal.querySelectorAll('input, textarea, select, button[type="submit"]').forEach(el => {
                el.readOnly = true;
                if (el.tagName === 'BUTTON') el.disabled = true;
                if (el.tagName === 'SELECT') el.disabled = true;
            });
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            if (window.lucide) lucide.createIcons();

            // Offer an Edit action in the header row.
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'vault-detail-edit inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50';
            editBtn.textContent = '✎ Edit';
            editBtn.onclick = () => {
                modal.querySelectorAll('input, textarea, select, button[type="submit"]').forEach(el => {
                    if (el.readOnly === true) el.readOnly = false;
                    if (el.disabled === true) el.disabled = false;
                });
                editBtn.remove();
                document.getElementById('vaultModalTitle').textContent = 'Edit Medical Record';
            };
            // Place after title element in header (simple re-insert near save button).
            const saveBtn = modal.querySelector('button[type="submit"]');
            saveBtn.parentNode.insertBefore(editBtn, saveBtn);
        },

        init() {
            this.render();
        },

        esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };

    window.Vault = Vault;
})();
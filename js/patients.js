/* Ciphera Health+ — Patient Care Module */
(function () {
    'use strict';

    const STORE_KEY = 'ciphera_patients';

    const Care = {
        getAll() {
            try {
                return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
            } catch (e) { return []; }
        },

        save(patients) {
            localStorage.setItem(STORE_KEY, JSON.stringify(patients));
        },

        init() {
            const seeded = this.getAll();
            if (seeded.length === 0) {
                this.save([
                    {
                        id: 'p_self',
                        name: 'You (Primary Caregiver)',
                        age: 34,
                        blood: 'O+',
                        relation: 'Self',
                        allergies: 'Penicillin',
                        conditions: 'None',
                        contact: 'Emergency — 911',
                        createdAt: Date.now()
                    }
                ]);
            }
            this.render();
        },

        render() {
            const grid = document.getElementById('patientsGrid');
            const empty = document.getElementById('patientsEmpty');
            const patients = this.getAll();

            if (!grid) return;

            if (patients.length === 0) {
                grid.innerHTML = '';
                empty.classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
                return;
            }

            empty.classList.add('hidden');

            grid.innerHTML = patients.map(p => {
                const bloodTone = (p.blood || '') === '' ? 'slate' :
                    (['A+', 'B+', 'AB+'].includes(p.blood) ? 'brand' :
                     (['A-', 'B-', 'AB-'].includes(p.blood) ? 'violet' : 'emerald'));
                const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

                return `
                    <div class="glass-card rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-slate-200/60 dark:border-slate-800/60 flex flex-col">
                        <div class="flex items-start gap-3 mb-3">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-emerald-500/20 shrink-0">
                                ${initials}
                            </div>
                            <div class="flex-1">
                                <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">${this.esc(p.name)}</h3>
                                <p class="text-xs text-slate-500">Age ${this.esc(p.age)} • <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${this.esc(p.relation)}</span></p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mb-3">
                            <span class="px-2.5 py-1 rounded-lg bg-gradient-to-br from-brand-100 to-emerald-50 text-brand-800 dark:from-brand-900/60 dark:to-emerald-900/40 dark:text-brand-200 text-xs font-black border border-brand-200/50 dark:border-brand-800/30">
                                ${this.esc(p.blood || 'Blood: ?')}
                            </span>
                            ${p.allergies ? `<span class="px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200/50 dark:border-rose-800/30">Allergies: ${this.esc(p.allergies)}</span>` : ''}
                        </div>

                        <div class="space-y-1.5 text-xs mb-4 flex-1">
                            ${p.conditions && p.conditions !== 'None' ? `<div class="flex justify-between"><span class="text-slate-500">Conditions:</span><span class="font-medium text-slate-700 dark:text-slate-300 text-right">${this.esc(p.conditions)}</span></div>` : '<div class="flex justify-between"><span class="text-slate-500">Conditions:</span><span class="text-emerald-600 dark:text-emerald-400 font-medium">None reported</span></div>'}
                            <div class="flex justify-between"><span class="text-slate-500">Emergency:</span><span class="font-medium text-slate-700 dark:text-slate-300 text-right">${this.esc(p.contact || '—')}</span></div>
                        </div>

                        <div class="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400 font-medium">Patient Record</span>
                            <div class="flex items-center gap-1">
                                <button onclick="Care.openPatientModal('${p.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition" title="Edit">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                </button>
                                <button onclick="Care.deletePatient('${p.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition" title="Delete">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },

        openPatientModal(id) {
            const modal = document.getElementById('patientModal');
            const patients = this.getAll();
            const p = patients.find(x => x.id === id);

            document.getElementById('patientFormId').value = p ? p.id : '';
            document.getElementById('patientFormName').value = p ? p.name : '';
            document.getElementById('patientFormAge').value = p ? p.age : '';
            document.getElementById('patientFormBlood').value = p ? p.blood : '';
            document.getElementById('patientFormRelation').value = p ? p.relation : 'Self';
            document.getElementById('patientFormAllergies').value = p ? p.allergies : '';
            document.getElementById('patientFormConditions').value = p ? p.conditions : '';
            document.getElementById('patientFormContact').value = p ? p.contact : '';

            document.getElementById('patientModalTitle').textContent = p ? 'Edit Patient Profile' : 'Add Patient Profile';
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        },

        closePatientModal() {
            document.getElementById('patientModal').classList.add('hidden');
            document.getElementById('patientModal').classList.remove('flex');
        },

        savePatient(event) {
            event.preventDefault();
            const id = document.getElementById('patientFormId').value;
            const patients = this.getAll();

            const data = {
                id: id || 'p_' + Date.now(),
                name: document.getElementById('patientFormName').value.trim(),
                age: document.getElementById('patientFormAge').value,
                blood: document.getElementById('patientFormBlood').value,
                relation: document.getElementById('patientFormRelation').value,
                allergies: document.getElementById('patientFormAllergies').value.trim(),
                conditions: document.getElementById('patientFormConditions').value.trim(),
                contact: document.getElementById('patientFormContact').value.trim(),
                createdAt: id ? (patients.find(x => x.id === id)?.createdAt || Date.now()) : Date.now()
            };

            if (id) {
                const idx = patients.findIndex(x => x.id === id);
                if (idx !== -1) patients[idx] = data;
            } else {
                patients.push(data);
            }

            this.save(patients);
            this.render();
            this.closePatientModal();
            App.showToast(id ? '✅ Patient updated!' : '✅ Patient profile created!', 'success');
        },

        deletePatient(id) {
            if (!confirm('Delete this patient profile?')) return;
            const patients = this.getAll().filter(x => x.id !== id);
            this.save(patients);
            this.render();
            App.showToast('Patient profile deleted.', 'info');
        },

        esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };

    window.Care = Care;
})();

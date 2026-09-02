/* Ciphera Health+ — Personalized AI Doctor Assistant
 * Answers patient questions using their stored profile (medicines, allergies,
 * conditions, dosage schedules) in simple language. Provides educational
 * explanations only, warns on allergy/drug conflicts, and logs Q&A history.
 */
(function () {
    'use strict';

    const Doctor = {

        historyKey: 'ciphera_doctor_history',

        // ---------------------------------------------------------------
        // Patient context assembly (used for all advice + Gemini prompt)
        // ---------------------------------------------------------------
        buildContext(patientId) {
            const patients = (window.Care && Care.getAll()) || [];
            const patient = patients.find(p => p.id === patientId) || patients[0] || null;

            const medicines = (window.MedStore && MedStore.getAll()) || [];
            const logs = (window.MedStore && MedStore.getAllLogs()) || [];
            const todayDoses = (window.AdherenceTracker && AdherenceTracker.getTodayDoses(medicines, logs)) || [];
            const score = (window.AdherenceTracker && AdherenceTracker.calculateDailyScore(todayDoses)) || { percentage: 0 };

            const db = (typeof PRECAUTIONS_DATA !== 'undefined' && PRECAUTIONS_DATA.drugDatabase) || [];
            const lifestyle = (typeof LIFESTYLE_DATA !== 'undefined') ? LIFESTYLE_DATA : null;

            // Build medicine list including a safety flag per medicine
            const allergyTokens = this.parseAllergies(patient && patient.allergies);
            const medRows = medicines.map(med => {
                const drug = db.find(d => d.name === med.name) || null;
                const conflict = drug ? this.findConflict(drug, allergyTokens) : null;
                return {
                    name: med.name,
                    dosage: med.dosage || 'as directed',
                    times: (med.schedule && med.schedule.times) ? med.schedule.times.join(', ') : 'as scheduled',
                    meal: (med.schedule && med.schedule.mealRelation) || 'no restriction',
                    category: med.category || 'General / Other',
                    conflict: conflict
                };
            });

            return {
                patient,
                medicines: medRows,
                allergies: allergyTokens,
                rawAllergies: (patient && patient.allergies) || '',
                conditions: (patient && patient.conditions) || '',
                age: (patient && patient.age) || '',
                blood: (patient && patient.blood) || '',
                adherence: score.percentage,
                hasMedicines: medicines.length > 0,
                lifecycle: lifestyle
            };
        },

        parseAllergies(allergiesStr) {
            return String(allergiesStr || '').split(',')
                .map(s => s.trim().toLowerCase()).filter(Boolean);
        },

        findConflict(drug, allergyTokens) {
            const da = (drug.allergens || []).map(a => a.toLowerCase());
            for (const t of allergyTokens) {
                const hit = da.find(a => a === t || a.includes(t) || t.includes(a));
                if (hit) return hit;
            }
            return null;
        },

        // ---------------------------------------------------------------
        // Conflict warning check before answering any medicine question
        // ---------------------------------------------------------------
        detectConflicts(ctx) {
            const conflicts = ctx.medicines.filter(m => m.conflict);
            return conflicts;
        },

        // ---------------------------------------------------------------
        // Q&A history tracking
        // ---------------------------------------------------------------
        getHistory(patientId) {
            try {
                const all = JSON.parse(localStorage.getItem(this.historyKey)) || [];
                return patientId ? all.filter(h => h.patientId === patientId) : all;
            } catch (e) { return []; }
        },
        addToHistory(patientId, question, answer, warnings) {
            try {
                const all = JSON.parse(localStorage.getItem(this.historyKey)) || [];
                all.push({
                    patientId,
                    question,
                    answer,
                    warnings: warnings || [],
                    ts: Date.now()
                });
                // Keep last 100 questions per session
                localStorage.setItem(this.historyKey, JSON.stringify(all.slice(-100)));
            } catch (e) { /* ignore */ }
        },

        // ---------------------------------------------------------------
        // Serverless LLM (Gemini via /api/doctor — key lives in Vercel env)
        // Returns { answer, source } where source is 'gemini' on success or
        // 'local' when the backend has no key / is unreachable.
        // ---------------------------------------------------------------
        async callDoctor(question, profile, history) {
            try {
                const resp = await fetch('/api/doctor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question, profile, history: history || [] })
                });
                if (!resp.ok) return { answer: '', source: 'local' };
                const data = await resp.json();
                if (!data || !data.answer) return { answer: '', source: 'local' };
                return { answer: data.answer, source: data.source || 'gemini' };
            } catch (e) {
                console.warn('AI Doctor API unreachable, using local knowledge:', e);
                return { answer: '', source: 'local' };
            }
        },

        // ---------------------------------------------------------------
        // Core: answer a question
        // ---------------------------------------------------------------
        async answer(patientId, question) {
            const ctx = this.buildContext(patientId);
            const conflicts = this.detectConflicts(ctx);

            if (!question.trim()) {
                this.addMessage('assistant', 'Please type a health question so I can help you. 💙', '');
                return;
            }

            // Profile-aware conflict warnings (checked before answering)
            const warnings = [];
            if (conflicts.length > 0) {
                warnings.push('Medicine conflict alert: ' + conflicts.map(m =>
                    `"${m.name}" contains ${m.conflict}, which is on your allergy list.`
                ).join(' '));
            }

            // Build patient context string for the model
            const profileText = this.profileToText(ctx);

            // Build conversation history (last several turns) for context
            const history = this.getHistory(patientId).slice(-10).map(h => [
                { role: 'user', content: h.question },
                { role: 'assistant', content: h.answer.replace(/<[^>]+>/g, '') }
            ]).flat();

            const res = await this.callDoctor(question, profileText, history);
            const usedAI = res.source === 'gemini';
            const answer = usedAI ? res.answer : this.localAnswer(ctx, question, conflicts);

            this.addMessage('assistant', answer, usedAI ? 'gemini' : 'local', warnings);
            this.addToHistory(ctx.patient ? ctx.patient.id : '', question, answer, warnings);

            if (window.lucide) lucide.createIcons();
        },

        profileToText(ctx) {
            let s = '';
            if (ctx.patient) {
                s += `Patient: ${ctx.patient.name}, age ${ctx.age || 'unknown'}, blood ${ctx.blood || 'unknown'}, ` +
                     `allergies: ${ctx.rawAllergies || 'none on file'}, conditions: ${ctx.conditions || 'none'}\n`;
            }
            s += 'Medicines ' + (ctx.hasMedicines ? '(tracked):' : '(none tracked):') + '\n';
            ctx.medicines.forEach(m => {
                s += `- ${m.name} (${m.dosage}), times: ${m.times}, with meals: ${m.meal}, category: ${m.category}` +
                     (m.conflict ? ` [ALLERGY CONFLICT: ${m.conflict}]` : '') + '\n';
            });
            s += `Adherence (today): ${ctx.adherence}%`;
            return s;
        },

        // ---------------------------------------------------------------
        // Local rule-based fallback knowledge base
        // ---------------------------------------------------------------
        localAnswer(ctx, question, conflicts) {
            const q = question.toLowerCase();
            const med = ctx.medicines[0];

            // Allergy warnings take priority
            if (conflicts.length > 0) {
                return '⚠ Heads-up before I answer: ' + conflicts.map(c =>
                    `"${c.name}" contains <strong>${c.conflict}</strong>, which appears on your allergy list. ` +
                    'Please stop taking it and contact your doctor about a safer alternative.'
                ).join(' ') + ' I can help with general guidance in the meantime.';
            }

            // Medicine-related questions
            if (/(medicine|medication|pill|tablet|drug|prescription|dose|dosage|schedule|take)/.test(q)) {
                if (!ctx.hasMedicines) {
                    return 'You currently have no medicines tracked in your cabinet. I can only give generic advice until you add them. In general: take medicines at consistent times, follow the label, and never double a missed dose. Always confirm with your doctor.';
                }
                return 'Here’s what I see for your doses:\n\n' + ctx.medicines.map(m =>
                    '• <strong>' + this.esc(m.name) + '</strong> (' + this.esc(m.dosage) + ') — ' +
                    'take at: ' + this.esc(m.times) + ', with meals: ' + this.esc(m.meal)
                ).join('\n') + '\n\n✅ Today’s adherence is ' + ctx.adherence + '%. If you miss a dose near the next scheduled time, skip the missed one — never double up. This is educational; confirm specifics with your pharmacist.';
            }

            if (/(side effect|reaction|affect|how does|what does|works)/.test(q)) {
                return 'For a medicine: ' + (med ? this.esc(med.name) : 'your medicine') + ' — common side effects depend on the drug and your health. Since side effects can vary, please read the leaflet that came with it and tell your doctor about anything unusual (rash, swelling, dizziness, nausea). I cannot diagnose, but I can explain: most side effects are temporary, and taking with food often eases stomach upset. Always confirm with your real doctor.';
            }

            if (/(allerg|allergic|penicil|react)/.test(q)) {
                if (ctx.allergies.length) {
                    return 'Your profile lists these allergies: <strong>' + this.esc(ctx.rawAllergies) + '</strong>. Any medicine containing these should be avoided. If you develop hives, swelling, or trouble breathing, seek emergency care right away. Always mention your allergies to every pharmacist and doctor. This is educational guidance — your doctor decides what is safe.';
                }
                return 'You have no allergies on file. Still, allergies can develop anytime, so always tell your pharmacist about anything you suspect. If you get hives or swelling after a medicine, stop it and contact a doctor or emergency services immediately.';
            }

            if (/(side effect|eat|food|diet|exercise|sleep|lifestyle)/.test(q)) {
                const cat = med ? med.category : '';
                const tips = (ctx.lifecycle && ctx.lifecycle.byCategory && ctx.lifecycle.byCategory[cat]) ? ctx.lifecycle.byCategory[cat].tips : null;
                if (tips) {
                    return 'Great lifestyle question! For your <strong>' + this.esc(cat) + '</strong> medicine, here are some supportive tips:\n\n' +
                        tips.map(t => '• ' + this.esc(t)).join('\n') +
                        '\n\nThese are educational suggestions. Please combine them with your doctor’s advice.';
                }
                return 'For general wellness: aim for balanced meals with plenty of vegetables, stay hydrated, get regular gentle exercise, keep a consistent sleep routine, and manage stress with breathing or mindfulness. These are educational tips — your doctor tailors advice to your specific health.';
            }

            // Default: empathetic educational response
            return 'That’s a great question and I’m here to help. 💙\n\nAs an educational assistant, I can explain general health and medicine topics, but I’m not a substitute for your doctor. ' +
                (ctx.hasMedicines
                    ? 'I can see your current medicines and dose schedule if you ask about them.'
                    : 'Once you add medicines to your cabinet, I can give more personalized answers.') +
                ' For anything urgent or persistent, please consult your real physician.';
        },

        // ---------------------------------------------------------------
        // UI rendering
        // ---------------------------------------------------------------
        initChat() {
            const patientSelect = document.getElementById('aiDoctorPatientSelect');
            if (!patientSelect) return;

            const patients = (window.Care && Care.getAll()) || [];
            const curr = this.currentPatientId || patients[0]?.id || '';
            patientSelect.innerHTML = patients.map(p =>
                `<option value="${p.id}" ${p.id === curr ? 'selected' : ''}>${this.esc(p.name)} (Age ${this.esc(p.age)})</option>`
            ).join('') || '<option value="">No patients yet</option>';
        },

        currentPatientId: null,

        render(selectedId) {
            this.initChat();
            this.currentPatientId = selectedId ||
                document.getElementById('aiDoctorPatientSelect')?.value ||
                this.currentPatientId ||
                (window.Care && Care.getAll())[0]?.id || '';

            // Summary strip
            const ctx = this.buildContext(this.currentPatientId);
            const conflicts = this.detectConflicts(ctx);

            const sum = document.getElementById('aiDoctorSummary');
            if (sum) {
                sum.innerHTML =
                    `Medicines: <strong>${ctx.medicines.length}</strong> • Allergies: <strong>${this.esc(ctx.rawAllergies || 'none')}</strong> • ` +
                    `Conditions: <strong>${this.esc(ctx.conditions || 'none')}</strong> • Adherence: <strong>${ctx.adherence}%</strong>` +
                    (conflicts.length ? ` <span class="text-rose-600 dark:text-rose-400">• ${conflicts.length} allergy conflict(s)</span>` : '');
            }

            this.renderHistory(this.currentPatientId);
        },

        renderHistory(patientId) {
            const box = document.getElementById('aiDoctorHistory');
            if (!box) return;
            const h = this.getHistory(patientId).slice(-6).reverse();
            box.innerHTML = h.length
                ? h.map(x => `
                    <div class="pb-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <p class="text-xs font-bold text-slate-800 dark:text-slate-100 mb-0.5">${this.esc(x.question)}</p>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">${this.esc(x.answer.replace(/<[^>]+>/g, ''))}</p>
                        <p class="text-[10px] text-slate-400 mt-0.5">${new Date(x.ts).toLocaleString()}</p>
                    </div>`).join('')
                : '<p class="text-xs text-slate-400">No questions asked yet.</p>';
        },

        addMessage(kind, text, mode, warnings) {
            const box = document.getElementById('aiDoctorMessages');
            if (!box) return;

            const isUser = kind === 'user';
            const wrapper = document.createElement('div');
            wrapper.className = 'flex ' + (isUser ? 'justify-end' : 'justify-start');

            wrapper.innerHTML = `
                <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                        ? 'bg-gradient-to-r from-brand-600 to-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/40'
                }">
                    ${warnings && warnings.length ? warnings.map(w =>
                        `<div class="mb-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs">${this.esc(w)}</div>`
                    ).join('') : ''}
                    <p class="whitespace-pre-line">${isUser ? this.esc(text) : this.formatAnswer(text)}</p>
                    ${!isUser && mode ? `<p class="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/40 text-[10px] text-slate-400 flex items-center gap-1">${
                        mode === 'gemini' ? '<i data-lucide="sparkles" class="w-3 h-3"></i> AI generated' : '<i data-lucide="cpu" class="w-3 h-3"></i> Local knowledge'
                    }</p>` : ''}
                    ${!isUser ? `<p class="mt-1 text-[10px] text-slate-400">Educational info — not a diagnosis. Please consult your doctor for medical decisions.</p>` : ''}
                </div>
            `;
            box.appendChild(wrapper);
            box.scrollTop = box.scrollHeight;
        },

        formatAnswer(text) {
            // Render bullet lists and keep normal text
            return this.esc(text)
                .replace(/\n+/g, '<br>')
                .replace(/<br>\s*•\s+/g, '<br>• ');
        },

        async send() {
            const input = document.getElementById('aiDoctorInput');
            const text = (input && input.value.trim()) || '';
            if (!text) return;
            const patientId = document.getElementById('aiDoctorPatientSelect')?.value || '';

            this.addMessage('user', text, '');
            if (input) input.value = '';
            const typing = this.addTyping();
            try {
                await this.answer(patientId, text);
            } finally {
                if (typing) typing.remove();
                const box = document.getElementById('aiDoctorMessages');
                if (box) box.scrollTop = box.scrollHeight;
                this.renderHistory(patientId);
            }
        },

        addTyping() {
            const box = document.getElementById('aiDoctorMessages');
            if (!box) return null;
            const el = document.createElement('div');
            el.className = 'flex justify-start';
            el.innerHTML = '<div class="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-400">Typing…</div>';
            box.appendChild(el);
            box.scrollTop = box.scrollHeight;
            return el;
        },

        esc(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };

    window.Doctor = Doctor;
})();
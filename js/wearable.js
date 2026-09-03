/* Ciphera Health+ — Smart Wearable Integration Module
 * Syncs heart rate, sleep, and glucose readings with medicine adherence.
 * Combines vitals + missed doses to surface potential health risks.
 *
 * Storage: localStorage keys:
 *   ciphera_wearable_metrics  -> [{ id, source, deviceName, metric, value, unit, readingTime, label }]
 *   ciphera_wearable_devices  -> [{ id, brand, model, provider, connected, lastSync }]
 *
 * Loaded AFTER cloud-sync.js but BEFORE app.js.
 */
(function () {
    'use strict';

    const METRICS_KEY = 'ciphera_wearable_metrics';
    const DEVICES_KEY = 'ciphera_wearable_devices';

    const Wearable = {
        // ── Storage layer ────────────────────────────────────────────────
        getAllMetrics() {
            try { return JSON.parse(localStorage.getItem(METRICS_KEY)) || []; } catch (e) { return []; }
        },
        saveMetrics(metrics) {
            localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
        },
        addMetric(metric) {
            const metrics = this.getAllMetrics();
            const entry = {
                id: 'wm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                source: metric.source || 'manual',
                deviceName: metric.deviceName || '',
                metric: metric.metric,
                label: metric.label || this.pretty(metric.metric),
                value: Number(metric.value),
                unit: metric.unit || this.unitFor(metric.metric),
                readingTime: Number(metric.readingTime) || Date.now(),
                meta: metric.meta || {}
            };
            metrics.unshift(entry);
            this.saveMetrics(metrics);
            return entry;
        },
        getLatest(metric) {
            const all = this.getAllMetrics();
            const matches = all.filter(m => m.metric === metric).sort((a, b) => b.readingTime - a.readingTime);
            return matches.length ? matches[0] : null;
        },

        // ── Device layer ──────────────────────────────────────────────────
        getDevices() {
            try { return JSON.parse(localStorage.getItem(DEVICES_KEY)) || []; } catch (e) { return []; }
        },
        saveDevices(devices) {
            localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
        },
        connectDevice(device) {
            const devices = this.getDevices();
            const entry = {
                id: device.id || 'dev_' + Date.now(),
                brand: device.brand || 'Other',
                model: device.model || '',
                provider: device.provider || 'generic',
                connected: true,
                lastSync: Date.now()
            };
            const idx = devices.findIndex(d => d.id === entry.id);
            if (idx >= 0) devices[idx] = entry; else devices.unshift(entry);
            this.saveDevices(devices);
            return entry;
        },
        disconnectDevice(id) {
            const devices = this.getDevices().filter(d => d.id !== id);
            this.saveDevices(devices);
        },
        isConnected() {
            return this.getDevices().some(d => d.connected);
        },

        // ── Utils ─────────────────────────────────────────────────────────
        pretty(metric) {
            const map = {
                heart_rate: 'Heart Rate', resting_heart: 'Resting Heart Rate',
                spo2: 'Blood Oxygen', glucose: 'Blood Glucose', blood_glucose: 'Blood Glucose',
                systolic_bp: 'Systolic BP', diastolic_bp: 'Diastolic BP',
                sleep_hours: 'Sleep Duration', sleep: 'Sleep Duration', steps: 'Steps'
            };
            return map[metric] || String(metric).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        },
        unitFor(metric) {
            const map = { heart_rate: 'bpm', resting_heart: 'bpm', spo2: '%', glucose: 'mg/dL', blood_glucose: 'mg/dL', systolic_bp: 'mmHg', diastolic_bp: 'mmHg', sleep_hours: 'h', sleep: 'h', steps: 'steps' };
            return map[metric] || '';
        },
        esc(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },

        // ── Local (offline) risk analysis fallback ───────────────────────
        localAnalyze(metrics, medicines, logs) {
            const today = new Date().toISOString().slice(0, 10);
            const latest = {};
            for (const m of metrics) latest[m.metric] = Number(m.value);

            const signals = [];
            let risk = 0;

            if (latest.heart_rate !== undefined) {
                if (latest.heart_rate > 100) { risk += 12; signals.push({ level: 'moderate', message: `Heart rate elevated (${latest.heart_rate} bpm).` }); }
                else if (latest.heart_rate < 55) { risk += 8; signals.push({ level: 'moderate', message: `Heart rate low (${latest.heart_rate} bpm).` }); }
            }
            if (latest.glucose !== undefined) {
                if (latest.glucose > 180) { risk += 12; signals.push({ level: 'moderate', message: `Blood glucose high (${latest.glucose} mg/dL).` }); }
                else if (latest.glucose < 70) { risk += 12; signals.push({ level: 'high', message: `Blood glucose low (${latest.glucose} mg/dL). Risk of hypoglycemia.` }); }
            }
            const g = latest.glucose || latest.blood_glucose;
            const missedAnti = medicines.filter(m =>
                /diabet|insulin|glucose|metformin/i.test((m.name || '') + ' ' + (m.category || '')))
                .filter(m => {
                    const times = (m.schedule && m.schedule.times) || [];
                    return times.some(t => {
                        const log = logs.find(l => l.medicineId === m.id && l.scheduledTime === t && l.date === today);
                        return !log || log.status !== 'TAKEN';
                    });
                });
            if (g && missedAnti.length) {
                risk += 15;
                signals.push({ level: 'high', message: `High glucose + missed diabetes medication — elevated hyperglycemia risk.` });
            }
            if (latest.spo2 !== undefined && latest.spo2 < 92) {
                risk += 12; signals.push({ level: 'high', message: `Blood oxygen low (${latest.spo2}%). Seek guidance if persists.` });
            }

            risk = Math.max(0, Math.min(100, risk));
            const label = risk >= 60 ? 'High' : (risk >= 30 ? 'Elevated' : (risk >= 10 ? 'Moderate' : 'Low'));
            return { risk, riskLabel: label, signals, thresholds: latest, summary: signals.length ? signals[0].message : 'Vitals within range and adherence on track.' };
        },

        // ── Risk engine (prefers server, falls back to local) ────────────
        async analyzeRisk() {
            const metrics = this.getAllMetrics();
            const medicines = MedStore.getAll();
            const logs = MedStore.getAllLogs();

            if (typeof window.CloudSync !== 'undefined' && !CloudSync.isOffline()) {
                try {
                    const medApi = medicines.map(medToApi);
                    const logApi = logs.map(l => ({ medicine_id: l.medicineId, medicine: getMedName(l.medicineId), scheduled_time: l.scheduledTime, date: l.date, status: l.status }));
                    const patient = (window.Care && Care.getAll().length) ? Care.getAll()[0] : {};
                    const res = await fetch('/api/wearable', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ metrics, medicines: medApi, logs: logApi, patient })
                    });
                    const data = await res.json();
                    if (data && data.ok) return data;
                    throw new Error('no server result');
                } catch (e) {
                    return this.localAnalyze(metrics, medicines, logs);
                }
            }
            return this.localAnalyze(metrics, medicines, logs);

            function medToApi(m) {
                return { id: m.id, name: m.name, category: m.category || '', schedule: m.schedule || {} };
            }
            function getMedName(id) {
                const m = medicines.find(x => x.id === id);
                return m ? m.name : '';
            }
        },

        // ── Seeding demo data (so the view is alive immediately) ─────────
        ensureSeeded() {
            if (this.getAllMetrics().length > 0) return;
            const now = Date.now();
            const hour = 3600000;
            const seed = [
                { metric: 'heart_rate', label: 'Heart Rate', value: 72, unit: 'bpm', source: 'demo', deviceName: 'Demo Band', readingTime: now - 2 * hour },
                { metric: 'heart_rate', label: 'Heart Rate', value: 98, unit: 'bpm', source: 'demo', deviceName: 'Demo Band', readingTime: now - hour },
                { metric: 'glucose', label: 'Blood Glucose', value: 142, unit: 'mg/dL', source: 'demo', deviceName: 'Demo Band', readingTime: now - 3 * hour },
                { metric: 'spo2', label: 'Blood Oxygen', value: 97, unit: '%', source: 'demo', deviceName: 'Demo Band', readingTime: now - hour },
                { metric: 'sleep_hours', label: 'Sleep Duration', value: 6.5, unit: 'h', source: 'demo', deviceName: 'Demo Band', readingTime: now - 12 * hour }
            ];
            this.saveMetrics(seed.map(s => ({ id: 'wm_seed_' + Math.floor(Math.random() * 1e6), ...s })));
        },

        // ── View rendering ──────────────────────────────────────────────
        render() {
            this.ensureSeeded();
            this.renderConnection();
            this.renderLatestReadings();
            this.renderHistory();
            this.renderRisk();
            if (window.lucide) lucide.createIcons();
        },

        renderConnection() {
            const el = document.getElementById('wearableConnection');
            if (!el) return;
            const devices = this.getDevices();
            if (devices.length === 0) {
                el.innerHTML = `
                    <div class="p-6 text-center">
                        <div class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-violet-500 to-brand-600 text-white flex items-center justify-center shadow-xl shadow-brand-500/20 mb-4">
                            <i data-lucide="watch" class="w-8 h-8"></i>
                        </div>
                        <h3 class="font-bold text-slate-900 dark:text-white">Connect a wearable device</h3>
                        <p class="text-xs text-slate-500 mt-1 mb-5 max-w-sm mx-auto">Sync heart rate, sleep, and glucose data from your smartwatch or fitness band to pair with medication adherence.</p>
                        <div class="flex flex-wrap justify-center gap-2">
                            <button onclick="Wearable.pickProvider('apple')" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-2">
                                <i data-lucide="smartphone" class="w-4 h-4"></i> Apple Watch
                            </button>
                            <button onclick="Wearable.pickProvider('fitbit')" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-2">
                                <i data-lucide="activity" class="w-4 h-4"></i> Fitbit
                            </button>
                            <button onclick="Wearable.pickProvider('garmin')" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-2">
                                <i data-lucide="compass" class="w-4 h-4"></i> Garmin
                            </button>
                            <button onclick="Wearable.pickProvider('samsung')" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-2">
                                <i data-lucide="smartwatch" class="w-4 h-4"></i> Samsung
                            </button>
                            <button onclick="Wearable.pickProvider('demo')" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition flex items-center gap-2">
                                <i data-lucide="flask-conical" class="w-4 h-4"></i> Simulate Demo Band
                            </button>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-4">Demo simulation creates a sample device & readings so you can explore the feature instantly.</p>
                    </div>
                `;
                return;
            }
            el.innerHTML = devices.map(d => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white flex items-center justify-center">
                            <i data-lucide="watch" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-bold text-slate-900 dark:text-white">${this.esc(d.brand)} ${this.esc(d.model)}</h4>
                            <p class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Connected
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-slate-400">${new Date(d.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button onclick="Wearable.syncNow('${d.id}')" title="Simulate sync" class="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                        <button onclick="Wearable.disconnectDevice('${d.id}')" title="Disconnect" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                            <i data-lucide="unplug" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        },

        pickProvider(provider) {
            const brands = {
                apple: ['Apple Watch Series 10', 'HealthKit'],
                fitbit: ['Fitbit Sense 2', 'Fitbit Web API'],
                garmin: ['Garmin Venu 3', 'Garmin Health API'],
                samsung: ['Galaxy Watch 7', 'Samsung Health'],
                demo: ['Demo Band', 'Simulation']
            };
            const [model, providerName] = brands[provider] || brands.demo;
            this.connectDevice({ id: 'dev_' + provider + '_' + Date.now(), brand: provider === 'demo' ? 'Demo' : provider.charAt(0).toUpperCase() + provider.slice(1), model, provider });
            // Auto-seed a few readings on connect so it feels live
            const now = Date.now();
            const seed = provider === 'demo'
                ? [
                    { metric: 'heart_rate', label: 'Heart Rate', value: 78, unit: 'bpm' },
                    { metric: 'glucose', label: 'Blood Glucose', value: 128, unit: 'mg/dL' },
                    { metric: 'spo2', label: 'Blood Oxygen', value: 97, unit: '%' },
                    { metric: 'sleep_hours', label: 'Sleep Duration', value: 7.2, unit: 'h' }
                  ]
                : [
                    { metric: 'heart_rate', label: 'Heart Rate', value: 74, unit: 'bpm' },
                    { metric: 'spo2', label: 'Blood Oxygen', value: 98, unit: '%' },
                    { metric: 'sleep_hours', label: 'Sleep Duration', value: 7, unit: 'h' }
                  ];
            seed.forEach((s, i) => this.addMetric({ ...s, source: 'device', deviceName: model, readingTime: now - i * 900000 }));
            this.render();
            this.showToast(`Wearable connected — ${model}. Readings synced.`, 'success');
        },

        syncNow(deviceId) {
            const devices = this.getDevices();
            const d = devices.find(x => x.id === deviceId);
            if (!d) return;
            d.lastSync = Date.now();
            this.saveDevices(devices);
            // Simulate a fresh reading
            const flip = Math.random();
            const reading = [
                { metric: 'heart_rate', label: 'Heart Rate', value: 60 + Math.round(Math.random() * 30), unit: 'bpm' },
                { metric: 'spo2', label: 'Blood Oxygen', value: 95 + Math.round(Math.random() * 4), unit: '%' },
                { metric: 'glucose', label: 'Blood Glucose', value: 90 + Math.round(Math.random() * 60), unit: 'mg/dL' }
            ][Math.floor(Math.random() * 3)];
            this.addMetric({ ...reading, source: 'device', deviceName: d.brand + ' ' + d.model });
            this.render();
            this.showToast(`Synced latest ${reading.label}: ${reading.value} ${reading.unit}`, 'success');
        },

        renderLatestReadings() {
            const el = document.getElementById('wearableReadings');
            if (!el) return;
            const metrics = this.getAllMetrics();
            const cards = [
                { metric: 'heart_rate', name: 'Heart Rate', icon: 'heart-pulse', color: 'from-rose-500 to-red-600', hint: 'Resting 60–100 bpm' },
                { metric: 'glucose', name: 'Blood Glucose', icon: 'droplet', color: 'from-violet-500 to-purple-600', hint: 'Target 70–180 mg/dL' },
                { metric: 'spo2', name: 'Blood Oxygen', icon: 'wind', color: 'from-sky-500 to-blue-600', hint: 'Healthy ≥ 95%' },
                { metric: 'sleep_hours', name: 'Sleep', icon: 'moon', color: 'from-indigo-500 to-violet-600', hint: 'Target 7–9 h' }
            ];
            const latest = (metric) => this.getAllMetrics().filter(m => m.metric === metric).sort((a, b) => b.readingTime - a.readingTime)[0];

            el.innerHTML = cards.map(c => {
                const reading = latest(c.metric);
                const value = reading ? reading.value : '--';
                const unit = reading ? (reading.unit || '') : '';
                const time = reading ? new Date(reading.readingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no data';
                return `
                    <div class="glass-card rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800/60">
                        <div class="flex items-center justify-between mb-3">
                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center shadow-lg">
                                <i data-lucide="${c.icon}" class="w-4 h-4"></i>
                            </div>
                            <span class="text-[10px] text-slate-400">${time}</span>
                        </div>
                        <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${c.name}</h4>
                        <p class="text-2xl font-black text-slate-900 dark:text-white mt-0.5">${value} <span class="text-sm font-semibold text-slate-400">${unit}</span></p>
                        <p class="text-[10px] text-slate-400 mt-1">${c.hint}</p>
                    </div>
                `;
            }).join('');
        },

        renderHistory() {
            const el = document.getElementById('wearableHistory');
            if (!el) return;
            const metrics = this.getAllMetrics();
            if (metrics.length === 0) {
                el.innerHTML = '<p class="text-xs text-slate-400 italic">No readings yet. Connect a device or add a manual reading.</p>';
                return;
            }
            el.innerHTML = metrics.slice(0, 12).map(m => `
                <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/50 transition">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                            <i data-lucide="activity" class="w-3.5 h-3.5"></i>
                        </span>
                        <span class="font-semibold text-slate-700 dark:text-slate-300">${this.esc(m.label || this.pretty(m.metric))}</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-slate-900 dark:text-white">${m.value} ${this.esc(m.unit || '')}</span>
                        <span class="text-[10px] text-slate-400 block">${this.esc(m.deviceName || 'Manual')} • ${new Date(m.readingTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            `).join('');
        },

        async renderRisk() {
            const el = document.getElementById('wearableRisk');
            if (!el) return;
            el.innerHTML = '<div class="p-6 text-center text-slate-400 text-xs"><i data-lucide="loader" class="w-5 h-5 animate-spin mx-auto mb-2"></i>Analyzing vitals + adherence...</div>';
            if (window.lucide) lucide.createIcons();

            const result = await this.analyzeRisk();
            const color = result.riskLabel === 'High' ? 'red' : (result.riskLabel === 'Elevated' ? 'amber' : (result.riskLabel === 'Moderate' ? 'yellow' : 'emerald'));
            const colorMap = {
                red: 'text-red-300 border-red-500/40',
                amber: 'text-amber-300 border-amber-500/40',
                yellow: 'text-yellow-300 border-yellow-500/40',
                emerald: 'text-emerald-300 border-emerald-500/40'
            };
            const ringMap = { red: '#ef4444', amber: '#f59e0b', yellow: '#eab308', emerald: '#10b981' };

            el.innerHTML = `
                <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div class="relative w-32 h-32 shrink-0">
                        <svg viewBox="0 0 120 120" class="w-32 h-32 -rotate-90">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="12" class="text-slate-200 dark:text-slate-800" />
                            <circle cx="60" cy="60" r="52" fill="none" stroke="${ringMap[color]}" stroke-width="12" stroke-linecap="round"
                                stroke-dasharray="326.73" stroke-dashoffset="${326.73 - (326.73 * result.risk / 100)}" style="transition: stroke-dashoffset 1s ease" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <span class="text-3xl font-black ${colorMap[color].split(' ')[0]}">${result.risk}</span>
                            <span class="text-[10px] font-bold uppercase tracking-wider ${colorMap[color].split(' ')[0]} opacity-70">Risk</span>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-black uppercase tracking-widest ${colorMap[color].split(' ')[0]}">${result.riskLabel} Risk Level</h4>
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${this.esc(result.summary)}</p>
                        <div class="mt-3 space-y-2">
                            ${(result.signals || []).slice(0, 5).map(s => `
                                <div class="flex items-start gap-2 text-xs p-2.5 rounded-xl border ${s.level === 'high' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300' : (s.level === 'moderate' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300')}">
                                    <i data-lucide="${s.level === 'high' ? 'alert-triangle' : 'alert-circle'}" class="w-4 h-4 mt-0.5 shrink-0"></i>
                                    <span>${this.esc(s.message || s.label)}</span>
                                </div>
                            `).join('') || '<p class="text-xs text-slate-400 italic">No risk signals detected.</p>'}
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        },

        // ── Manual entry ────────────────────────────────────────────────
        openManualEntry() {
            const modal = document.getElementById('wearableManualModal');
            if (modal) modal.classList.remove('hidden');
        },
        closeManualEntry() {
            const modal = document.getElementById('wearableManualModal');
            if (modal) modal.classList.add('hidden');
        },
        addManualReading() {
            const metric = document.getElementById('wmMetric').value;
            const value = document.getElementById('wmValue').value;
            if (!metric || value === '' || isNaN(Number(value))) {
                this.showToast('Please choose a metric and enter a numeric value.', 'error');
                return;
            }
            this.addMetric({ metric, value: Number(value), source: 'manual', deviceName: 'Manual Entry' });
            this.closeManualEntry();
            this.render();
            this.showToast(`Recorded ${this.pretty(metric)}: ${value} ${this.unitFor(metric)}`, 'success');
        },

        showToast(msg, type) {
            if (window.App && App.showToast) return App.showToast(msg, type);
            alert(msg);
        }
    };

    window.Wearable = Wearable;
})();

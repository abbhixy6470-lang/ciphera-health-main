/* Ciphera Health+ — Cloud Sync (Vercel Postgres backend)
 * Bridges the app's localStorage data model to the /api sync endpoint. Strategy:
 *   - Server is the source of truth. On boot we `pull()`; after any local
 *     mutation we debounced `push()` the full bundle.
 *   - Works 100% offline: when the API is unreachable, the app keeps using
 *     localStorage and retries later.
 *
 * Loaded AFTER store.js and patients.js but BEFORE app.js.
 */
(function () {
    'use strict';

    const CONFIG = {
        syncUrl: '/api/sync',
        deviceKeyStorage: 'ciphera_device_key',
        syncLagStorage: 'ciphera_last_sync',
        offlineCache: 'ciphera_sync_offline',
        watchKeys: [
            'medguard_medicines',
            'medguard_logs',
            'medguard_settings',
            'ciphera_patients',
            'ciphera_doctor_history',
            'ciphera_medical_records'
        ]
    };

    // ── device / profile key ─────────────────────────────────────────────
    function deviceKey() {
        let k = localStorage.getItem(CONFIG.deviceKeyStorage);
        if (!k) {
            k = 'dev_' + (crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
            try { localStorage.setItem(CONFIG.deviceKeyStorage, k); } catch (e) {}
        }
        return k;
    }

    // ── field mapping helpers ───────────────────────────────────────────┐
    const MED_FWD = { expiryDate: 'expiry_date', batchNo: 'batch_no', openedDate: 'opened_date', storageLocation: 'storage_location' };
    function medToApi(m) {
        const out = { id: m.id, name: m.name, generic: m.generic || '', category: m.category || '', form: m.form || '', dosage: m.dosage || '', stock: m.stock || 0, notes: m.notes || '', schedule: m.schedule || {} };
        out.expiry_date = m.expiryDate || '';
        out.batch_no = m.batchNo || '';
        out.opened_date = m.openedDate || '';
        out.storage_location = m.storageLocation || '';
        return out;
    }
    function medFromApi(r) {
        return {
            id: r.id, name: r.name, generic: r.generic || '', category: r.category || '', form: r.form || '',
            dosage: r.dosage || '', stock: r.stock || 0, notes: r.notes || '', schedule: r.schedule || {},
            expiryDate: r.expiry_date || '', batchNo: r.batch_no || '', openedDate: r.opened_date || '',
            storageLocation: r.storage_location || ''
        };
    }

    const LOG_FWD = { scheduledTime: 'scheduled_time' };
    function logToApi(l) {
        return { id: l.id, medicine_id: l.medicineId, date: l.date, scheduled_time: l.scheduledTime, status: l.status, timestamp: new Date(l.timestamp).getTime(), notes: l.notes || '', actor: l.actor || 'Patient' };
    }
    function logFromApi(r) {
        return { id: r.id, medicineId: r.medicine_id, date: r.date, scheduledTime: r.scheduled_time, status: r.status, timestamp: new Date(r.timestamp || Date.now()).toISOString(), notes: r.notes || '', actor: r.actor || 'Patient' };
    }

    function patientToApi(p) {
        return { id: p.id, name: p.name || '', age: p.age, blood: p.blood, relation: p.relation || 'Self', allergies: p.allergies || '', conditions: p.conditions || '', contact: p.contact || '' };
    }
    function patientFromApi(r) {
        return { id: r.id, name: r.name, age: r.age, blood: r.blood, relation: r.relation || 'Self', allergies: r.allergies || '', conditions: r.conditions || '', contact: r.contact || '', createdAt: Date.now() };
    }

    function historyToApi(h) {
        return { id: h.id, question: h.question, answer: h.answer, warnings: h.warnings || [], ts: h.ts };
    }
    function historyFromApi(r) {
        return { id: r.id, patientId: r.patient_id || 'p_self', question: r.question, answer: r.answer, warnings: r.warnings || [], ts: r.ts };
    }

    function recordToApi(r) {
        return {
            id: r.id, title: r.title || 'Untitled record', type: r.type || 'Report',
            recordDate: r.recordDate || r.date || '', patientId: r.patientId || '',
            facility: r.facility || '', doctor: r.doctor || '',
            resultSummary: r.resultSummary || r.results || '', notes: r.notes || '',
            fields: r.fields || [], createdAt: r.createdAt || Date.now()
        };
    }
    function recordFromApi(r) {
        return {
            id: r.id, title: r.title || 'Untitled record', type: r.type || 'Report',
            recordDate: r.recordDate || '', patientId: r.patientId || '',
            facility: r.facility || '', doctor: r.doctor || '',
            resultSummary: r.resultSummary || '', notes: r.notes || '',
            fields: r.fields || [], createdAt: r.createdAt || Date.now()
        };
    }

    // ── bundle builders ─────────────────────────────────────────────────
    function buildLocalBundle() {
        const medicines = MedStore.getAll().map(medToApi);
        const logs = MedStore.getAllLogs().map(logToApi);
        const settings = MedStore.getSettings();
        const patients = (window.Care && Care.getAll() || []).map(patientToApi);
        const doctorHistory = JSON.parse(localStorage.getItem('ciphera_doctor_history') || '[]').map(historyToApi);
        const records = JSON.parse(localStorage.getItem('ciphera_medical_records') || '[]').map(recordToApi);
        return { medicines, logs, settings, patients, doctorHistory, records };
    }

    function applyServerBundle(bundle) {
        if (!bundle) return;
        const meds = (bundle.medicines || []).map(medFromApi);
        const logs = (bundle.logs || []).map(logFromApi);
        localStorage.setItem('medguard_medicines', JSON.stringify(meds));
        localStorage.setItem('medguard_logs', JSON.stringify(logs));
        if (bundle.settings && typeof bundle.settings === 'object') {
            const s = bundle.settings;
            s.theme = s.theme || 'light';
            localStorage.setItem('medguard_settings', JSON.stringify(s));
        }
        const patients = (bundle.patients || []).map(patientFromApi);
        if (window.Care) Care.save(patients);
        if (bundle.doctorHistory && Array.isArray(bundle.doctorHistory)) {
            localStorage.setItem('ciphera_doctor_history', JSON.stringify(bundle.doctorHistory.map(historyFromApi)));
        }
        if (bundle.records && Array.isArray(bundle.records)) {
            localStorage.setItem('ciphera_medical_records', JSON.stringify(bundle.records.map(recordFromApi)));
        }
    }

    // ── API calls ───────────────────────────────────────────────────────
    function api(url, options) {
        return fetch(url, options).then(r => r.json()).then(d => {
            if (d && d.ok) return d;
            throw new Error((d && d.error) || 'API error');
        });
    }

    async function pull() {
        try {
            const d = await api(CONFIG.syncUrl + '?key=' + encodeURIComponent(deviceKey()), { method: 'GET' });
            const b = d.bundle;
            if (b) {
                const serverHasData = (b.medicines && b.medicines.length)
                    || (b.patients && b.patients.length)
                    || (b.logs && b.logs.length);
                if (serverHasData) {
                    // Server is authoritative — overwrite local with cloud data.
                    applyServerBundle(b);
                    localStorage.setItem(CONFIG.syncLagStorage, String(Date.now()));
                    localStorage.removeItem(CONFIG.offlineCache);
                } else {
                    // First contact with an empty DB: push the local (seeded) data up
                    // so the device becomes the cloud source of truth.
                    await push();
                }
            }
            return true;
        } catch (e) {
            localStorage.setItem(CONFIG.offlineCache, '1');
            return false;
        }
    }

    let pushTimer = null;
    function schedulePush(delay = 1200) {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(push, delay);
    }
    async function push() {
        pushTimer = null;
        try {
            const body = buildLocalBundle();
            const d = await api(CONFIG.syncUrl + '?key=' + encodeURIComponent(deviceKey()), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (d.saved) {
                localStorage.setItem(CONFIG.syncLagStorage, String(Date.now()));
                localStorage.removeItem(CONFIG.offlineCache);
            }
        } catch (e) {
            localStorage.setItem(CONFIG.offlineCache, '1');
        }
    }

    // ── wire into existing write paths with zero modifications ─────────
    const _origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        _origSetItem.call(this, key, value);
        if (CONFIG.watchKeys.indexOf(key) !== -1) schedulePush();
    };
    const _origRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
        _origRemoveItem.call(this, key);
        if (CONFIG.watchKeys.indexOf(key) !== -1) schedulePush();
    };

    const CloudSync = {
        pull,
        push,
        schedulePush,
        deviceKey,
        isOffline: () => localStorage.getItem(CONFIG.offlineCache) === '1',
        lastSync: () => Number(localStorage.getItem(CONFIG.syncLagStorage)) || 0
    };

    window.CloudSync = CloudSync;

    // Boot: pull latest from cloud before the app renders. The app calls
    // CloudSync.boot() from MedStore.init()/App after DOM ready.
    CloudSync.boot = async function () {
        await pull();
        return true;
    };
})();
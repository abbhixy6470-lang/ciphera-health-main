/**
 * LocalStorage Data Store & Medical Database Initializer
 * MedGuard Storage Module
 */

const MedStore = {
    KEYS: {
        MEDICINES: 'medguard_medicines',
        LOGS: 'medguard_logs',
        SETTINGS: 'medguard_settings'
    },

    init() {
        if (!localStorage.getItem(this.KEYS.MEDICINES)) {
            this.seedDefaultData();
        }
    },

    /**
     * Create default initial sample data relative to today's date
     */
    seedDefaultData() {
        const today = new Date();

        const formatDateRel = (daysOffset) => {
            const d = new Date(today);
            d.setDate(today.getDate() + daysOffset);
            return d.toISOString().split('T')[0];
        };

        const initialMeds = [
            {
                id: 'med-001',
                name: 'Amoxicillin 500mg',
                generic: 'Amoxicillin Trihydrate',
                category: 'Antibiotics',
                form: 'Capsule',
                dosage: '500 mg (1 Capsule)',
                batchNo: 'AMX-98214',
                mfgDate: formatDateRel(-350),
                expiryDate: formatDateRel(12), // Expiring in 12 days!
                openedDate: null,
                stock: 14,
                storageLocation: 'Bedroom Medicine Box (Dry)',
                notes: 'Complete full 7-day course. Do not stop midway.',
                schedule: {
                    enabled: true,
                    times: ['08:00', '14:00', '20:00'],
                    mealRelation: 'After Food',
                    instructions: 'Take with full glass of water'
                }
            },
            {
                id: 'med-002',
                name: 'Ofloxacin Eye Drops 0.3%',
                generic: 'Ofloxacin Ophthalmic Solution',
                category: 'Ophthalmic (Eye Drops)',
                form: 'Eye Drops',
                dosage: '2 drops in right eye',
                batchNo: 'OFL-77120',
                mfgDate: formatDateRel(-200),
                expiryDate: formatDateRel(-8), // Expired 8 days ago!
                openedDate: formatDateRel(-35), // Opened 35 days ago (Rule of 28 days triggered!)
                stock: 1,
                storageLocation: 'Cool Dry Cabinet',
                notes: 'For conjunctivitis treatment.',
                schedule: {
                    enabled: true,
                    times: ['09:00', '21:00'],
                    mealRelation: 'No meal restriction',
                    instructions: 'Wash hands before applying. Do not touch dropper tip to eye.'
                }
            },
            {
                id: 'med-003',
                name: 'Metformin 500mg ER',
                generic: 'Metformin Hydrochloride Extended Release',
                category: 'Antidiabetic / Insulin',
                form: 'Tablet',
                dosage: '1 Tablet (500mg)',
                batchNo: 'MET-44109',
                mfgDate: formatDateRel(-180),
                expiryDate: formatDateRel(380), // Safe: ~1 year valid
                openedDate: null,
                stock: 45,
                storageLocation: 'Kitchen Pantry Drawer',
                notes: 'Daily maintenance for type-2 diabetes blood sugar management.',
                schedule: {
                    enabled: true,
                    times: ['08:30', '20:30'],
                    mealRelation: 'With Food',
                    instructions: 'Take with morning and evening meals to minimize GI discomfort.'
                }
            },
            {
                id: 'med-004',
                name: 'Amlodipine 5mg',
                generic: 'Amlodipine Besylate',
                category: 'Cardiovascular / Blood Pressure',
                form: 'Tablet',
                dosage: '1 Tablet (5mg)',
                batchNo: 'AML-10293',
                mfgDate: formatDateRel(-120),
                expiryDate: formatDateRel(520), // Safe
                openedDate: null,
                stock: 28,
                storageLocation: 'Master Bedroom Nightstand',
                notes: 'Hypertension control. Do not skip daily dose.',
                schedule: {
                    enabled: true,
                    times: ['08:00'],
                    mealRelation: 'Before Food',
                    instructions: 'Take first thing in the morning.'
                }
            },
            {
                id: 'med-005',
                name: 'Paracetamol 650mg',
                generic: 'Acetaminophen / Paracetamol',
                category: 'Pain Relievers & NSAIDs',
                form: 'Tablet',
                dosage: '1 Tablet as needed',
                batchNo: 'PCM-66019',
                mfgDate: formatDateRel(-90),
                expiryDate: formatDateRel(700), // Safe
                openedDate: null,
                stock: 20,
                storageLocation: 'First Aid Kit',
                notes: 'For occasional fever or headache. Max 4 tablets in 24 hours.',
                schedule: {
                    enabled: false,
                    times: [],
                    mealRelation: 'With or without food',
                    instructions: 'Take when needed (SOS) with at least 4-6 hours between doses.'
                }
            },
            {
                id: 'med-006',
                name: 'Vitamin D3 60K Softgel',
                generic: 'Cholecalciferol 60,000 IU',
                category: 'Vitamins & Supplements',
                form: 'Softgel',
                dosage: '1 Softgel weekly',
                batchNo: 'VIT-33019',
                mfgDate: formatDateRel(-60),
                expiryDate: formatDateRel(450),
                openedDate: null,
                stock: 6,
                storageLocation: 'Dining Area Cupboard',
                notes: 'Weekly bone & immunity supplement.',
                schedule: {
                    enabled: true,
                    times: ['13:00'],
                    mealRelation: 'With Food',
                    instructions: 'Take with Sunday lunch (fats aid absorption).'
                }
            }
        ];

        // Default initial dose logs for today so adherence displays beautifully right away
        const todayStr = today.toISOString().split('T')[0];
        const initialLogs = [
            {
                id: 'log-001',
                medicineId: 'med-004',
                date: todayStr,
                scheduledTime: '08:00',
                status: 'TAKEN',
                timestamp: new Date(today.setHours(8, 2, 0, 0)).toISOString(),
                notes: 'Taken on time with water'
            },
            {
                id: 'log-002',
                medicineId: 'med-001',
                date: todayStr,
                scheduledTime: '08:00',
                status: 'TAKEN',
                timestamp: new Date(today.setHours(8, 15, 0, 0)).toISOString(),
                notes: 'Taken after breakfast'
            }
        ];

        const defaultSettings = {
            theme: 'light',
            audioEnabled: true,
            pushNotificationsEnabled: true,
            expiringSoonThreshold: 30
        };

        localStorage.setItem(this.KEYS.MEDICINES, JSON.stringify(initialMeds));
        localStorage.setItem(this.KEYS.LOGS, JSON.stringify(initialLogs));
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(defaultSettings));
    },

    getAll() {
        try {
            const data = localStorage.getItem(this.KEYS.MEDICINES);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    getById(id) {
        return this.getAll().find(m => m.id === id) || null;
    },

    save(medicine) {
        const medicines = this.getAll();
        if (!medicine.id) {
            medicine.id = 'med-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
            medicines.unshift(medicine);
        } else {
            const idx = medicines.findIndex(m => m.id === medicine.id);
            if (idx >= 0) {
                medicines[idx] = medicine;
            } else {
                medicines.unshift(medicine);
            }
        }
        localStorage.setItem(this.KEYS.MEDICINES, JSON.stringify(medicines));
        return medicine;
    },

    delete(id) {
        let medicines = this.getAll();
        medicines = medicines.filter(m => m.id !== id);
        localStorage.setItem(this.KEYS.MEDICINES, JSON.stringify(medicines));
    },

    refillStock(id, count = 30) {
        const med = this.getById(id);
        if (med) {
            med.stock = (parseInt(med.stock) || 0) + count;
            this.save(med);
        }
    },

    decrementStock(id, count = 1) {
        const med = this.getById(id);
        if (med && med.stock !== undefined && med.stock !== null) {
            med.stock = Math.max(0, (parseInt(med.stock) || 0) - count);
            this.save(med);
        }
    },

    // Dose Logs
    getAllLogs() {
        try {
            const data = localStorage.getItem(this.KEYS.LOGS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    getLogsForDate(dateStr) {
        return this.getAllLogs().filter(l => l.date === dateStr);
    },

    logDose(medicineId, scheduledTime, status = 'TAKEN', notes = '', actor) {
        const todayStr = new Date().toISOString().split('T')[0];
        const logs = this.getAllLogs();

        // Default actor: who is driving the app right now (patient or caregiver)
        let who = actor || 'Patient';
        if (typeof window.CaregiverAuth !== 'undefined') {
            const cur = window.CaregiverAuth.currentActor();
            who = actor || (cur.role === 'caregiver' ? `Caregiver: ${cur.name}` : 'Patient');
        }

        // Check if existing log for today and scheduledTime
        const idx = logs.findIndex(l => l.medicineId === medicineId && l.scheduledTime === scheduledTime && l.date === todayStr);

        const logEntry = {
            id: 'log-' + Date.now(),
            medicineId,
            date: todayStr,
            scheduledTime,
            status, // TAKEN, SKIPPED, SNOOZED
            timestamp: new Date().toISOString(),
            notes,
            actor: who
        };

        if (idx >= 0) {
            logs[idx] = logEntry;
        } else {
            logs.unshift(logEntry);
        }

        localStorage.setItem(this.KEYS.LOGS, JSON.stringify(logs));

        // If status is TAKEN, decrement stock by 1
        if (status === 'TAKEN') {
            this.decrementStock(medicineId, 1);
        }

        return logEntry;
    },

    // Settings
    getSettings() {
        try {
            const data = localStorage.getItem(this.KEYS.SETTINGS);
            return data ? JSON.parse(data) : { theme: 'light', audioEnabled: true, pushNotificationsEnabled: true };
        } catch (e) {
            return { theme: 'light', audioEnabled: true, pushNotificationsEnabled: true };
        }
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    }
};

window.MedStore = MedStore;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MedStore;
}

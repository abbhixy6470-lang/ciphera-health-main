/**
 * Medication Reminder, Alarm Engine & Web Audio Synthesizer
 * MedGuard Real-Time Adherence Controller
 */

const ReminderAlarm = {
    audioCtx: null,
    alarmInterval: null,
    snoozedAlarms: [], // Array of { medId, doseTime, snoozeUntilTimestamp, medName, dosage }
    activeModalCallback: null,
    lastTriggeredMinute: null,

    init() {
        this.startTicker();
        // Setup notification permission state check
        if ('Notification' in window && Notification.permission === 'default') {
            // Can be requested on user interaction
        }
    },

    /**
     * Web Audio API Synthesizer (Generates pleasant medical chimes without external audio files)
     */
    getAudioContext() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    },

    playChime(type = 'gentle') {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            
            if (type === 'gentle') {
                // Harmonic medical chime: E5 -> G#5 -> B5 -> E6
                const notes = [659.25, 830.61, 987.77, 1318.51];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.12);

                    gain.gain.setValueAtTime(0, now + idx * 0.12);
                    gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + idx * 0.12);
                    osc.stop(now + idx * 0.12 + 0.65);
                });
            } else if (type === 'urgent') {
                // Repeating double alert beep
                [0, 0.25, 0.5, 0.75].forEach((offset) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(880, now + offset);

                    gain.gain.setValueAtTime(0, now + offset);
                    gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + offset);
                    osc.stop(now + offset + 0.2);
                });
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    },

    /**
     * Request desktop notification permission
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        try {
            const permission = await Notification.requestPermission();
            return permission;
        } catch (e) {
            return 'denied';
        }
    },

    /**
     * Show Desktop Push Notification
     */
    notify(title, body, medId) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notif = new Notification(title, {
                    body: body,
                    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%230ea5e9" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
                    requireInteraction: true,
                    tag: `med-reminder-${medId}-${Date.now()}`
                });

                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };
            } catch (err) {
                console.warn('Notification error:', err);
            }
        }
    },

    /**
     * Live Ticker: checks for scheduled medicine times every second
     */
    startTicker() {
        if (this.alarmInterval) clearInterval(this.alarmInterval);

        this.alarmInterval = setInterval(() => {
            this.checkReminders();
            this.checkCriticalMisses(); // notify the patient on critical missed doses
        }, 1000);
    },

    /**
     * Notify the patient of a reminder event.
     */
    notifyBoth(title, body, medId) {
        this.notify(title, body, medId);
    },

    /**
     * Detect critical missed doses: a scheduled time has passed beyond the
     * grace window and the dose was neither taken nor explicitly skipped.
     * On detection, immediately notify both patient and caregiver.
     */
    checkCriticalMisses() {
        if (!window.MedStore) return;
        const gateKey = 'ciphera_critical_notified';
        let notified = {};
        try { notified = JSON.parse(localStorage.getItem(gateKey)) || {}; } catch (e) {}

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const graceMs = 45 * 60 * 1000; // 45 minutes grace
        const nowTs = now.getTime();
        const medicines = window.MedStore.getAll();
        const logs = window.MedStore.getAllLogs();

        let changed = false;
        medicines.forEach(med => {
            if (!med.schedule || !med.schedule.enabled || !med.schedule.times) return;
            med.schedule.times.forEach(time => {
                // This time slot will become critical only after it has passed today
                const [hh, mm] = time.split(':').map(Number);
                const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
                const slotTs = slotDate.getTime();
                if (slotTs > nowTs - graceMs) return; // not yet critical

                const key = `${todayStr}|${med.id}|${time}`;
                if (notified[key]) return; // already alerted this slot

                const logged = logs.some(l =>
                    l.medicineId === med.id && l.scheduledTime === time && l.date === todayStr);
                if (logged) return; // taken or skipped, not missed

                const criticalTitle = `⚠️ CRITICAL: ${med.name} dose was missed`;
                const criticalBody =
                    `The ${time} dose of ${med.name} (${med.dosage || '1 unit'}) was not recorded. ` +
                    `Please confirm it was taken or skipped immediately.`;
                this.notifyBoth(criticalTitle, criticalBody, med.id);
                // Also sound an urgent chime to grab attention in-app
                this.playChime('urgent');

                notified[key] = Date.now();
                changed = true;
                console.warn('Critical missed dose alerted:', med.name, time);
            });
        });

        if (changed) {
            try { localStorage.setItem(gateKey, JSON.stringify(notified)); } catch (e) {}
        }
    },

    /**
     * Live Ticker: checks for scheduled medicine times every second
     */
    checkReminders() {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHour}:${currentMinute}`;
        const currentMinuteKey = `${now.toDateString()} ${currentTimeStr}`;

        // Check snoozed alarms
        const currentTs = now.getTime();
        const pendingSnoozed = [];
        
        for (const snooze of this.snoozedAlarms) {
            if (currentTs >= snooze.snoozeUntilTimestamp) {
                this.triggerAlarm(snooze.medicine, snooze.doseTime, true);
            } else {
                pendingSnoozed.push(snooze);
            }
        }
        this.snoozedAlarms = pendingSnoozed;

        // Prevent multi-triggering in the exact same minute for scheduled list
        if (this.lastTriggeredMinute === currentMinuteKey) {
            return;
        }

        // Get medicines from storage
        if (!window.MedStore) return;
        const medicines = window.MedStore.getAll();
        const todayStr = now.toISOString().split('T')[0];

        medicines.forEach(med => {
            if (!med.schedule || !med.schedule.enabled || !med.schedule.times) return;

            med.schedule.times.forEach(time => {
                if (time === currentTimeStr) {
                    // Check if already taken or skipped today for this time slot
                    const logs = window.MedStore.getLogsForDate(todayStr);
                    const alreadyLogged = logs.some(l => l.medicineId === med.id && l.scheduledTime === time);

                    if (!alreadyLogged) {
                        this.lastTriggeredMinute = currentMinuteKey;
                        this.triggerAlarm(med, time, false);
                    }
                }
            });
        });
    },

    /**
     * Trigger alarm: sound + push notification + in-app alert modal
     */
    triggerAlarm(medicine, doseTime, isSnoozed = false) {
        // Expiry check
        const expiry = window.ExpiryEngine ? window.ExpiryEngine.evaluateExpiry(medicine) : { isExpired: false };
        const isExpiredWarning = expiry.isExpired;

        // Play chime sound
        this.playChime(isExpiredWarning ? 'urgent' : 'gentle');

        // Desktop push notification
        const title = isExpiredWarning 
            ? `⚠️ CRITICAL: Time for ${medicine.name} (EXPIRED MEDICATION!)`
            : `💊 Medication Reminder: ${medicine.name}`;
        
        const mealNote = medicine.schedule?.mealRelation ? ` • ${medicine.schedule.mealRelation}` : '';
        const body = `Dose: ${medicine.dosage || '1 unit'}${mealNote}\nScheduled Time: ${doseTime}${isSnoozed ? ' (Snoozed)' : ''}`;

        this.notifyBoth(title, body, medicine.id);

        // In-App Alert Modal
        if (window.App && typeof window.App.showDoseModal === 'function') {
            window.App.showDoseModal({
                medicine,
                doseTime,
                isSnoozed,
                expiry
            });
        }
    },

    /**
     * Snooze an alarm by X minutes (default 10 mins)
     */
    snooze(medicine, doseTime, minutes = 10) {
        const snoozeUntil = Date.now() + minutes * 60 * 1000;
        this.snoozedAlarms.push({
            medicine,
            doseTime,
            snoozeUntilTimestamp: snoozeUntil
        });
        
        const returnTime = new Date(snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return returnTime;
    }
};

window.ReminderAlarm = ReminderAlarm;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReminderAlarm;
}

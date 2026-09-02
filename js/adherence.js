/**
 * Medication Adherence & Streak Tracker
 * MedGuard Adherence Module
 */

const AdherenceTracker = {
    /**
     * Get today's scheduled dose items across all medicines
     */
    getTodayDoses(medicines, logs) {
        const todayStr = new Date().toISOString().split('T')[0];
        const doses = [];

        medicines.forEach(med => {
            if (!med.schedule || !med.schedule.enabled || !med.schedule.times) return;

            med.schedule.times.forEach(time => {
                // Check if a log exists for this med + time today
                const log = logs.find(l => 
                    l.medicineId === med.id && 
                    l.scheduledTime === time && 
                    l.date === todayStr
                );

                const status = log ? log.status : 'PENDING'; // PENDING, TAKEN, SKIPPED, SNOOZED
                const expiryInfo = window.ExpiryEngine ? window.ExpiryEngine.evaluateExpiry(med) : {};

                doses.push({
                    medicineId: med.id,
                    medicineName: med.name,
                    genericName: med.generic || '',
                    category: med.category || 'General / Other',
                    dosage: med.dosage || '1 dose',
                    form: med.form || 'Tablet',
                    time: time,
                    mealRelation: med.schedule.mealRelation || 'With or without food',
                    instructions: med.schedule.instructions || '',
                    status: status,
                    logTimestamp: log ? log.timestamp : null,
                    expiryInfo: expiryInfo,
                    stock: med.stock !== undefined ? med.stock : null
                });
            });
        });

        // Sort chronologically by time e.g. "08:00", "13:00", "20:00"
        return doses.sort((a, b) => a.time.localeCompare(b.time));
    },

    /**
     * Calculate Daily Adherence Percentage and Status Summary
     */
    calculateDailyScore(todayDoses) {
        if (!todayDoses || todayDoses.length === 0) {
            return {
                totalDoses: 0,
                takenCount: 0,
                skippedCount: 0,
                pendingCount: 0,
                percentage: 0,
                rating: 'No Doses Scheduled'
            };
        }

        const total = todayDoses.length;
        const taken = todayDoses.filter(d => d.status === 'TAKEN').length;
        const skipped = todayDoses.filter(d => d.status === 'SKIPPED').length;
        const pending = todayDoses.filter(d => d.status === 'PENDING').length;

        const percentage = Math.round((taken / total) * 100);

        let rating = 'On Track';
        let badgeColor = 'text-emerald-500';

        if (percentage === 100) {
            rating = 'Perfect! All doses taken';
            badgeColor = 'text-emerald-600 dark:text-emerald-400';
        } else if (percentage >= 70) {
            rating = 'Good Adherence';
            badgeColor = 'text-blue-600 dark:text-blue-400';
        } else if (percentage >= 40) {
            rating = 'Needs Attention';
            badgeColor = 'text-amber-600 dark:text-amber-400';
        } else {
            rating = pending > 0 ? `${pending} Doses Pending` : 'Poor Adherence';
            badgeColor = 'text-red-600 dark:text-red-400';
        }

        return {
            totalDoses: total,
            takenCount: taken,
            skippedCount: skipped,
            pendingCount: pending,
            percentage: percentage,
            rating: rating,
            badgeColor: badgeColor
        };
    },

    /**
     * Compute multi-day adherence streak from log history
     */
    calculateStreak(medicines, allLogs) {
        if (!medicines || medicines.length === 0) return 0;
        
        let streak = 0;
        const now = new Date();

        // Check back up to 30 days
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(now);
            checkDate.setDate(now.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            // Get total scheduled doses on this day
            let scheduledCount = 0;
            medicines.forEach(m => {
                if (m.schedule && m.schedule.enabled && m.schedule.times) {
                    scheduledCount += m.schedule.times.length;
                }
            });

            if (scheduledCount === 0) continue;

            const dayLogs = allLogs.filter(l => l.date === dateStr && l.status === 'TAKEN');
            
            // For today, if some pending doses remain but all past ones were taken, maintain streak
            if (i === 0) {
                if (dayLogs.length > 0) {
                    streak++;
                }
            } else {
                // For past days, require >= 80% taken to keep streak
                const adherence = (dayLogs.length / scheduledCount) * 100;
                if (adherence >= 80) {
                    streak++;
                } else {
                    break; // Streak broken
                }
            }
        }

        return streak;
    }
};

window.AdherenceTracker = AdherenceTracker;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdherenceTracker;
}

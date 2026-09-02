/**
 * Expiry Calculation Engine & Status Classifier
 * MedGuard Core Logic
 */

const ExpiryEngine = {
    // Threshold in days for "Expiring Soon" alert
    EXPIRING_SOON_DAYS: 30,

    /**
     * Parse date string (YYYY-MM-DD or MM/YY or MM/YYYY) into Date object
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        // If already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d, 23, 59, 59);
        }

        // If MM/YYYY or MM-YYYY
        if (/^(\d{1,2})[/-](\d{4})$/.test(dateStr)) {
            const matches = dateStr.match(/^(\d{1,2})[/-](\d{4})$/);
            const m = parseInt(matches[1], 10);
            const y = parseInt(matches[2], 10);
            // End of the given month
            return new Date(y, m, 0, 23, 59, 59);
        }

        // If MM/YY
        if (/^(\d{1,2})[/-](\d{2})$/.test(dateStr)) {
            const matches = dateStr.match(/^(\d{1,2})[/-](\d{2})$/);
            const m = parseInt(matches[1], 10);
            const y = 2000 + parseInt(matches[2], 10);
            return new Date(y, m, 0, 23, 59, 59);
        }

        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    },

    /**
     * Get days difference between two dates
     */
    getDaysDifference(targetDate, baseDate = new Date()) {
        const target = this.parseDate(targetDate);
        if (!target) return null;

        // Reset hours for clean date math
        const now = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        const exp = new Date(target.getFullYear(), target.getMonth(), target.getDate());

        const diffTime = exp.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * Compute full expiry status for a medicine
     */
    evaluateExpiry(medicine) {
        const now = new Date();
        const expiryDate = this.parseDate(medicine.expiryDate);
        
        if (!expiryDate) {
            return {
                status: 'UNKNOWN',
                badgeText: 'No Date Set',
                badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                daysRemaining: null,
                isExpired: false,
                isExpiringSoon: false,
                riskLevel: 'Low',
                warningMessage: 'Please set an expiry date to track safety.'
            };
        }

        const daysRemaining = this.getDaysDifference(medicine.expiryDate);
        let status = 'SAFE';
        let isExpired = false;
        let isExpiringSoon = false;
        let reason = 'package_date';

        // Check opened date rules (e.g. 28 days for eye drops or opened insulin)
        let openedDaysPast = null;
        let openedExpiryLimit = null;
        
        if (medicine.openedDate) {
            const openedDate = this.parseDate(medicine.openedDate);
            if (openedDate) {
                const diffOpened = this.getDaysDifference(now, openedDate); // days since opened
                openedDaysPast = Math.abs(diffOpened);
                
                // Special opened limit based on category
                if (medicine.category === 'Ophthalmic (Eye Drops)' || medicine.category === 'Antidiabetic / Insulin') {
                    openedExpiryLimit = 28;
                } else if (medicine.category === 'Antibiotics' && medicine.form === 'Oral Suspension') {
                    openedExpiryLimit = 14;
                } else if (medicine.category === 'Liquid Suspensions & Syrups') {
                    openedExpiryLimit = 90; // 3 months
                }

                if (openedExpiryLimit && openedDaysPast > openedExpiryLimit) {
                    isExpired = true;
                    status = 'EXPIRED';
                    reason = 'opened_shelf_life';
                }
            }
        }

        if (!isExpired) {
            if (daysRemaining < 0) {
                status = 'EXPIRED';
                isExpired = true;
            } else if (daysRemaining <= this.EXPIRING_SOON_DAYS) {
                status = 'EXPIRING_SOON';
                isExpiringSoon = true;
            } else {
                status = 'SAFE';
            }
        }

        // Determine Risk Level based on Category and Expiry Status
        const categoryData = PRECAUTIONS_DATA.categories[medicine.category] || PRECAUTIONS_DATA.categories['General / Other'];
        let riskLevel = 'Low';

        if (status === 'EXPIRED') {
            if (categoryData.hazardLevel === 'Severe') {
                riskLevel = 'Severe';
            } else if (categoryData.hazardLevel === 'Moderate to High' || categoryData.hazardLevel === 'High') {
                riskLevel = 'High';
            } else {
                riskLevel = 'Moderate';
            }
        } else if (status === 'EXPIRING_SOON') {
            riskLevel = categoryData.hazardLevel === 'Severe' ? 'High' : 'Moderate';
        } else {
            riskLevel = 'Safe';
        }

        // Generate badge styling & readable countdown text
        let badgeClass = '';
        let badgeText = '';
        let countdownText = '';
        let warningMessage = '';

        if (status === 'EXPIRED') {
            badgeClass = 'bg-red-100 text-red-800 border border-red-300 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800';
            if (reason === 'opened_shelf_life') {
                badgeText = 'Expired (Opened > ' + openedExpiryLimit + 'd)';
                countdownText = `Opened ${openedDaysPast} days ago (Exceeded ${openedExpiryLimit}-day safety limit)`;
                warningMessage = `CRITICAL SAFETY ALERT: This ${medicine.category} was opened ${openedDaysPast} days ago. Its sterile/chemical integrity has expired. Discard immediately.`;
            } else {
                const daysOver = Math.abs(daysRemaining);
                badgeText = 'Expired';
                countdownText = `Expired ${daysOver} day${daysOver === 1 ? '' : 's'} ago`;
                warningMessage = `CRITICAL SAFETY ALERT: Expired on ${this.formatReadableDate(medicine.expiryDate)}. Potency lost; risk of toxic degradation or treatment failure. Do not consume.`;
            }
        } else if (status === 'EXPIRING_SOON') {
            badgeClass = 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800';
            badgeText = 'Expiring Soon';
            countdownText = daysRemaining === 0 ? 'Expires Today!' : `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
            warningMessage = `WARNING: Medication expires in ${daysRemaining} days. Consider arranging a fresh refill.`;
        } else {
            badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800';
            badgeText = 'Safe & Valid';
            if (daysRemaining > 365) {
                const years = (daysRemaining / 365.25).toFixed(1);
                countdownText = `Valid for ~${years} years (${daysRemaining} days)`;
            } else if (daysRemaining > 60) {
                const months = Math.floor(daysRemaining / 30);
                countdownText = `Valid for ~${months} months (${daysRemaining} days)`;
            } else {
                countdownText = `Valid for ${daysRemaining} days`;
            }
            warningMessage = 'Medication is within valid potency window. Store properly.';
        }

        return {
            status,
            isExpired,
            isExpiringSoon,
            isSafe: status === 'SAFE',
            daysRemaining,
            badgeText,
            badgeClass,
            countdownText,
            riskLevel,
            warningMessage,
            reason,
            openedDaysPast,
            categoryInfo: categoryData
        };
    },

    /**
     * Format Date to standard human readable string e.g. "Sep 15, 2026"
     */
    formatReadableDate(dateStr) {
        const d = this.parseDate(dateStr);
        if (!d) return 'Invalid Date';
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpiryEngine;
}

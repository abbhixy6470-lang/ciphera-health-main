/**
 * MedGuard Main Application Controller
 * Wires UI, Expiry Engine, Adherence, Reminders, and OCR Scanner
 */

const App = {
    currentTab: 'dashboard',
    activeAlarmData: null,
    editingMedId: null,

    init() {
        // Initialize Storage & Alarm Ticker
        MedStore.init();
        ReminderAlarm.init();

        // Start Cloud Sync (pull latest from Postgres, then re-render with cloud data)
        if (typeof window.CloudSync !== 'undefined') {
            CloudSync.boot().then(() => {
                if (typeof window.Care !== 'undefined') Care.render();
                this.renderAllViews();
                if (typeof window.Analytics !== 'undefined') Analytics.init();
                this.refreshCurrentView && this.refreshCurrentView();
            }).catch(() => {});
        }

        // Apply Saved Theme
        this.applyTheme();

        // Start Live Clock
        this.startLiveClock();

        // Initialize UI Views
        this.renderAllViews();

        // Initialize New Modules
        Care.init();
        Analytics.init();
        AiReader.init();
        if (typeof window.Vault !== 'undefined') Vault.init();

        // Check Notification Permission State
        this.updateNotifButtonState();

        // Restore caregiver session badge (if a session persists)
        this.syncCaregiverUI();

        // Initialize Lucide Icons
        lucide.createIcons();

        // Setup Drag and drop handlers for scanner
        this.setupDropZone();
    },

    /**
     * Start live header digital clock ticker
     */
    startLiveClock() {
        const updateClock = () => {
            const now = new Date();
            const el = document.getElementById('liveClockDisplay');
            const printDateEl = document.getElementById('printDate');
            
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

            if (el) el.textContent = `${timeStr} • ${dateStr}`;
            if (printDateEl) printDateEl.textContent = `${dateStr} at ${timeStr}`;
        };
        updateClock();
        setInterval(updateClock, 1000);
    },

    /**
     * Tab Switcher
     */
    switchTab(tabId) {
        this.currentTab = tabId;

        // Update nav button states
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-950/50', 'border-brand-200', 'dark:border-brand-800', 'border', 'shadow-sm', 'shadow-brand-500/5');
            btn.classList.add('text-slate-500', 'dark:text-slate-400');
        });

        const activeBtn = document.getElementById(`tabBtn-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'text-brand-600', 'dark:text-brand-400', 'bg-brand-50', 'dark:bg-brand-950/50', 'border', 'border-brand-200', 'dark:border-brand-800', 'shadow-sm', 'shadow-brand-500/5');
            activeBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        }

        // Hide all views, show selected
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.add('hidden');
        });

        const targetPane = document.getElementById(`view-${tabId}`);
        if (targetPane) {
            targetPane.classList.remove('hidden');
        }

        // Stop camera if moving away from scanner tab
        if (tabId !== 'scanner' && OCRScanner.cameraStream) {
            this.stopScannerCamera();
        }

        // Re-render target view
        if (tabId === 'dashboard') this.renderDashboard();
        if (tabId === 'cabinet') this.renderCabinet();
        if (tabId === 'schedule') this.renderSchedule();
        if (tabId === 'analytics') Analytics.render();
        if (tabId === 'patients') Care.render();
        if (tabId === 'recommendations') this.renderRecommendations();
        if (tabId === 'ai-doctor') this.renderAIDoctor();
        if (tabId === 'vault') { if (window.Vault) Vault.render(); }

        lucide.createIcons();
    },

    renderAllViews() {
        this.renderDashboard();
        this.renderCabinet();
        this.renderSchedule();
    },

    // Recommendation tab: build the patient dropdown when first visited
    renderRecommendations() {
        if (window.Recommendations) {
            const selected = Recommendations.populatePatientSelect();
            Recommendations.render(selected);
        }
    },

    // AI Doctor tab: initialize chat UI for the selected patient
    renderAIDoctor() {
        if (window.Doctor) Doctor.render();
    },

    // Open Gemini AI settings modal
    openGeminiSettings() {
        AiReader.openSettings();
    },

    // Enter from opening screen (requires a real account login)
    async enterApp() {
        if (typeof window.Auth !== 'undefined' && Auth.isLoggedIn() === false) {
            Auth.show();
            return;
        }
        const splash = document.getElementById('openingScreen');
        if (!splash) return;
        // On entry with a live session, pull cloud data and re-render.
        if (typeof window.CloudSync !== 'undefined') {
            CloudSync.boot().then(() => {
                try { this.renderAllViews && this.renderAllViews(); } catch (e) {}
            }).catch(() => {});
        }
        // Fade out splash, then remove it and reveal app
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        document.body.classList.remove('opening-lock');
        setTimeout(() => {
            splash.remove();
            // Re-initialize icons any dynamically-rendered views
            lucide.createIcons();
        }, 550);
    },

    // Pre-fill add-medicine form from AI reader result
    prefillFromRx(rx) {
        setTimeout(() => {
            const nameEl = document.getElementById('medFormName');
            const genericEl = document.getElementById('medFormGeneric');
            const catEl = document.getElementById('medFormCategory');
            const doseEl = document.getElementById('medFormDosageAmount');
            if (nameEl && rx && rx.name) {
                nameEl.value = rx.name;
                if (genericEl) genericEl.value = rx.generic || '';
                if (catEl) {
                    const cats = Array.from(catEl.options).map(o => o.value);
                    catEl.value = cats.includes(rx.category) ? rx.category : 'General / Other';
                    this.handleCategoryChange();
                }
                if (doseEl) doseEl.value = rx.dosage || '';
            }
        }, 150);
    },

    // Prefill the add-medicine form from a recommended (allergy-safe) medicine
    prefillFromRecommendation(name) {
        const drug = ((typeof PRECAUTIONS_DATA !== 'undefined' && PRECAUTIONS_DATA.drugDatabase) || [])
            .find(d => d.name === name);
        if (!drug) return;

        this.openAddMedicineModal();
        const genericEl = document.getElementById('medFormGeneric');
        const catEl = document.getElementById('medFormCategory');
        const doseEl = document.getElementById('medFormDosageAmount');
        const formEl = document.getElementById('medFormDosageForm');
        const mealEl = document.getElementById('medFormMealRelation');

        document.getElementById('medFormName').value = drug.name;
        if (genericEl) genericEl.value = drug.generic || '';
        if (catEl) {
            const cats = Array.from(catEl.options).map(o => o.value);
            catEl.value = cats.includes(drug.category) ? drug.category : 'General / Other';
            this.handleCategoryChange();
        }
        if (doseEl) doseEl.value = drug.defaultDose || '';
        if (formEl && drug.commonForms && drug.commonForms.length) formEl.value = drug.commonForms[0];
        if (mealEl && drug.mealRule) mealEl.value = drug.mealRule;

        this.showToast('✅ Recommended medicine pre-filled. Review and add to cabinet.', 'success');
    },

    // =========================================================================
    // 1. DASHBOARD RENDERING
    // =========================================================================
    renderDashboard() {
        const medicines = MedStore.getAll();
        const logs = MedStore.getAllLogs();
        const todayDoses = AdherenceTracker.getTodayDoses(medicines, logs);
        const score = AdherenceTracker.calculateDailyScore(todayDoses);
        const streak = AdherenceTracker.calculateStreak(medicines, logs);

        // Stats calculations
        let expiredCount = 0;
        let expiringSoonCount = 0;
        let safeCount = 0;
        const expiryWatchlist = [];

        medicines.forEach(med => {
            const exp = ExpiryEngine.evaluateExpiry(med);
            if (exp.isExpired) {
                expiredCount++;
                expiryWatchlist.push({ med, exp });
            } else if (exp.isExpiringSoon) {
                expiringSoonCount++;
                expiryWatchlist.push({ med, exp });
            } else {
                safeCount++;
            }
        });

        // Update Stat Cards in DOM
        document.getElementById('statTotalMeds').textContent = medicines.length;
        document.getElementById('statSafeMeds').textContent = safeCount;
        document.getElementById('statExpiredMeds').textContent = expiredCount;
        document.getElementById('statExpiringSoonMeds').textContent = expiringSoonCount;
        document.getElementById('statAdherenceRate').textContent = `${score.percentage}%`;
        document.getElementById('statAdherenceSub').textContent = `${score.takenCount} / ${score.totalDoses} doses taken`;
        document.getElementById('statStreakBadge').innerHTML = `<i data-lucide="flame" class="w-3.5 h-3.5 text-orange-500"></i> ${streak}d streak`;

        // Update Header Badge Counters
        document.getElementById('badgeCabinetCount').textContent = medicines.length;
        document.getElementById('badgePendingDoses').textContent = `${score.pendingCount} due`;

        // Update Adherence Progress Ring
        const circle = document.getElementById('statAdherenceCircle');
        if (circle) {
            const circumference = 100;
            const offset = circumference - (score.percentage / 100) * circumference;
            circle.style.strokeDashoffset = offset;
        }

        // Render Urgent Expiry Top Banner
        const urgentBanner = document.getElementById('urgentExpiryBanner');
        if (expiredCount > 0) {
            urgentBanner.className = 'p-4 rounded-2xl bg-red-500 text-white shadow-lg flex items-center justify-between gap-4 animate-pop';
            urgentBanner.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="p-2 rounded-xl bg-white/20">
                        <i data-lucide="alert-octagon" class="w-6 h-6 text-white"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm">Urgent: You have ${expiredCount} expired medication${expiredCount === 1 ? '' : 's'}!</h4>
                        <p class="text-xs text-red-100">Expired medicines have degraded potency and high risk of toxicity. Discard them safely.</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="App.filterCabinetByStatus('EXPIRED')" class="px-3.5 py-1.5 rounded-xl bg-white text-red-600 text-xs font-bold shadow hover:bg-red-50 transition">
                        View & Discard
                    </button>
                </div>
            `;
            urgentBanner.classList.remove('hidden');
        } else if (expiringSoonCount > 0) {
            urgentBanner.className = 'p-4 rounded-2xl bg-amber-500 text-white shadow-lg flex items-center justify-between gap-4 animate-pop';
            urgentBanner.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="p-2 rounded-xl bg-white/20">
                        <i data-lucide="clock" class="w-6 h-6 text-white"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-sm">Notice: ${expiringSoonCount} medication${expiringSoonCount === 1 ? '' : 's'} expiring within 30 days!</h4>
                        <p class="text-xs text-amber-100">Arrange for timely refills before they lose therapeutic effectiveness.</p>
                    </div>
                </div>
                <button onclick="App.filterCabinetByStatus('EXPIRING_SOON')" class="px-3.5 py-1.5 rounded-xl bg-white text-amber-700 text-xs font-bold shadow hover:bg-amber-50 transition">
                    Review Refills
                </button>
            `;
            urgentBanner.classList.remove('hidden');
        } else {
            urgentBanner.classList.add('hidden');
        }

        // Render Dashboard Today's Doses List
        const dosesContainer = document.getElementById('dashTodayDosesList');
        if (todayDoses.length === 0) {
            dosesContainer.innerHTML = `
                <div class="p-8 text-center text-slate-400 dark:text-slate-500 space-y-2">
                    <i data-lucide="calendar" class="w-8 h-8 mx-auto opacity-50"></i>
                    <p class="text-xs">No doses scheduled for today.</p>
                    <button onclick="App.openAddMedicineModal()" class="text-xs text-brand-600 font-semibold hover:underline">+ Add Scheduled Medicine</button>
                </div>
            `;
        } else {
            dosesContainer.innerHTML = todayDoses.map(item => {
                const isTaken = item.status === 'TAKEN';
                const isSkipped = item.status === 'SKIPPED';
                const isPending = item.status === 'PENDING';

                return `
                    <div class="p-4 rounded-xl border ${isTaken ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' : (isSkipped ? 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm')} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
                        <div class="flex items-center gap-3">
                            <div class="px-2.5 py-1.5 rounded-xl ${isTaken ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'} font-bold text-xs flex items-center gap-1.5">
                                <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                                <span>${item.time}</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-sm text-slate-900 dark:text-white ${isTaken ? 'line-through text-slate-500 dark:text-slate-400' : ''}">${item.medicineName}</h4>
                                    ${item.expiryInfo.isExpired ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">EXPIRED</span>' : ''}
                                </div>
                                <p class="text-xs text-slate-500 dark:text-slate-400">${item.dosage} • <span class="font-medium text-slate-700 dark:text-slate-300">${item.mealRelation}</span></p>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-2">
                            ${isTaken ? `
                                <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <i data-lucide="check-circle" class="w-4 h-4"></i> Taken
                                </span>
                            ` : (isSkipped ? `
                                <span class="text-xs text-slate-400 font-medium">Skipped</span>
                            ` : `
                                <button onclick="App.logDoseQuick('${item.medicineId}', '${item.time}', 'TAKEN')" class="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
                                    <i data-lucide="check" class="w-3.5 h-3.5"></i> Take Now
                                </button>
                                <button onclick="App.logDoseQuick('${item.medicineId}', '${item.time}', 'SKIPPED')" class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium transition" title="Skip dose">
                                    Skip
                                </button>
                            `)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render Expiry Watchlist in Dashboard
        const watchlistContainer = document.getElementById('dashExpiryWatchlist');
        if (expiryWatchlist.length === 0) {
            watchlistContainer.innerHTML = `
                <div class="p-6 text-center text-slate-400 dark:text-slate-500">
                    <i data-lucide="shield-check" class="w-8 h-8 mx-auto text-emerald-500 mb-2"></i>
                    <p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">All medicines are safe & valid!</p>
                </div>
            `;
        } else {
            watchlistContainer.innerHTML = expiryWatchlist.slice(0, 4).map(({ med, exp }) => {
                return `
                    <div class="p-3 rounded-xl border ${exp.isExpired ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40' : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'} flex items-start justify-between gap-2">
                        <div>
                            <h4 class="text-xs font-bold text-slate-900 dark:text-white">${med.name}</h4>
                            <p class="text-[11px] ${exp.isExpired ? 'text-red-700 dark:text-red-400 font-semibold' : 'text-amber-700 dark:text-amber-400'} mt-0.5">
                                ${exp.countdownText}
                            </p>
                        </div>
                        <button onclick="App.openMedicineDetailModal('${med.id}')" class="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline shrink-0">
                            Precautions
                        </button>
                    </div>
                `;
            }).join('');
        }

        lucide.createIcons();
    },

    // =========================================================================
    // 2. MEDICINE CABINET RENDERING & FILTERING
    // =========================================================================
    renderCabinet() {
        const medicines = MedStore.getAll();
        const searchQuery = (document.getElementById('cabinetSearchInput')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('cabinetStatusFilter')?.value || 'ALL';
        const categoryFilter = document.getElementById('cabinetCategoryFilter')?.value || 'ALL';

        const filtered = medicines.filter(med => {
            const exp = ExpiryEngine.evaluateExpiry(med);

            // Search filter
            const matchesSearch = med.name.toLowerCase().includes(searchQuery) ||
                (med.generic && med.generic.toLowerCase().includes(searchQuery)) ||
                (med.batchNo && med.batchNo.toLowerCase().includes(searchQuery));

            if (!matchesSearch) return false;

            // Status filter
            if (statusFilter !== 'ALL' && exp.status !== statusFilter) {
                return false;
            }

            // Category filter
            if (categoryFilter !== 'ALL' && med.category !== categoryFilter) {
                return false;
            }

            return true;
        });

        const grid = document.getElementById('cabinetGrid');
        const emptyState = document.getElementById('cabinetEmptyState');

        if (filtered.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            lucide.createIcons();
            return;
        }

        emptyState.classList.add('hidden');

        grid.innerHTML = filtered.map(med => {
            const exp = ExpiryEngine.evaluateExpiry(med);
            const isLowStock = med.stock !== undefined && med.stock !== null && med.stock < 10;

            return `
                <div class="glass-card rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between border ${exp.isExpired ? 'border-red-300 dark:border-red-800/80 pulse-danger' : (exp.isExpiringSoon ? 'border-amber-300 dark:border-amber-800/80 hover:border-amber-400 dark:hover:border-amber-700' : 'border-slate-200/60 dark:border-slate-800/60 hover:border-brand-300 dark:hover:border-brand-700')}">
                    <div>
                        <div class="flex items-start justify-between gap-2 mb-3">
                            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/40">
                                ${med.category}
                            </span>
                            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full ${exp.badgeClass}">
                                ${exp.badgeText}
                            </span>
                        </div>

                        <h3 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">${med.name}</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">${med.generic || 'Generic formulation'}</p>

                        <div class="p-3 rounded-xl ${exp.isExpired ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200/50 dark:border-red-800/30' : (exp.isExpiringSoon ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/30')} text-xs space-y-1 mb-3">
                            <div class="flex justify-between">
                                <span class="text-slate-500">Expiry Date:</span>
                                <span class="font-bold">${ExpiryEngine.formatReadableDate(med.expiryDate)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-slate-500">Status:</span>
                                <span class="font-semibold">${exp.countdownText}</span>
                            </div>
                            ${med.batchNo ? `
                                <div class="flex justify-between">
                                    <span class="text-slate-500">Batch / Lot:</span>
                                    <span class="font-mono text-[11px]">${med.batchNo}</span>
                                </div>
                            ` : ''}
                        </div>

                        <div class="space-y-2 text-xs mb-4">
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500">Dose Schedule:</span>
                                <span class="font-medium text-slate-700 dark:text-slate-300">
                                    ${med.schedule?.enabled && med.schedule.times?.length ? med.schedule.times.join(', ') : 'As needed (SOS)'}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-slate-500">Stock Left:</span>
                                <div class="flex items-center gap-1.5">
                                    <span class="font-bold ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}">${med.stock !== undefined && med.stock !== null ? med.stock : '--'} doses</span>
                                    <button onclick="App.quickRefill('${med.id}', 30)" title="Refill +30 doses" class="px-1.5 py-0.5 rounded-md bg-brand-100 hover:bg-brand-200 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300 dark:hover:bg-brand-800/60 text-[10px] font-bold transition-all duration-200">+30</button>
                                </div>
                            </div>
                            ${med.storageLocation ? `
                                <div class="flex justify-between items-center text-[11px]">
                                    <span class="text-slate-500">Storage:</span>
                                    <span class="text-slate-600 dark:text-slate-400 italic">${med.storageLocation}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2">
                        <button onclick="App.openMedicineDetailModal('${med.id}')" class="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition-colors">
                            <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Safety Rules
                        </button>
                        <div class="flex items-center gap-1">
                            <button onclick="App.openEditMedicineModal('${med.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-all duration-200" title="Edit Medicine">
                                <i data-lucide="pencil" class="w-4 h-4"></i>
                            </button>
                            <button onclick="App.handleDeleteMedicine('${med.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-200" title="Delete from Cabinet">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    filterCabinetByStatus(status) {
        this.switchTab('cabinet');
        const filterSelect = document.getElementById('cabinetStatusFilter');
        if (filterSelect) {
            filterSelect.value = status;
            this.renderCabinet();
        }
    },

    // =========================================================================
    // 3. DAILY SCHEDULE & DOSE TIMELINE
    // =========================================================================
    renderSchedule() {
        const medicines = MedStore.getAll();
        const logs = MedStore.getAllLogs();
        const todayDoses = AdherenceTracker.getTodayDoses(medicines, logs);
        const streak = AdherenceTracker.calculateStreak(medicines, logs);

        document.getElementById('scheduleStreakCount').textContent = `${streak} Days`;
        document.getElementById('scheduleDateSubtitle').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        const timelineContainer = document.getElementById('scheduleTimelineList');
        if (todayDoses.length === 0) {
            timelineContainer.innerHTML = `
                <div class="p-8 text-center text-slate-400 space-y-2">
                    <i data-lucide="calendar" class="w-8 h-8 mx-auto opacity-50"></i>
                    <p class="text-xs">No doses scheduled for today.</p>
                </div>
            `;
        } else {
            timelineContainer.innerHTML = todayDoses.map(item => {
                const isTaken = item.status === 'TAKEN';
                const isSkipped = item.status === 'SKIPPED';
                const isPending = item.status === 'PENDING';

                return `
                    <div class="p-4 rounded-2xl border transition-all duration-200 ${isTaken ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60' : (isSkipped ? 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md')} flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex items-start gap-4">
                            <div class="px-3 py-2 rounded-xl ${isTaken ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-200/50 dark:border-emerald-800/30' : 'bg-gradient-to-br from-brand-100 to-brand-50 text-brand-800 dark:from-brand-900 dark:to-brand-950 dark:text-brand-200 border border-brand-200/50 dark:border-brand-800/30'} font-black text-sm text-center min-w-[70px] shadow-sm">
                                ${item.time}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-bold text-base text-slate-900 dark:text-white tracking-tight ${isTaken ? 'line-through text-slate-500' : ''}">${item.medicineName}</h4>
                                    ${item.expiryInfo.isExpired ? '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300 border border-red-200/50 dark:border-red-800/30">EXPIRED!</span>' : ''}
                                </div>
                                <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                    <strong>Dose:</strong> ${item.dosage} • <strong>Relation:</strong> <span class="text-brand-600 dark:text-brand-400 font-semibold">${item.mealRelation}</span>
                                </p>
                                ${item.instructions ? `<p class="text-[11px] text-slate-500 italic mt-0.5">Note: ${item.instructions}</p>` : ''}
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            ${isTaken ? `
                                <div class="text-right">
                                    <span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/40 px-3 py-1.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/30">
                                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Taken
                                    </span>
                                </div>
                            ` : (isSkipped ? `
                                <span class="text-xs font-semibold text-slate-400 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Skipped</span>
                            ` : `
                                <button onclick="App.logDoseQuick('${item.medicineId}', '${item.time}', 'TAKEN')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 flex items-center gap-1.5 transition-all duration-200">
                                    <i data-lucide="check" class="w-4 h-4"></i> Mark Taken
                                </button>
                                <button onclick="App.logDoseQuick('${item.medicineId}', '${item.time}', 'SKIPPED')" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-all duration-200">
                                    Skip
                                </button>
                            `)}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Low stock tracker
        const lowStockContainer = document.getElementById('scheduleLowStockList');
        const lowStockMeds = medicines.filter(m => m.stock !== undefined && m.stock !== null && m.stock < 10);

        if (lowStockMeds.length === 0) {
            lowStockContainer.innerHTML = `<p class="text-xs text-slate-400 italic">All medicines have adequate stock levels.</p>`;
        } else {
            lowStockContainer.innerHTML = lowStockMeds.map(m => `
                <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:shadow-sm transition-all duration-200">
                    <div>
                        <h5 class="text-xs font-bold text-slate-900 dark:text-white">${m.name}</h5>
                        <p class="text-[11px] text-red-600 dark:text-red-400 font-semibold">${m.stock} doses remaining</p>
                    </div>
                    <button onclick="App.quickRefill('${m.id}', 30)" class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white text-xs font-bold shadow-sm shadow-brand-600/15 transition-all duration-200">
                        + Refill
                    </button>
                </div>
            `).join('');
        }

        // Recent Activity Log
        const logHistoryContainer = document.getElementById('scheduleHistoryLogList');
        if (logs.length === 0) {
            logHistoryContainer.innerHTML = `<p class="text-xs text-slate-400 italic">No dose activity recorded yet.</p>`;
        } else {
            logHistoryContainer.innerHTML = logs.slice(0, 10).map(l => {
                const med = medicines.find(m => m.id === l.medicineId) || { name: 'Unknown Medicine' };
                const timeTaken = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isTaken = l.status === 'TAKEN';
                const actor = String(l.actor || 'Patient');
                const actorTone = actor.toLowerCase().includes('caregiver') ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-300';
                const statusLabel = isTaken ? 'Taken' : 'Skipped';

                return `
                    <div class="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 text-xs flex items-center justify-between border border-slate-200/40 dark:border-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/40 transition-all duration-200">
                        <div class="flex items-center gap-2">
                            <div class="p-1 rounded-lg ${isTaken ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-200 dark:bg-slate-800'}">
                                <i data-lucide="${isTaken ? 'check-circle-2' : 'x-circle'}" class="w-3.5 h-3.5 ${isTaken ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}"></i>
                            </div>
                            <div>
                                <span class="font-bold text-slate-800 dark:text-slate-200">${String(med.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>
                                <span class="text-[10px] text-slate-500 block">${l.date} • Scheduled ${l.scheduledTime} • Marked by <span class="font-semibold ${actorTone}">${actor.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></span>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-semibold text-slate-500 tabular-nums block">${timeTaken}</span>
                            <span class="text-[10px] ${isTaken ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} font-bold">${statusLabel}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        lucide.createIcons();
    },

    logDoseQuick(medicineId, scheduledTime, status) {
        MedStore.logDose(medicineId, scheduledTime, status);
        this.renderAllViews();
        this.showToast(status === 'TAKEN' ? '✅ Dose recorded! Stock updated.' : 'Dose marked as skipped.', 'info');
    },

    quickRefill(medicineId, count = 30) {
        MedStore.refillStock(medicineId, count);
        this.renderAllViews();
        this.showToast(`📦 Refilled +${count} doses into stock!`, 'success');
    },


    // =========================================================================
    // 5. OCR SCANNER CONTROLLER
    // =========================================================================
    setupDropZone() {
        const dropZone = document.getElementById('dropZoneContainer');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('border-brand-500', 'bg-brand-50/50');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-brand-500', 'bg-brand-50/50');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                this.processOcrFile(files[0]);
            }
        });
    },

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processOcrFile(file);
        }
    },

    async processOcrFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageSrc = e.target.result;
            this.displayPreviewImage(imageSrc);
            await this.runOCR(imageSrc);
        };
        reader.readAsDataURL(file);
    },

    displayPreviewImage(src) {
        const preview = document.getElementById('imagePreview');
        const container = document.getElementById('imagePreviewContainer');
        const dropZone = document.getElementById('dropZoneContainer');

        if (preview && container) {
            preview.src = src;
            container.classList.remove('hidden');
            if (dropZone) dropZone.classList.add('hidden');
        }
    },

    clearScannerImage() {
        document.getElementById('imagePreviewContainer').classList.add('hidden');
        document.getElementById('dropZoneContainer').classList.remove('hidden');
        document.getElementById('ocrExtractedExpiry').value = '';
        document.getElementById('ocrExtractedBatch').value = '';
        document.getElementById('ocrExtractedMfg').value = '';
        document.getElementById('ocrRawTextOutput').textContent = 'No text scanned yet.';
        document.getElementById('btnAutoFillMedicine').disabled = true;
        document.getElementById('ocrExpiryStatusBadge').classList.add('hidden');
    },

    async runOCR(imageSrc) {
        const progressContainer = document.getElementById('ocrProgressBarContainer');
        const progressBar = document.getElementById('ocrProgressBar');
        const progressPercent = document.getElementById('ocrProgressPercent');

        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';

        try {
            const result = await OCRScanner.scanImage(imageSrc, (progress) => {
                progressBar.style.width = `${progress}%`;
                progressPercent.textContent = `${progress}%`;
            });

            // Populate extracted fields
            const extracted = result.extracted;
            document.getElementById('ocrExtractedExpiry').value = extracted.expiryDate || 'Not detected (select manually)';
            document.getElementById('ocrExtractedBatch').value = extracted.batchNo || 'Not detected';
            document.getElementById('ocrExtractedMfg').value = extracted.mfgDate || 'Not detected';
            document.getElementById('ocrRawTextOutput').textContent = result.rawText || 'No text extracted.';

            // Status badge on extracted expiry
            const badge = document.getElementById('ocrExpiryStatusBadge');
            if (extracted.expiryDate) {
                const exp = ExpiryEngine.evaluateExpiry({ expiryDate: extracted.expiryDate, category: 'General / Other' });
                badge.className = `px-2.5 py-1 rounded-full text-xs font-bold ${exp.badgeClass}`;
                badge.textContent = exp.badgeText;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }

            document.getElementById('btnAutoFillMedicine').disabled = false;
            this.showToast('🔍 Text & Expiry parsed successfully!', 'success');
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Error running OCR scanner', 'error');
        } finally {
            progressContainer.classList.add('hidden');
            lucide.createIcons();
        }
    },

    async toggleScannerCamera() {
        const container = document.getElementById('cameraContainer');
        const video = document.getElementById('scannerVideo');
        const btnText = document.getElementById('btnToggleCameraText');

        if (OCRScanner.cameraStream) {
            this.stopScannerCamera();
        } else {
            try {
                container.classList.remove('hidden');
                document.getElementById('dropZoneContainer').classList.add('hidden');
                await OCRScanner.startCamera(video);
                btnText.textContent = 'Stop Camera';
            } catch (e) {
                this.showToast(e.message || 'Camera permission denied or camera unavailable', 'error');
                container.classList.add('hidden');
                document.getElementById('dropZoneContainer').classList.remove('hidden');
            }
        }
        lucide.createIcons();
    },

    stopScannerCamera() {
        OCRScanner.stopCamera();
        document.getElementById('cameraContainer').classList.add('hidden');
        document.getElementById('dropZoneContainer').classList.remove('hidden');
        const btnText = document.getElementById('btnToggleCameraText');
        if (btnText) btnText.textContent = 'Start Camera';
    },

    async captureCameraFrame() {
        const video = document.getElementById('scannerVideo');
        const snapshotSrc = OCRScanner.captureSnapshot(video);
        this.stopScannerCamera();
        this.displayPreviewImage(snapshotSrc);
        await this.runOCR(snapshotSrc);
    },

    transferOcrToAddModal() {
        const expiry = document.getElementById('ocrExtractedExpiry').value;
        const batch = document.getElementById('ocrExtractedBatch').value;

        this.openAddMedicineModal();

        if (expiry && expiry !== 'Not detected (select manually)') {
            document.getElementById('medFormExpiry').value = expiry;
        }
        if (batch && batch !== 'Not detected') {
            document.getElementById('medFormBatch').value = batch;
        }
    },

    // =========================================================================
    // 6. MODALS & FORMS (ADD/EDIT MEDICINE, DETAIL, ALARM)
    // =========================================================================
    openAddMedicineModal() {
        this.editingMedId = null;
        document.getElementById('medModalTitle').textContent = 'Add Medicine to Cabinet';
        document.getElementById('medForm').reset();
        document.getElementById('medFormId').value = '';
        document.getElementById('scheduleFieldsWrapper').classList.add('hidden');

        // Set default expiry date to 1 year from now
        this.setExpiryPreset(12);

        document.getElementById('addMedModal').classList.remove('hidden');
        lucide.createIcons();
    },

    openEditMedicineModal(id) {
        const med = MedStore.getById(id);
        if (!med) return;

        this.editingMedId = id;
        document.getElementById('medModalTitle').textContent = 'Edit Medicine Details';
        document.getElementById('medFormId').value = med.id;
        document.getElementById('medFormName').value = med.name || '';
        document.getElementById('medFormGeneric').value = med.generic || '';
        document.getElementById('medFormCategory').value = med.category || 'General / Other';
        document.getElementById('medFormDosageForm').value = med.form || 'Tablet';
        document.getElementById('medFormExpiry').value = med.expiryDate || '';
        document.getElementById('medFormBatch').value = med.batchNo || '';
        document.getElementById('medFormOpenedDate').value = med.openedDate || '';
        document.getElementById('medFormDosageAmount').value = med.dosage || '';
        document.getElementById('medFormStock').value = med.stock !== undefined ? med.stock : '';
        document.getElementById('medFormStorageLocation').value = med.storageLocation || '';
        document.getElementById('medFormNotes').value = med.notes || '';

        // Schedule
        const hasSchedule = med.schedule && med.schedule.enabled;
        document.getElementById('medFormScheduleEnabled').checked = hasSchedule;
        if (hasSchedule) {
            document.getElementById('scheduleFieldsWrapper').classList.remove('hidden');
            document.getElementById('medFormTimesInput').value = med.schedule.times ? med.schedule.times.join(', ') : '';
            document.getElementById('medFormMealRelation').value = med.schedule.mealRelation || 'After Food';
        } else {
            document.getElementById('scheduleFieldsWrapper').classList.add('hidden');
        }

        document.getElementById('addMedModal').classList.remove('hidden');
        lucide.createIcons();
    },

    closeAddMedicineModal() {
        document.getElementById('addMedModal').classList.add('hidden');
    },

    setExpiryPreset(months) {
        const d = new Date();
        d.setMonth(d.getMonth() + months);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        document.getElementById('medFormExpiry').value = `${yyyy}-${mm}-${dd}`;
    },

    setSchedulePreset(timesArray) {
        document.getElementById('medFormTimesInput').value = timesArray.join(', ');
    },

    toggleFormScheduleFields() {
        const isChecked = document.getElementById('medFormScheduleEnabled').checked;
        const wrapper = document.getElementById('scheduleFieldsWrapper');
        if (isChecked) {
            wrapper.classList.remove('hidden');
            if (!document.getElementById('medFormTimesInput').value) {
                document.getElementById('medFormTimesInput').value = '08:00, 20:00';
            }
        } else {
            wrapper.classList.add('hidden');
        }
    },

    handleCategoryChange() {
        const cat = document.getElementById('medFormCategory').value;
        const formSelect = document.getElementById('medFormDosageForm');

        if (cat === 'Ophthalmic (Eye Drops)') formSelect.value = 'Eye Drops';
        else if (cat === 'Respiratory & Inhalers') formSelect.value = 'Inhaler (MDI)';
        else if (cat === 'Liquid Suspensions & Syrups') formSelect.value = 'Oral Suspension';
        else if (cat === 'Topical Creams & Ointments') formSelect.value = 'Ointment / Cream';
        else if (cat === 'Antidiabetic / Insulin') formSelect.value = 'Injection Pen';
    },

    handleSaveMedicine(event) {
        event.preventDefault();

        const id = document.getElementById('medFormId').value || null;
        const name = document.getElementById('medFormName').value.trim();
        const generic = document.getElementById('medFormGeneric').value.trim();
        const category = document.getElementById('medFormCategory').value;
        const form = document.getElementById('medFormDosageForm').value;
        const expiryDate = document.getElementById('medFormExpiry').value;
        const batchNo = document.getElementById('medFormBatch').value.trim();
        const openedDate = document.getElementById('medFormOpenedDate').value || null;
        const dosage = document.getElementById('medFormDosageAmount').value.trim() || '1 dose';
        const stockInput = document.getElementById('medFormStock').value;
        const stock = stockInput !== '' ? parseInt(stockInput, 10) : 30;
        const storageLocation = document.getElementById('medFormStorageLocation').value.trim();
        const notes = document.getElementById('medFormNotes').value.trim();

        const scheduleEnabled = document.getElementById('medFormScheduleEnabled').checked;
        const timesStr = document.getElementById('medFormTimesInput').value;
        const mealRelation = document.getElementById('medFormMealRelation').value;

        const times = scheduleEnabled && timesStr ? timesStr.split(',').map(t => t.trim()).filter(t => /^\d{2}:\d{2}$/.test(t)) : [];

        const medicine = {
            id: id || undefined,
            name,
            generic,
            category,
            form,
            dosage,
            expiryDate,
            batchNo,
            openedDate,
            stock,
            storageLocation,
            notes,
            schedule: {
                enabled: scheduleEnabled,
                times: times,
                mealRelation: mealRelation,
                instructions: notes
            }
        };

        MedStore.save(medicine);
        this.closeAddMedicineModal();
        this.renderAllViews();
        this.showToast(`🎉 "${name}" saved to cabinet!`, 'success');
    },

    handleDeleteMedicine(id) {
        const med = MedStore.getById(id);
        if (!med) return;

        if (confirm(`Are you sure you want to remove "${med.name}" from your cabinet?`)) {
            MedStore.delete(id);
            this.renderAllViews();
            this.showToast(`"${med.name}" removed.`, 'info');
        }
    },

    openMedicineDetailModal(id) {
        const med = MedStore.getById(id);
        if (!med) return;

        const exp = ExpiryEngine.evaluateExpiry(med);
        const catInfo = PRECAUTIONS_DATA.categories[med.category] || PRECAUTIONS_DATA.categories['General / Other'];

        document.getElementById('detailCategoryBadge').className = `px-2.5 py-0.5 rounded-full text-xs font-bold ${catInfo.badgeColor}`;
        document.getElementById('detailCategoryBadge').textContent = med.category;
        document.getElementById('detailMedName').textContent = med.name;
        document.getElementById('detailGeneric').textContent = med.generic || 'Active pharmaceutical ingredients';

        // Expiry Callout Box
        const callout = document.getElementById('detailExpiryCallout');
        if (exp.isExpired) {
            callout.className = 'p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200';
            callout.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
                    <i data-lucide="alert-octagon" class="w-4 h-4"></i> ${exp.badgeText} (${exp.countdownText})
                </div>
                <p class="mt-1">${exp.warningMessage}</p>
            `;
        } else if (exp.isExpiringSoon) {
            callout.className = 'p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200';
            callout.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                    <i data-lucide="clock" class="w-4 h-4"></i> ${exp.badgeText} (${exp.countdownText})
                </div>
                <p class="mt-1">${exp.warningMessage}</p>
            `;
        } else {
            callout.className = 'p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200';
            callout.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                    <i data-lucide="shield-check" class="w-4 h-4"></i> ${exp.badgeText} (${exp.countdownText})
                </div>
                <p class="mt-1">${exp.warningMessage}</p>
            `;
        }

        // Hazards
        const hazardsList = document.getElementById('detailHazardsList');
        hazardsList.innerHTML = catInfo.expiryHazards.map(h => `<li>${h}</li>`).join('');

        // Storage & Meal Rules
        document.getElementById('detailStorage').textContent = catInfo.storageTips;
        document.getElementById('detailMealRule').textContent = `${med.schedule?.mealRelation || 'With or without food'} • ${catInfo.foodInteractions}`;

        // Personalized Lifestyle Recommendations (category + patient conditions)
        this.renderLifestyleTips(med.category);

        document.getElementById('medDetailModal').classList.remove('hidden');
        lucide.createIcons();
    },

    // Build and display personalized lifestyle tips for a medicine
    renderLifestyleTips(catName) {
        const listEl = document.getElementById('detailLifestyleList');
        if (!listEl) return;

        // Resolve the data set: fall back to General / Other if category missing
        const tipsData = (typeof LIFESTYLE_DATA !== 'undefined' && LIFESTYLE_DATA.byCategory) || {};
        const catKey = (tipsData[catName]) ? catName : 'General / Other';

        const tips = [];
        if (tipsData[catKey]) tips.push(...tipsData[catKey].tips);

        // Condition-specific tips for the primary / self patient, if conditions match
        const patient = (window.Care && Care.getAll() || []).find(p => p.relation === 'Self' || p.id === 'p_self');
        const conditionTips = (typeof LIFESTYLE_DATA !== 'undefined' && LIFESTYLE_DATA.byCondition) || {};
        if (patient && patient.conditions && conditionTips) {
            const condTokens = patient.conditions.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(Boolean);
            condTokens.forEach(cond => {
                const entry = conditionTips[cond];
                if (entry) tips.push(entry);
            });
        }

        // Fallback message if nothing available
        if (tips.length === 0) {
            tips.push("Follow a healthy, balanced diet and stay active as tolerated while on this medicine.");
            tips.push("Keep a medication diary and report any new symptoms to your doctor.");
        }

        // De-duplicate
        const unique = Array.from(new Set(tips));
        listEl.innerHTML = unique.map(t => `<li class="leading-relaxed">${t}</li>`).join('');
    },

    closeDetailModal() {
        document.getElementById('medDetailModal').classList.add('hidden');
    },

    // =========================================================================
    // 7. REAL-TIME REMINDER ALARM MODAL CONTROLLER
    // =========================================================================
    showDoseModal(data) {
        this.activeAlarmData = data;
        const { medicine, doseTime, isSnoozed, expiry } = data;

        document.getElementById('alarmMedName').textContent = medicine.name;
        document.getElementById('alarmGenericName').textContent = medicine.generic || 'Scheduled Routine Dose';
        document.getElementById('alarmDoseAmount').textContent = medicine.dosage || '1 dose';
        document.getElementById('alarmMealRelation').textContent = medicine.schedule?.mealRelation || 'No restriction';
        document.getElementById('alarmDoseTime').textContent = `${doseTime}${isSnoozed ? ' (Snoozed)' : ''}`;

        // Expiry alert in alarm
        const expBox = document.getElementById('alarmExpiryAlertBox');
        if (expiry && expiry.isExpired) {
            expBox.classList.remove('hidden');
            expBox.innerHTML = `<strong>⚠️ CRITICAL WARNING:</strong> This medication is EXPIRED (${expiry.countdownText}). Clinical efficacy is degraded. Avoid taking expired medication.`;
        } else {
            expBox.classList.add('hidden');
        }

        document.getElementById('alarmModal').classList.remove('hidden');
        lucide.createIcons();
    },

    handleAlarmAction(action) {
        const modal = document.getElementById('alarmModal');
        modal.classList.add('hidden');

        if (!this.activeAlarmData) return;
        const { medicine, doseTime } = this.activeAlarmData;

        if (action === 'TAKEN') {
            MedStore.logDose(medicine.id, doseTime, 'TAKEN');
            this.renderAllViews();
            this.showToast(`✅ Recorded ${medicine.name} as taken!`, 'success');
        } else if (action === 'SNOOZE') {
            const returnTime = ReminderAlarm.snooze(medicine, doseTime, 10);
            this.showToast(`⏰ Alarm snoozed for 10 minutes (Next: ${returnTime})`, 'info');
        } else if (action === 'SKIP') {
            MedStore.logDose(medicine.id, doseTime, 'SKIPPED');
            this.renderAllViews();
            this.showToast(`Dose for ${medicine.name} skipped.`, 'info');
        }

        this.activeAlarmData = null;
    },

    // =========================================================================
    // 8. THEME & PUSH NOTIFICATIONS
    // =========================================================================
    toggleTheme() {
        const html = document.documentElement;
        const isDark = html.classList.toggle('dark');
        html.classList.toggle('light', !isDark);

        const settings = MedStore.getSettings();
        settings.theme = isDark ? 'dark' : 'light';
        MedStore.saveSettings(settings);

        this.updateThemeIcon(isDark);
    },

    applyTheme() {
        const settings = MedStore.getSettings();
        const isDark = settings.theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('light', !isDark);
        this.updateThemeIcon(isDark);
    },

    updateThemeIcon(isDark) {
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
            lucide.createIcons();
        }
    },

    // =========================================================================
    // 9. CAREGIVER ACCESS
    // =========================================================================
    openCaregiverModal() {
        const modal = document.getElementById('caregiverModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        this.syncCaregiverUI();
        this.toggleCaregiverMode(CaregiverAuth.isCaregiverLoggedIn() ? 'login' : 'login');
    },

    closeCaregiverModal() {
        const modal = document.getElementById('caregiverModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    },

    cancelCaregiver() {
        this.closeCaregiverModal();
    },

    toggleCaregiverMode(mode) {
        const loginForm = document.getElementById('cgLoginForm');
        const regForm = document.getElementById('cgRegisterForm');
        const loginBtn = document.getElementById('cgModeLoginBtn');
        const regBtn = document.getElementById('cgModeRegisterBtn');

        const makeActive = (act, inact) => {
            act.classList.remove('bg-slate-100', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-slate-300');
            act.classList.add('bg-violet-100', 'text-violet-700', 'dark:bg-violet-900/50', 'dark:text-violet-300');
            inact.classList.remove('bg-violet-100', 'text-violet-700', 'dark:bg-violet-900/50', 'dark:text-violet-300');
            inact.classList.add('bg-slate-100', 'text-slate-600', 'dark:bg-slate-800', 'dark:text-slate-300');
        };

        if (mode === 'register') {
            loginForm.classList.add('hidden');
            regForm.classList.remove('hidden');
            makeActive(regBtn, loginBtn);
        } else {
            regForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            makeActive(loginBtn, regBtn);
        }
    },

    syncCaregiverUI() {
        const badge = document.getElementById('caregiverBadge');
        if (!badge) return;
        const logged = CaregiverAuth.isCaregiverLoggedIn();
        if (logged) {
            const cur = CaregiverAuth.currentActor();
            badge.textContent = `Caregiver: ${cur.name}`;
            badge.classList.remove('hidden');
        } else {
            badge.textContent = '';
            badge.classList.add('hidden');
        }
    },

    async submitCaregiverLogin(event) {
        event.preventDefault();
        const email = document.getElementById('cgLoginEmail').value;
        const password = document.getElementById('cgLoginPassword').value;
        const errEl = document.getElementById('cgLoginError');
        errEl.classList.add('hidden');

        const result = await CaregiverAuth.login(email, password);
        if (!result.ok) {
            errEl.textContent = result.error;
            errEl.classList.remove('hidden');
            return;
        }
        this.syncCaregiverUI();
        this.closeCaregiverModal();
        this.showToast('✅ Caregiver access granted.', 'success');
    },

    async submitCaregiverRegister(event) {
        event.preventDefault();
        const name = document.getElementById('cgRegName').value;
        const email = document.getElementById('cgRegEmail').value;
        const password = document.getElementById('cgRegPassword').value;
        const consent = document.getElementById('cgRegConsent').checked;
        const errEl = document.getElementById('cgRegisterError');
        errEl.classList.add('hidden');

        const result = await CaregiverAuth.register(name, email, password, consent);
        if (!result.ok) {
            errEl.textContent = result.error;
            errEl.classList.remove('hidden');
            return;
        }
        this.syncCaregiverUI();
        this.closeCaregiverModal();
        this.showToast('✅ Caregiver account created & signed in (patient consent recorded).', 'success');
    },

    async submitAuthLogin(event) {
        event.preventDefault();
        const errEl = document.getElementById('authLoginError');
        errEl.classList.add('hidden');
        const btn = document.getElementById('authLoginBtn');
        btn.disabled = true;
        try {
            const email = document.getElementById('authLoginEmail').value;
            const password = document.getElementById('authLoginPassword').value;
            const result = await Auth.submitLogin(email, password);
            this.showToast('✅ Signed in! Your cloud data is loading…', 'success');
            return result;
        } catch (e) {
            errEl.textContent = e.message || 'Sign in failed.';
            errEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    },

    async submitAuthRegister(event) {
        event.preventDefault();
        const errEl = document.getElementById('authRegError');
        errEl.classList.add('hidden');
        const btn = document.getElementById('authRegBtn');
        btn.disabled = true;
        try {
            const name = document.getElementById('authRegName').value;
            const email = document.getElementById('authRegEmail').value;
            const password = document.getElementById('authRegPassword').value;
            await Auth.submitRegister(name, email, password);
            this.showToast('✅ Account created! Welcome to Ciphera Health+.', 'success');
        } catch (e) {
            errEl.textContent = e.message || 'Could not create account.';
            errEl.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    },

    logout() {
        if (typeof window.Auth !== 'undefined') Auth.logout();
        else if (typeof window.CloudSync !== 'undefined') CloudSync.logout();
    },

    saveVaultRecord(event) {
        if (typeof window.Vault !== 'undefined') Vault.saveRecord(event);
    },

    async requestPushNotifications() {
        const permission = await ReminderAlarm.requestPermission();
        this.updateNotifButtonState();

        if (permission === 'granted') {
            this.showToast('🔔 Desktop push notifications enabled!', 'success');
            ReminderAlarm.notify('Ciphera Health+ Active', 'You will now receive timely medication alerts.');
        } else if (permission === 'denied') {
            this.showToast('Notifications blocked in browser settings.', 'error');
        }
    },

    updateNotifButtonState() {
        const dot = document.getElementById('notifDot');
        if (!dot) return;

        if ('Notification' in window && Notification.permission === 'granted') {
            dot.className = 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500';
        } else {
            dot.className = 'absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500';
        }
    },

    // =========================================================================
    // 9. TOAST NOTIFICATIONS HELPER
    // =========================================================================
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2 pointer-events-auto toast-animate ${
            type === 'success' ? 'bg-emerald-600 text-white border-emerald-500/50' :
            (type === 'error' ? 'bg-red-600 text-white border-red-500/50' : 'bg-slate-900 text-white border-slate-700 dark:bg-slate-100 dark:text-slate-900')
        }`;

        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px) scale(0.95)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
};

window.App = App;

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

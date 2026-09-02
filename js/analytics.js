/* Ciphera Health+ — Health Analytics Module */
(function () {
    'use strict';

    const Analytics = {

        init() {
            this.render();
        },

        render() {
            this.renderStats();
            this.renderWeekly();
            this.renderTrend();
            this.renderInsight();
        },

        renderStats() {
            const meds = MedStore.getAll();
            const logs = MedStore.getAllLogs();

            const todayDoses = AdherenceTracker.getTodayDoses(meds, logs);
            const score = AdherenceTracker.calculateDailyScore(todayDoses);
            const takenToday = todayDoses.filter(d => d.status === 'TAKEN').length;

            const missed7 = (logs || []).filter(l => l.status === 'SKIPPED').filter(l => {
                const d = new Date(l.timestamp || Date.now());
                const diff = (Date.now() - d.getTime()) / 86400000;
                return diff <= 7;
            }).length;

            const expiring = meds.filter(m => {
                const e = ExpiryEngine.evaluateExpiry(m);
                return e.isExpiringSoon;
            }).length;

            document.getElementById('anScore').textContent = score.percentage + '%';
            document.getElementById('anTodayMeds').textContent = todayDoses.length;
            document.getElementById('anMissed').textContent = missed7;
            document.getElementById('anExpiring').textContent = expiring;
        },

        renderWeekly() {
            const container = document.getElementById('anWeeklyBars');
            const logs = MedStore.getAllLogs() || [];

            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const dayLogs = logs.filter(l => l.date === key);
                const taken = dayLogs.filter(l => l.status === 'TAKEN').length;
                const total = dayLogs.length;
                days.push({
                    label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                    pct: total === 0 ? 0 : Math.round((taken / total) * 100),
                    total
                });
            }

            container.innerHTML = days.map(d => {
                const h = Math.max(d.pct, d.pct > 0 ? 6 : 2);
                const color = d.pct >= 80 ? 'from-emerald-500 to-teal-500' :
                    (d.pct >= 50 ? 'from-brand-500 to-brand-600' : 'from-amber-500 to-orange-500');
                return `
                    <div class="flex flex-col items-center justify-end gap-1.5 flex-1 min-w-0">
                        <span class="text-[10px] font-bold text-slate-500">${d.pct}%</span>
                        <div class="w-full max-w-[28px] rounded-lg bg-gradient-to-t ${color} hover:-translate-y-0.5 transition-transform duration-200" style="height:${h}%; min-height:${d.pct > 0 ? '6px' : '2px'}"></div>
                        <span class="text-[10px] font-medium text-slate-400">${d.label}</span>
                    </div>
                `;
            }).join('');
        },

        renderTrend() {
            const el = document.getElementById('anTrendChart');
            const logs = MedStore.getAllLogs() || [];

            const points = [];
            for (let w = 11; w >= 0; w--) {
                const start = new Date();
                start.setDate(start.getDate() - (w * 7) - 6);
                const end = new Date();
                end.setDate(end.getDate() - (w * 7));
                const sKey = start.toISOString().slice(0, 10);
                const eKey = end.toISOString().slice(0, 10);
                const wk = logs.filter(l => l.date >= sKey && l.date <= eKey);
                const taken = wk.filter(l => l.status === 'TAKEN').length;
                const total = wk.length;
                points.push(total === 0 ? 0 : Math.round((taken / total) * 100));
            }

            const W = 460, H = 150, pad = 8;
            const maxV = 100;
            const stepX = (W - pad * 2) / (points.length - 1 || 1);
            const yFor = v => H - pad - (v / maxV) * (H - pad * 2);

            const coords = points.map((v, i) => `${(pad + i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`);

            const area = `${pad},${H - pad} ${coords.join(' ')} ${(W - pad)},${H - pad}`;
            const path = 'M' + coords.join(' L ');

            el.innerHTML = `
                <svg viewBox="0 0 ${W} ${H}" class="w-full h-full" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="rgba(51,131,248,0.35)"/>
                            <stop offset="100%" stop-color="rgba(51,131,248,0)"/>
                        </linearGradient>
                    </defs>
                    <polygon points="${area}" fill="url(#trendFill)"/>
                    <polyline points="${coords.join(' ')}" fill="none" stroke="#3383f8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                    ${points.map((v, i) => `<circle cx="${(pad + i * stepX).toFixed(1)}" cy="${yFor(v).toFixed(1)}" r="3" fill="#10b981" stroke="#fff" stroke-width="1.5"/>`).join('')}
                </svg>
            `;
        },

        renderInsight() {
            const el = document.getElementById('anInsight');
            if (!el) return;

            const meds = MedStore.getAll();
            const logs = MedStore.getAllLogs() || [];
            const todayDoses = AdherenceTracker.getTodayDoses(meds, logs);
            const score = AdherenceTracker.calculateDailyScore(todayDoses);
            const streak = AdherenceTracker.calculateStreak ? AdherenceTracker.calculateStreak(meds, logs) : 0;
            const expiring = meds.filter(m => {
                const e = ExpiryEngine.evaluateExpiry(m);
                return e.isExpired || e.isExpiringSoon;
            });
            const lowStock = meds.filter(m => m.stock !== undefined && m.stock < 10);

            const bits = [];
            if (score.percentage >= 80) bits.push(`Your adherence is strong at <strong class="text-emerald-600 dark:text-emerald-400">${score.percentage}%</strong>${streak ? ` with a ${streak}-day streak` : ''}. Keep going!`);
            else if (score.percentage > 0) bits.push(`Your adherence is <strong class="text-amber-600 dark:text-amber-400">${score.percentage}%</strong>. Try setting alarms and keeping medicines visible to build consistency.`);
            else bits.push(`No doses tracked yet today. Add medicines and mark doses as taken to build your adherence score.`);

            if (expiring.length > 0) bits.push(`You have <strong class="text-red-600 dark:text-red-400">${expiring.length} medicine${expiring.length > 1 ? 's' : ''}</strong> expired or expiring soon. Schedule a refill or safe disposal.`);
            if (lowStock.length > 0) bits.push(`${lowStock.length} medicine${lowStock.length > 1 ? 's have' : ' has'} low stock — consider refilling.`);

            el.innerHTML = bits.join(' ');
        }
    };

    window.Analytics = Analytics;
})();

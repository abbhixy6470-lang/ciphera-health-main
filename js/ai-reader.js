/* Ciphera Health+ — AI Prescription Reader (Gemini + Local Fallback) */
(function () {
    'use strict';

    const AiReader = {

        currentImage: null,

        init() {
            Settings.syncGeminiStatusBadge();
        },

        openSettings() {
            document.getElementById('geminiKeyInput').value = Settings.getGeminiKey();
            document.getElementById('geminiSettingsModal').classList.remove('hidden');
            document.getElementById('geminiSettingsModal').classList.add('flex');
        },

        closeSettings() {
            document.getElementById('geminiSettingsModal').classList.add('hidden');
            document.getElementById('geminiSettingsModal').classList.remove('flex');
        },

        saveSettings() {
            const key = document.getElementById('geminiKeyInput').value.trim();
            Settings.setGeminiKey(key);
            Settings.syncGeminiStatusBadge();
            this.closeSettings();
            App.showToast(key ? '🔑 Gemini AI key saved & activated!' : 'Gemini key removed. Using local parser.', 'success');
        },

        handleUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            this.prepareImage(file);
            event.target.value = '';
        },

        prepareImage(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentImage = e.target.result;
                const preview = document.getElementById('rxPreview');
                preview.src = this.currentImage;
                document.getElementById('rxPreviewContainer').classList.remove('hidden');
                document.getElementById('btnAnalyzeRx').disabled = false;
            };
            reader.readAsDataURL(file);
        },

        clearImage() {
            this.currentImage = null;
            document.getElementById('rxPreviewContainer').classList.add('hidden');
            document.getElementById('rxPreview').src = '';
            document.getElementById('btnAnalyzeRx').disabled = true;
        },

        setProgress(pct, text) {
            const box = document.getElementById('rxProgress');
            box.classList.remove('hidden');
            document.getElementById('rxProgressBar').style.width = pct + '%';
            if (text) document.getElementById('rxProgressText').textContent = text;
        },

        async analyze() {
            if (!this.currentImage) return;

            const btn = document.getElementById('btnAnalyzeRx');
            btn.disabled = true;
            this.setProgress(10, 'Extracting text with OCR...');
            document.getElementById('rxResultEmpty').classList.add('hidden');
            document.getElementById('rxResultBody').classList.add('hidden');

            let rawText = '';

            try {
                // 1) OCR the image locally with Tesseract
                const result = await Tesseract.recognize(this.currentImage, 'eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            this.setProgress(10 + Math.round(m.progress * 50), 'Reading handwriting with OCR...');
                        }
                    }
                });
                rawText = (result.data && result.data.text) || '';
            } catch (e) {
                rawText = '';
            }

            this.setProgress(65, 'Interpreting with AI...');

            let parsed;
            const geminiKey = Settings.getGeminiKey();

            if (geminiKey) {
                try {
                    parsed = await this.callGemini(this.currentImage, rawText, geminiKey);
                } catch (e) {
                    console.warn('Gemini failed, using local parser:', e);
                    parsed = this.localParse(rawText);
                }
            } else {
                parsed = this.localParse(rawText);
            }

            this.renderResult(parsed, geminiKey, rawText);
            this.setProgress(100, 'Done');
            btn.disabled = false;

            setTimeout(() => {
                document.getElementById('rxProgress').classList.add('hidden');
            }, 800);
        },

        async callGemini(imageDataUrl, rawText, apiKey) {
            // Extract base64 from data URL
            const base64 = imageDataUrl.split(',')[1] || imageDataUrl;

            const endpoint =
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(apiKey);

            const body = {
                contents: [{
                    parts: [
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64
                            }
                        },
                        {
                            text: 'You are a clinical pharmacist. Read this prescription (image plus OCR text: "' + rawText + '"). ' +
                                'Return STRICT JSON only, no markdown, no extra text, with this schema: ' +
                                '{"medicine":"name","generic":"generic name","dosage":"amount e.g. 500mg 1 tablet",' +
                                '"timing":"e.g. twice daily after meals","duration":"e.g. 7 days",' +
                                '"instructions":"simple language explanation","category":"one of: Antibiotics, Pain Relievers & NSAIDs, Cardiovascular / Blood Pressure, Antidiabetic / Insulin, Respiratory & Inhalers, Vitamins & Supplements, General / Other"}'
                        }
                    ]
                }]
            };

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                throw new Error('Gemini HTTP ' + resp.status);
            }

            const data = await resp.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Strip markdown fences
            const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start === -1 || end === -1) throw new Error('No JSON in response');

            return JSON.parse(cleaned.slice(start, end + 1));
        },

        localParse(rawText) {
            // Rule-based fallback parser for prescription text
            const normalize = (phrase) => phrase.toLowerCase().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
            const txt = normalize(rawText);

            // Find dose frequency hints
            let timing = 'as directed';
            if (/(twice|2 times|bd|b\.?d\.?|bid)/.test(txt)) timing = 'twice daily (morning & evening)';
            else if (/(thrice|three|3 times|tds|tid)/.test(txt)) timing = 'three times daily';
            else if (/(once daily|od|daily|qd)/.test(txt)) timing = 'once daily';

            // Duration
            let duration = '';
            const durMatch = txt.match(/(\d+)\s*(days?|weeks?|months?)/);
            if (durMatch) duration = durMatch[0];

            // Medicine name: first multiword token-ish
            let medicine = '';
            const firstLine = (rawText || '').split('\n').map(l => l.trim()).find(l => l && l.length > 2);
            if (firstLine) medicine = firstLine;

            // Dosage
            let dosage = '';
            const doseMatch = txt.match(/(\d+\s*(mg|mcg|g|ml|drops|tablet|capsule|tab|cap))/);
            if (doseMatch) dosage = doseMatch[1];

            // Generic guess from name
            const generic = medicine;

            // Category detection
            let category = 'General / Other';
            const catRules = [
                [/amox|cef|azith|cipro|clav|antibiotic/i, 'Antibiotics'],
                [/metformin|insulin|glipizide|glimepiride/i, 'Antidiabetic / Insulin'],
                [/amlodip|atenol|losart|metoprol|enalap|ramipril|atorv|rosuv|hydrochlor/i, 'Cardiovascular / Blood Pressure'],
                [/ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|diclofenac/i, 'Pain Relievers & NSAIDs'],
                [/salbutamol|albuterol|budesonide|fluticasone/i, 'Respiratory & Inhalers'],
                [/multivitamin|vitamin|calcium|iron|folic/i, 'Vitamins & Supplements']
            ];
            for (const [re, cat] of catRules) {
                if (re.test(txt)) { category = cat; break; }
            }

            return {
                medicine: medicine || 'Unknown Medicine',
                generic: generic || '',
                dosage: dosage || 'as directed',
                timing: timing,
                duration: duration || 'as prescribed',
                instructions: 'This prescription was parsed locally (no AI key configured). Please verify with your pharmacist.',
                category: category
            };
        },

        renderResult(parsed, usedGemini, rawText) {
            const body = document.getElementById('rxResultBody');
            const iconTone = usedGemini ? 'violet' : 'slate';

            body.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-white shadow-lg shadow-brand-500/20 shrink-0">
                        <i data-lucide="pill" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="text-lg font-bold text-slate-900 dark:text-white">${this.esc(parsed.medicine)}</h4>
                        <p class="text-xs text-slate-500">${this.esc(parsed.generic)}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Dosage</span>
                        <span class="text-slate-600 dark:text-slate-400">${this.esc(parsed.dosage)}</span>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Timing</span>
                        <span class="text-slate-600 dark:text-slate-400">${this.esc(parsed.timing)}</span>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Duration</span>
                        <span class="text-slate-600 dark:text-slate-400">${this.esc(parsed.duration)}</span>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Category</span>
                        <span class="text-slate-600 dark:text-slate-400">${this.esc(parsed.category)}</span>
                    </div>
                </div>

                <div class="p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/50 dark:border-violet-800/30">
                    <span class="text-[11px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> In Simple Language
                    </span>
                    <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">${this.esc(parsed.instructions)}</p>
                </div>

                <button onclick="App.openAddMedicineModal(); App.prefillFromRx(${JSON.stringify({
                    name: parsed.medicine,
                    generic: parsed.generic,
                    category: parsed.category,
                    dosage: parsed.dosage
                }).replace(/"/g, '&quot;')})" class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                    <span>Add to Medicine Cabinet</span>
                </button>

                ${rawText ? `<details class="text-xs text-slate-500">
                    <summary class="cursor-pointer font-medium hover:text-slate-800 dark:hover:text-slate-200 py-1">View Raw OCR Text</summary>
                    <pre class="mt-2 p-3 rounded bg-slate-200 dark:bg-slate-950 text-[11px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">${this.esc(rawText)}</pre>
                </details>` : ''}
            `;

            body.classList.remove('hidden');

            if (window.lucide) lucide.createIcons();
        },

        esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
    };

    window.AiReader = AiReader;
})();

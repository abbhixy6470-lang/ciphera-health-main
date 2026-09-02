/**
 * Optical Character Recognition (OCR) & Smart Date Finder
 * MedGuard Scanner Module
 */

const OCRScanner = {
    isScanning: false,
    cameraStream: null,

    /**
     * Preprocess image on HTML Canvas for higher OCR contrast on medicine foils
     * Accepts an image data URL or Blob and returns a processed data URL
     */
    async preprocessImage(imageSrc) {
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageSrc;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Grayscale + Contrast stretch
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // Luminosity formula
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            // Contrast boost
            gray = gray > 120 ? Math.min(255, gray * 1.2) : Math.max(0, gray * 0.8);

            d[i] = gray;
            d[i + 1] = gray;
            d[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    },

    /**
     * Run OCR on image data URL or Blob
     */
    async scanImage(imageSrc, onProgress) {
        if (!window.Tesseract) {
            throw new Error('Tesseract.js OCR library is still loading. Please check internet connection or try manual entry.');
        }

        this.isScanning = true;
        try {
            // Preprocess image to boost OCR accuracy on medicine foils
            let processedSrc = imageSrc;
            try {
                processedSrc = await this.preprocessImage(imageSrc);
            } catch (e) {
                // Fall back to original image if preprocessing fails
                console.warn('Image preprocessing failed, using original:', e);
            }

            const result = await window.Tesseract.recognize(
                processedSrc,
                'eng',
                {
                    logger: m => {
                        if (onProgress && m.status === 'recognizing text') {
                            onProgress(Math.round((m.progress || 0) * 100));
                        }
                    }
                }
            );

            const rawText = result.data.text || '';
            const extracted = this.extractDetails(rawText);

            return {
                rawText,
                extracted
            };
        } finally {
            this.isScanning = false;
        }
    },

    /**
     * Regex Pattern Extraction Engine for Expiry Date, Batch/Lot, and Mfg Date
     */
    extractDetails(text) {
        if (!text) return { expiryDate: null, mfgDate: null, batchNo: null, matchedMedicine: null };

        const cleanText = text.replace(/\r/g, ' ').toUpperCase();
        let expiryDate = null;
        let mfgDate = null;
        let batchNo = null;
        let matchedMedicine = null;

        // 1. Expiry Date Regex Matches
        // Matches: EXP: 12/2027, EXP 05/26, EXP. 14-08-2027, USE BY 10/28, B.B. 11/2026, EXPIRY: OCT 2026
        const expRegex = /(?:EXP|EXPIRY|EXP\.?|USE\s*BY|BB|B\.?B\.?|VAL|VALID\s*THRU)[:\s.\-]*([0-9]{1,2}[-/.][0-9]{2,4}|[A-Z]{3,9}\s*[-/.]?\s*[0-9]{2,4}|[0-9]{2,4}[-/.][0-9]{1,2}(?:[-/.][0-9]{1,2})?)/i;
        const expMatch = cleanText.match(expRegex);

        if (expMatch && expMatch[1]) {
            expiryDate = this.normalizeExtractedDate(expMatch[1]);
        } else {
            // General Date format fallback in text if keyword was missed
            const generalDateMatch = cleanText.match(/\b(0[1-9]|1[0-2])[-/.](20[2-3][0-9]|[2-3][0-9])\b/);
            if (generalDateMatch) {
                expiryDate = this.normalizeExtractedDate(generalDateMatch[0]);
            }
        }

        // 2. Manufacturing Date Regex Matches
        const mfgRegex = /(?:MFG|MFD|M\.?F\.?G|M\/D|DOM)[:\s.\-]*([0-9]{1,2}[-/.][0-9]{2,4}|[A-Z]{3,9}\s*[-/.]?\s*[0-9]{2,4})/i;
        const mfgMatch = cleanText.match(mfgRegex);
        if (mfgMatch && mfgMatch[1]) {
            mfgDate = this.normalizeExtractedDate(mfgMatch[1]);
        }

        // 3. Batch / Lot Number Regex Matches
        const batchRegex = /(?:BATCH|LOT|B\.?NO|B\s*NO|B\.N\.|LOT\s*NO)[:\s.\-]*([A-Z0-9\-_]{3,14})/i;
        const batchMatch = cleanText.match(batchRegex);
        if (batchMatch && batchMatch[1]) {
            batchNo = batchMatch[1].trim();
        }

        // 4. Medicine Name Auto-Detection against known database
        if (PRECAUTIONS_DATA && PRECAUTIONS_DATA.drugDatabase) {
            for (const drug of PRECAUTIONS_DATA.drugDatabase) {
                const searchName = drug.name.split('/')[0].trim().toUpperCase();
                if (cleanText.includes(searchName)) {
                    matchedMedicine = drug;
                    break;
                }
            }
        }

        return {
            expiryDate,
            mfgDate,
            batchNo,
            matchedMedicine,
            rawExtractedText: text
        };
    },

    /**
     * Convert extracted OCR date text into standard YYYY-MM-DD
     */
    normalizeExtractedDate(dateStr) {
        if (!dateStr) return null;
        dateStr = dateStr.trim().replace(/[,\s]+/g, '/');

        const monthNames = {
            'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
            'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
            'JANUARY': 1, 'FEBRUARY': 2, 'MARCH': 3, 'APRIL': 4, 'JUNE': 6,
            'JULY': 7, 'AUGUST': 8, 'SEPTEMBER': 9, 'OCTOBER': 10, 'NOVEMBER': 11, 'DECEMBER': 12
        };

        // Check if contains word month e.g. "OCT/2026" or "OCT 2026"
        for (const [mName, mNum] of Object.entries(monthNames)) {
            if (dateStr.toUpperCase().includes(mName)) {
                const yearMatch = dateStr.match(/\b(20\d{2}|\d{2})\b/);
                if (yearMatch) {
                    let y = parseInt(yearMatch[1], 10);
                    if (y < 100) y += 2000;
                    const daysInMonth = new Date(y, mNum, 0).getDate();
                    return `${y}-${String(mNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
                }
            }
        }

        // Match MM/YYYY or MM/YY
        const mmYyyy = dateStr.match(/^(\d{1,2})[/-](\d{2,4})$/);
        if (mmYyyy) {
            let m = parseInt(mmYyyy[1], 10);
            let y = parseInt(mmYyyy[2], 10);
            if (y < 100) y += 2000;
            if (m >= 1 && m <= 12) {
                const daysInMonth = new Date(y, m, 0).getDate();
                return `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
            }
        }

        // Match DD/MM/YYYY
        const ddMmYyyy = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
        if (ddMmYyyy) {
            let d = parseInt(ddMmYyyy[1], 10);
            let m = parseInt(ddMmYyyy[2], 10);
            let y = parseInt(ddMmYyyy[3], 10);
            if (y < 100) y += 2000;
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        return null;
    },

    /**
     * Start live camera viewfinder
     */
    async startCamera(videoElement) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera access not supported on this browser or device.');
        }

        this.stopCamera();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        this.cameraStream = stream;
        videoElement.srcObject = stream;
        await videoElement.play();
        return stream;
    },

    /**
     * Capture a still snapshot frame from active video stream
     */
    captureSnapshot(videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    },

    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }
};

window.OCRScanner = OCRScanner;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCRScanner;
}

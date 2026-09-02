# Ciphera Health+ — Smart Medicine Expiry & Routine Adherence Web App

**Ciphera Health+** is a web application designed to track medicine expiry dates, provide safety precautions and disposal guidelines based on medicine types and expiry status, and ensure medicines are taken at the correct time with audio chimes, browser notifications, and adherence tracking.

---

## 🌟 Key Features

### 1. 🔍 Expiry Date Tracking & Expiry Status Engine
- **Accurate Expiry Analysis**: Computes days remaining or days past expiry relative to the real-time clock.
- **Color-Coded Status Badges**:
  - 🟢 **Safe & Valid**: Displays active validity duration.
  - 🟡 **Expiring Soon (<30 Days)**: Warning threshold to arrange refills before loss of therapeutic efficacy.
  - 🔴 **Expired / Unsafe**: Alert with countdown of days overdue and safety risk assessment.
- **Rule of 28 Days**: Special sterile shelf-life validation for opened eye drops, in-use insulin pens, and antibiotic suspensions.
- **Medicine Inventory & Stock Counter**: Low stock alerts (< 10 doses remaining) with 1-click `+30 Refill` buttons.

### 2. 🛡️ Intelligent Clinical Precautions & Safe Disposal Advisor
- **Dynamic Category Hazards**:
  - **Antibiotics**: Antimicrobial resistance warnings and chemical degradation risks.
  - **Ophthalmic Eye Drops**: Bacterial/fungal keratitis hazards and the mandatory 28-day discard rule.
  - **Insulin & Biologics**: Protein denaturation and risk of Diabetic Ketoacidosis (DKA).
  - **Cardiovascular & Blood Pressure**: Loss of potency leading to hypertensive crises or angina failure.
  - **Pain Relievers / Aspirin**: Acetic acid hydrolysis risks and stomach ulceration.
  - **Liquid Syrups & Suspensions**: Active ingredient precipitation and microbial fermentation.
- **Safe Medicine Disposal Protocol**:
  - Step-by-step FDA household trash mix-in method (coffee grounds/kitty litter in sealed containers).
  - High-potency narcotic FDA flush list guidelines.
- **Storage Dos and Don'ts**: Advice regarding bathroom steam moisture, refrigeration, and light protection.

### 3. ⏰ Timely Medication Reminder & Adherence Routine
- **Daily Dosage Timeline**: Grouped chronologically with meal relation tags (*Before Food*, *With Food*, *After Food*, *No Restriction*).
- **Web Audio API Chimes**: Built-in harmonic medical chimes that play without needing any external audio file downloads.
- **Desktop Push Notifications**: Native browser popups with direct action buttons.
- **Live In-App Alarm Modal**: Prompts users at the exact scheduled minute with options to **Mark as Taken**, **Snooze 10m**, or **Skip**.
- **Daily Adherence Score & Multi-Day Streak Tracker**: Live percentage ring, streak counter, and activity log.

### 4. 📷 Smart Expiry Scanner (Client-Side OCR)
- Powered by **Tesseract.js** directly inside the browser.
- **Image Upload / Drag & Drop** or **Live Camera Viewfinder**.
- Regex pattern extractor automatically detects `EXP`, `MFG`, `LOT/BATCH` dates and auto-populates the medicine registration form.

### 5. 🖨️ Printable Medical Summary Report
- Built-in `@media print` layout allows 1-click printing of your current medicine cabinet and dosage schedule to share with your doctor, pharmacist, or caregiver.

---

## 🚀 How to Open & Run the App

Because **Ciphera Health+** is built with modern zero-dependency client-side HTML5, Tailwind CSS, and Vanilla JavaScript, it runs directly in your web browser:

1. Navigate to:
   ```
   C:\Users\KAILASHNATH MANOJ\.gemini\antigravity\scratch\medguard-tracker\
   ```
2. Double-click `index.html` (or right-click -> **Open with Google Chrome / Microsoft Edge / Firefox**).
3. The application will launch with pre-loaded realistic medicine samples (Expired Eye Drops, Expiring Amoxicillin, Active Metformin & Paracetamol) so you can test all features right away!

---

## 📁 Project Structure

```
medguard-tracker/
├── index.html              # Main single-page application structure & UI layout
├── README.md               # User guide & documentation
├── css/
│   └── custom.css          # Glassmorphism, animations, print stylesheets & themes
└── js/
    ├── precautions-data.js # Clinical hazards, drug interaction & disposal rules database
    ├── expiry-engine.js    # Expiry calculation, status categorization & shelf-life engine
    ├── reminder-alarm.js   # Live timer engine, Web Audio chime synthesizer & notifications
    ├── adherence.js        # Daily dose tracking, adherence score & streak calculation
    ├── ocr-scanner.js      # Tesseract.js image processor & regex date extraction
    ├── store.js            # LocalStorage persistence & sample medicine dataset
    └── app.js              # Application controller, tab router & event listeners
```

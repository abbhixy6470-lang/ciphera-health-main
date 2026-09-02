/**
 * Precautions, Hazards, and Disposal Guidelines Database
 * MedGuard Clinical Knowledge Base
 */

const PRECAUTIONS_DATA = {
    // Category specific precautions and expiry hazards
    categories: {
        "Antibiotics": {
            icon: "pill",
            badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
            hazardLevel: "Severe",
            expiryHazards: [
                "Loss of potency: Sub-potent antibiotics fail to kill bacteria, fostering drug-resistant bacterial strains (Antimicrobial Resistance / Superbugs).",
                "Chemical degradation: Certain antibiotics (especially Tetracyclines) degrade into nephrotoxic epimers, potentially causing Fanconi-like renal tubular syndrome.",
                "Incomplete infection treatment: Leads to relapse, sepsis, and complicated secondary bacterial infections."
            ],
            openedRules: "Liquid antibiotic suspensions (e.g. Amoxicillin suspension) usually expire 7 to 14 days after reconstitution. Must be refrigerated.",
            storageTips: "Store tablets in a cool, dry place away from bathroom moisture. Keep reconstituted suspensions refrigerated (2°C - 8°C).",
            foodInteractions: "Take exactly at spaced intervals (e.g., every 8 or 12 hours). Avoid dairy with tetracyclines/fluoroquinolones. Finish full prescribed course.",
            disposalMethod: "DO NOT flush down the toilet. Mix with coffee grounds/dirt in sealed bag and discard in trash, or use a pharmacy take-back drop box."
        },
        "Ophthalmic (Eye Drops)": {
            icon: "eye",
            badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            hazardLevel: "Severe",
            expiryHazards: [
                "Bacterial / Fungal Contamination: Preservatives (like Benzalkonium chloride) break down rapidly. Using expired drops can introduce Pseudomonas or fungal keratitis, leading to corneal ulcers and permanent blindness.",
                "pH Alteration & Eye Irritation: Degraded compounds cause severe chemical conjunctivitis, burning, and corneal epithelial damage."
            ],
            openedRules: "CRITICAL 28-DAY RULE: Discard all opened eye drops 28 days after first unsealing, even if the bottle expiry date is a year away!",
            storageTips: "Store upright in original box. Never touch the dropper tip to your eye, fingers, or any surface. Some drops (e.g. Latanoprost) require refrigeration before opening.",
            foodInteractions: "No direct food interactions. Wash hands thoroughly before administration. Wait 5 minutes between different eye drop medications.",
            disposalMethod: "Household trash. Wrap bottle tightly or place in sealed bag."
        },
        "Cardiovascular / Blood Pressure": {
            icon: "heart-pulse",
            badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
            hazardLevel: "Severe",
            expiryHazards: [
                "Loss of Therapeutic Efficacy: Blood pressure medications (e.g. Amlodipine, Lisinopril, Atenolol) lose active concentration, risking rebound hypertensive crises, stroke, or heart failure.",
                "Nitroglycerin Breakdown: Sublingual Nitroglycerin degrades rapidly when exposed to air and light; expired tablets will fail to abort an acute angina/heart attack."
            ],
            openedRules: "Sublingual Nitroglycerin bottles must be replaced 3 to 6 months after first opening. Keep in original amber glass bottle with tight cap.",
            storageTips: "Keep strictly away from heat, light, and humidity. Never store in glove compartments or humid bathrooms.",
            foodInteractions: "Take at the same time every day. Avoid sudden discontinuation. Avoid grapefruit juice with Calcium Channel Blockers (Amlodipine/Nifedipine).",
            disposalMethod: "Pharmacy take-back program recommended, or trash mix-in with coffee grounds."
        },
        "Antidiabetic / Insulin": {
            icon: "activity",
            badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
            hazardLevel: "Severe",
            expiryHazards: [
                "Peptide Denaturation: Insulin proteins denature and lose biological activity. Using expired insulin fails to lower blood glucose, causing Diabetic Ketoacidosis (DKA) or Hyperosmolar Hyperglycemic State (HHS).",
                "Metformin / Oral Antidiabetics: Ineffective glycemic control leads to chronic vascular and renal complications."
            ],
            openedRules: "In-use insulin vials/pens can only be kept at room temperature (below 30°C) for up to 28 days (some up to 42 days). Discard after 28 days.",
            storageTips: "Unopened insulin MUST be kept in the refrigerator (2°C - 8°C). NEVER freeze insulin (freezing destroys the protein structure). Protect from direct sunlight.",
            foodInteractions: "Take precisely in relation to meals (e.g. Rapid-acting insulin 10-15 mins before eating; Metformin with or immediately after meals to reduce gastrointestinal upset).",
            disposalMethod: "Never flush. Dispose of needles in puncture-proof sharps containers. Medicine vials via take-back kiosk or household trash mix-in."
        },
        "Pain Relievers & NSAIDs": {
            icon: "shield-alert",
            badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
            hazardLevel: "Moderate to High",
            expiryHazards: [
                "Aspirin Degradation: Expired aspirin hydrolyzes into salicylic acid and acetic acid (gives off a strong vinegar smell), causing severe gastric mucosal damage, ulcers, and gastrointestinal bleeding.",
                "Paracetamol / Acetaminophen: While relatively stable, expired tablets lose predictable dosing and can lead to accidental toxic overconsumption when patients take extra doses seeking pain relief."
            ],
            openedRules: "Discard if tablets are crumbly, discolored, or smell like vinegar (Aspirin). Liquid syrups discard 6 months after opening.",
            storageTips: "Store in a dry place below 25°C. Keep away from children's reach.",
            foodInteractions: "Take NSAIDs (Ibuprofen, Naproxen, Aspirin) WITH food or milk to protect stomach lining. Avoid alcohol (increases liver toxicity with paracetamol and stomach bleeding with NSAIDs).",
            disposalMethod: "Household trash mix-in method."
        },
        "Respiratory & Inhalers": {
            icon: "wind",
            badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
            hazardLevel: "High",
            expiryHazards: [
                "Loss of Propellant Pressure: Expired metered dose inhalers (e.g. Albuterol/Salbutamol) lose propellant pressure, failing to deliver the correct aerosolized drug dose during an acute asthma attack or COPD exacerbation.",
                "Steroid Particle Clumping: Dry powder inhalers clump from humidity, delivering sub-therapeutic steroid doses."
            ],
            openedRules: "Many dry powder inhalers (e.g. Advair, Symbicort) must be discarded 1 to 3 months after opening protective foil pouches.",
            storageTips: "Store inhaler with mouthpiece cap on. Keep away from open flames and direct heat. Clean plastic mouthpiece weekly.",
            foodInteractions: "Rinse mouth thoroughly with water and spit it out after using corticosteroid inhalers to prevent oral thrush (candidiasis) and hoarseness.",
            disposalMethod: "Do not puncture or incinerate pressurized canisters. Return to pharmacy or follow local hazardous waste collection guidelines."
        },
        "Liquid Suspensions & Syrups": {
            icon: "droplets",
            badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
            hazardLevel: "Moderate to High",
            expiryHazards: [
                "Active Ingredient Settling & Caking: Emulsions and suspensions separate and crystalize at the bottom over time. Shaking expired bottles cannot evenly redistribute the drug, causing severe underdosing initially and dangerous overdosing at the bottom.",
                "Microbial Growth: Sugars and flavorings in syrups ferment and culture bacteria/mold once preservatives expire."
            ],
            openedRules: "Most opened non-reconstituted syrups should be discarded within 3 to 6 months of opening. Reconstituted powders expire in 7 to 14 days.",
            storageTips: "Always shake well before measuring with an oral syringe or measuring cup (never use kitchen spoons). Keep bottle neck clean.",
            foodInteractions: "Follow specific medication packaging guidelines for meal timing.",
            disposalMethod: "Pour into bag with cat litter or coffee grounds and throw in trash. DO NOT pour large quantities down sinks or toilets."
        },
        "Topical Creams & Ointments": {
            icon: "sparkles",
            badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
            hazardLevel: "Low to Moderate",
            expiryHazards: [
                "Emulsion Separation: Water and oil phases separate, leading to uneven drug absorption and localized skin irritation.",
                "Preservative Breakdown & Bacterial Contamination: Dipping fingers into expired tubs can introduce Staphylococcus and Pseudomonas onto skin."
            ],
            openedRules: "Tubes typically last 6-12 months after opening. Jars/tubs with finger contact should be discarded after 3-6 months.",
            storageTips: "Store tightly capped in a cool place below 25°C. Avoid leaving in direct car heat or sun.",
            foodInteractions: "Wash hands before and after application. Avoid getting into eyes or open wounds unless specifically formulated.",
            disposalMethod: "Squeeze remaining ointment onto absorbent paper, seal in bag, and place in regular garbage."
        },
        "Vitamins & Supplements": {
            icon: "sun",
            badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
            hazardLevel: "Low",
            expiryHazards: [
                "Vitamin Potency Loss: Fat-soluble and water-soluble vitamins (especially Vitamin C, B-complex, and probiotics) lose strength and become ineffective.",
                "Fish Oil / Omega-3 Rancidity: Expired softgels oxidize and become rancid, generating harmful lipid peroxides and rancid odor."
            ],
            openedRules: "Discard if softgels stick together, leak, smell foul, or if tablets show spotting/mold.",
            storageTips: "Store in a dark, cool, dry cabinet. Keep silica gel packet inside the bottle to absorb moisture.",
            foodInteractions: "Take fat-soluble vitamins (A, D, E, K) with a meal containing healthy fats for optimal absorption. Take Iron on an empty stomach with Vitamin C (avoid taking iron with tea/coffee/calcium).",
            disposalMethod: "Regular household trash."
        },
        "General / Other": {
            icon: "pill",
            badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            hazardLevel: "Moderate",
            expiryHazards: [
                "Active chemical degradation: Reduced medication potency leading to unmanaged symptoms.",
                "Physical degradation: Tablets crumbling, discoloration, altered dissolution rate in stomach."
            ],
            openedRules: "Follow pharmacist and packaging instructions.",
            storageTips: "Store in original packaging with label intact, in a cool, dry area away from heat and moisture.",
            foodInteractions: "Always consult package insert or doctor regarding meal schedules.",
            disposalMethod: "FDA trash mix-in method or pharmacy take-back drop box."
        }
    },

    // Drug specific warnings and interaction details
    // Each entry lists its constituent/allergen names so recommendations can be
    // cross-checked against a patient's documented allergies.
    drugDatabase: [
        {
            name: "Amoxicillin",
            generic: "Amoxicillin Trihydrate",
            category: "Antibiotics",
            allergens: ["Penicillin", "Amoxicillin", "Cephalosporin"],
            defaultDose: "500 mg",
            commonForms: ["Capsule", "Tablet", "Oral Suspension"],
            scheduleRecommendation: "Every 8 hours with or without meals",
            mealRule: "With or after food",
            expiryWarning: "Expired amoxicillin causes treatment failure and antibiotic-resistant bacteria. Reconstituted syrup expires in 14 days!",
            storage: "Capsules: Room temp (<25°C). Liquid: Refrigerated (2-8°C)."
        },
        {
            name: "Paracetamol / Acetaminophen",
            generic: "Acetaminophen",
            category: "Pain Relievers & NSAIDs",
            allergens: ["Paracetamol", "Acetaminophen"],
            defaultDose: "500 mg - 650 mg",
            commonForms: ["Tablet", "Syrup", "Suppository"],
            scheduleRecommendation: "Every 4 to 6 hours as needed (Max 4000mg/day)",
            mealRule: "With or without food",
            expiryWarning: "Do not exceed maximum daily dosage to compensate for expired medication; severe risk of fatal liver toxicity.",
            storage: "Cool dry place away from direct sunlight."
        },
        {
            name: "Metformin",
            generic: "Metformin Hydrochloride",
            category: "Antidiabetic / Insulin",
            allergens: ["Metformin"],
            defaultDose: "500 mg - 1000 mg",
            commonForms: ["Tablet", "Extended Release (ER)"],
            scheduleRecommendation: "Twice daily with meals (Breakfast & Dinner)",
            mealRule: "With meals",
            expiryWarning: "Expired metformin leads to poorly managed blood sugar spikes and elevated HbA1c.",
            storage: "Room temperature (20-25°C), away from moisture."
        },
        {
            name: "Amlodipine",
            generic: "Amlodipine Besylate",
            category: "Cardiovascular / Blood Pressure",
            allergens: ["Amlodipine"],
            defaultDose: "5 mg - 10 mg",
            commonForms: ["Tablet"],
            scheduleRecommendation: "Once daily in the morning",
            mealRule: "With or without food (avoid grapefruit)",
            expiryWarning: "Expired blood pressure pills cause unpredictable blood pressure spikes and hypertensive crises.",
            storage: "Room temperature, protect from light."
        },
        {
            name: "Ofloxacin / Ciprofloxacin Eye Drops",
            generic: "Ofloxacin 0.3%",
            category: "Ophthalmic (Eye Drops)",
            allergens: ["Fluoroquinolone", "Ofloxacin", "Ciprofloxacin"],
            defaultDose: "1-2 drops",
            commonForms: ["Eye Drops"],
            scheduleRecommendation: "Every 4 to 6 hours into affected eye",
            mealRule: "No meal restriction",
            expiryWarning: "CRITICAL: Discard 28 days after opening. Expired drops harbor deadly bacterial/fungal pathogens that can cause blindness.",
            storage: "Keep bottle upright, tightly closed, protect from light."
        },
        {
            name: "Aspirin",
            generic: "Acetylsalicylic Acid",
            category: "Pain Relievers & NSAIDs",
            allergens: ["Aspirin", "NSAID", "Salicylate", "Acetylsalicylic Acid"],
            defaultDose: "75 mg - 100 mg (Cardio) / 325 mg - 500 mg (Pain)",
            commonForms: ["Tablet", "Enteric Coated"],
            scheduleRecommendation: "Once daily (Cardio) or every 4-6h for pain",
            mealRule: "Always with food or full glass of water",
            expiryWarning: "If it smells like vinegar, it has broken down into acetic acid. Causes severe stomach burning and ulcers.",
            storage: "Keep in a dry container. Humidity rapidly hydrolyzes aspirin."
        },
        {
            name: "Salbutamol / Albuterol Inhaler",
            generic: "Albuterol Sulfate",
            category: "Respiratory & Inhalers",
            allergens: ["Salbutamol", "Albuterol"],
            defaultDose: "100 mcg (1-2 puffs)",
            commonForms: ["Inhaler (MDI)"],
            scheduleRecommendation: "Every 4 to 6 hours as needed for bronchospasm / 15m before exercise",
            mealRule: "No meal restriction",
            expiryWarning: "Expired inhalers lose propellant pressure. May fail during a sudden severe asthma attack.",
            storage: "Store between 15°C and 25°C. Protect from freezing and direct sunlight."
        },
        {
            name: "Insulin Glargine (Lantus / Basaglar)",
            generic: "Insulin Glargine 100 units/mL",
            category: "Antidiabetic / Insulin",
            allergens: ["Insulin"],
            defaultDose: "As prescribed (Units)",
            commonForms: ["Injection Pen", "Vial"],
            scheduleRecommendation: "Once daily at the same time each day (e.g. 9:00 PM)",
            mealRule: "Consistent daily timing",
            expiryWarning: "Denatures if expired or frozen. Expired insulin causes life-threatening Diabetic Ketoacidosis.",
            storage: "Unopened: Refrigerator (2-8°C). In-use: Room temp (<30°C) for max 28 days."
        },
        {
            name: "Vitamin D3 (Cholecalciferol)",
            generic: "Cholecalciferol 60,000 IU / 1000 IU",
            category: "Vitamins & Supplements",
            allergens: ["Vitamin D", "Vitamins & Supplements"],
            defaultDose: "1000 IU daily or 60,000 IU weekly",
            commonForms: ["Capsule", "Softgel", "Liquid Drops"],
            scheduleRecommendation: "With the largest meal of the day (containing dietary fats)",
            mealRule: "With a fat-containing meal",
            expiryWarning: "Potency degrades gradually over time.",
            storage: "Store in cool, dry place. Protect softgels from excessive heat."
        },
        {
            name: "Cetirizine",
            generic: "Cetirizine Hydrochloride",
            category: "General / Other",
            allergens: ["Cetirizine"],
            defaultDose: "10 mg",
            commonForms: ["Tablet", "Syrup"],
            scheduleRecommendation: "Once daily in the evening (may cause mild drowsiness)",
            mealRule: "With or without food",
            expiryWarning: "Expired antihistamines will be ineffective at suppressing acute allergic reactions or hives.",
            storage: "Store at room temperature below 30°C."
        }
    ],

    // Safe Disposal Methods according to FDA & WHO
    disposalGuidelines: {
        trashMixMethod: [
            {
                step: 1,
                title: "Do Not Crush Tablets",
                desc: "Keep tablets and capsules in their solid form (do not crush or dissolve pills to prevent accidental absorption)."
            },
            {
                step: 2,
                title: "Mix with Unappealing Substance",
                desc: "Mix medications with an unpalatable, undesirable substance like used coffee grounds, dirt, or cat litter."
            },
            {
                step: 3,
                title: "Seal in a Container",
                desc: "Place the mixture in a sealable plastic bag, empty can, or leak-proof container to prevent spillage."
            },
            {
                step: 4,
                title: "Dispose in Household Trash",
                desc: "Throw the sealed container into your standard household garbage can right before collection."
            },
            {
                step: 5,
                title: "Scratch Out Personal Info",
                desc: "Before discarding the original prescription bottle, remove or scratch out all personal information, prescription numbers, and your name to protect privacy."
            }
        ],
        flushListMedicines: [
            "Fentanyl Transdermal Patches",
            "Morphine Sulfate",
            "Oxycodone / Hydrocodone (High-potency narcotics)",
            "Diazepam Rectal Gel",
            "Buprenorphine (Only if designated by FDA flush list to prevent fatal child/pet ingestion)"
        ],
        generalStorageDosAndDonts: {
            dos: [
                "Keep medicines in their original containers with clear labels.",
                "Store in a high, out-of-reach cabinet with child-safety locks.",
                "Keep a temperature log for refrigerated medicines (2°C - 8°C).",
                "Write the 'Date Opened' on eye drops, syrups, and insulin pens.",
                "Keep silica gel desiccants inside the bottles to ward off moisture."
            ],
            donts: [
                "DON'T store medicines in bathroom cabinets (hot shower steam and moisture cause rapid degradation).",
                "DON'T leave medicines inside parked cars or on sunny windowsills.",
                "DON'T share prescription drugs with family members or friends.",
                "DON'T freeze liquid medicines or insulin.",
                "DON'T take expired aspirin that smells like vinegar or discolored tablets."
            ]
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PRECAUTIONS_DATA;
}

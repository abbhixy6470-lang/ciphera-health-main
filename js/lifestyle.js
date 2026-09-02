/* Ciphera Health+ — Personalized Lifestyle Recommendation Knowledge Base
 * Produces evidence-informed lifestyle tips based on a medicine's category
 * and the patient's documented conditions.
 */
const LIFESTYLE_DATA = {

    // Category-specific lifestyle guidance (matched by PRECAUTIONS_DATA category)
    byCategory: {
        "Antibiotics": {
            icon: "shield-check",
            tips: [
                "Finish the entire prescribed course even if you feel better, to prevent antibiotic resistance.",
                "Stay well hydrated and consider a probiotic (yogurt) to support gut flora during treatment.",
                "Avoid alcohol while on antibiotics, especially metronidazole and cephalosporins.",
                "Contact your doctor if a rash, swelling, or diarrhea develops during treatment."
            ]
        },
        "Ophthalmic (Eye Drops)": {
            icon: "eye",
            tips: [
                "Wash hands thoroughly and avoid touching the dropper tip to your eye or fingers.",
                "Discard the bottle 28 days after opening to avoid contamination-related eye infection.",
                "Rest your eyes regularly; avoid rubbing your eyes if they are irritated.",
                "Remove contact lenses before instilling drops and wait 15 minutes before reinserting."
            ]
        },
        "Cardiovascular / Blood Pressure": {
            icon: "heart-pulse",
            tips: [
                "Reduce your salt (sodium) intake to help lower blood pressure.",
                "Exercise for at least 150 minutes per week with light-to-moderate activity.",
                "Limit alcohol and avoid smoking to improve heart health.",
                "Take your BP medication at the same time every day without skipping doses.",
                "Track your blood pressure at home and report consistent high readings to your doctor."
            ]
        },
        "Antidiabetic / Insulin": {
            icon: "activity",
            tips: [
                "Follow a balanced, low-glycemic diet and reduce added sugars.",
                "Monitor your blood glucose regularly and log the readings.",
                "Pair medication with 30 minutes of daily physical activity.",
                "Carry a fast-acting sugar source in case of low blood sugar (hypoglycemia).",
                "Check injection sites and rotate them to prevent skin hardening."
            ]
        },
        "Pain Relievers & NSAIDs": {
            icon: "shield-alert",
            tips: [
                "Take NSAIDs with food or milk to protect your stomach lining.",
                "Avoid alcohol, which increases stomach-bleeding and liver risks.",
                "Do not exceed the maximum daily dose; use the lowest effective dose.",
                "Use heat or cold therapy and gentle stretching as non-drug pain relief.",
                "Never combine multiple NSAIDs (e.g. ibuprofen + aspirin) unless directed."
            ]
        },
        "Respiratory & Inhalers": {
            icon: "wind",
            tips: [
                "Rinse your mouth with water and spit after using corticosteroid inhalers to prevent oral thrush.",
                "Avoid known triggers such as smoke, dust, pets, and strong scents.",
                "Do breathing exercises (e.g. pursed-lip breathing) alongside medication.",
                "Always carry a rescue inhaler if you have asthma or COPD.",
                "Keep inhalers away from heat and check propellant pressure against expiry."
            ]
        },
        "Liquid Suspensions & Syrups": {
            icon: "droplets",
            tips: [
                "Shake the bottle well before each measured dose for even distribution.",
                "Use the provided measuring cup or oral syringe, not kitchen spoons.",
                "Store according to label; many reconstituted syrups need refrigeration.",
                "Keep the bottle neck clean after each use to prevent spoilage."
            ]
        },
        "Topical Creams & Ointments": {
            icon: "sparkles",
            tips: [
                "Wash hands before and after applying cream to avoid contamination.",
                "Apply a thin, even layer and avoid broken or non-target skin areas.",
                "Discard jars/tubs after 3-6 months if dipped into with bare fingers.",
                "Keep topical medicines away from eyes and open wounds unless directed."
            ]
        },
        "Vitamins & Supplements": {
            icon: "sun",
            tips: [
                "Take fat-soluble vitamins (A, D, E, K) with a meal containing healthy fats.",
                "Take iron on an empty stomach with vitamin C, and avoid tea/coffee/calcium near iron.",
                "Store supplements in a cool, dark, dry place to preserve potency.",
                "Get nutrients from whole foods first; treat supplements as a top-up."
            ]
        },
        "General / Other": {
            icon: "pill",
            tips: [
                "Follow your prescriber's instructions and read the package insert carefully.",
                "Keep a medication diary to track doses, timing, and any side effects.",
                "Do not mix with alcohol unless your pharmacist confirms it is safe.",
                "Report any new or unusual symptoms to your doctor promptly."
            ]
        }
    },

    // Condition-specific lifestyle guidance
    byCondition: {
        "diabetes": [
            "Monitor blood sugar regularly and keep a log to share with your clinician.",
            "Choose fiber-rich, whole-grain foods and limit sugary drinks.",
            "Aim for at least 150 minutes of moderate physical activity per week."
        ],
        "hypertension": [
            "Reduce sodium intake to under 1,500-2,300 mg per day.",
            "Follow a DASH-style diet rich in fruits, vegetables, and low-fat dairy.",
            "Manage stress with relaxation techniques such as breathing or meditation."
        ],
        "asthma": [
            "Identify and avoid your asthma triggers.",
            "Keep your rescue inhaler accessible and know your action plan.",
            "Get annual flu and pneumonia vaccines as advised."
        ],
        "anxiety": [
            "Maintain consistent sleep, meals, and physical activity.",
            "Limit caffeine and alcohol, which can worsen anxiety.",
            "Try mindfulness, deep breathing, and regular exercise."
        ],
        "heart disease": [
            "Follow a heart-healthy, low-saturated-fat diet.",
            "Get regular moderate exercise as cleared by your doctor.",
            "Take medications exactly as prescribed and attend cardiac rehab if offered."
        ],
        "acid reflux": [
            "Eat smaller, more frequent meals and avoid lying down right after eating.",
            "Avoid trigger foods such as spicy, fatty, or acidic items and caffeine.",
            "Elevate the head of your bed and maintain a healthy weight."
        ]
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LIFESTYLE_DATA;
}
// Doctors used to type their specialization freely. This maps the existing
// values onto the fixed list (src/utils/specializations.js) so that
// Emergency Alert eligibility, which compares exact values, works for them.
// The list is copied here on purpose: a migration must keep doing the same
// thing even if the application list changes later.
// Values that match nothing are left as they are for an admin to review.

const CANONICAL = [
  "General Medicine",
  "Emergency Medicine",
  "Family Medicine",
  "Internal Medicine",
  "General Surgery",
  "Orthopedics",
  "Plastic and Reconstructive Surgery",
  "Pediatrics",
  "Obstetrics and Gynecology",
  "Cardiology",
  "Neurology",
  "Psychiatry",
  "Physical Medicine and Rehabilitation",
  "Dermatology",
  "Ophthalmology",
  "Otolaryngology",
  "Anesthesiology",
];

const SYNONYMS = {
  "general practice": "General Medicine",
  "general practitioner": "General Medicine",
  gp: "General Medicine",
  "طب عام": "General Medicine",
  "طبيب عام": "General Medicine",
  emergency: "Emergency Medicine",
  "طب الطوارئ": "Emergency Medicine",
  "طب طوارئ": "Emergency Medicine",
  طوارئ: "Emergency Medicine",
  "طب الأسرة": "Family Medicine",
  "طب اسرة": "Family Medicine",
  "internal medicine": "Internal Medicine",
  باطنة: "Internal Medicine",
  الباطنة: "Internal Medicine",
  باطني: "Internal Medicine",
  surgery: "General Surgery",
  جراحة: "General Surgery",
  "جراحة عامة": "General Surgery",
  "الجراحة العامة": "General Surgery",
  orthopedic: "Orthopedics",
  orthopaedics: "Orthopedics",
  "orthopedic surgery": "Orthopedics",
  عظام: "Orthopedics",
  العظام: "Orthopedics",
  "plastic surgery": "Plastic and Reconstructive Surgery",
  "جراحة تجميل": "Plastic and Reconstructive Surgery",
  pediatric: "Pediatrics",
  paediatrics: "Pediatrics",
  أطفال: "Pediatrics",
  "طب الأطفال": "Pediatrics",
  "طب اطفال": "Pediatrics",
  obgyn: "Obstetrics and Gynecology",
  "ob/gyn": "Obstetrics and Gynecology",
  gynecology: "Obstetrics and Gynecology",
  "نسائية وتوليد": "Obstetrics and Gynecology",
  "النساء والولادة": "Obstetrics and Gynecology",
  قلب: "Cardiology",
  "أمراض القلب": "Cardiology",
  أعصاب: "Neurology",
  "طب نفسي": "Psychiatry",
  "الطب النفسي": "Psychiatry",
  rehabilitation: "Physical Medicine and Rehabilitation",
  "physical therapy": "Physical Medicine and Rehabilitation",
  "علاج طبيعي": "Physical Medicine and Rehabilitation",
  "تأهيل": "Physical Medicine and Rehabilitation",
  جلدية: "Dermatology",
  عيون: "Ophthalmology",
  ent: "Otolaryngology",
  "أنف وأذن وحنجرة": "Otolaryngology",
  تخدير: "Anesthesiology",
  anesthesia: "Anesthesiology",
};

function normalizeKey(value) {
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

const LOOKUP = new Map([
  ...CANONICAL.map((name) => [normalizeKey(name), name]),
  ...Object.entries(SYNONYMS).map(([key, name]) => [normalizeKey(key), name]),
]);

exports.up = async function (knex) {
  const rows = await knex("doctors")
    .distinct("specialization")
    .whereNotNull("specialization");

  for (const { specialization } of rows) {
    const canonical = LOOKUP.get(normalizeKey(specialization));

    if (canonical && canonical !== specialization) {
      await knex("doctors")
        .where({ specialization })
        .update({ specialization: canonical });
    }
  }
};

// The original free text is not kept, so there is nothing to restore.
exports.down = async function () {};

// The fixed list of Doctor specializations. The stored value is the English
// name; the frontend translates it. Keep this list in sync with
// HCMS-Frontend src/presentation/constants/specializations.js.
const SPECIALIZATIONS = Object.freeze([
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
]);

// Doctors with these specializations can take Emergency Alerts.
const EMERGENCY_ELIGIBLE_SPECIALIZATIONS = Object.freeze([
  "General Medicine",
  "Emergency Medicine",
]);

const SPECIALIZATION_SET = new Set(SPECIALIZATIONS);
const EMERGENCY_ELIGIBLE_SET = new Set(EMERGENCY_ELIGIBLE_SPECIALIZATIONS);

function isKnownSpecialization(value) {
  return SPECIALIZATION_SET.has(value);
}

function isEmergencyEligibleSpecialization(value) {
  return EMERGENCY_ELIGIBLE_SET.has(value);
}

module.exports = {
  EMERGENCY_ELIGIBLE_SPECIALIZATIONS,
  SPECIALIZATIONS,
  isEmergencyEligibleSpecialization,
  isKnownSpecialization,
};

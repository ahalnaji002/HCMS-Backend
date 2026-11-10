/**
 * Demo data for presentations, the demo video, and the hackathon.
 *
 * Every record is created through the real HTTP API, running in-process on an
 * ephemeral local port, so it passes the same validation, authorization, and
 * business rules as real use. Notifications and activity logs are therefore
 * produced naturally by the services.
 *
 * Usage:  npm run seed            (creates the administrator first)
 *         npm run seed:demo
 *
 * All demo accounts use the @demo.hcms.test domain and the password in
 * DEMO_PASSWORD below. The script refuses to run twice on the same database
 * and refuses to run with NODE_ENV=production unless HCMS_ALLOW_DEMO_SEED=1.
 */
require("dotenv").config({ quiet: true });

// Registration is rate limited per IP; the seed registers many accounts from
// 127.0.0.1, so lift that limit for this process only.
process.env.RATE_LIMIT_REGISTER_MAX = process.env.RATE_LIMIT_REGISTER_MAX || "1000";
process.env.RATE_LIMIT_EMERGENCY_MAX = process.env.RATE_LIMIT_EMERGENCY_MAX || "1000";

const DEMO_DOMAIN = "demo.hcms.test";
const DEMO_PASSWORD = "Demo@2026";

// ---------- date helpers (local time, relative to today) ----------
const pad = (n) => String(n).padStart(2, "0");
function dayOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}
const date = (days) => {
  const d = dayOffset(days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const dateTime = (days, hour, minute = 0, separator = " ") =>
  `${date(days)}${separator}${pad(hour)}:${pad(minute)}:00`;

// ---------- demo content ----------
const email = (local) => `${local}@${DEMO_DOMAIN}`;

const DOCTORS = {
  khaled: { full_name: "د. خالد المصري", email: email("dr.khaled"), phone: "0599100201", specialization: "General Medicine", license_number: "DEMO-GM-1021" },
  sara: { full_name: "د. سارة أبو ندى", email: email("dr.sara"), phone: "0599100202", specialization: "Emergency Medicine", license_number: "DEMO-EM-1022" },
  mohammad: { full_name: "د. محمد الحلو", email: email("dr.mohammad"), phone: "0599100203", specialization: "Orthopedics", license_number: "DEMO-OR-1023" },
  reem: { full_name: "د. ريم الشوا", email: email("dr.reem"), phone: "0599100204", specialization: "Physical Medicine and Rehabilitation", license_number: "DEMO-RH-1024" },
  yousef: { full_name: "د. يوسف عوض", email: email("dr.yousef"), phone: "0599100205", specialization: "General Medicine", license_number: "DEMO-GM-1025" },
};
const PENDING_DOCTOR = { full_name: "د. أحمد صيام", email: email("dr.ahmad"), phone: "0599100206", specialization: "Pediatrics", license_number: "DEMO-PD-1026" };
const REJECTED_DOCTOR = { full_name: "د. نور حمد", email: email("dr.nour"), phone: "0599100207", specialization: "Dermatology", license_number: "DEMO-DM-1027" };

const NGOS = {
  amal: { full_name: "منسق مؤسسة الأمل", email: email("ngo.amal"), phone: "0599100301", organization_name: "مؤسسة الأمل للإغاثة الإنسانية (تجريبي)", registration_number: "DEMO-NGO-301", address: "غزة - الرمال" },
  shifa: { full_name: "منسقة جمعية شفاء", email: email("ngo.shifa"), phone: "0599100302", organization_name: "جمعية شفاء للرعاية الصحية (تجريبي)", registration_number: "DEMO-NGO-302", address: "خان يونس - وسط البلد" },
};
const PENDING_NGO = { full_name: "منسق مبادرة سند", email: email("ngo.sanad"), phone: "0599100303", organization_name: "مبادرة سند المجتمعية (تجريبي)", registration_number: "DEMO-NGO-303", address: "دير البلح" };

const PATIENTS = {
  mahmoud: { full_name: "محمود ناصر", email: email("mahmoud"), phone: "0569200101", national_id: "401234561", date_of_birth: "1994-03-12", gender: "MALE", address: "غزة - الشجاعية (نازح إلى النصيرات)" },
  fatima: { full_name: "فاطمة الزهار", email: email("fatima"), phone: "0569200102", national_id: "401234562", date_of_birth: "1968-07-02", gender: "FEMALE", address: "خان يونس - مخيم خان يونس" },
  layla: { full_name: "ليلى عاشور", email: email("layla"), phone: "0569200103", national_id: "401234563", date_of_birth: "2015-11-20", gender: "FEMALE", address: "دير البلح - مركز إيواء" },
  omar: { full_name: "عمر بركة", email: email("omar"), phone: "0569200104", national_id: "401234564", date_of_birth: "1979-01-15", gender: "MALE", address: "رفح - تل السلطان" },
  heba: { full_name: "هبة قديح", email: email("heba"), phone: "0569200105", national_id: "401234565", date_of_birth: "1990-05-08", gender: "FEMALE", address: "النصيرات - البلد" },
  sami: { full_name: "سامي الكرد", email: email("sami"), phone: "0569200106", national_id: "401234566", date_of_birth: "1985-09-30", gender: "MALE", address: "جباليا - البلد" },
  asmaa: { full_name: "أسماء جودة", email: email("asmaa"), phone: "0569200107", national_id: "401234567", date_of_birth: "2001-12-11", gender: "FEMALE", address: "غزة - تل الهوى" },
  rami: { full_name: "رامي شعت", email: email("rami"), phone: "0569200108", national_id: "401234568", date_of_birth: "1998-04-25", gender: "MALE", address: "خان يونس - بني سهيلا" },
};

const INTAKES = {
  mahmoud: { current_problem: "كسر في الساق اليسرى نتيجة إصابة بشظايا", symptoms: "ألم شديد عند المشي، تورم في الساق، صعوبة في الحركة", symptom_onset: "منذ 3 أسابيع", chronic_conditions_answer: "NO", medications_answer: "YES", medications_details: "مسكنات ألم", allergies_answer: "NO", additional_information: "خضعت لعملية تثبيت في المستشفى الميداني" },
  fatima: { current_problem: "صعوبة في ضبط السكري بعد انقطاع الإنسولين", symptoms: "عطش متكرر، دوخة، تعب عام", symptom_onset: "منذ شهر", chronic_conditions_answer: "YES", chronic_conditions_details: "سكري من النوع الثاني، ضغط دم مرتفع", medications_answer: "YES", medications_details: "إنسولين، ميتفورمين", allergies_answer: "NO" },
  layla: { current_problem: "حروق في الذراع اليمنى", symptoms: "ألم واحمرار وبثور في مكان الحرق", symptom_onset: "منذ 10 أيام", chronic_conditions_answer: "NO", medications_answer: "NO", allergies_answer: "UNKNOWN", additional_information: "طفلة، تحتاج متابعة تغيير الضمادات" },
  omar: { current_problem: "ارتفاع ضغط الدم وصداع مستمر", symptoms: "صداع، دوخة، ضيق نفس عند الجهد", symptom_onset: "منذ شهرين", chronic_conditions_answer: "YES", chronic_conditions_details: "ارتفاع ضغط الدم", medications_answer: "YES", medications_details: "أملوديبين", allergies_answer: "NO" },
  heba: { current_problem: "ضيق تنفس متكرر بسبب الغبار والدخان", symptoms: "سعال، صفير في الصدر ليلاً", symptom_onset: "منذ 6 أسابيع", chronic_conditions_answer: "YES", chronic_conditions_details: "ربو", medications_answer: "YES", medications_details: "بخاخ موسع للشعب الهوائية", allergies_answer: "YES", allergies_details: "حساسية من البنسلين" },
  sami: { current_problem: "ألم مزمن في أسفل الظهر", symptoms: "ألم يزداد مع الجلوس الطويل", symptom_onset: "منذ 3 أشهر", chronic_conditions_answer: "NO", medications_answer: "NO", allergies_answer: "NO" },
  asmaa: { current_problem: "فقر دم وتعب مستمر", symptoms: "شحوب، إرهاق، خفقان", symptom_onset: "منذ شهر", chronic_conditions_answer: "UNKNOWN", medications_answer: "NO", allergies_answer: "NO" },
};

// ---------- runtime ----------
function assertNotProduction() {
  if (process.env.NODE_ENV === "production" && process.env.HCMS_ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed demo data with NODE_ENV=production (set HCMS_ALLOW_DEMO_SEED=1 to allow)");
  }
}

function assertNoDemoData(db) {
  return db("users").where("email", "like", `%@${DEMO_DOMAIN}`).first("id").then((row) => {
    if (row) throw new Error(`Demo data already exists (users with @${DEMO_DOMAIN}). Use a fresh database.`);
  });
}

async function main() {
  assertNotProduction();
  const db = require("../src/config/database");
  const app = require("../src/app");
  const { signToken } = require("../src/services/tokenService");

  await assertNoDemoData(db);
  const admin = await db("users").where({ role: "ADMIN", account_status: "ACTIVE" }).first();
  if (!admin) throw new Error("No active administrator found. Run `npm run seed` first.");

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokens = { admin: signToken(admin) };
  const counts = {};

  async function api(method, path, token, body) {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(json)}`);
    }
    const key = `${method} ${path.replace(/\d+/g, ":id")}`;
    counts[key] = (counts[key] || 0) + 1;
    return json.data;
  }
  const as = (who) => tokens[who];
  const userByEmail = (e) => db("users").where({ email: e }).first();

  try {
    // 1. Doctors and NGOs register, the administrator reviews them.
    const doctorIds = {};
    for (const [key, d] of Object.entries({ ...DOCTORS, pending: PENDING_DOCTOR, rejected: REJECTED_DOCTOR })) {
      await api("POST", "/api/auth/register/doctor", null, { ...d, password: DEMO_PASSWORD, password_confirmation: DEMO_PASSWORD });
      const user = await userByEmail(d.email);
      const request = await db("join_requests").where({ user_id: user.id }).first();
      if (DOCTORS[key]) {
        await api("PATCH", `/api/admin/join-requests/${request.id}/approve`, as("admin"), {});
        tokens[key] = signToken({ ...user, account_status: "ACTIVE" });
        doctorIds[key] = (await db("doctors").where({ user_id: user.id }).first()).id;
        DOCTORS[key].user_id = user.id;
      } else if (key === "rejected") {
        await api("PATCH", `/api/admin/join-requests/${request.id}/reject`, as("admin"), { rejection_reason: "رقم الترخيص غير مطابق لسجلات نقابة الأطباء. يرجى التواصل مع الإدارة." });
      }
    }
    const ngoIds = {};
    for (const [key, n] of Object.entries({ ...NGOS, pending: PENDING_NGO })) {
      await api("POST", "/api/auth/register/ngo", null, { ...n, password: DEMO_PASSWORD, password_confirmation: DEMO_PASSWORD });
      if (NGOS[key]) {
        const user = await userByEmail(n.email);
        const request = await db("join_requests").where({ user_id: user.id }).first();
        await api("PATCH", `/api/admin/join-requests/${request.id}/approve`, as("admin"), {});
        tokens[`ngo_${key}`] = signToken({ ...user, account_status: "ACTIVE" });
        ngoIds[key] = (await db("ngos").where({ user_id: user.id }).first()).id;
      }
    }

    // 2. Patients register; most submit an intake form.
    const patientIds = {};
    for (const [key, p] of Object.entries(PATIENTS)) {
      await api("POST", "/api/auth/register/patient", null, { ...p, password: DEMO_PASSWORD, password_confirmation: DEMO_PASSWORD });
      const user = await userByEmail(p.email);
      tokens[key] = signToken(user);
      PATIENTS[key].user_id = user.id;
      patientIds[key] = (await db("patients").where({ user_id: user.id }).first()).id;
    }
    const intakeIds = {};
    for (const [key, intake] of Object.entries(INTAKES)) {
      const data = await api("POST", "/api/patient/intake", as(key), intake);
      intakeIds[key] = data.intake.id;
    }
    // asmaa stays SUBMITTED (new in the admin queue); rami has no intake yet.
    for (const key of ["mahmoud", "fatima", "layla", "omar", "heba", "sami"]) {
      await api("PATCH", `/api/admin/patient-intakes/${intakeIds[key]}/start-review`, as("admin"));
    }

    // 3. Administrator assigns doctors (sami is left under review, unassigned).
    const assign = (doctor, patient, reason, notes) =>
      api("POST", "/api/admin/doctor-patient-assignments", as("admin"), {
        doctor_id: doctorIds[doctor], patient_id: patientIds[patient], assignment_reason: reason, ...(notes ? { notes } : {}),
      });
    await assign("mohammad", "mahmoud", "متابعة كسر الساق بعد التثبيت الجراحي");
    await assign("reem", "mahmoud", "برنامج علاج طبيعي وتأهيل للمشي");
    await assign("khaled", "fatima", "ضبط السكري ومتابعة الأدوية المزمنة");
    await assign("khaled", "layla", "متابعة الحروق وتغيير الضمادات", "حالة طفلة، أولوية في المواعيد");
    await assign("yousef", "omar", "متابعة ارتفاع ضغط الدم");
    await assign("sara", "heba", "متابعة نوبات الربو");

    // Workload: Dr. Khaled at capacity (advisory warning), Dr. Yousef unavailable.
    await api("PATCH", `/api/admin/doctors/${doctorIds.khaled}/workload`, as("admin"), { capacity_limit: 2 });
    await api("PATCH", `/api/admin/doctors/${doctorIds.mohammad}/workload`, as("admin"), { capacity_limit: 15 });
    await api("PATCH", `/api/admin/doctors/${doctorIds.yousef}/workload`, as("admin"), { availability: "UNAVAILABLE" });

    // 4. Doctors build the medical picture.
    const P = (key) => `/api/doctor/patients/${patientIds[key]}`;
    await api("POST", `${P("mahmoud")}/medical-record`, as("mohammad"), { blood_type: "O+", allergies: "لا يوجد", chronic_diseases: "لا يوجد", medical_history: "إصابة بشظايا في الساق اليسرى، كسر في عظمة الساق", previous_surgeries: "تثبيت داخلي لكسر الساق في مستشفى ميداني" });
    await api("POST", `${P("mahmoud")}/medical-notes`, as("mohammad"), { note: "الجرح يلتئم بشكل جيد، لا علامات التهاب. يسمح بتحميل جزئي على الساق باستخدام عكازين." });
    await api("POST", `${P("mahmoud")}/medical-notes`, as("reem"), { note: "بدء تمارين تقوية عضلات الفخذ ونطاق حركة الركبة، 3 جلسات أسبوعياً." });
    await api("POST", `${P("mahmoud")}/diagnoses`, as("mohammad"), { diagnosis: "كسر في عظمة الساق اليسرى (Tibial fracture) بعد التثبيت الجراحي" });
    await api("POST", `${P("mahmoud")}/diagnoses`, as("reem"), { diagnosis: "ضعف في عضلات الطرف السفلي وتقييد في حركة الركبة" });

    await api("POST", `${P("fatima")}/medical-record`, as("khaled"), { blood_type: "A+", allergies: "لا يوجد", chronic_diseases: "سكري من النوع الثاني، ارتفاع ضغط الدم", medical_history: "سكري منذ 12 سنة", previous_surgeries: "لا يوجد" });
    await api("POST", `${P("fatima")}/diagnoses`, as("khaled"), { diagnosis: "سكري من النوع الثاني غير منضبط بسبب انقطاع الإنسولين" });
    await api("POST", `${P("fatima")}/medical-notes`, as("khaled"), { note: "قراءة السكر الصباحية 240. تم تعديل جرعة الإنسولين وطلب توفير الإنسولين عبر المؤسسات." });

    await api("POST", `${P("layla")}/medical-record`, as("khaled"), { blood_type: "B+", allergies: "غير معروف", chronic_diseases: "لا يوجد", medical_history: "حروق من الدرجة الثانية في الذراع اليمنى", previous_surgeries: "لا يوجد" });
    await api("POST", `${P("layla")}/diagnoses`, as("khaled"), { diagnosis: "حروق من الدرجة الثانية في الذراع اليمنى (حوالي 4% من مساحة الجسم)" });

    await api("POST", `${P("omar")}/medical-record`, as("yousef"), { blood_type: "AB+", allergies: "لا يوجد", chronic_diseases: "ارتفاع ضغط الدم", medical_history: "ارتفاع ضغط منذ 5 سنوات", previous_surgeries: "لا يوجد" });
    await api("POST", `${P("heba")}/medical-record`, as("sara"), { blood_type: "O-", allergies: "حساسية من البنسلين", chronic_diseases: "ربو", medical_history: "ربو منذ الطفولة، تزايد النوبات مؤخراً", previous_surgeries: "لا يوجد" });

    // 5. Treatment plans with medications and appointments (past and upcoming).
    const plan = async (doctor, patient, body) => (await api("POST", `${P(patient)}/treatment-plans`, as(doctor), body)).treatment_plan;
    const med = async (doctor, planId, body) => (await api("POST", `/api/doctor/treatment-plans/${planId}/medications`, as(doctor), body)).medication;
    const appt = async (doctor, planId, body) => (await api("POST", `/api/doctor/treatment-plans/${planId}/appointments`, as(doctor), body)).appointment;

    const legPlan = await plan("mohammad", "mahmoud", { title: "خطة متابعة وتأهيل كسر الساق", general_instructions: "استخدام العكازين، تحميل جزئي فقط، رفع الساق عند الراحة، مراجعة فورية عند زيادة الألم أو التورم.", start_date: date(-21), end_date: date(60) });
    const legMed = await med("mohammad", legPlan.id, { medication_name: "Ibuprofen 400mg", dosage: "قرص واحد", frequency: "3 مرات يومياً بعد الأكل", duration: "10 أيام", instructions: "لا يؤخذ على معدة فارغة" });
    await med("mohammad", legPlan.id, { medication_name: "Calcium + Vitamin D", dosage: "قرص واحد", frequency: "مرة يومياً", duration: "3 أشهر" });
    await med("mohammad", legPlan.id, { medication_name: "Enoxaparin 40mg", dosage: "حقنة واحدة", frequency: "مرة يومياً", duration: "14 يوم", instructions: "للوقاية من الجلطات" });
    await appt("mohammad", legPlan.id, { appointment_date: dateTime(-7, 10), purpose: "مراجعة الجرح وتصوير أشعة", location: "عيادة العظام - مستشفى ميداني دير البلح", notes: "الالتئام جيد" });
    const legAppt = await appt("mohammad", legPlan.id, { appointment_date: dateTime(3, 11), purpose: "صورة أشعة متابعة للكسر", location: "عيادة العظام - مستشفى ميداني دير البلح" });
    await appt("mohammad", legPlan.id, { appointment_date: dateTime(17, 9, 30), purpose: "تقييم إمكانية التحميل الكامل", location: "عيادة العظام" });

    const rehabPlan = await plan("reem", "mahmoud", { title: "برنامج العلاج الطبيعي", general_instructions: "تمارين منزلية يومية حسب الورقة المرفقة، 3 جلسات أسبوعياً في المركز.", start_date: date(-10), end_date: date(50) });
    await appt("reem", rehabPlan.id, { appointment_date: dateTime(1, 13), purpose: "جلسة علاج طبيعي", location: "مركز التأهيل - النصيرات" });
    await appt("reem", rehabPlan.id, { appointment_date: dateTime(4, 13), purpose: "جلسة علاج طبيعي", location: "مركز التأهيل - النصيرات" });

    const sugarPlan = await plan("khaled", "fatima", { title: "خطة ضبط السكري", general_instructions: "قياس السكر صباحاً ومساءً وتسجيل القراءات، نظام غذائي قليل السكريات.", start_date: date(-14), end_date: date(90) });
    const insulin = await med("khaled", sugarPlan.id, { medication_name: "Insulin Glargine", dosage: "20 وحدة", frequency: "مرة يومياً مساءً", instructions: "يحفظ في مكان بارد" });
    await med("khaled", sugarPlan.id, { medication_name: "Metformin 850mg", dosage: "قرص واحد", frequency: "مرتين يومياً مع الأكل" });
    await appt("khaled", sugarPlan.id, { appointment_date: dateTime(-4, 9), purpose: "مراجعة قراءات السكر", location: "العيادة العامة - خان يونس" });
    await appt("khaled", sugarPlan.id, { appointment_date: dateTime(5, 9), purpose: "فحص السكر التراكمي HbA1c", location: "العيادة العامة - خان يونس" });

    const burnPlan = await plan("khaled", "layla", { title: "خطة علاج الحروق", general_instructions: "تغيير الضمادة كل يومين، الحفاظ على نظافة المكان، عدم فقء البثور.", start_date: date(-8), end_date: date(20) });
    await med("khaled", burnPlan.id, { medication_name: "Silver Sulfadiazine 1% cream", dosage: "طبقة رقيقة", frequency: "مع كل تغيير ضمادة" });
    await med("khaled", burnPlan.id, { medication_name: "Paracetamol syrup", dosage: "10 مل", frequency: "عند الحاجة حتى 3 مرات يومياً" });
    await appt("khaled", burnPlan.id, { appointment_date: dateTime(2, 12), purpose: "تغيير الضمادة ومتابعة الالتئام", location: "نقطة طبية - مركز الإيواء دير البلح" });

    const bpPlan = await plan("yousef", "omar", { title: "خطة ضبط ضغط الدم", general_instructions: "تقليل الملح، المشي اليومي 20 دقيقة، قياس الضغط يومياً.", start_date: date(-30) });
    await med("yousef", bpPlan.id, { medication_name: "Amlodipine 5mg", dosage: "قرص واحد", frequency: "مرة يومياً صباحاً" });

    const asthmaPlan = await plan("sara", "heba", { title: "خطة السيطرة على الربو", general_instructions: "تجنب الدخان والغبار قدر الإمكان، استخدام البخاخ الوقائي يومياً.", start_date: date(-5), end_date: date(45) });
    await med("sara", asthmaPlan.id, { medication_name: "Salbutamol inhaler", dosage: "بختين", frequency: "عند الحاجة" });
    await med("sara", asthmaPlan.id, { medication_name: "Budesonide inhaler", dosage: "بخة واحدة", frequency: "مرتين يومياً" });

    // 6. Patient reminders (future, so they are delivered later by the worker).
    await api("POST", "/api/patient/reminders", as("mahmoud"), { type: "MEDICATION", reference_id: legMed.id, remind_at: dateTime(1, 8, 0, "T") });
    await api("POST", "/api/patient/reminders", as("mahmoud"), { type: "APPOINTMENT", reference_id: legAppt.id, remind_at: dateTime(2, 20, 0, "T") });
    await api("POST", "/api/patient/reminders", as("fatima"), { type: "MEDICATION", reference_id: insulin.id, remind_at: dateTime(1, 19, 0, "T") });

    // 7. Emergency alerts in every state of the workflow.
    const alert = async (who, body) => (await api("POST", who ? "/api/patient/emergency-alerts" : "/api/emergency-alerts", who ? as(who) : null, body)).emergency_alert;
    await alert(null, { phone: "0598765432", location: "مخيم النصيرات - قرب مدرسة الإيواء", description: "طفل مصاب بشظايا في القدم مع نزيف، لا توجد سيارة إسعاف قريبة" });
    await alert(null, { phone: "0567654321", location: "خان يونس - شارع جلال", description: "رجل مسن فقد الوعي، يعاني من السكري" });
    const mahmoudAlert = await alert("mahmoud", { phone: PATIENTS.mahmoud.phone, location: "النصيرات - خيمة رقم 14", description: "ألم شديد وتورم مفاجئ في الساق المصابة" });
    const fatimaAlert = await alert("fatima", { phone: PATIENTS.fatima.phone, location: "خان يونس - مخيم خان يونس", description: "هبوط حاد في السكر وتعرق ورجفة" });
    const hebaAlert = await alert("heba", { phone: PATIENTS.heba.phone, location: "النصيرات - البلد", description: "نوبة ربو شديدة لا تستجيب للبخاخ" });
    const laylaAlert = await alert("layla", { phone: PATIENTS.layla.phone, location: "دير البلح - مركز إيواء", description: "ارتفاع حرارة" });
    await api("PATCH", `/api/patient/emergency-alerts/${laylaAlert.id}/cancel`, as("layla"));

    const assignAlert = (alertId, doctor) => api("PATCH", `/api/admin/emergency-alerts/${alertId}/assign`, as("admin"), { doctor_id: doctorIds[doctor] });
    await assignAlert(mahmoudAlert.id, "sara");
    await api("PATCH", `/api/doctor/emergency-alerts/${mahmoudAlert.id}/status`, as("sara"), { status: "IN_PROGRESS" });
    await assignAlert(fatimaAlert.id, "khaled");
    await api("PATCH", `/api/doctor/emergency-alerts/${fatimaAlert.id}/status`, as("khaled"), { status: "IN_PROGRESS" });
    await api("PATCH", `/api/doctor/emergency-alerts/${fatimaAlert.id}/status`, as("khaled"), { status: "RESOLVED" });
    await assignAlert(hebaAlert.id, "sara");

    // 8. Humanitarian assistance requests through the full workflow.
    const request = async (doctor, patient, body) => (await api("POST", `${P(patient)}/assistance-requests`, as(doctor), body)).assistance_request;
    const assignNgo = (id, ngo) => api("PATCH", `/api/admin/assistance-requests/${id}/assign`, as("admin"), { ngo_id: ngoIds[ngo] });
    const ngoStatus = (ngo, id, status) => api("PATCH", `/api/ngo/assistance-requests/${id}/status`, as(`ngo_${ngo}`), { status });
    const allocate = (ngo, id, body) => api("POST", `/api/ngo/assistance-requests/${id}/resources`, as(`ngo_${ngo}`), body);

    const wheelchair = await request("mohammad", "mahmoud", { request_type: "أجهزة طبية مساعدة", description: "عكازان وكرسي متحرك مؤقت لمريض كسر في الساق يقيم في خيمة" });
    await assignNgo(wheelchair.id, "amal");
    await ngoStatus("amal", wheelchair.id, "UNDER_REVIEW");
    await ngoStatus("amal", wheelchair.id, "APPROVED");
    await allocate("amal", wheelchair.id, { resource_name: "عكازان طبيان", quantity: 2, delivery_date: date(-3), notes: "تم التسليم في نقطة توزيع النصيرات" });
    await allocate("amal", wheelchair.id, { resource_name: "كرسي متحرك", quantity: 1, delivery_date: date(-3) });
    await ngoStatus("amal", wheelchair.id, "COMPLETED");

    const insulinReq = await request("khaled", "fatima", { request_type: "أدوية", description: "توفير إنسولين Glargine لمدة 3 أشهر وجهاز قياس سكر مع شرائط" });
    await assignNgo(insulinReq.id, "shifa");
    await ngoStatus("shifa", insulinReq.id, "UNDER_REVIEW");
    await ngoStatus("shifa", insulinReq.id, "APPROVED");
    await allocate("shifa", insulinReq.id, { resource_name: "أقلام إنسولين Glargine", quantity: 6, delivery_date: date(2), notes: "يحفظ في حافظة تبريد" });

    const dressings = await request("khaled", "layla", { request_type: "مستلزمات طبية", description: "ضمادات حروق معقمة وكريم سلفاديازين لمدة أسبوعين" });
    await assignNgo(dressings.id, "shifa");
    await ngoStatus("shifa", dressings.id, "UNDER_REVIEW");

    await request("sara", "heba", { request_type: "أجهزة طبية", description: "جهاز بخار (Nebulizer) للاستخدام المنزلي بسبب تكرر نوبات الربو" });
    const foodReq = await request("yousef", "omar", { request_type: "غذاء صحي", description: "سلة غذائية قليلة الملح لمريض ضغط" });
    await assignNgo(foodReq.id, "amal");
    await ngoStatus("amal", foodReq.id, "UNDER_REVIEW");
    await ngoStatus("amal", foodReq.id, "REJECTED");

    // 9. Messaging between patients and their assigned doctors.
    const say = (from, to, text) => api("POST", "/api/messages", as(from), { receiver_id: to, message_text: text });
    await say("mahmoud", DOCTORS.mohammad.user_id, "دكتور، الألم يزيد بالليل، هل أزيد جرعة المسكن؟");
    await say("mohammad", PATIENTS.mahmoud.user_id, "لا تزد الجرعة. ارفع الساق على وسادة واستخدم كمادات باردة، وإذا زاد التورم أرسل تنبيه طوارئ.");
    await say("mahmoud", DOCTORS.mohammad.user_id, "تمام، شكراً دكتور.");
    await say("fatima", DOCTORS.khaled.user_id, "قراءة السكر اليوم الصبح 180 بعد الجرعة الجديدة.");
    await say("khaled", PATIENTS.fatima.user_id, "ممتاز، تحسن واضح. استمري على نفس الجرعة وسجلي القراءات.");

    // 10. Intake correction requests: one resolved, one open.
    await api("POST", "/api/patient/intake-correction-requests", as("omar"), { message: "نسيت أذكر أنني أعاني من حساسية خفيفة من الأسبرين." });
    const [omarCorrection] = await db("intake_correction_requests").orderBy("id", "desc").limit(1);
    await api("PATCH", `/api/admin/intake-correction-requests/${omarCorrection.id}/resolve`, as("admin"), { admin_response: "تمت إضافة الملاحظة وإبلاغ الطبيب المعالج." });
    await api("POST", "/api/patient/intake-correction-requests", as("sami"), { message: "الألم بدأ بعد إصابة أثناء النزوح وليس تدريجياً كما كتبت." });

    // ---------- summary ----------
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`\nDemo data created through ${total} API requests.\n`);
    console.log(`Password for every demo account: ${DEMO_PASSWORD}\n`);
    const rows = [
      ["Admin", admin.email, "(existing administrator — use its own password)"],
      ...Object.values(DOCTORS).map((d) => ["Doctor", d.email, `${d.full_name} — ${d.specialization}`]),
      ["Doctor (pending)", PENDING_DOCTOR.email, "awaiting approval"],
      ["Doctor (rejected)", REJECTED_DOCTOR.email, "shows rejection reason on login"],
      ...Object.values(NGOS).map((n) => ["NGO", n.email, n.organization_name]),
      ["NGO (pending)", PENDING_NGO.email, "awaiting approval"],
      ...Object.values(PATIENTS).map((p) => ["Patient", p.email, p.full_name]),
    ];
    for (const [role, mail, note] of rows) console.log(`  ${role.padEnd(18)} ${mail.padEnd(32)} ${note}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exit(1);
});

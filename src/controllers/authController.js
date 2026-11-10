const {
  registerDoctor,
} = require("../services/doctorRegistrationService");
const {
  registerNgo,
} = require("../services/ngoRegistrationService");
const {
  registerPatient,
} = require("../services/patientRegistrationService");
const {
  login,
} = require("../services/loginService");
const formatDateOnly = require("../utils/formatDateOnly");

// ==============================
// Patient Registration
// ==============================

async function registerPatientHandler(req, res) {
  const registration = await registerPatient(
    req.validatedPatientRegistration
  );
  const responseData = {
    ...registration,
    patient: {
      ...registration.patient,
      date_of_birth: formatDateOnly(registration.patient.date_of_birth),
    },
  };

  return res.status(201).json({
    success: true,
    message: "Patient registered successfully",
    data: responseData,
  });
}

// ==============================
// Doctor Registration
// ==============================

async function registerDoctorHandler(req, res) {
  const registration = await registerDoctor(
    req.validatedDoctorRegistration
  );

  return res.status(201).json({
    success: true,
    message: "Doctor registered successfully",
    data: registration,
  });
}

// ==============================
// NGO Registration
// ==============================

async function registerNgoHandler(req, res) {
  const registration = await registerNgo(req.validatedNgoRegistration);

  return res.status(201).json({
    success: true,
    message: "NGO registered successfully",
    data: registration,
  });
}

// ==============================
// Login
// ==============================

async function loginHandler(req, res) {
  const result = await login(req.validatedLogin);
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: result,
  });
}

// ==============================
// Current User
// ==============================

function currentUserHandler(req, res) {
  return res.status(200).json({
    success: true,
    message: "Current user retrieved successfully",
    data: { user: req.user },
  });
}

module.exports = {
  currentUser: currentUserHandler,
  login: loginHandler,
  registerPatient: registerPatientHandler,
  registerDoctor: registerDoctorHandler,
  registerNgo: registerNgoHandler,
};

const {
  DoctorRegistrationConflictError,
  registerDoctor,
} = require("../services/doctorRegistrationService");
const {
  NgoRegistrationConflictError,
  registerNgo,
} = require("../services/ngoRegistrationService");
const {
  DuplicateEmailError,
  DuplicateNationalIdError,
  registerPatient,
} = require("../services/patientRegistrationService");
const {
  InvalidCredentialsError,
  AccountNotActiveError,
  login,
} = require("../services/loginService");
const formatDateOnly = require("../utils/formatDateOnly");

// ==============================
// Patient Registration
// ==============================

async function registerPatientHandler(req, res) {
  try {
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
  } catch (error) {
    if (
      error instanceof DuplicateEmailError ||
      error instanceof DuplicateNationalIdError
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Patient registration failed");

    return res.status(500).json({
      success: false,
      message: "Patient registration failed",
    });
  }
}

// ==============================
// Doctor Registration
// ==============================

async function registerDoctorHandler(req, res) {
  try {
    const registration = await registerDoctor(
      req.validatedDoctorRegistration
    );

    return res.status(201).json({
      success: true,
      message: "Doctor registered successfully",
      data: registration,
    });
  } catch (error) {
    if (error instanceof DoctorRegistrationConflictError) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Doctor registration failed");

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

// ==============================
// NGO Registration
// ==============================

async function registerNgoHandler(req, res) {
  try {
    const registration = await registerNgo(req.validatedNgoRegistration);

    return res.status(201).json({
      success: true,
      message: "NGO registered successfully",
      data: registration,
    });
  } catch (error) {
    if (error instanceof NgoRegistrationConflictError) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    console.error("NGO registration failed");

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

// ==============================
// Login
// ==============================

async function loginHandler(req, res) {
  try {
    const result = await login(req.validatedLogin);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return res.status(401).json({ success: false, message: error.message });
    }

    if (error instanceof AccountNotActiveError) {
      const response = { success: false, message: error.message };
      if (error.application) {
        response.data = { application: error.application };
      }
      return res.status(403).json(response);
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
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

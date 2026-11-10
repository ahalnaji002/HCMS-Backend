// Shared integration-test harness: database safety checks, fixtures,
// helpers, and the per-file lifecycle hooks used by test/integration/*.
// Extracted from the former single profileAuthorization.test.js file.

const { after, before, beforeEach } = require("node:test");

const assert = require("node:assert/strict");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const request = require("supertest");

const app = require("../../src/app");

const db = require("../../src/config/database");

const doctorRoutes = require("../../src/routes/doctorRoutes");

const treatmentAppointmentModel = require("../../src/models/treatmentAppointmentModel");

const treatmentPlanModel = require("../../src/models/treatmentPlanModel");

const { registerDoctor } = require("../../src/services/doctorRegistrationService");

const { registerNgo } = require("../../src/services/ngoRegistrationService");

const { registerPatient } = require("../../src/services/patientRegistrationService");

const { signToken } = require("../../src/services/tokenService");

const systemSettingsSeed = require("../../database/seeds/002_system_settings");

const TEST_PASSWORD_HASH = "test-password-hash";

// Shared fixture object, refilled in place before every test so that
// importing files keep a stable reference.
const users = {};

let testDatabaseVerified = false;

let unsafeTestDatabaseState = false;

async function verifyTestDatabase() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Authorization tests require NODE_ENV=test");
  }

  if (!process.env.TEST_DB_NAME) {
    throw new Error("TEST_DB_NAME is required");
  }

  if (process.env.TEST_DB_NAME === process.env.DB_NAME) {
    throw new Error("TEST_DB_NAME must differ from DB_NAME");
  }

  if (
    process.env.HCMS_ISOLATED_TEST_DB !== "1" ||
    !/^hcms_test_run_[0-9]+_[a-f0-9]{12}$/.test(process.env.TEST_DB_NAME)
  ) {
    throw new Error(
      "Refusing to run database tests without the isolated temporary test runner",
    );
  }

  const result = await db.raw("SELECT DATABASE() AS database_name");
  const databaseName = result[0][0].database_name;

  if (databaseName !== process.env.TEST_DB_NAME) {
    throw new Error(
      `Refusing to run tests against unexpected database: ${databaseName}`,
    );
  }

  testDatabaseVerified = true;
}

function assertTestDatabaseVerified() {
  if (!testDatabaseVerified) {
    throw new Error(
      "Refusing to modify database before test database verification",
    );
  }
}

async function createUser({
  fullName,
  email,
  role,
  accountStatus = "ACTIVE",
  phone = null,
}) {
  const [id] = await db("users").insert({
    full_name: fullName,
    email,
    password_hash: TEST_PASSWORD_HASH,
    role,
    account_status: accountStatus,
    phone,
  });

  return db("users").where({ id }).first();
}

async function createFixtures() {
  const patient = await createUser({
    fullName: "Authorization Patient",
    email: "auth.patient@test.local",
    role: "PATIENT",
    phone: "0591111111",
  });

  await db("patients").insert({
    user_id: patient.id,
    national_id: "123456789",
    date_of_birth: "2000-01-15",
    gender: "MALE",
    address: "Gaza",
  });

  const doctor = await createUser({
    fullName: "Authorization Doctor",
    email: "auth.doctor@test.local",
    role: "DOCTOR",
    phone: "0561111111",
  });

  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "AUTH-DOCTOR-001",
  });

  const ngo = await createUser({
    fullName: "Authorization NGO User",
    email: "auth.ngo@test.local",
    role: "NGO",
  });

  await db("ngos").insert({
    user_id: ngo.id,
    organization_name: "Authorization Test NGO",
    registration_number: "AUTH-NGO-001",
    address: "Gaza",
    contact_phone: "0592222222",
  });

  const admin = await createUser({
    fullName: "Authorization Admin",
    email: "auth.admin@test.local",
    role: "ADMIN",
  });

  const patientProfile = await db("patients")
    .where({ user_id: patient.id })
    .first();

  const doctorProfile = await db("doctors")
    .where({ user_id: doctor.id })
    .first();

  return {
    patient,
    doctor,
    ngo,
    admin,
    patientProfile,
    doctorProfile,
  };
}

function tokenFor(user) {
  return signToken(user);
}

function patientRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five Patient",
    email: "sprint5.patient@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0591234567",
    national_id: "523456789",
    date_of_birth: "1995-04-12",
    gender: "FEMALE",
    address: "Gaza",
    ...overrides,
  };
}

function doctorRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five Doctor",
    email: "sprint5.doctor@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0561234567",
    specialization: "General Medicine",
    license_number: "SPRINT5-DOC-001",
    ...overrides,
  };
}

function ngoRegistration(overrides = {}) {
  return {
    full_name: "Sprint Five NGO User",
    email: "sprint5.ngo@test.local",
    password: "Secure123",
    password_confirmation: "Secure123",
    phone: "0597654321",
    organization_name: "Sprint Five NGO",
    registration_number: "SPRINT5-NGO-001",
    address: "Gaza",
    ...overrides,
  };
}

function patientIntakePayload(overrides = {}) {
  return {
    current_problem: "Recurring headaches",
    symptoms: "Headache and nausea",
    symptom_onset: "About two weeks ago",
    chronic_conditions_answer: "NO",
    medications_answer: "YES",
    medications_details: "Paracetamol",
    allergies_answer: "UNKNOWN",
    additional_information: "Symptoms are worse in the evening",
    ...overrides,
  };
}

async function insertAssignment(overrides = {}) {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
    assignment_reason: "Assignment viewing test",
    notes: "Approved assignment notes",
    ...overrides,
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

async function insertMedicalRecord(overrides = {}) {
  const [id] = await db("medical_records").insert({
    patient_id: users.patientProfile.id,
    blood_type: "O+",
    allergies: "None",
    chronic_diseases: null,
    medical_history: "Test medical history",
    previous_surgeries: null,
    ...overrides,
  });

  return db("medical_records").where({ id }).first();
}

async function insertActiveAssignment() {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

async function insertMedicalNote(overrides = {}) {
  let medicalRecord = await db("medical_records")
    .where({ patient_id: users.patientProfile.id })
    .first();

  if (!medicalRecord) {
    medicalRecord = await insertMedicalRecord();
  }

  const [id] = await db("medical_notes").insert({
    medical_record_id: medicalRecord.id,
    doctor_id: users.doctorProfile.id,
    note: "Test medical note",
    ...overrides,
  });

  return db("medical_notes").where({ id }).first();
}

async function createSecondDoctor() {
  const doctorUser = await createUser({
    fullName: "Second Authorization Doctor",
    email: "auth.doctor2@test.local",
    role: "DOCTOR",
    phone: "0562222222",
  });

  const [doctorId] = await db("doctors").insert({
    user_id: doctorUser.id,
    specialization: "Internal Medicine",
    license_number: "AUTH-DOCTOR-002",
  });

  const doctorProfile = await db("doctors").where({ id: doctorId }).first();

  return {
    user: doctorUser,
    profile: doctorProfile,
  };
}

async function insertTreatmentPlan(overrides = {}) {
  const [id] = await db("treatment_plans").insert({
    patient_id: users.patientProfile.id,
    doctor_id: users.doctorProfile.id,
    title: "Test Treatment Plan",
    general_instructions: "Follow the treatment instructions.",
    status: "ACTIVE",
    start_date: "2026-09-21",
    end_date: "2026-10-21",
    ...overrides,
  });

  return db("treatment_plans").where({ id }).first();
}

function databaseDateOnly(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function databaseDateTime(value) {
  if (value instanceof Date) {
    return `${databaseDateOnly(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 19);
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForBounded(promise, timeoutMs, description) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function captureConnectionBeforeModelLock(model, methodName, connectionArgumentIndex, onCapture) {
  const original = model[methodName];
  model[methodName] = async function captureConnection(...args) {
    const connection = args[connectionArgumentIndex];
    const result = await connection.raw("SELECT CONNECTION_ID() AS connection_id");
    onCapture(Number(result[0][0].connection_id));
    const timeoutResult = await connection.raw(
      "SELECT @@SESSION.innodb_lock_wait_timeout AS lock_wait_timeout",
    );
    const previousLockWaitTimeout = Number(timeoutResult[0][0].lock_wait_timeout);
    await connection.raw("SET SESSION innodb_lock_wait_timeout = 8");
    try {
      return await original.apply(this, args);
    } finally {
      await connection.raw(`SET SESSION innodb_lock_wait_timeout = ${previousLockWaitTimeout}`);
    }
  };
  return () => {
    model[methodName] = original;
  };
}

async function getTreatmentPlanRecordLock(connectionId, planId) {
  const locks = await db("performance_schema.data_locks as held_lock")
    .join(
      "performance_schema.threads as holder_thread",
      "holder_thread.THREAD_ID",
      "held_lock.THREAD_ID",
    )
    .select(
      "held_lock.ENGINE as engine",
      "held_lock.ENGINE_LOCK_ID as engine_lock_id",
      "held_lock.ENGINE_TRANSACTION_ID as engine_transaction_id",
      "held_lock.INDEX_NAME as index_name",
      "held_lock.LOCK_DATA as lock_data",
    )
    .where("holder_thread.PROCESSLIST_ID", connectionId)
    .where("held_lock.OBJECT_NAME", "treatment_plans")
    .where("held_lock.LOCK_TYPE", "RECORD")
    .where("held_lock.LOCK_STATUS", "GRANTED")
    .where("held_lock.INDEX_NAME", "PRIMARY")
    .whereRaw("held_lock.OBJECT_SCHEMA = DATABASE()")
    .orderBy("held_lock.ENGINE_LOCK_ID", "asc");

  if (locks.length !== 1 || locks[0].lock_data == null) {
    throw new Error(
      `Expected exactly one inspectable primary-record lock for treatment plan ${planId} held by MySQL connection ${connectionId}; found ${locks.length}`,
    );
  }
  return locks[0];
}

async function waitForTreatmentPlanLockWait({
  blockingConnectionId,
  requestingConnectionId,
  expectedLock,
  planId,
}) {
  const timeoutMs = 5000;
  const pollIntervalMs = 20;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const lockWait = await db("performance_schema.data_lock_waits as waits")
      .join(
        "performance_schema.threads as blocking_thread",
        "blocking_thread.THREAD_ID",
        "waits.BLOCKING_THREAD_ID",
      )
      .join(
        "performance_schema.threads as requesting_thread",
        "requesting_thread.THREAD_ID",
        "waits.REQUESTING_THREAD_ID",
      )
      .join("performance_schema.data_locks as blocking_lock", function joinBlockingLock() {
        this.on("blocking_lock.ENGINE", "=", "waits.ENGINE")
          .andOn(
            "blocking_lock.ENGINE_LOCK_ID",
            "=",
            "waits.BLOCKING_ENGINE_LOCK_ID",
          )
          .andOn(
            "blocking_lock.ENGINE_TRANSACTION_ID",
            "=",
            "waits.BLOCKING_ENGINE_TRANSACTION_ID",
          );
      })
      .join("performance_schema.data_locks as requested_lock", function joinRequestedLock() {
        this.on("requested_lock.ENGINE", "=", "waits.ENGINE")
          .andOn(
            "requested_lock.ENGINE_LOCK_ID",
            "=",
            "waits.REQUESTING_ENGINE_LOCK_ID",
          )
          .andOn(
            "requested_lock.ENGINE_TRANSACTION_ID",
            "=",
            "waits.REQUESTING_ENGINE_TRANSACTION_ID",
          );
      })
      .select(
        "requesting_thread.PROCESSLIST_ID as requesting_connection_id",
        "requested_lock.ENGINE as engine",
        "requested_lock.ENGINE_LOCK_ID as engine_lock_id",
        "requested_lock.ENGINE_TRANSACTION_ID as engine_transaction_id",
        "requested_lock.INDEX_NAME as index_name",
        "requested_lock.LOCK_DATA as lock_data",
      )
      .where("blocking_thread.PROCESSLIST_ID", blockingConnectionId)
      .where("requesting_thread.PROCESSLIST_ID", requestingConnectionId)
      .where("requested_lock.OBJECT_NAME", "treatment_plans")
      .where("requested_lock.LOCK_TYPE", "RECORD")
      .where("requested_lock.LOCK_STATUS", "WAITING")
      .where("requested_lock.ENGINE", expectedLock.engine)
      .where("requested_lock.INDEX_NAME", expectedLock.index_name)
      .where("requested_lock.LOCK_DATA", expectedLock.lock_data)
      .where("blocking_lock.OBJECT_NAME", "treatment_plans")
      .where("blocking_lock.LOCK_TYPE", "RECORD")
      .where("blocking_lock.LOCK_STATUS", "GRANTED")
      .where("blocking_lock.ENGINE", expectedLock.engine)
      .where("blocking_lock.INDEX_NAME", expectedLock.index_name)
      .where("blocking_lock.LOCK_DATA", expectedLock.lock_data)
      .whereRaw("requested_lock.OBJECT_SCHEMA = DATABASE()")
      .whereRaw("blocking_lock.OBJECT_SCHEMA = DATABASE()")
      .first();

    if (lockWait) return lockWait;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for API connection ${requestingConnectionId} to request the treatment plan ${planId} primary-record lock held by MySQL connection ${blockingConnectionId}`,
  );
}

function observeNextApiOperation(method, routePath) {
  const routeLayer = doctorRoutes.stack.find(
    (layer) => layer.route?.path === routePath && layer.route.methods[method],
  );
  if (!routeLayer || routeLayer.route.stack.length === 0) {
    throw new Error(`Could not instrument ${method.toUpperCase()} ${routePath}`);
  }
  const controllerLayer = routeLayer.route.stack[routeLayer.route.stack.length - 1];
  const original = controllerLayer.handle;
  const queuedOperations = [];
  controllerLayer.handle = async function observeControllerOperation(...args) {
    const operation = queuedOperations.shift();
    if (!operation) return original.apply(this, args);
    operation.started = true;
    operation.startedSignal.resolve();
    try {
      return await original.apply(this, args);
    } finally {
      operation.completed = true;
      operation.completedSignal.resolve();
    }
  };

  return {
    expectNext() {
      const operation = {
        started: false,
        completed: false,
        startedSignal: createDeferred(),
        completedSignal: createDeferred(),
      };
      queuedOperations.push(operation);
      return operation;
    },
    restore() {
      controllerLayer.handle = original;
    },
  };
}

function startBoundedRequest(supertestRequest, serverOperations = [], timeoutMs = 8000) {
  const requestHandle = supertestRequest.timeout({ response: timeoutMs, deadline: timeoutMs });
  const promise = requestHandle.then(
    (response) => response,
    (error) => { throw error; },
  );
  promise.catch(() => {});
  return { requestHandle, promise, serverOperations };
}

async function settleStartedRequests(startedRequests, onWaitingForServer = () => {}) {
  const serverCompletions = startedRequests.flatMap(({ serverOperations }) =>
    serverOperations.map((operation) => operation.completedSignal.promise),
  );
  onWaitingForServer();
  try {
    await waitForBounded(
      Promise.all(serverCompletions),
      10000,
      "competing API service operations and their transactions to complete",
    );
  } catch (error) {
    unsafeTestDatabaseState = true;
    for (const { requestHandle } of startedRequests) requestHandle.abort();
    throw error;
  }

  const settleAll = Promise.allSettled(startedRequests.map(({ promise }) => promise));
  try {
    await waitForBounded(settleAll, 2000, "API responses after server-side completion");
  } catch (error) {
    for (const { requestHandle } of startedRequests) requestHandle.abort();
    try {
      await waitForBounded(settleAll, 1000, "aborted API responses after server-side completion");
    } catch (abortError) {
      error.abortError = abortError;
      throw error;
    }
  }
}

async function cleanupConcurrencyTest(
  { trx, startedRequests, releaseGates, restoreHooks, onWaitingForServer },
  originalError,
) {
  const cleanupErrors = [];
  for (const release of releaseGates) {
    try {
      release();
    } catch (error) {
      unsafeTestDatabaseState = true;
      cleanupErrors.push(error);
    }
  }

  if (trx && !trx.isCompleted()) {
    try {
      await waitForBounded(trx.rollback(), 5000, "blocking transaction rollback");
    } catch (error) {
      unsafeTestDatabaseState = true;
      cleanupErrors.push(error);
    }
  }

  try {
    await settleStartedRequests(startedRequests, onWaitingForServer);
  } catch (error) {
    cleanupErrors.push(error);
  }

  for (const restore of restoreHooks) {
    try {
      restore();
    } catch (error) {
      unsafeTestDatabaseState = true;
      cleanupErrors.push(error);
    }
  }

  if (originalError) {
    if (cleanupErrors.length) originalError.cleanupErrors = cleanupErrors;
    return originalError;
  }
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "Concurrency test cleanup failed");
  }
  return null;
}

async function insertTreatmentMedication(planId, overrides = {}) {
  const [id] = await db("treatment_medications").insert({
    treatment_plan_id: planId,
    medication_name: "Metformin",
    dosage: "500 mg",
    frequency: "Twice daily",
    duration: "30 days",
    instructions: "Take with meals.",
    ...overrides,
  });

  return db("treatment_medications").where({ id }).first();
}

async function insertTreatmentAppointment(planId, overrides = {}) {
  const [id] = await db("treatment_appointments").insert({
    treatment_plan_id: planId,
    appointment_date: "2026-10-15 10:30:00",
    purpose: "Routine follow-up",
    location: "Clinic A",
    status: "SCHEDULED",
    notes: "Bring recent test results.",
    ...overrides,
  });

  return db("treatment_appointments").where({ id }).first();
}

async function createSecondPatient() {
  const patientUser = await createUser({
    fullName: "Second Treatment Patient",
    email: "treatment.patient2@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [patientId] = await db("patients").insert({
    user_id: patientUser.id,
    national_id: "223456789",
    date_of_birth: "2001-01-01",
    gender: "FEMALE",
    address: "Gaza",
  });

  return {
    user: patientUser,
    profile: await db("patients").where({ id: patientId }).first(),
  };
}

async function insertDoctorEmergencyAlert(overrides = {}) {
  const [id] = await db("emergency_alerts").insert({
    patient_id: users.patientProfile.id,
    phone: "0591111111",
    assigned_doctor_id: users.doctorProfile.id,
    assigned_by_admin_id: users.admin.id,
    priority: "HIGH",
    status: "ASSIGNED",
    assigned_at: db.fn.now(),
    ...overrides,
  });

  return db("emergency_alerts").where({ id }).first();
}

async function insertAssistanceRequest(overrides = {}) {
  const [id] = await db("assistance_requests").insert({
    patient_id: users.patientProfile.id,
    doctor_id: users.doctorProfile.id,
    request_type: "Medical supplies",
    description: "Patient requires medical supplies",
    ...overrides,
  });

  return db("assistance_requests").where({ id }).first();
}

async function createSecondPatientForAssistanceRequests() {
  const patientUser = await createUser({
    fullName: "Second Assistance Patient",
    email: "second.assistance.patient@test.local",
    role: "PATIENT",
    phone: "0593333333",
  });

  const [patientId] = await db("patients").insert({
    user_id: patientUser.id,
    national_id: "923456781",
    date_of_birth: "1998-06-20",
    gender: "FEMALE",
    address: "Gaza",
  });

  const patientProfile = await db("patients").where({ id: patientId }).first();

  return { patientUser, patientProfile };
}

async function getPrimaryNgoProfile() {
  return db("ngos").where({ user_id: users.ngo.id }).first();
}

async function createAssistanceNgo({
  email,
  registrationNumber,
  role = "NGO",
  accountStatus = "ACTIVE",
}) {
  const user = await createUser({
    fullName: `Assistance ${registrationNumber}`,
    email,
    role,
    accountStatus,
  });
  const [id] = await db("ngos").insert({
    user_id: user.id,
    organization_name: `Organization ${registrationNumber}`,
    registration_number: registrationNumber,
  });

  return {
    user,
    profile: await db("ngos").where({ id }).first(),
  };
}

async function insertResourceAllocation(requestId, overrides = {}) {
  const [id] = await db("resource_allocations").insert({
    assistance_request_id: requestId,
    resource_name: "Medical supplies",
    quantity: 2,
    ...overrides,
  });

  return db("resource_allocations").where({ id }).first();
}

async function insertMessagingAssignment(overrides = {}) {
  const [id] = await db("doctor_patient_assignments").insert({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
    status: "ACTIVE",
    assignment_reason: "Messaging test assignment",
    ...overrides,
  });

  return db("doctor_patient_assignments").where({ id }).first();
}

async function createMessagingPatient(suffix) {
  const user = await createUser({
    fullName: `Messaging Patient ${suffix}`,
    email: `messaging.patient.${suffix}@test.local`,
    role: "PATIENT",
  });
  const [id] = await db("patients").insert({
    user_id: user.id,
    national_id: `8${String(user.id).padStart(8, "0")}`.slice(-9),
    date_of_birth: "1998-02-03",
    gender: "FEMALE",
  });

  return { user, profile: await db("patients").where({ id }).first() };
}

async function createMessagingDoctor(suffix) {
  const user = await createUser({
    fullName: `Messaging Doctor ${suffix}`,
    email: `messaging.doctor.${suffix}@test.local`,
    role: "DOCTOR",
  });
  const [id] = await db("doctors").insert({
    user_id: user.id,
    specialization: "General Medicine",
    license_number: `MSG-DOCTOR-${suffix}`,
  });

  return { user, profile: await db("doctors").where({ id }).first() };
}

async function insertMessage(overrides = {}) {
  const [id] = await db("messages").insert({
    sender_id: users.patient.id,
    receiver_id: users.doctor.id,
    message_text: "Messaging fixture",
    ...overrides,
  });

  return db("messages").where({ id }).first();
}

async function insertNotification(userId, overrides = {}) {
  const [id] = await db("notifications").insert({
    user_id: userId,
    title: "Test notification",
    message: "Test notification message",
    type: "TREATMENT_PLAN",
    is_read: false,
    reference_type: null,
    reference_id: null,
    read_at: null,
    ...overrides,
  });

  return db("notifications").where({ id }).first();
}

const REMINDER_COLUMNS = [
  "created_at",
  "id",
  "reference_id",
  "reference_type",
  "remind_at",
  "sent_at",
  "status",
  "type",
  "updated_at",
  "user_id",
];

function localDateTimeString(offsetSeconds) {
  const value = new Date(Date.now() + offsetSeconds * 1000);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

async function insertReminder(overrides = {}) {
  const plan = overrides.plan || (await insertTreatmentPlan());
  const reference =
    overrides.reference || (await insertTreatmentMedication(plan.id));
  const payload = {
    user_id: users.patient.id,
    type: "MEDICATION",
    reference_type: "TREATMENT_MEDICATION",
    reference_id: reference.id,
    remind_at: localDateTimeString(3600).replace("T", " "),
    status: "PENDING",
    sent_at: null,
    ...overrides,
  };
  delete payload.plan;
  delete payload.reference;

  const [id] = await db("reminders").insert(payload);
  return db("reminders").where({ id }).first();
}

const ACTIVITY_LOG_COLUMNS = [
  "action",
  "created_at",
  "description",
  "entity_id",
  "entity_type",
  "id",
  "ip_address",
  "user_id",
];

async function insertActivityLog(overrides = {}) {
  const [id] = await db("activity_logs").insert({
    user_id: users.admin.id,
    action: "APPROVE_JOIN_REQUEST",
    entity_type: "JOIN_REQUEST",
    entity_id: "1",
    description: "Join Request #1 approved.",
    ip_address: "127.0.0.1",
    ...overrides,
  });

  return db("activity_logs").where({ id }).first();
}

const SYSTEM_SETTING_COLUMNS = [
  "description",
  "id",
  "setting_key",
  "setting_value",
  "updated_at",
];

async function seedSystemSettings() {
  await systemSettingsSeed.seed(db);
}

const DASHBOARD_KEYS = {
  ADMIN: [
    "active_emergency_alerts",
    "pending_assistance_requests",
    "pending_join_requests",
    "total_doctors",
    "total_ngos",
    "total_patients",
  ],
  PATIENT: [
    "active_emergency_alerts",
    "active_treatment_plans",
    "pending_assistance_requests",
    "pending_reminders",
    "unread_notifications",
  ],
  DOCTOR: [
    "active_patients",
    "assigned_emergency_alerts",
    "submitted_assistance_requests",
  ],
  NGO: ["assigned_assistance_requests", "resource_allocations"],
};

const DASHBOARD_PATHS = {
  ADMIN: "/api/admin/dashboard",
  PATIENT: "/api/patient/dashboard",
  DOCTOR: "/api/doctor/dashboard",
  NGO: "/api/ngo/dashboard",
};

const REPORT_PATHS = [
  "/api/admin/reports/patients",
  "/api/admin/reports/treatment-plans",
  "/api/admin/reports/assistance-requests",
];

function markUnsafeTestDatabaseState() {
  unsafeTestDatabaseState = true;
}

/** Registers the database guard, per-test reset, and final cleanup hooks. */
function registerIntegrationHooks() {
  before(async () => {
    await verifyTestDatabase();
  });

  beforeEach(async () => {
    if (unsafeTestDatabaseState) {
      throw new Error(
        "Refusing to run another database test because server-side API completion was not established",
      );
    }
    assertTestDatabaseVerified();

    await db("activity_logs").del();
    await db("system_settings").del();
    await db("intake_correction_requests").del();
    await db("doctor_diagnoses").del();
    await db("patient_intakes").del();
    await db("notifications").del();
    await db("reminders").del();
    await db("messages").del();
    await db("resource_allocations").del();
    await db("assistance_requests").del();
    await db("emergency_alerts").del();
    await db("medical_notes").del();
    await db("treatment_medications").del();
    await db("treatment_appointments").del();
    await db("treatment_plans").del();
    await db("medical_records").del();
    await db("doctor_patient_assignments").del();
    await db("join_requests").del();
    await db("ngos").del();
    await db("doctors").del();
    await db("patients").del();
    await db("users").del();

    for (const key of Object.keys(users)) delete users[key];
    Object.assign(users, await createFixtures());
    await db("patient_intakes").insert({
      patient_id: users.patientProfile.id,
      current_problem: "Test intake",
      symptoms: "Test symptoms",
      symptom_onset: "Unknown",
      chronic_conditions_answer: "NO",
      medications_answer: "NO",
      allergies_answer: "NO",
      status: "UNDER_REVIEW",
      review_started_at: db.fn.now(),
      review_started_by_admin_id: users.admin.id,
    });
  });

  after(async () => {
    try {
      if (testDatabaseVerified && !unsafeTestDatabaseState) {
        await db("activity_logs").del();
        await db("system_settings").del();
        await db("intake_correction_requests").del();
        await db("doctor_diagnoses").del();
        await db("patient_intakes").del();
        await db("notifications").del();
        await db("reminders").del();
        await db("messages").del();
        await db("resource_allocations").del();
        await db("assistance_requests").del();
        await db("emergency_alerts").del();
        await db("medical_notes").del();
        await db("treatment_medications").del();
        await db("treatment_appointments").del();
        await db("treatment_plans").del();
        await db("medical_records").del();
        await db("doctor_patient_assignments").del();
        await db("join_requests").del();
        await db("ngos").del();
        await db("doctors").del();
        await db("patients").del();
        await db("users").del();
      }
    } finally {
      await db.destroy();
    }
  });

}

module.exports = {
  assert,
  bcrypt,
  jwt,
  request,
  app,
  db,
  doctorRoutes,
  treatmentAppointmentModel,
  treatmentPlanModel,
  registerDoctor,
  registerNgo,
  registerPatient,
  signToken,
  systemSettingsSeed,
  TEST_PASSWORD_HASH,
  users,
  verifyTestDatabase,
  assertTestDatabaseVerified,
  createUser,
  createFixtures,
  tokenFor,
  patientRegistration,
  doctorRegistration,
  ngoRegistration,
  patientIntakePayload,
  insertAssignment,
  insertMedicalRecord,
  insertActiveAssignment,
  insertMedicalNote,
  createSecondDoctor,
  insertTreatmentPlan,
  databaseDateOnly,
  databaseDateTime,
  createDeferred,
  waitForBounded,
  captureConnectionBeforeModelLock,
  getTreatmentPlanRecordLock,
  waitForTreatmentPlanLockWait,
  observeNextApiOperation,
  startBoundedRequest,
  settleStartedRequests,
  cleanupConcurrencyTest,
  insertTreatmentMedication,
  insertTreatmentAppointment,
  createSecondPatient,
  insertDoctorEmergencyAlert,
  insertAssistanceRequest,
  createSecondPatientForAssistanceRequests,
  getPrimaryNgoProfile,
  createAssistanceNgo,
  insertResourceAllocation,
  insertMessagingAssignment,
  createMessagingPatient,
  createMessagingDoctor,
  insertMessage,
  insertNotification,
  REMINDER_COLUMNS,
  localDateTimeString,
  insertReminder,
  ACTIVITY_LOG_COLUMNS,
  insertActivityLog,
  SYSTEM_SETTING_COLUMNS,
  seedSystemSettings,
  DASHBOARD_KEYS,
  DASHBOARD_PATHS,
  REPORT_PATHS,
  markUnsafeTestDatabaseState,
  registerIntegrationHooks,
};

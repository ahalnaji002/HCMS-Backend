const { test } = require("node:test");
const assert = require("node:assert/strict");

const SwaggerParser = require("@apidevtools/swagger-parser");
const swaggerSpec = require("../src/config/swagger");
const {
  validateResolveCorrectionRequest,
} = require("../src/middleware/validateIntakeCorrectionRequest");
const { validateIntakePayload } = require("../src/middleware/validatePatientIntake");

function invokeValidator(validator, body) {
  const req = { body };
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
  };

  validator(req, res, () => {
    nextCalled = true;
  });

  return { req, statusCode, responseBody, nextCalled };
}

function validIntake(overrides = {}) {
  return {
    current_problem: "Recurring headaches",
    symptoms: "Headache and nausea",
    symptom_onset: "Unknown",
    chronic_conditions_answer: "NO",
    medications_answer: "NO",
    allergies_answer: "NO",
    ...overrides,
  };
}

test("OpenAPI document validates and describes all configured paths", async () => {
  const validated = await SwaggerParser.validate(swaggerSpec);
  assert.equal(validated.openapi, "3.0.3");
  assert.ok(Object.keys(validated.paths).length > 0);
  assert.ok(validated.paths["/api/patient/intake"]);
});

test("Sprint 9.1 OpenAPI contracts describe assignment, medical, and treatment rules", async () => {
  const validated = await SwaggerParser.validate(swaggerSpec);
  const assignment = validated.paths["/api/admin/doctor-patient-assignments"];
  assert.ok(assignment.post);
  assert.equal(assignment.post.responses["201"].description, "Doctor-patient assignment created successfully");
  assert.ok(validated.paths["/api/admin/doctor-patient-assignments/{id}/status"].patch.responses["409"]);

  const notes = validated.paths["/api/doctor/patients/{patientId}/medical-notes"];
  assert.ok(notes.get && notes.post);
  assert.equal(notes.patch, undefined);
  assert.equal(notes.delete, undefined);
  assert.ok(validated.paths["/api/doctor/patients/{patientId}/medical-record"].post.responses["409"]);

  assert.ok(validated.paths["/api/doctor/treatment-plans/{planId}/medications/{medicationId}"].delete.responses["200"]);
  assert.ok(validated.paths["/api/doctor/treatment-plans/{planId}/appointments/{appointmentId}"].delete.responses["200"]);
  const medication = validated.components.schemas.TreatmentMedication;
  assert.equal(medication.properties.status, undefined);
  const appointmentDate = validated.components.schemas.TreatmentAppointment.properties.appointment_date;
  assert.equal(appointmentDate.format, undefined);
  assert.equal(appointmentDate.pattern, "^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$");
  assert.match(appointmentDate.description, /Asia\/Hebron/);
  const planSchema = validated.components.schemas.TreatmentPlan;
  assert.equal(planSchema.properties.start_date.format, "date");
  assert.equal(planSchema.properties.end_date.format, "date");
  assert.equal(planSchema.properties.end_date.nullable, true);
  const appointmentRequest = validated.paths["/api/doctor/treatment-plans/{planId}/appointments"].post.requestBody.content["application/json"].schema.properties.appointment_date;
  assert.equal(appointmentRequest.format, undefined);
  assert.equal(appointmentRequest.pattern, appointmentDate.pattern);
  assert.match(appointmentRequest.description, /Asia\/Hebron/);
  const planRequest = validated.paths["/api/doctor/patients/{patientId}/treatment-plans"].post.requestBody.content["application/json"].schema.properties.start_date;
  assert.equal(planRequest.format, "date");
  assert.match(validated.paths["/api/doctor/patients/{patientId}/treatment-plans/{planId}"].patch.description, /existing appointment/i);
});

test("correction resolution requires a non-whitespace admin response", () => {
  for (const body of [{}, { admin_response: null }, { admin_response: "" }, { admin_response: " \t\n " }]) {
    const result = invokeValidator(validateResolveCorrectionRequest, body);
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
    assert.ok(result.responseBody.errors.admin_response);
  }

  const accepted = invokeValidator(validateResolveCorrectionRequest, {
    admin_response: "  Reviewed and recorded.  ",
  });
  assert.equal(accepted.nextCalled, true);
  assert.equal(accepted.req.validatedAdminResponse, "Reviewed and recorded.");
});

test("symptom_onset accepts 255 characters and rejects 256", () => {
  const boundary = invokeValidator(validateIntakePayload, validIntake({
    symptom_onset: "ع".repeat(255),
  }));
  assert.equal(boundary.nextCalled, true);
  assert.equal(Array.from(boundary.req.validatedPatientIntake.symptom_onset).length, 255);

  const tooLong = invokeValidator(validateIntakePayload, validIntake({
    symptom_onset: "ع".repeat(256),
  }));
  assert.equal(tooLong.nextCalled, false);
  assert.equal(tooLong.statusCode, 400);
  assert.ok(tooLong.responseBody.errors.symptom_onset);
});

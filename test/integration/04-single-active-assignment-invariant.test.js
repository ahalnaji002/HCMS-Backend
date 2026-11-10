const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  request,
  app,
  db,
  users,
  tokenFor,
  insertAssignment,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Single Active Assignment Invariant
registerIntegrationHooks();

test("multiple inactive historical assignments are allowed for the same pair", async () => {
  const first = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-17 10:00:00",
  });
  const second = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });

  const historicalAssignments = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      status: "INACTIVE",
    })
    .orderBy("id", "asc");

  assert.equal(historicalAssignments.length, 2);
  assert.deepEqual(
    historicalAssignments.map((assignment) => assignment.id),
    [first.id, second.id],
  );
});

test("deactivation allows a new active assignment while preserving history", async () => {
  const original = await insertAssignment({
    assignment_reason: "Original assignment",
  });
  const token = tokenFor(users.admin);

  const deactivationResponse = await request(app)
    .patch(`/api/admin/doctor-patient-assignments/${original.id}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "INACTIVE" });

  assert.equal(deactivationResponse.status, 200);

  const creationResponse = await request(app)
    .post("/api/admin/doctor-patient-assignments")
    .set("Authorization", `Bearer ${token}`)
    .send({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
      assignment_reason: "Replacement assignment",
    });

  assert.equal(creationResponse.status, 201);

  const assignments = await db("doctor_patient_assignments")
    .where({
      doctor_id: users.doctorProfile.id,
      patient_id: users.patientProfile.id,
    })
    .orderBy("id", "asc");

  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].id, original.id);
  assert.equal(assignments[0].status, "INACTIVE");
  assert.ok(assignments[0].ended_at);
  assert.equal(assignments[0].assignment_reason, "Original assignment");
  assert.equal(assignments[1].status, "ACTIVE");
  assert.equal(assignments[1].ended_at, null);
  assert.equal(assignments[1].assignment_reason, "Replacement assignment");
});

test("concurrent creation and reactivation preserve one active assignment", async () => {
  const historical = await insertAssignment({
    status: "INACTIVE",
    ended_at: "2026-09-18 10:00:00",
  });
  const token = tokenFor(users.admin);

  const [creationResponse, reactivationResponse] = await Promise.all([
    request(app)
      .post("/api/admin/doctor-patient-assignments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        doctor_id: users.doctorProfile.id,
        patient_id: users.patientProfile.id,
        assignment_reason: "Concurrent replacement",
      }),
    request(app)
      .patch(`/api/admin/doctor-patient-assignments/${historical.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ACTIVE" }),
  ]);

  const responses = [creationResponse, reactivationResponse];
  const conflictResponses = responses.filter(
    (response) => response.status === 409,
  );
  const successfulResponses = responses.filter(
    (response) => response.status === 200 || response.status === 201,
  );

  assert.equal(conflictResponses.length, 1);
  assert.equal(successfulResponses.length, 1);
  assert.equal(
    conflictResponses[0].body.message,
    "An active assignment already exists for this doctor and patient",
  );

  const assignments = await db("doctor_patient_assignments").where({
    doctor_id: users.doctorProfile.id,
    patient_id: users.patientProfile.id,
  });
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "ACTIVE",
  );

  assert.equal(activeAssignments.length, 1);
  assert.ok(assignments.some((assignment) => assignment.id === historical.id));
});

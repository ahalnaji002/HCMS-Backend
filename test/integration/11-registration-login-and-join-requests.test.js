const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  bcrypt,
  jwt,
  request,
  app,
  db,
  registerDoctor,
  registerNgo,
  registerPatient,
  users,
  createUser,
  tokenFor,
  patientRegistration,
  doctorRegistration,
  ngoRegistration,
  registerIntegrationHooks,
} = require("../helpers/integrationHarness");

// Registration, Login and Join Request Review
registerIntegrationHooks();

test("patient registration creates one active patient account with a hashed password", async () => {
  const payload = patientRegistration();
  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.role, "PATIENT");
  assert.equal(response.body.data.user.account_status, "ACTIVE");
  assert.equal(response.body.data.patient.date_of_birth, "1995-04-12");
  assert.equal(response.body.data.patient.national_id, payload.national_id);
  assert.equal("password_hash" in response.body.data.user, false);

  const user = await db("users").where({ email: payload.email }).first();
  const patient = await db("patients").where({ user_id: user.id }).first();
  const joinRequest = await db("join_requests").where({ user_id: user.id }).first();

  assert.ok(user);
  assert.ok(patient);
  assert.equal(patient.national_id, payload.national_id);
  assert.equal(joinRequest, undefined);
  assert.notEqual(user.password_hash, payload.password);
  assert.equal(await bcrypt.compare(payload.password, user.password_hash), true);
});

test("patient registration rejects missing and malformed national IDs", async () => {
  const cases = [
    undefined,
    "12345678",
    "1234567890",
    "12345A789",
    "023456789",
  ];

  for (const nationalId of cases) {
    const response = await request(app)
      .post("/api/auth/register/patient")
      .send(patientRegistration({ national_id: nationalId }));

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.equal(
      response.body.errors.national_id,
      "national_id must be exactly 9 digits and must not start with 0",
    );
  }

  assert.equal(
    Number((await db("users").where({ email: "sprint5.patient@test.local" }).count("id as count"))[0].count),
    0,
  );
});

test("patient registration enforces the approved phone date and password rules", async () => {
  const cases = [
    [
      patientRegistration({ phone: "0581234567" }),
      "phone",
    ],
    [
      patientRegistration({ date_of_birth: "2025-02-29" }),
      "date_of_birth",
    ],
    [
      patientRegistration({ password: "lowercase1", password_confirmation: "lowercase1" }),
      "password",
    ],
    [
      patientRegistration({ password_confirmation: "Different123" }),
      "password_confirmation",
    ],
  ];

  for (const [payload, field] of cases) {
    const response = await request(app)
      .post("/api/auth/register/patient")
      .send(payload);

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Validation failed");
    assert.ok(response.body.errors[field]);
  }

  assert.equal(
    Number((await db("users").where("email", "like", "sprint5.patient%@test.local").count("id as count"))[0].count),
    0,
  );
});

test("patient registration rejects a duplicate email without creating a second profile", async () => {
  const payload = patientRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/patient").send(payload)).status,
    201,
  );

  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(payload);

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "An account with this email already exists");
  assert.equal(
    Number((await db("users").where({ email: payload.email }).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("patients").join("users", "users.id", "patients.user_id").where("users.email", payload.email).count("patients.id as count"))[0].count),
    1,
  );
});

test("patient registration rejects a duplicate national ID without partial records", async () => {
  const original = patientRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/patient").send(original)).status,
    201,
  );

  const duplicate = patientRegistration({
    email: "sprint5.patient2@test.local",
  });
  const response = await request(app)
    .post("/api/auth/register/patient")
    .send(duplicate);

  assert.equal(response.status, 409);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "A patient with this national ID already exists");
  assert.equal(
    await db("users").where({ email: duplicate.email }).first(),
    undefined,
  );
  assert.equal(
    Number((await db("patients").where({ national_id: original.national_id }).count("id as count"))[0].count),
    1,
  );
});

test("patient registration rolls back the user when profile creation fails", async () => {
  const payload = patientRegistration({
    email: "rollback.patient@test.local",
    gender: "INVALID",
  });

  await assert.rejects(registerPatient(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("patients").join("users", "users.id", "patients.user_id").where("users.email", payload.email).count("patients.id as count"))[0].count),
    0,
  );
});

test("doctor registration atomically creates an inactive account profile and pending request", async () => {
  const payload = doctorRegistration();
  const response = await request(app)
    .post("/api/auth/register/doctor")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, "DOCTOR");
  assert.equal(response.body.data.user.account_status, "INACTIVE");
  assert.equal(response.body.data.join_request.request_type, "DOCTOR");
  assert.equal(response.body.data.join_request.status, "PENDING");

  const user = await db("users").where({ email: payload.email }).first();
  assert.ok(await db("doctors").where({ user_id: user.id }).first());
  assert.ok(
    await db("join_requests")
      .where({ user_id: user.id, request_type: "DOCTOR", status: "PENDING" })
      .first(),
  );
});

test("doctor registration rejects duplicate email and license conflicts", async () => {
  const payload = doctorRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/doctor").send(payload)).status,
    201,
  );

  const duplicateEmail = await request(app)
    .post("/api/auth/register/doctor")
    .send(doctorRegistration({ license_number: "SPRINT5-DOC-002" }));
  const duplicateLicense = await request(app)
    .post("/api/auth/register/doctor")
    .send(doctorRegistration({ email: "sprint5.doctor2@test.local" }));

  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateLicense.status, 409);
  assert.equal(
    Number((await db("users").whereIn("email", [payload.email, "sprint5.doctor2@test.local"]).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("doctors").where({ license_number: payload.license_number }).count("id as count"))[0].count),
    1,
  );
});

test("concurrent doctor registration leaves one complete registration and no partial rows", async () => {
  const payload = doctorRegistration();
  const responses = await Promise.all([
    request(app).post("/api/auth/register/doctor").send(payload),
    request(app).post("/api/auth/register/doctor").send(payload),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409],
  );

  const registeredUsers = await db("users").where({ email: payload.email });
  assert.equal(registeredUsers.length, 1);
  assert.equal(
    Number((await db("doctors").where({ user_id: registeredUsers[0].id }).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("join_requests").where({ user_id: registeredUsers[0].id }).count("id as count"))[0].count),
    1,
  );
});

test("doctor registration rolls back the user when profile creation fails", async () => {
  const payload = doctorRegistration({
    email: "rollback.doctor@test.local",
    specialization: null,
    license_number: "ROLLBACK-DOC-001",
  });

  await assert.rejects(registerDoctor(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("doctors").where({ license_number: payload.license_number }).count("id as count"))[0].count),
    0,
  );
});

test("NGO registration atomically creates an inactive account profile and pending request", async () => {
  const payload = ngoRegistration();
  const response = await request(app)
    .post("/api/auth/register/ngo")
    .send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, "NGO");
  assert.equal(response.body.data.user.account_status, "INACTIVE");
  assert.equal(response.body.data.ngo.contact_phone, payload.phone);
  assert.equal(response.body.data.join_request.request_type, "NGO");
  assert.equal(response.body.data.join_request.status, "PENDING");

  const user = await db("users").where({ email: payload.email }).first();
  assert.ok(await db("ngos").where({ user_id: user.id }).first());
  assert.ok(await db("join_requests").where({ user_id: user.id, status: "PENDING" }).first());
});

test("NGO registration rejects duplicate email and registration number conflicts", async () => {
  const payload = ngoRegistration();
  assert.equal(
    (await request(app).post("/api/auth/register/ngo").send(payload)).status,
    201,
  );

  const duplicateEmail = await request(app)
    .post("/api/auth/register/ngo")
    .send(ngoRegistration({ registration_number: "SPRINT5-NGO-002" }));
  const duplicateRegistration = await request(app)
    .post("/api/auth/register/ngo")
    .send(ngoRegistration({ email: "sprint5.ngo2@test.local" }));

  assert.equal(duplicateEmail.status, 409);
  assert.equal(duplicateRegistration.status, 409);
  assert.equal(
    Number((await db("users").whereIn("email", [payload.email, "sprint5.ngo2@test.local"]).count("id as count"))[0].count),
    1,
  );
  assert.equal(
    Number((await db("ngos").where({ registration_number: payload.registration_number }).count("id as count"))[0].count),
    1,
  );
});

test("NGO registration rolls back the user when profile creation fails", async () => {
  const payload = ngoRegistration({
    email: "rollback.ngo@test.local",
    organization_name: null,
    registration_number: "ROLLBACK-NGO-001",
  });

  await assert.rejects(registerNgo(payload));
  assert.equal(await db("users").where({ email: payload.email }).first(), undefined);
  assert.equal(
    Number((await db("ngos").where({ registration_number: payload.registration_number }).count("id as count"))[0].count),
    0,
  );
});

test("login issues a role-bearing JWT and grants access to a protected route", async () => {
  const payload = patientRegistration();
  await request(app).post("/api/auth/register/patient").send(payload);

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: `  ${payload.email}  `, password: payload.password });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.role, "PATIENT");
  assert.equal("password_hash" in response.body.data.user, false);

  const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
  assert.equal(decoded.role, "PATIENT");
  assert.equal(String(decoded.user_id), String(response.body.data.user.id));
  assert.equal(typeof decoded.exp, "number");

  const me = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${response.body.data.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, payload.email);
});

test("login safely rejects a wrong password and an unknown account", async () => {
  const payload = patientRegistration();
  await request(app).post("/api/auth/register/patient").send(payload);

  for (const credentials of [
    { email: payload.email, password: "Wrong123" },
    { email: "missing@test.local", password: "Wrong123" },
  ]) {
    const response = await request(app).post("/api/auth/login").send(credentials);
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Invalid email or password");
  }
});

test("login rejects inactive unapproved accounts", async () => {
  const payload = doctorRegistration();
  const registration = await request(app)
    .post("/api/auth/register/doctor")
    .send(payload);
  const joinRequestId = registration.body.data.join_request.id;

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, "Account is not active");
  assert.deepEqual(response.body.data.application, {
    request_type: "DOCTOR",
    status: "PENDING",
    rejection_reason: null,
    submitted_at: response.body.data.application.submitted_at,
    reviewed_at: null,
  });
  assert.ok(response.body.data.application.submitted_at);
  assert.equal("token" in response.body.data, false);

  const wrongPassword = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: "Wrong123" });
  assert.equal(wrongPassword.status, 401);
  assert.equal("data" in wrongPassword.body, false);

  const joinRequest = await db("join_requests")
    .where({ id: joinRequestId })
    .first();
  assert.equal(joinRequest.status, "PENDING");
});

test("login returns the rejection reason to an authenticated inactive applicant", async () => {
  const payload = ngoRegistration();
  const registration = await request(app)
    .post("/api/auth/register/ngo")
    .send(payload);
  const joinRequestId = registration.body.data.join_request.id;
  const rejectionReason = "Organization registration could not be verified.";

  await db("join_requests").where({ id: joinRequestId }).update({
    status: "REJECTED",
    rejection_reason: rejectionReason,
    reviewed_by_admin_id: users.admin.id,
    reviewed_at: db.fn.now(),
  });

  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body.data.application, {
    request_type: "NGO",
    status: "REJECTED",
    rejection_reason: rejectionReason,
    submitted_at: response.body.data.application.submitted_at,
    reviewed_at: response.body.data.application.reviewed_at,
  });
  assert.ok(response.body.data.application.submitted_at);
  assert.ok(response.body.data.application.reviewed_at);
  assert.equal("token" in response.body.data, false);
});

test("protected routes reject malformed invalid and expired JWTs", async () => {
  const expiredToken = jwt.sign(
    { user_id: users.patient.id, role: "PATIENT" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: -1 },
  );

  for (const authorization of [
    "Bearer not-a-jwt",
    `Bearer ${expiredToken}`,
    "Basic credentials",
  ]) {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", authorization);
    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
    assert.equal(response.body.message, "Authentication required");
  }
});

test("join request review endpoints enforce authentication and ADMIN authorization", async () => {
  const unauthenticated = await request(app).get("/api/admin/join-requests");
  const forbidden = await request(app)
    .get("/api/admin/join-requests")
    .set("Authorization", `Bearer ${tokenFor(users.patient)}`);

  assert.equal(unauthenticated.status, 401);
  assert.equal(forbidden.status, 403);
});

test("admin approval updates request and user states with fresh timestamps", async () => {
  const oldTimestamp = "2020-01-01 00:00:00";
  const doctor = await createUser({
    fullName: "Pending Doctor",
    email: "pending.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "PENDING-DOC-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: doctor.id,
    request_type: "DOCTOR",
    created_at: oldTimestamp,
    updated_at: oldTimestamp,
  });
  await db("users").where({ id: doctor.id }).update({ updated_at: oldTimestamp });

  const response = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.data.join_request.status, "APPROVED");
  assert.equal(response.body.data.join_request.user.account_status, "ACTIVE");
  assert.equal(String(response.body.data.join_request.reviewed_by_admin_id), String(users.admin.id));
  assert.ok(response.body.data.join_request.reviewed_at);

  const reviewed = await db("join_requests").where({ id: requestId }).first();
  const activated = await db("users").where({ id: doctor.id }).first();
  assert.ok(new Date(reviewed.updated_at).getTime() > new Date(oldTimestamp).getTime());
  assert.ok(new Date(activated.updated_at).getTime() > new Date(oldTimestamp).getTime());
});

test("admin rejection updates request state and timestamp while keeping the account inactive", async () => {
  const oldTimestamp = "2020-01-01 00:00:00";
  const ngo = await createUser({
    fullName: "Pending NGO",
    email: "pending.ngo@test.local",
    role: "NGO",
    accountStatus: "INACTIVE",
  });
  await db("ngos").insert({
    user_id: ngo.id,
    organization_name: "Pending NGO",
    registration_number: "PENDING-NGO-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: ngo.id,
    request_type: "NGO",
    created_at: oldTimestamp,
    updated_at: oldTimestamp,
  });

  const response = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/reject`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({ rejection_reason: "Verification documents are incomplete" });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.join_request.status, "REJECTED");
  assert.equal(response.body.data.join_request.user.account_status, "INACTIVE");
  assert.equal(
    response.body.data.join_request.rejection_reason,
    "Verification documents are incomplete",
  );

  const reviewed = await db("join_requests").where({ id: requestId }).first();
  assert.ok(new Date(reviewed.updated_at).getTime() > new Date(oldTimestamp).getTime());
});

test("join request review rejects missing and already reviewed requests", async () => {
  const missing = await request(app)
    .patch("/api/admin/join-requests/999999999/approve")
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});
  assert.equal(missing.status, 404);

  const doctor = await createUser({
    fullName: "Reviewed Doctor",
    email: "reviewed.doctor@test.local",
    role: "DOCTOR",
    accountStatus: "INACTIVE",
  });
  await db("doctors").insert({
    user_id: doctor.id,
    specialization: "General Medicine",
    license_number: "REVIEWED-DOC-001",
  });
  const [requestId] = await db("join_requests").insert({
    user_id: doctor.id,
    request_type: "DOCTOR",
  });

  const first = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});
  const repeated = await request(app)
    .patch(`/api/admin/join-requests/${requestId}/approve`)
    .set("Authorization", `Bearer ${tokenFor(users.admin)}`)
    .send({});

  assert.equal(first.status, 200);
  assert.equal(repeated.status, 409);
  assert.equal(repeated.body.message, "Join request has already been reviewed");
});

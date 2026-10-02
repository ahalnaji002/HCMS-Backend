/**
 * @openapi
 * components:
 *   schemas:
 *
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         full_name:
 *           type: string
 *           maxLength: 150
 *           example: Ahmed Alnaji
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: ahmed@example.com
 *         role:
 *           type: string
 *           enum: [PATIENT, DOCTOR, NGO, ADMIN]
 *           example: PATIENT
 *         account_status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: ACTIVE
 *         phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *           example: '0591234567'
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     PatientProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - national_id
 *             - date_of_birth
 *             - gender
 *           properties:
 *             national_id:
 *               type: string
 *               pattern: '^[1-9][0-9]{8}$'
 *               description: Palestinian national ID. Must contain exactly 9 digits and must not start with 0.
 *               example: '123456789'
 *             date_of_birth:
 *               type: string
 *               format: date
 *               example: '2002-05-15'
 *             gender:
 *               type: string
 *               enum: [MALE, FEMALE]
 *               example: MALE
 *             address:
 *               type: string
 *               nullable: true
 *               maxLength: 255
 *               example: Gaza, Palestine
 *
 *     DoctorProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - specialization
 *             - license_number
 *           properties:
 *             specialization:
 *               type: string
 *               maxLength: 100
 *               example: General Medicine
 *             license_number:
 *               type: string
 *               maxLength: 100
 *               example: MED-2026-001
 *
 *     NgoProfile:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           required:
 *             - organization_name
 *           properties:
 *             organization_name:
 *               type: string
 *               maxLength: 150
 *               example: Gaza Medical Relief
 *             registration_number:
 *               type: string
 *               nullable: true
 *               maxLength: 100
 *               example: NGO-2026-001
 *             address:
 *               type: string
 *               nullable: true
 *               maxLength: 255
 *               example: Gaza, Palestine
 *             contact_phone:
 *               type: string
 *               nullable: true
 *               pattern: '^(059|056)[0-9]{7}$'
 *               example: '0591234567'
 *
 *     AdminProfile:
 *       $ref: '#/components/schemas/User'
 *
 *     AdminDashboard:
 *       type: object
 *       required:
 *         - total_patients
 *         - total_doctors
 *         - total_ngos
 *         - pending_join_requests
 *         - active_emergency_alerts
 *         - pending_assistance_requests
 *       properties:
 *         total_patients:
 *           type: integer
 *           example: 25
 *         total_doctors:
 *           type: integer
 *           example: 8
 *         total_ngos:
 *           type: integer
 *           example: 4
 *         pending_join_requests:
 *           type: integer
 *           example: 3
 *         active_emergency_alerts:
 *           type: integer
 *           example: 2
 *         pending_assistance_requests:
 *           type: integer
 *           example: 6
 *
 *     PatientDashboard:
 *       type: object
 *       required: [active_treatment_plans, pending_reminders, active_emergency_alerts, pending_assistance_requests, unread_notifications]
 *       properties:
 *         active_treatment_plans:
 *           type: integer
 *         pending_reminders:
 *           type: integer
 *         active_emergency_alerts:
 *           type: integer
 *         pending_assistance_requests:
 *           type: integer
 *         unread_notifications:
 *           type: integer
 *
 *     MedicalRecord:
 *       type: object
 *       required: [id, patient_id, blood_type, allergies, chronic_diseases, medical_history, previous_surgeries, created_at, updated_at]
 *       properties:
 *         id:
 *           type: integer
 *         patient_id:
 *           type: integer
 *         blood_type:
 *           type: string
 *           nullable: true
 *         allergies:
 *           type: string
 *           nullable: true
 *         chronic_diseases:
 *           type: string
 *           nullable: true
 *         medical_history:
 *           type: string
 *           nullable: true
 *         previous_surgeries:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     TreatmentPlan:
 *       type: object
 *       required: [id, patient_id, doctor_id, title, general_instructions, status, start_date, end_date, created_at, updated_at]
 *       properties:
 *         id:
 *           type: integer
 *         patient_id:
 *           type: integer
 *         doctor_id:
 *           type: integer
 *         title:
 *           type: string
 *         general_instructions:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [ACTIVE, COMPLETED, CANCELLED]
 *         start_date:
 *           type: string
 *           format: date
 *         end_date:
 *           type: string
 *           format: date
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     TreatmentMedication:
 *       type: object
 *       required: [id, treatment_plan_id, medication_name, dosage, frequency, duration, instructions, created_at, updated_at]
 *       properties:
 *         id:
 *           type: integer
 *         treatment_plan_id:
 *           type: integer
 *         medication_name:
 *           type: string
 *         dosage:
 *           type: string
 *         frequency:
 *           type: string
 *         duration:
 *           type: string
 *           nullable: true
 *         instructions:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     TreatmentAppointment:
 *       type: object
 *       required: [id, treatment_plan_id, appointment_date, purpose, location, status, notes, created_at, updated_at]
 *       properties:
 *         id:
 *           type: integer
 *         treatment_plan_id:
 *           type: integer
 *         appointment_date:
 *           type: string
 *           format: date-time
 *           description: Local datetime formatted as YYYY-MM-DD HH:mm:ss.
 *         purpose:
 *           type: string
 *         location:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *         notes:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     Reminder:
 *       type: object
 *       required: [id, user_id, type, reference_type, reference_id, remind_at, status, sent_at, created_at, updated_at]
 *       properties:
 *         id:
 *           type: integer
 *         user_id:
 *           type: integer
 *         type:
 *           type: string
 *           enum: [MEDICATION, APPOINTMENT]
 *         reference_type:
 *           type: string
 *           enum: [TREATMENT_MEDICATION, TREATMENT_APPOINTMENT]
 *         reference_id:
 *           type: integer
 *         remind_at:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, SENT, CANCELLED]
 *         sent_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     PatientReportItem:
 *       type: object
 *       required: [id, user_id, full_name, created_at]
 *       properties:
 *         id:
 *           type: integer
 *           example: 27
 *         user_id:
 *           type: integer
 *           example: 9
 *         full_name:
 *           type: string
 *           example: Ahmed Alnaji
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     TreatmentPlanReportItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         patient_id:
 *           type: integer
 *         doctor_id:
 *           type: integer
 *         status:
 *           type: string
 *         start_date:
 *           type: string
 *           format: date
 *         end_date:
 *           type: string
 *           format: date
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *     AssistanceRequestReportItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         patient_id:
 *           type: integer
 *         doctor_id:
 *           type: integer
 *           nullable: true
 *         ngo_id:
 *           type: integer
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED]
 *         request_type:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     ActivityLog:
 *       type: object
 *       required:
 *         - id
 *         - user_id
 *         - action
 *         - entity_type
 *         - entity_id
 *         - description
 *         - created_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 1
 *         action:
 *           type: string
 *           enum:
 *             - APPROVE_JOIN_REQUEST
 *             - REJECT_JOIN_REQUEST
 *             - ASSIGN_EMERGENCY_ALERT
 *             - UPDATE_EMERGENCY_STATUS
 *             - CREATE_ASSISTANCE_REQUEST
 *             - UPDATE_ASSISTANCE_STATUS
 *             - CREATE_RESOURCE_ALLOCATION
 *             - UPDATE_RESOURCE_ALLOCATION
 *             - DELETE_RESOURCE_ALLOCATION
 *             - UPDATE_SYSTEM_SETTING
 *         entity_type:
 *           type: string
 *           enum:
 *             - JOIN_REQUEST
 *             - EMERGENCY_ALERT
 *             - ASSISTANCE_REQUEST
 *             - RESOURCE_ALLOCATION
 *             - SYSTEM_SETTING
 *         entity_id:
 *           type: integer
 *           example: 12
 *         description:
 *           type: string
 *           example: Join Request #12 approved.
 *         ip_address:
 *           type: string
 *           nullable: true
 *           example: "::1"
 *         created_at:
 *           type: string
 *           format: date-time
 *
 *
 *     SystemSetting:
 *       type: object
 *       required:
 *         - id
 *         - setting_key
 *         - setting_value
 *         - description
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         setting_key:
 *           type: string
 *           enum:
 *             - system_name
 *             - support_email
 *             - support_phone
 *           example: system_name
 *         setting_value:
 *           type: string
 *           nullable: true
 *           example: Healthcare Conflict Management System
 *         description:
 *           type: string
 *           nullable: true
 *           example: Display name of the HCMS platform
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     DoctorPatientAssignment:
 *       type: object
 *       required:
 *         - id
 *         - doctor_id
 *         - patient_id
 *         - status
 *         - assigned_at
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         doctor_id:
 *           type: integer
 *           example: 3
 *         patient_id:
 *           type: integer
 *           example: 27
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: ACTIVE
 *         assignment_reason:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: Patient requires follow-up care.
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Optional notes. Maximum size is 65535 UTF-8 bytes.
 *           example: Follow up with the patient regularly.
 *         assigned_at:
 *           type: string
 *           format: date-time
 *         ended_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     EmergencyAlert:
 *       type: object
 *       required:
 *         - id
 *         - phone
 *         - priority
 *         - status
 *         - sent_at
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         patient_id:
 *           type: integer
 *           nullable: true
 *           example: 27
 *         phone:
 *           type: string
 *           maxLength: 30
 *           example: '0591234567'
 *         location:
 *           type: string
 *           nullable: true
 *           maxLength: 255
 *           example: Gaza
 *         assigned_doctor_id:
 *           type: integer
 *           nullable: true
 *           example: 3
 *         assigned_by_admin_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         description:
 *           type: string
 *           nullable: true
 *           description: Emergency description. Maximum size is 65535 UTF-8 bytes.
 *           example: Patient requires urgent medical assistance.
 *         priority:
 *           type: string
 *           example: HIGH
 *         status:
 *           type: string
 *           enum:
 *             - PENDING_ASSIGNMENT
 *             - ASSIGNED
 *             - IN_PROGRESS
 *             - RESOLVED
 *             - CANCELLED
 *           example: PENDING_ASSIGNMENT
 *         sent_at:
 *           type: string
 *           format: date-time
 *         assigned_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         responded_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         resolved_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *
 *     AssistanceRequest:
 *       type: object
 *       required:
 *         - id
 *         - patient_id
 *         - doctor_id
 *         - request_type
 *         - description
 *         - status
 *         - submitted_at
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         patient_id:
 *           type: integer
 *           example: 27
 *         doctor_id:
 *           type: integer
 *           example: 3
 *         ngo_id:
 *           type: integer
 *           nullable: true
 *           example: 2
 *         request_type:
 *           type: string
 *           maxLength: 100
 *           example: Medical Supplies
 *         description:
 *           type: string
 *           description: Assistance request description. Maximum size is 65535 UTF-8 bytes.
 *           example: Patient requires medical supplies for continued treatment.
 *         status:
 *           type: string
 *           enum:
 *             - PENDING
 *             - UNDER_REVIEW
 *             - APPROVED
 *             - REJECTED
 *             - COMPLETED
 *           example: PENDING
 *         submitted_at:
 *           type: string
 *           format: date-time
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     ResourceAllocation:
 *       type: object
 *       required:
 *         - id
 *         - assistance_request_id
 *         - resource_name
 *         - quantity
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         assistance_request_id:
 *           type: integer
 *           example: 1
 *         resource_name:
 *           type: string
 *           maxLength: 150
 *           example: Medical Kit
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           maximum: 4294967295
 *           example: 5
 *         delivery_date:
 *           type: string
 *           format: date
 *           nullable: true
 *           example: '2026-10-15'
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Optional notes. Maximum size is 65535 UTF-8 bytes.
 *           example: Deliver directly to the patient.
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     JoinRequestUser:
 *       type: object
 *       required:
 *         - full_name
 *         - email
 *         - role
 *         - account_status
 *       properties:
 *         full_name:
 *           type: string
 *           example: Ahmed Alnaji
 *         email:
 *           type: string
 *           format: email
 *           example: ahmed@example.com
 *         role:
 *           type: string
 *           enum: [DOCTOR, NGO]
 *         account_status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *
 *     JoinRequestDoctorDetails:
 *       type: object
 *       required:
 *         - specialization
 *         - license_number
 *       properties:
 *         specialization:
 *           type: string
 *           example: General Medicine
 *         license_number:
 *           type: string
 *           example: MED-2026-001
 *
 *     JoinRequestNgoDetails:
 *       type: object
 *       required:
 *         - organization_name
 *       properties:
 *         organization_name:
 *           type: string
 *           example: Gaza Medical Relief
 *         registration_number:
 *           type: string
 *           nullable: true
 *           example: NGO-2026-001
 *         address:
 *           type: string
 *           nullable: true
 *           example: Gaza
 *         contact_phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *
 *     JoinRequest:
 *       type: object
 *       required:
 *         - id
 *         - user_id
 *         - request_type
 *         - status
 *         - user
 *         - created_at
 *         - updated_at
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *         user_id:
 *           type: integer
 *           example: 12
 *         request_type:
 *           type: string
 *           enum: [DOCTOR, NGO]
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         reviewed_by_admin_id:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         reviewed_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           example: Registration information could not be verified.
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         user:
 *           $ref: '#/components/schemas/JoinRequestUser'
 *         doctor:
 *           $ref: '#/components/schemas/JoinRequestDoctorDetails'
 *         ngo:
 *           $ref: '#/components/schemas/JoinRequestNgoDetails'
 *
 *     RegistrationCommonFields:
 *       type: object
 *       required:
 *         - full_name
 *         - email
 *         - password
 *         - password_confirmation
 *       properties:
 *         full_name:
 *           type: string
 *           maxLength: 150
 *           example: Ahmed Alnaji
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           example: ahmed@example.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *           description: Must contain at least one uppercase letter, one lowercase letter, and one digit. Maximum 72 UTF-8 bytes.
 *           example: Password1
 *         password_confirmation:
 *           type: string
 *           format: password
 *           description: Must exactly match password. Used for validation only and is never stored.
 *           example: Password1
 *         phone:
 *           type: string
 *           nullable: true
 *           pattern: '^(059|056)[0-9]{7}$'
 *           description: Optional Palestinian mobile number. Must be exactly 10 digits and start with 059 or 056.
 *           example: '0591234567'
 *
 *     ValidationError:
 *       type: object
 *       required:
 *         - success
 *         - message
 *         - errors
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Validation failed
 *         errors:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           example:
 *             email: email must be a valid email address
 *
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: Internal server error
 *
 *   responses:
 *
 *     ValidationError:
 *       description: Request validation failed
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidationError'
 *
 *     AuthenticationRequired:
 *       description: Authentication is required or the supplied token is invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Authentication required
 *
 *     AccountNotActive:
 *       description: The authenticated account is not active
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Account is not active
 *
 *     InternalServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: Internal server error
 */

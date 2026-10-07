<!-- Markdown transcription of docs/requirements/SRS.pdf (Version 1.1, September 2026). The PDF remains the authoritative original. -->

# Software Requirements Specification (SRS)

## Healthcare Conflict Management System (HCMS)

**Prepared by:** Healing Hands Team  
**Supervisor:** Dr. Hatem Hammad  
**The Islamic University - Gaza**  
**Version:** 1.1  
**Date:** September 2026

## Table of Contents

1. Introduction
   - 1.1 Purpose
   - 1.2 Scope
   - 1.3 Definitions, Acronyms, and Abbreviations
   - 1.4 References
   - 1.5 Document Overview
2. Overall Description
   - 2.1 Product Perspective
   - 2.2 Product Functions
   - 2.3 User Classes and Characteristics
   - 2.4 Operating Environment
3. External Interface Requirements
   - 3.1 User Interfaces
   - 3.2 Software Interfaces
4. System Features (Functional Requirements)
   - 4.1 Authentication
   - 4.2 Patient Management
   - 4.3 Doctor Management
   - 4.4 NGO Management
   - 4.5 Treatment Plan Management
   - 4.6 Emergency Alert Management
   - 4.7 Humanitarian Assistance Management
   - 4.8 Communication
   - 4.9 Reporting & Dashboard
   - 4.10 Administration
5. Non-Functional Requirements
   - 5.1 Security
   - 5.2 Performance
   - 5.3 Reliability
   - 5.4 Availability
   - 5.5 Scalability
   - 5.6 Usability
6. Other Requirements
   - 6.1 Business Rules
   - 6.2 Future Enhancements

# 1. Introduction

## 1.1 Purpose

The purpose of this Software Requirements Specification (SRS) is to define the functional and non-functional requirements of the Healthcare Conflict Management System (HCMS). This document serves as a reference for the development team, project supervisor, testers, and future stakeholders by clearly describing the system's objectives, features, constraints, and expected behavior.

The SRS provides a comprehensive description of the system requirements, ensuring that all team members share a common understanding of the project before implementation begins. It also serves as the primary reference for system design, development, testing, and future maintenance.

## 1.2 Scope

The Healthcare Conflict Management System (HCMS) is a web-based healthcare management platform designed to improve medical follow-up and humanitarian assistance for patients living in conflict-affected areas. The system provides an integrated environment that connects patients, doctors, healthcare organizations (NGOs), and administrators through a centralized platform.

The system enables patients to manage their medical profiles, view treatment plans, receive medication and appointment reminders, and send emergency alerts. Public visitors may also submit an emergency alert from the public landing page without creating an account; this public access is limited to alert submission only. Doctors can monitor patient progress, manage treatment plans, respond to emergency cases assigned to them, and communicate with their patients. Healthcare organizations can review and process assistance requests, allocate available resources, and track the status of humanitarian support. Administrators are responsible for managing users, monitoring system activities, assigning emergency alerts, generating reports, and maintaining the overall operation of the platform.

The system will be implemented as a responsive web application accessible through modern web browsers. It aims to improve healthcare coordination, enhance communication between stakeholders, and support timely medical and humanitarian services in conflict-affected environments.

## 1.3 Definitions, Acronyms, and Abbreviations

The following definitions, acronyms, and abbreviations are used throughout this Software Requirements Specification (SRS) document.

| Term / Acronym | Definition |
| --- | --- |
| HCMS | Healthcare Conflict Management System |
| SRS | Software Requirements Specification |
| NGO | Non-Governmental Organization |
| ERD | Entity Relationship Diagram |
| UML | Unified Modeling Language |
| UI | User Interface |
| UX | User Experience |
| API | Application Programming Interface |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| Administrator (Admin) | The system user responsible for managing users, organizations, system settings, and monitoring activities. |
| Patient | A registered user who receives medical follow-up, views treatment plans, tracks assistance request status, sends emergency alerts, and communicates with healthcare providers. |
| Doctor | A healthcare provider responsible for managing patient records, treatment plans, and medical follow-up. |
| Healthcare Organization (NGO) | An organization that receives and manages medical or humanitarian assistance requests submitted through the system. |
| Treatment Plan | A structured medical plan created by a doctor that includes medications, appointments, and follow-up instructions for a patient. |
| Emergency Alert | A high-priority alert submitted by a registered patient or a public visitor to report an emergency situation requiring immediate medical attention. Public visitors may submit an alert without receiving authenticated follow-up access. |
| Assistance Request | A request submitted by a doctor on behalf of a patient for medical or humanitarian support, which is reviewed and managed by healthcare organizations (NGOs). |

## 1.4 References

The following references were used during the preparation of this Software Requirements Specification (SRS):

1. IEEE. ISO/IEC/IEEE 29148:2018 – Systems and Software Engineering — Life Cycle Processes — Requirements Engineering.
2. Ian Sommerville, Software Engineering, 10th Edition, Pearson, 2016.
3. Roger S. Pressman and Bruce R. Maxim, Software Engineering: A Practitioner's Approach, 9th Edition, McGraw-Hill, 2019.
4. The initial project proposal prepared by the Healthcare Conflict Management System (HCMS) project team.

## 1.5 Document Overview

This Software Requirements Specification (SRS) document is organized into six main chapters.

- Chapter 1 introduces the purpose, scope, definitions, references, and overall organization of the document.
- Chapter 2 provides an overview of the Healthcare Conflict Management System (HCMS), including its main functions, user classes, operating environment, assumptions, and constraints.
- Chapter 3 describes the external interface requirements, including user and software interfaces.
- Chapter 4 specifies the functional requirements of the system by describing its main features and services.
- Chapter 5 presents the non-functional requirements, including security, performance, reliability, availability, scalability, and usability.
- Chapter 6 describes additional requirements, including business rules and possible future enhancements.

# 2. Overall Description

## 2.1 Product Perspective

The Healthcare Conflict Management System (HCMS) is a new web-based healthcare management platform developed to support medical follow-up and humanitarian assistance in conflict-affected environments. The system is designed as a centralized solution that integrates patients, doctors, healthcare organizations (NGOs), and administrators into a single platform.

HCMS provides a secure environment for managing patient information, treatment plans, emergency alerts, and assistance requests. It also enables healthcare providers to monitor patient progress and allows NGOs to manage humanitarian support efficiently.

The system operates as an independent web application and can be accessed through modern web browsers. It is designed to improve communication among stakeholders, enhance healthcare coordination, and simplify the management of medical and humanitarian services.

## 2.2 Product Functions

The Healthcare Conflict Management System (HCMS) provides a set of integrated functions to support healthcare management and humanitarian assistance in conflict-affected environments. The main functions of the system include:

- Secure user registration and authentication based on user roles.
- Management of patient medical profiles and personal information.
- Creation, updating, and monitoring of treatment plans by healthcare providers.
- Medication and appointment reminder management.
- Submission and tracking of medical and humanitarian assistance requests.
- Emergency alert reporting for critical situations by registered patients and public visitors, with administrative assignment and doctor response.
- Communication between patients and doctors.
- Management of assistance requests by healthcare organizations (NGOs).
- User, organization, and system management by administrators.
- Dashboard, reports, and statistical analysis to support monitoring and decision-making.

These functions work together to improve healthcare coordination, facilitate communication among stakeholders, and enhance the efficiency of medical follow-up and humanitarian support.

## 2.3 User Classes and Characteristics

The Healthcare Conflict Management System (HCMS) supports four main categories of users. Each user has different responsibilities and access permissions based on their role within the system.

### Patient

Patients are the primary users of the system. They can manage their medical profiles, view treatment plans, receive medication and appointment reminders, send and track their own emergency alerts, and communicate with their assigned doctors.

### Doctor

Doctors are responsible for monitoring patients, creating and updating treatment plans, recording medical notes, reviewing patient progress, responding to emergency alerts assigned to them, and communicating with patients.

### Healthcare Organization (NGO)

Healthcare organizations (NGOs) are responsible for reviewing and managing medical or humanitarian assistance requests, allocating available resources, tracking assistance status, and responding to urgent cases.

### Administrator

Administrators manage the overall operation of the system. Their responsibilities include managing user accounts, monitoring system activities, generating reports, maintaining system settings, and ensuring the proper functioning of the platform.

## 2.4 Operating Environment

The Healthcare Conflict Management System (HCMS) is a web-based application designed to operate in a standard web environment. The system will be accessible through modern web browsers such as Google Chrome, Mozilla Firefox, Microsoft Edge, and Safari, without requiring any additional software installation.

The system will be deployed on a web server and will use a MySQL database for data storage. It is intended to run on desktop and laptop computers, with a responsive user interface that also supports tablets and mobile devices through web browsers.

The application requires a stable internet connection to allow users to access system features, exchange information securely, and interact with the centralized database in real time.

# 3. External Interface Requirements

The Healthcare Conflict Management System (HCMS) interacts with users and supporting software components through well-defined interfaces. These interfaces ensure secure communication, efficient data exchange, and an intuitive user experience.

## 3.1 User Interfaces

The system provides a responsive and user-friendly web interface that enables different categories of users to perform their tasks efficiently. The interface is designed to be simple, consistent, and accessible through modern web browsers.

The main user interfaces include:

- Login and Registration pages.
- Patient Dashboard.
- Doctor Dashboard.
- Healthcare Organization (NGO) Dashboard.
- Administrator Dashboard.
- Treatment Plan Management pages.
- Medical and Humanitarian Assistance Request pages.
- Emergency Alert page, including public visitor emergency submission.
- Reports and Statistics pages.

The user interface will support responsive design to ensure compatibility with desktop computers, laptops, tablets, and mobile devices.

## 3.2 Software Interfaces

The Healthcare Conflict Management System (HCMS) interacts with several software components to provide its functionality. These interfaces enable secure data storage, authentication, and communication between the client and server.

The system interfaces include:

- MySQL Database for storing and managing system data.
- RESTful API for communication between the frontend and backend.
- JSON Web Token (JWT) for secure user authentication and authorization.
- Modern Web Browsers (such as Google Chrome, Mozilla Firefox, Microsoft Edge, and Safari) for accessing the web application.

# 4. System Features (Functional Requirements)

## 4.1 Authentication

### Description

The Authentication module allows users to securely access the Healthcare Conflict Management System (HCMS) according to their assigned roles. The system verifies user credentials and grants access to authorized resources while protecting sensitive information.

### Functional Requirements

- **FR-1.1:** The system shall allow Patients, Doctors, and NGOs to register. Patient registration shall require a unique National ID consisting of exactly 9 digits, with the first digit not equal to zero. National ID shall be required for Patients only.
- **FR-1.2:** The system shall require administrator approval before activating doctor and healthcare organization (NGO) accounts.
- **FR-1.3:** The system shall allow users to log in using their registered email and password.
- **FR-1.4:** The system shall authenticate users before granting access.
- **FR-1.5:** The system shall assign system permissions based on the user's role (Patient, Doctor, NGO, or Administrator).
- **FR-1.6:** The system shall allow users to securely log out.

> **Note:** The current system uses stateless JWT authentication. Logout is performed by securely removing the locally stored authentication token and authentication state from the client. Issued JWTs are not stored or revoked server-side and remain valid until expiration unless access is denied based on the user's current account state or permissions.

- **FR-1.7:** The system shall encrypt user passwords before storing them in the database.
- **FR-1.8:** The system shall prevent unauthorized users from accessing protected resources.

## 4.2 Patient Management

### Description

The Patient Management module enables patients to manage their personal and medical information while allowing doctors to monitor patient progress and treatment.

### Functional Requirements

- **FR-2.1:** The system shall allow patients to view and update their personal information.
- **FR-2.2:** The system shall allow patients to view their medical records.
- **FR-2.3:** The system shall allow patients to view their treatment plans.
- **FR-2.4:** The system shall allow doctors to access assigned patient records.
- **FR-2.5:** The system shall maintain the current Patient information and its latest modification timestamp.

## 4.3 Doctor Management

### Description

The Doctor Management module enables doctors to manage patient care, treatment plans, and medical follow-up activities.

### Functional Requirements

- **FR-3.1:** The system shall allow doctors to create treatment plans.
- **FR-3.2:** The system shall allow doctors to update treatment plans.
- **FR-3.3:** The system shall allow doctors to record medical notes.
- **FR-3.4:** The system shall allow doctors to monitor patient progress.
- **FR-3.5:** The system shall allow doctors to respond to emergency alerts.

## 4.4 NGO Management

### Description

The NGO Management module enables healthcare organizations to manage humanitarian assistance requests, allocate available resources, and monitor the delivery of support to patients.

### Functional Requirements

- **FR-4.1:** The system shall allow NGOs to view assigned assistance requests.
- **FR-4.2:** The system shall allow NGOs to approve or reject assistance requests.
- **FR-4.3:** The system shall allow NGOs to update the status of assistance requests.
- **FR-4.4:** The system shall allow NGOs to record assistance details.
- **FR-4.5:** The system shall maintain a history of NGO activities.

## 4.5 Treatment Plan Management

### Description

The system shall enable doctors to create, manage, and monitor treatment plans for patients while allowing patients to view their assigned treatment plans.

### Functional Requirements

- **FR-5.1:** The system shall allow doctors to create treatment plans.
- **FR-5.2:** The system shall allow doctors to update treatment plans.
- **FR-5.3:** The system shall allow doctors to assign treatment plans to patients.
- **FR-5.4:** The system shall allow patients to view their treatment plans.
- **FR-5.5:** The system shall maintain the current Treatment Plan information and its latest modification timestamp.

## 4.6 Emergency Alert Management

### Description

The system shall provide an emergency alert feature that enables registered patients and public visitors to report critical situations requiring immediate attention. Public visitors may submit an alert from the public landing page without authentication, while authenticated follow-up functions remain restricted to registered users according to their roles.

### Functional Requirements

- **FR-6.1:** The system shall allow registered patients and public visitors to submit emergency alerts. Public visitor access shall be limited to alert submission only.
- **FR-6.2:** The system shall allow administrators to monitor pending emergency alerts and assign an alert to an eligible active doctor whose specialization is General Medicine or Emergency Medicine.
- **FR-6.3:** The system shall notify the doctor assigned by an administrator when an emergency alert is assigned.
- **FR-6.4:** The system shall allow the assigned doctor to update the emergency alert status according to the approved workflow.
- **FR-6.5:** The system shall allow registered patients to view their own emergency alerts and cancel an alert only while it is pending assignment.
- **FR-6.6:** The system shall maintain a record of all emergency alerts, including alerts submitted by public visitors.
- **FR-6.7:** The system shall allow administrators to monitor all emergency alerts, including alerts submitted by public visitors.

## 4.7 Humanitarian Assistance Management

### Description

The system shall support the submission and management of humanitarian assistance requests between patients and healthcare organizations (NGOs).

### Functional Requirements

- **FR-7.1:** The system shall allow doctors to submit assistance requests on behalf of patients.
- **FR-7.2:** The system shall allow NGOs to review assistance requests.
- **FR-7.3:** The system shall allow NGOs to approve or reject requests.
- **FR-7.4:** The system shall allow patients to track the status of their requests.
- **FR-7.5:** The system shall maintain records of all assistance requests.

## 4.8 Communication

### Description

The system shall facilitate communication between patients and doctors and provide notifications related to important system events.

### Functional Requirements

- **FR-8.1:** The system shall allow secure messaging between patients and doctors.
- **FR-8.2:** The system shall send notifications for treatment plan updates.
- **FR-8.3:** The system shall notify users about emergency alerts when applicable.
- **FR-8.4:** The system shall notify users about assistance request status updates.
- **FR-8.5:** The system shall store communication history.

## 4.9 Reporting & Dashboard

### Description

The system shall provide dashboards and reports to support monitoring, management, and decision-making.

### Functional Requirements

- **FR-9.1:** The system shall provide dashboards based on user roles.
- **FR-9.2:** The system shall generate reports related to patients and treatment plans.
- **FR-9.3:** The system shall generate reports for humanitarian assistance requests.
- **FR-9.4:** The system shall display statistical summaries.
- **FR-9.5:** The system shall allow administrators to monitor overall system activities.

## 4.10 Administration

### Description

The system shall provide administrative functions for managing users, organizations, and system settings.

### Functional Requirements

- **FR-10.1:** The system shall allow administrators to manage user accounts.
- **FR-10.2:** The system shall allow administrators to manage healthcare organizations (NGOs).
- **FR-10.3:** The system shall allow administrators to update system settings.
- **FR-10.4:** The system shall maintain activity logs for administrative actions.
- **FR-10.5:** The system shall restrict administrative functions to authorized administrators only.

# 5. Non-Functional Requirements

## 5.1 Security

The system shall ensure the confidentiality, integrity, and security of user data.

- **NFR-1.1:** User passwords shall be encrypted before being stored in the database.
- **NFR-1.2:** The system shall implement secure authentication and role-based access control (RBAC).
- **NFR-1.3:** All communication between the client and server shall be secured using HTTPS.

## 5.2 Performance

The system shall provide efficient performance under normal operating conditions.

- **NFR-2.1:** The system shall respond to user requests within an acceptable response time.
- **NFR-2.2:** The system shall support multiple users accessing the system simultaneously without significant performance degradation.

## 5.3 Reliability

The system shall operate reliably and minimize the risk of data loss.

- **NFR-3.1:** The system shall maintain data consistency during all operations.
- **NFR-3.2:** The system shall recover gracefully from unexpected errors whenever possible.

## 5.4 Availability

The system shall be available to authorized users whenever internet access is available.

- **NFR-4.1:** The system shall be accessible through modern web browsers.
- **NFR-4.2:** Authorized users shall be able to access the system at any time, subject to server availability.

## 5.5 Scalability

The system shall support future growth and expansion.

- **NFR-5.1:** The system shall support the addition of new users and organizations without requiring major architectural changes.
- **NFR-5.2:** The system shall allow future integration of additional healthcare services and features.

## 5.6 Usability

The system shall provide an intuitive and user-friendly interface.

- **NFR-6.1:** The user interface shall be simple and easy to navigate.
- **NFR-6.2:** The system shall maintain a consistent design across all pages.
- **NFR-6.3:** The system shall support responsive design for different screen sizes.

# 6. Other Requirements

## 6.1 Business Rules

The Healthcare Conflict Management System (HCMS) shall operate according to the following business rules:

- **BR-1:** Each user shall be assigned a single system role (Patient, Doctor, NGO, or Administrator).
- **BR-2:** Patients shall only access their own personal and medical information.
- **BR-3:** Doctors shall only access information related to their assigned patients.
- **BR-4:** Healthcare organizations (NGOs) shall only manage assistance requests assigned to their organization.
- **BR-5:** Only administrators shall manage user accounts, organizations, and system settings.
- **BR-6:** Every emergency alert and assistance request shall be recorded in the system for future reference.
- **BR-7:** Public visitors may submit emergency alerts without authentication, but they shall not be allowed to view, track, update, or cancel an alert after submission.
- **BR-8:** New emergency alerts shall enter the PENDING_ASSIGNMENT state. Only administrators may assign an eligible doctor; only the assigned doctor may progress an assigned alert through IN_PROGRESS to RESOLVED; and only the originating registered patient may cancel an alert while it is still PENDING_ASSIGNMENT.

## 6.2 Future Enhancements

The Healthcare Conflict Management System (HCMS) has been designed to support future improvements and additional features. Possible enhancements include:

- Integration with hospital information systems.
- SMS and email notification services.
- Video consultation between doctors and patients.
- Mobile application support.
- Advanced analytics and reporting dashboards.
- Artificial intelligence to assist in monitoring patient conditions and prioritizing emergency cases.

- **Secure Password Recovery:** Provide secure password recovery and reset functionality using a time-limited, single-use verification mechanism and an approved delivery channel such as email or SMS.
- **Doctor and NGO Application Re-submission:** Provide a secure applicant-access workflow for Doctor and NGO accounts that are not activated after administrative review. Rejected applicants may securely access their application status and rejection reason, update permitted application information, and submit a new join request for administrative review. Previous reviewed requests shall be preserved for history, and only one PENDING join request shall be allowed for the same user at a time. Applicant access shall not grant access to protected Doctor or NGO system functionality until the account is approved and activated.

## Approved Requirements Addendum — Patient Intake and Care Coordination

**Status:** Approved product requirements; implementation and the authoritative SRS PDF have not yet been updated. This addendum supplements the transcribed SRS and takes precedence where they conflict, pending formal revision of the source PDF.

### Platform scope and patient intake

- HCMS is a multi-organization coordination network. Current external participants are individual doctors and NGOs; hospitals do not have a separate account or organization role in this scope.
- Patient registration collects account and identity information only. After login, the patient completes one required self-reported health-intake form. The form is not a diagnosis and is not a direct request for NGO assistance.
- The form asks about the current health problem (required free text), symptoms and onset (required; “I don't know” is valid for onset), chronic conditions, current medications, known allergies, and optional additional information. Conditional details are requested when the patient answers yes. The free-text description may mention more than one concern.
- The patient can navigate their profile before completing the form. Until it is completed, the system shall not permit doctor assignment or creation of a new assistance request on the patient's behalf. Emergency-alert access remains available.
- After submission, the patient sees **تم تسليم الطلب** and may edit the form until an administrator explicitly starts review. Merely opening or viewing the form does not start review. The start-review action changes the status to **قيد المراجعة** and makes the form read-only to the patient. After assignment is saved, the status is **تم تعيين طبيب**. The patient is prompted after submission to review answers and is told that editing closes when review begins.
- After the form is locked, the patient may submit a correction/addition through the technical-support channel. Support staff forward it to an authorized administrator and do not access or edit the health form themselves.

### Assignment and workload

- Administrators review the intake and choose doctors. A patient may have multiple active doctor assignments for different concerns; the required internal assignment reason states what that doctor is following. A duplicate active assignment for the same doctor-patient pair is not allowed.
- Administration records doctor availability as **متاح/غير متاح** and configures capacity in coordination with the doctor. The system calculates active patient assignments and displays open assigned emergency alerts as separate workload indicators.
- Capacity is an administrative warning only and never blocks an assignment, whether routine or emergency. An unavailable doctor cannot receive a routine assignment, but may receive an emergency assignment; the administrator sees availability and workload and makes the decision.
- A doctor becoming unavailable after assignment is outside this release's scope.
- Emergency alerts and routine patient assignments remain separate workflows. Existing emergency specialization eligibility rules continue to apply.

### Clinical documentation and privacy

- The patient's intake is a self-reported account, not a diagnosis. Each doctor records a separate diagnosis within that doctor's clinical documentation, associated with its author and documentation time; there is no shared patient-level diagnosis field.
- The patient and doctors currently assigned to that patient may read recorded diagnoses. Detailed medical-note text remains visible only to its authoring doctor. NGOs and unassigned doctors cannot access the intake or diagnoses.
- The patient and administrators (for review/assignment) may access the intake; assigned doctors may access it for care. Access control must be enforced by the backend API as well as the interface.
- NGOs receive only information needed to process their assigned assistance request, not the intake form or the full medical record. The doctor remains the party that creates an assistance request on the patient's behalf.

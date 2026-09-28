const db = require("../config/database");
const dashboardReportModel = require("../models/dashboardReportModel");
const doctorModel = require("../models/doctorModel");
const ngoModel = require("../models/ngoModel");
const notificationService = require("./notificationService");
const patientModel = require("../models/patientModel");

class DashboardProfileNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "DashboardProfileNotFoundError";
  }
}

function consistentRead(work) {
  return db.transaction(work, { isolationLevel: "repeatable read" });
}

function getAdminDashboard() {
  return consistentRead((trx) => dashboardReportModel.getAdminDashboard(trx));
}

function getPatientDashboard(user) {
  return consistentRead(async (trx) => {
    const patient = await patientModel.findByUserId(user.id, trx);
    if (!patient) {
      throw new DashboardProfileNotFoundError("Patient profile not found");
    }

    const metrics = await dashboardReportModel.getPatientDashboard(
      patient.id,
      user.id,
      trx,
    );
    const unreadNotifications = await notificationService.getOwnUnreadCount(
      user,
      trx,
    );

    return { ...metrics, unread_notifications: unreadNotifications };
  });
}

function getDoctorDashboard(user) {
  return consistentRead(async (trx) => {
    const doctor = await doctorModel.findByUserId(user.id, trx);
    if (!doctor) {
      throw new DashboardProfileNotFoundError("Doctor profile not found");
    }

    return dashboardReportModel.getDoctorDashboard(doctor.id, trx);
  });
}

function getNgoDashboard(user) {
  return consistentRead(async (trx) => {
    const ngo = await ngoModel.findByUserId(user.id, trx);
    if (!ngo) {
      throw new DashboardProfileNotFoundError("NGO profile not found");
    }

    return dashboardReportModel.getNgoDashboard(ngo.id, trx);
  });
}

async function paginatedReport(query, loader) {
  const result = await consistentRead((trx) => loader(trx));
  return {
    items: result.items,
    page: query.page,
    limit: query.limit,
    total: result.total,
    total_pages: Math.ceil(result.total / query.limit),
  };
}

function getPatientReport(query) {
  return paginatedReport(query, (trx) =>
    dashboardReportModel.listPatients(query.page, query.limit, trx),
  );
}

function getTreatmentPlanReport(query) {
  return paginatedReport(query, (trx) =>
    dashboardReportModel.listTreatmentPlans(query.page, query.limit, trx),
  );
}

function getAssistanceRequestReport(query) {
  return paginatedReport(query, (trx) =>
    dashboardReportModel.listAssistanceRequests(
      query.filters,
      query.page,
      query.limit,
      trx,
    ),
  );
}

module.exports = {
  DashboardProfileNotFoundError,
  getAdminDashboard,
  getAssistanceRequestReport,
  getDoctorDashboard,
  getNgoDashboard,
  getPatientDashboard,
  getPatientReport,
  getTreatmentPlanReport,
};

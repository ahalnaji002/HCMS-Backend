const dashboardReportService = require("../services/dashboardReportService");
const formatDateOnly = require("../utils/formatDateOnly");

function dashboardHandler(loader, message) {
  return async (req, res) => {
    const data = await loader(req.user);
    return res.status(200).json({ success: true, message, data });
  };
}

function reportHandler(loader, message, transform = (data) => data) {
  return async (req, res) => {
    const data = transform(await loader(req.validatedReportQuery));
    return res.status(200).json({ success: true, message, data });
  };
}

const getAdminDashboard = dashboardHandler(
  dashboardReportService.getAdminDashboard,
  "Admin dashboard retrieved successfully",
);
const getPatientDashboard = dashboardHandler(
  dashboardReportService.getPatientDashboard,
  "Patient dashboard retrieved successfully",
);
const getDoctorDashboard = dashboardHandler(
  dashboardReportService.getDoctorDashboard,
  "Doctor dashboard retrieved successfully",
);
const getNgoDashboard = dashboardHandler(
  dashboardReportService.getNgoDashboard,
  "NGO dashboard retrieved successfully",
);
const getPatientReport = reportHandler(
  dashboardReportService.getPatientReport,
  "Patient report retrieved successfully",
);
const getTreatmentPlanReport = reportHandler(
  dashboardReportService.getTreatmentPlanReport,
  "Treatment Plan report retrieved successfully",
  (data) => ({
    ...data,
    items: data.items.map((item) => ({
      ...item,
      start_date: formatDateOnly(item.start_date),
      end_date: item.end_date === null ? null : formatDateOnly(item.end_date),
    })),
  }),
);
const getAssistanceRequestReport = reportHandler(
  dashboardReportService.getAssistanceRequestReport,
  "Assistance Request report retrieved successfully",
);

module.exports = {
  getAdminDashboard,
  getAssistanceRequestReport,
  getDoctorDashboard,
  getNgoDashboard,
  getPatientDashboard,
  getPatientReport,
  getTreatmentPlanReport,
};

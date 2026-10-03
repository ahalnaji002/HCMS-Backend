const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./config/swagger");

const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const emergencyAlertRoutes = require("./routes/emergencyAlertRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const ngoRoutes = require("./routes/ngoRoutes");
const patientRoutes = require("./routes/patientRoutes");

const {
  apiErrorHandler,
  apiNotFound,
} = require("./middleware/apiErrorHandler");

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.json({
    message: "HCMS Backend API is running",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/emergency-alerts", emergencyAlertRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/patient", patientRoutes);

// API error handling
app.use("/api", apiNotFound);
app.use(apiErrorHandler);

module.exports = app;

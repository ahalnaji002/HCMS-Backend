const express = require("express");
const cors = require("cors");
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");
const emergencyAlertRoutes = require("./routes/emergencyAlertRoutes");
const ngoRoutes = require("./routes/ngoRoutes");
const messageRoutes = require("./routes/messageRoutes");

const {
  apiErrorHandler,
  apiNotFound,
} = require("./middleware/apiErrorHandler");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "HCMS Backend API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/emergency-alerts", emergencyAlertRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/ngo", ngoRoutes);
app.use("/api/patient", patientRoutes);

app.use("/api", apiNotFound);
app.use(apiErrorHandler);

module.exports = app;

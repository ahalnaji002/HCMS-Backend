const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");

const swaggerSpec = require("./config/swagger");
const { buildCorsOptions } = require("./config/cors");

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

// Behind a reverse proxy, set TRUST_PROXY (e.g. 1) so rate limiting keys on
// the real client address instead of the proxy's.
if (process.env.TRUST_PROXY) {
  const trustProxy = Number(process.env.TRUST_PROXY);
  app.set(
    "trust proxy",
    Number.isNaN(trustProxy) ? process.env.TRUST_PROXY : trustProxy,
  );
}

// Global middleware
// upgrade-insecure-requests is only sent in production: it breaks plain-HTTP
// local development (e.g. Swagger UI on http://localhost) in some browsers.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(cors(buildCorsOptions()));
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

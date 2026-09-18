const express = require("express");
const cors = require("cors");

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
app.use("/api/admin", adminRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api", apiNotFound);
app.use(apiErrorHandler);

module.exports = app;

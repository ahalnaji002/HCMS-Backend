const app = require("./app");
const db = require("./config/database");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

db.raw("SELECT 1 AS connected")
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch(() => {
    console.error("Database connection failed");
  });

require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

const db = require("./config/database");

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

db.getConnection()
  .then((connection) => {
    console.log("Database connected successfully");
    connection.release();
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
  });

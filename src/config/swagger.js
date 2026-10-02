const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",

    info: {
      title: "HCMS API",
      version: "1.0.0",
      description:
        "Interactive API documentation for the Healthcare Conflict Management System (HCMS).",
    },

    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter the JWT access token.",
        },
      },
    },

    tags: [
      {
        name: "Authentication",
        description: "Registration, login, and current-user authentication.",
      },
      {
        name: "Profile",
        description:
          "Authenticated user profile retrieval and self-service updates.",
      },
      {
        name: "Admin Dashboard & Reports",
        description:
          "Administrative dashboard metrics and paginated system reports.",
      },
      {
        name: "Activity Logs",
        description: "Administrative audit and activity log access.",
      },
      {
        name: "System Settings",
        description: "Administrative system configuration.",
      },
      {
        name: "Join Requests",
        description: "Administrative review of Doctor and NGO join requests.",
      },
      {
        name: "Doctor-Patient Assignments",
        description: "Administrative management of Doctor-Patient assignments.",
      },
      {
        name: "Emergency Alerts",
        description: "Emergency alert management and Doctor assignment.",
      },
      {
        name: "Assistance Requests",
        description: "Assistance request review and NGO assignment.",
      },
      {
        name: "Resource Allocations",
        description: "Resources allocated to assistance requests.",
      },
    ],
  },

  apis: ["./src/docs/swagger/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

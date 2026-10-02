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
    ],
  },

  apis: ["./src/docs/swagger/**/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
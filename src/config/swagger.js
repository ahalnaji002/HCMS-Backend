// The OpenAPI document is generated at build time (npm run docs:build) so
// swagger-jsdoc and its file-scanning dependencies are not needed in
// production. Only the server list is added here, because it depends on
// API_PUBLIC_URL.
const openApiDocument = require("../docs/openapi.json");

function buildServers(env = process.env) {
  return [
    ...(env.API_PUBLIC_URL
      ? [{ url: env.API_PUBLIC_URL, description: "Deployed server" }]
      : []),
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ];
}

const swaggerSpec = { ...openApiDocument, servers: buildServers() };

module.exports = swaggerSpec;
// Non-enumerable so the exported object stays a plain OpenAPI document.
Object.defineProperty(module.exports, "buildServers", { value: buildServers });

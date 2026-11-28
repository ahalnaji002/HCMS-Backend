// Builds the Postman collection and environment from src/docs/openapi.json.
//   npm run docs:build     (runs this after the OpenAPI build)
//
// Output in docs/api/postman/:
//   HCMS.postman_collection.json   every endpoint, grouped by role, then tag
//   HCMS.postman_environment.json  baseUrl, demo sign-in emails, tokens, ids
//
// "0. Sign in" holds one login request per role; each saves its token
// ({{adminToken}}, {{doctorToken}}, ...). Role folders use their role's
// token; shared endpoints use {{token}}, which every login also sets.
// Every request checks that the status is the documented success code.
const fs = require("node:fs");
const path = require("node:path");

const openApi = require("../src/docs/openapi.json");

const OUTPUT_DIR = path.join(__dirname, "..", "docs", "api", "postman");
const COLLECTION_PATH = path.join(OUTPUT_DIR, "HCMS.postman_collection.json");
const ENVIRONMENT_PATH = path.join(OUTPUT_DIR, "HCMS.postman_environment.json");

const METHODS = ["get", "post", "put", "patch", "delete"];

// Demo accounts from `npm run seed:demo`, admin from the admin seed.
const SIGN_INS = [
  { role: "Admin", tokenVar: "adminToken", emailVar: "adminEmail", email: "admin@hcms.local", passwordVar: "adminPassword" },
  { role: "Doctor", tokenVar: "doctorToken", emailVar: "doctorEmail", email: "dr.khaled@demo.hcms.test", passwordVar: "demoPassword" },
  { role: "Patient", tokenVar: "patientToken", emailVar: "patientEmail", email: "mahmoud@demo.hcms.test", passwordVar: "demoPassword" },
  { role: "NGO", tokenVar: "ngoToken", emailVar: "ngoEmail", email: "ngo.amal@demo.hcms.test", passwordVar: "demoPassword" },
];

const ROLE_GROUPS = [
  { name: "1. Public", match: (p, op) => !op.security || op.security.length === 0, tokenVar: null },
  { name: "2. Admin", match: (p) => p.startsWith("/api/admin"), tokenVar: "adminToken" },
  { name: "3. Doctor", match: (p) => p.startsWith("/api/doctor"), tokenVar: "doctorToken" },
  { name: "4. Patient", match: (p) => p.startsWith("/api/patient"), tokenVar: "patientToken" },
  { name: "5. NGO", match: (p) => p.startsWith("/api/ngo"), tokenVar: "ngoToken" },
  { name: "6. Shared (any signed-in role)", match: () => true, tokenVar: "token" },
];

function resolveRef(value) {
  if (!value || typeof value !== "object" || !value.$ref) return value;
  const parts = value.$ref.replace(/^#\//, "").split("/");
  return resolveRef(parts.reduce((node, key) => node?.[key], openApi));
}

// Small example value for a schema: example → default → first enum value →
// a value of the right type. Depth-limited so recursive schemas end.
function sampleFromSchema(schema, depth = 0) {
  const resolved = resolveRef(schema);
  if (!resolved || depth > 6) return null;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.default !== undefined) return resolved.default;
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) return resolved.enum[0];
  if (resolved.allOf) {
    return Object.assign({}, ...resolved.allOf.map((part) => sampleFromSchema(part, depth + 1)));
  }
  if (resolved.oneOf || resolved.anyOf) {
    return sampleFromSchema((resolved.oneOf || resolved.anyOf)[0], depth + 1);
  }

  switch (resolved.type) {
    case "object": {
      const result = {};
      for (const [key, property] of Object.entries(resolved.properties || {})) {
        result[key] = sampleFromSchema(property, depth + 1);
      }
      return result;
    }
    case "array":
      return [sampleFromSchema(resolved.items, depth + 1)];
    case "integer":
    case "number":
      return resolved.minimum ?? 1;
    case "boolean":
      return true;
    case "string":
      if (resolved.format === "date") return "2026-12-01";
      if (resolved.format === "date-time") return "2026-12-01T10:00:00";
      if (resolved.format === "email") return "someone@example.com";
      return "text";
    default:
      return null;
  }
}

function requestBodyFor(operation) {
  const content = resolveRef(operation.requestBody)?.content?.["application/json"];
  if (!content) return undefined;

  let example = content.example;
  if (example === undefined && content.examples) {
    example = resolveRef(Object.values(content.examples)[0])?.value;
  }
  if (example === undefined) example = sampleFromSchema(content.schema);

  return {
    mode: "raw",
    raw: JSON.stringify(example, null, 2),
    options: { raw: { language: "json" } },
  };
}

function successCode(operation) {
  const codes = Object.keys(operation.responses || {}).filter((code) => /^2\d\d$/.test(code));
  return codes.length > 0 ? Number(codes.sort()[0]) : 200;
}

function parametersFor(pathItem, operation) {
  return [...(pathItem.parameters || []), ...(operation.parameters || [])].map(resolveRef);
}

function buildUrl(apiPath, parameters) {
  const postmanPath = apiPath.replace(/\{([^}]+)\}/g, ":$1");
  const query = parameters
    .filter((parameter) => parameter.in === "query")
    .map((parameter) => ({
      key: parameter.name,
      value: String(sampleFromSchema(parameter.schema) ?? ""),
      description: parameter.description,
      disabled: !parameter.required,
    }));
  const variable = parameters
    .filter((parameter) => parameter.in === "path")
    .map((parameter) => ({
      key: parameter.name,
      value: `{{${parameter.name}}}`,
      description: parameter.description,
    }));

  const raw = `{{baseUrl}}${postmanPath}`;
  return {
    raw,
    host: ["{{baseUrl}}"],
    path: postmanPath.split("/").filter(Boolean),
    ...(query.length > 0 ? { query } : {}),
    ...(variable.length > 0 ? { variable } : {}),
  };
}

function statusTest(code) {
  return {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [`pm.test("status is ${code}", function () {`, `  pm.response.to.have.status(${code});`, "});"],
    },
  };
}

function bearer(tokenVar) {
  return tokenVar
    ? { type: "bearer", bearer: [{ key: "token", value: `{{${tokenVar}}}`, type: "string" }] }
    : { type: "noauth" };
}

function buildItem(apiPath, method, pathItem, operation) {
  const parameters = parametersFor(pathItem, operation);
  const body = requestBodyFor(operation);
  const code = successCode(operation);
  const headers = body ? [{ key: "Content-Type", value: "application/json" }] : [];

  return {
    name: operation.summary || `${method.toUpperCase()} ${apiPath}`,
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: buildUrl(apiPath, parameters),
      ...(body ? { body } : {}),
      description: [operation.description, operation.operationId ? `operationId: ${operation.operationId}` : null]
        .filter(Boolean)
        .join("\n\n"),
    },
    event: [statusTest(code)],
  };
}

function signInFolder() {
  return {
    name: "0. Sign in",
    description: "Run these first. Each saves its role token and also sets {{token}} for the shared folder.",
    auth: { type: "noauth" },
    item: SIGN_INS.map(({ role, tokenVar, emailVar, passwordVar }) => ({
      name: `Sign in as ${role}`,
      request: {
        method: "POST",
        header: [{ key: "Content-Type", value: "application/json" }],
        url: { raw: "{{baseUrl}}/api/auth/login", host: ["{{baseUrl}}"], path: ["api", "auth", "login"] },
        body: {
          mode: "raw",
          raw: JSON.stringify({ email: `{{${emailVar}}}`, password: `{{${passwordVar}}}` }, null, 2),
          options: { raw: { language: "json" } },
        },
      },
      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              'pm.test("status is 200", function () {',
              "  pm.response.to.have.status(200);",
              "});",
              "const token = pm.response.json().data && pm.response.json().data.token;",
              "if (token) {",
              `  pm.environment.set("${tokenVar}", token);`,
              '  pm.environment.set("token", token);',
              "}",
            ],
          },
        },
      ],
    })),
  };
}

function buildCollection() {
  const groups = new Map(ROLE_GROUPS.map((group) => [group.name, new Map()]));

  for (const [apiPath, pathItem] of Object.entries(openApi.paths)) {
    for (const method of METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const group = ROLE_GROUPS.find((candidate) => candidate.match(apiPath, operation));
      const tag = (operation.tags && operation.tags[0]) || "Other";
      const tags = groups.get(group.name);
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(buildItem(apiPath, method, pathItem, operation));
    }
  }

  const roleFolders = ROLE_GROUPS.map((group) => ({
    name: group.name,
    auth: bearer(group.tokenVar),
    item: [...groups.get(group.name).entries()].map(([tag, items]) => ({ name: tag, item: items })),
  })).filter((folder) => folder.item.length > 0);

  return {
    info: {
      name: openApi.info.title,
      description:
        "Generated from src/docs/openapi.json by scripts/buildPostmanCollection.js (npm run docs:build). " +
        "Import with HCMS.postman_environment.json, run '0. Sign in', then any request. " +
        "Path ids such as {{alertId}} are environment variables; set them to real ids from your data.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: bearer("token"),
    item: [signInFolder(), ...roleFolders],
  };
}

function buildEnvironment(collection) {
  const pathVariables = new Set();
  const visit = (items) => {
    for (const item of items) {
      if (item.item) visit(item.item);
      for (const variable of item.request?.url?.variable || []) pathVariables.add(variable.key);
    }
  };
  visit(collection.item);

  const values = [
    { key: "baseUrl", value: "http://localhost:3000", type: "default", enabled: true },
    ...SIGN_INS.map(({ emailVar, email }) => ({ key: emailVar, value: email, type: "default", enabled: true })),
    { key: "adminPassword", value: "", type: "secret", enabled: true },
    { key: "demoPassword", value: "", type: "secret", enabled: true },
    ...["token", ...SIGN_INS.map(({ tokenVar }) => tokenVar)].map((key) => ({
      key,
      value: "",
      type: "secret",
      enabled: true,
    })),
    ...[...pathVariables].sort().map((key) => ({ key, value: "1", type: "default", enabled: true })),
  ];

  return { name: "HCMS local", values };
}

function generatePostmanFiles() {
  const collection = buildCollection();
  return {
    collection: `${JSON.stringify(collection, null, 2)}\n`,
    environment: `${JSON.stringify(buildEnvironment(collection), null, 2)}\n`,
  };
}

function readCommitted(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n") : "";
}

function main() {
  const { collection, environment } = generatePostmanFiles();

  if (process.argv.includes("--check")) {
    if (readCommitted(COLLECTION_PATH) !== collection || readCommitted(ENVIRONMENT_PATH) !== environment) {
      console.error("docs/api/postman is out of date. Run: npm run docs:build");
      process.exit(1);
    }
    console.log("docs/api/postman is up to date.");
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(COLLECTION_PATH, collection);
  fs.writeFileSync(ENVIRONMENT_PATH, environment);
  console.log(`Wrote ${path.relative(process.cwd(), COLLECTION_PATH)}`);
  console.log(`Wrote ${path.relative(process.cwd(), ENVIRONMENT_PATH)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  COLLECTION_PATH,
  ENVIRONMENT_PATH,
  generatePostmanFiles,
  readCommitted,
};

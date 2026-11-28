// Builds src/docs/openapi.json from the JSDoc blocks in src/docs/swagger/.
//   npm run docs:build             write the file
//   npm run docs:check             exit 1 if the file is out of date
const fs = require("node:fs");
const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");

const openApiOptions = require("../src/docs/openApiOptions");

const ROOT = path.join(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "src", "docs", "openapi.json");

function generateOpenApiJson() {
  const cwd = process.cwd();
  // swagger-jsdoc resolves the `apis` globs from the working directory.
  process.chdir(ROOT);
  try {
    return `${JSON.stringify(swaggerJsdoc(openApiOptions), null, 2)}\n`;
  } finally {
    process.chdir(cwd);
  }
}

function readCommittedOpenApiJson() {
  if (!fs.existsSync(OUTPUT_PATH)) return "";
  // Git may check the file out with CRLF line endings on Windows.
  return fs.readFileSync(OUTPUT_PATH, "utf8").replace(/\r\n/g, "\n");
}

function main() {
  const generated = generateOpenApiJson();

  if (process.argv.includes("--check")) {
    if (readCommittedOpenApiJson() !== generated) {
      console.error("src/docs/openapi.json is out of date. Run: npm run docs:build");
      process.exit(1);
    }
    console.log("src/docs/openapi.json is up to date.");
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, generated);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

if (require.main === module) {
  main();
}

module.exports = { OUTPUT_PATH, generateOpenApiJson, readCommittedOpenApiJson };

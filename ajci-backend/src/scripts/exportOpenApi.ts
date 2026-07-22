import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOpenApiSpec } from "../docs/openapi.js";

// Writes the generated OpenAPI document to openapi.json at the project root.
// Handy for client codegen or committing the contract for diff review.
const spec = buildOpenApiSpec();
const out = resolve(process.cwd(), "openapi.json");
await writeFile(out, JSON.stringify(spec, null, 2));
console.log(`Wrote ${out} (${Object.keys(spec.paths).length} paths)`);

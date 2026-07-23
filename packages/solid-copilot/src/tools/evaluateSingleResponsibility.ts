import { readFile } from "fs/promises";
import * as ts from "typescript";
import { AuditReport, Ruleset, Violation, buildReport } from "@guardian/shared";
import { BedrockClient } from "../bedrock/BedrockClient";
import { validateSolidPayload } from "../bedrock/schemaValidator";
import { mapBedrockViolations } from "../bedrock/severityMapper";
import { BedrockConfig } from "../bedrock/types";

/**
 * Checks whether AWS credentials are available in the environment.
 * If neither AWS_ACCESS_KEY_ID nor AWS_REGION are set, Bedrock is considered unavailable.
 */
function isBedrockAvailable(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION);
}

/**
 * Extracts Bedrock configuration from the ruleset if a `bedrock` section is present.
 * Falls back to defaults defined in BedrockClient constructor.
 */
function extractBedrockConfig(ruleset: Ruleset): Partial<BedrockConfig> {
  const bedrockSection = (ruleset as unknown as Record<string, unknown>)["bedrock"] as
    | Record<string, unknown>
    | undefined;

  if (!bedrockSection) return {};

  return {
    modelId: bedrockSection.model_id as string | undefined,
    fallbackModelId: bedrockSection.fallback_model_id as string | undefined,
    timeoutMs: bedrockSection.timeout_ms as number | undefined,
    maxRetries: bedrockSection.max_retries as number | undefined,
  };
}

export async function evaluateSingleResponsibility(
  args: { filepath: string },
  ruleset: Ruleset
): Promise<AuditReport & { fallback?: boolean }> {
  const { filepath } = args;

  let content: string;
  try {
    content = await readFile(filepath, "utf-8");
  } catch (err) {
    return buildReport({
      agentName: "solid-copilot",
      analyzedPath: filepath,
      violations: [
        {
          filePath: filepath,
          line: 0,
          description: `Cannot read file: ${(err as Error).message}`,
          severity: "warning",
          rule: "FILE_READ_ERROR",
        },
      ],
    });
  }

  // If AWS credentials are not available, use local analysis directly
  if (!isBedrockAvailable()) {
    return evaluateLocal(filepath, content);
  }

  // Attempt Bedrock analysis with fallback
  try {
    const bedrockConfig = extractBedrockConfig(ruleset);
    const client = new BedrockClient(bedrockConfig);
    const result = await client.analyze(content);

    if (!result.success || !result.payload) {
      // Bedrock failed → fallback to local analysis
      const localReport = evaluateLocal(filepath, content);
      return { ...localReport, fallback: true };
    }

    // Validate schema of the Bedrock response
    if (!validateSolidPayload(result.payload)) {
      const localReport = evaluateLocal(filepath, content);
      return { ...localReport, fallback: true };
    }

    // Map Bedrock violations to Guardian format
    const violations = mapBedrockViolations(result.payload.violations, filepath);

    return buildReport({
      agentName: "solid-copilot",
      analyzedPath: filepath,
      violations,
    });
  } catch {
    // Any unexpected error → fallback to local analysis
    const localReport = evaluateLocal(filepath, content);
    return { ...localReport, fallback: true };
  }
}

/**
 * Performs local static analysis (the original behavior) as fallback.
 */
function evaluateLocal(filepath: string, content: string): AuditReport {
  return buildReport({
    agentName: "solid-copilot",
    analyzedPath: filepath,
    violations: evaluateSingleResponsibilitySync(filepath, content),
  });
}

/**
 * Synchronous version for testing with in-memory content.
 * Analyzes classes for Single Responsibility Principle violations.
 */
export function evaluateSingleResponsibilitySync(
  filepath: string,
  content: string
): Violation[] {
  const sourceFile = ts.createSourceFile(
    filepath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const violations: Violation[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isClassDeclaration(node)) return;
    const className = node.name?.getText(sourceFile) ?? "<anonymous>";

    // Count methods
    const methods = node.members.filter((m) => ts.isMethodDeclaration(m));

    // Count lines
    const startLine = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    ).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(
      node.getEnd()
    ).line;
    const lineCount = endLine - startLine + 1;

    // Count constructor params (injected dependencies)
    const constructor = node.members.find((m) =>
      ts.isConstructorDeclaration(m)
    ) as ts.ConstructorDeclaration | undefined;
    const paramCount = constructor?.parameters.length ?? 0;

    const reasons: string[] = [];
    if (lineCount > 200)
      reasons.push(`${lineCount} lineas (umbral: 200)`);
    if (methods.length > 10)
      reasons.push(`${methods.length} metodos (umbral: 10)`);
    if (paramCount > 5)
      reasons.push(`${paramCount} dependencias inyectadas (umbral: 5)`);

    if (reasons.length > 0) {
      violations.push({
        filePath: filepath,
        line: startLine + 1,
        description: `Clase '${className}' posiblemente viola SRP: ${reasons.join(", ")}. Considere dividirla en clases mas cohesivas.`,
        severity: "warning",
        rule: "SRP_GOD_OBJECT",
      });
    }
  });

  return violations;
}

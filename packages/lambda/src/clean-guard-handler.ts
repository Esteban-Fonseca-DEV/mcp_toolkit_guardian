import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { CleanGuardAgent } from "@guardian/clean-guard";
import { Ruleset } from "@guardian/shared";

interface LambdaPayload {
  toolName: string;
  args: unknown;
  ruleset: Ruleset;
}

/**
 * AWS Lambda handler for Clean-Guard agent.
 * Parses the request body, initializes the agent with the provided Ruleset,
 * finds and invokes the requested tool, and returns the AuditReport.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const payload: LambdaPayload = JSON.parse(event.body ?? "{}");
    const agent = new CleanGuardAgent();
    agent.initialize(payload.ruleset);

    const tool = agent.tools.find((t) => t.name === payload.toolName);
    if (!tool) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Tool '${payload.toolName}' not found` }),
      };
    }

    const report = await tool.handler(payload.args, payload.ruleset);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
}

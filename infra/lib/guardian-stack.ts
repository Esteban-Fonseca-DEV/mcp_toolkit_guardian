import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import { Construct } from "constructs";

export class GuardianStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda Layer with typescript compiler (for AST parsing at runtime)
    const sharedLayer = new lambda.LayerVersion(this, "GuardianSharedLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../../layers/shared")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Guardian shared layer: typescript compiler for AST parsing",
    });

    // Common Lambda configuration
    const lambdaDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      layers: [sharedLayer],
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
    };

    // Shared Lambda code bundle (handlers + all @guardian/* dependencies)
    const lambdaCodeBundle = lambda.Code.fromAsset(
      path.join(__dirname, "../../lambda-bundle")
    );

    // Lambda: Clean-Guard Handler
    const cleanGuardFn = new lambda.Function(this, "CleanGuardHandler", {
      ...lambdaDefaults,
      handler: "clean-guard-handler.handler",
      code: lambdaCodeBundle,
      description: "Guardian Clean-Guard agent Lambda handler",
      functionName: "guardian-clean-guard",
    });

    // Lambda: TDD-Strict Handler
    const tddStrictFn = new lambda.Function(this, "TddStrictHandler", {
      ...lambdaDefaults,
      handler: "tdd-strict-handler.handler",
      code: lambdaCodeBundle,
      description: "Guardian TDD-Strict agent Lambda handler",
      functionName: "guardian-tdd-strict",
    });

    // Lambda: DDD-Guard Handler
    const dddGuardFn = new lambda.Function(this, "DddGuardHandler", {
      ...lambdaDefaults,
      handler: "ddd-guard-handler.handler",
      code: lambdaCodeBundle,
      description: "Guardian DDD-Guard agent Lambda handler",
      functionName: "guardian-ddd-guard",
    });

    // Lambda: Security-Guard Handler
    const securityGuardFn = new lambda.Function(this, "SecurityGuardHandler", {
      ...lambdaDefaults,
      handler: "security-guard-handler.handler",
      code: lambdaCodeBundle,
      description: "Guardian Security-Guard agent Lambda handler",
      functionName: "guardian-security-guard",
    });

    // Lambda: SOLID-Copilot Handler
    const solidCopilotFn = new lambda.Function(this, "SolidCopilotHandler", {
      ...lambdaDefaults,
      handler: "solid-copilot-handler.handler",
      code: lambdaCodeBundle,
      description: "Guardian SOLID-Copilot agent Lambda handler",
      functionName: "guardian-solid-copilot",
    });

    // Lambda: Concurrency-Guard Handler
    const concurrencyGuardFn = new lambda.Function(
      this,
      "ConcurrencyGuardHandler",
      {
        ...lambdaDefaults,
        handler: "concurrency-guard-handler.handler",
        code: lambdaCodeBundle,
        description: "Guardian Concurrency-Guard agent Lambda handler",
        functionName: "guardian-concurrency-guard",
      }
    );

    // API Gateway REST API
    const api = new apigateway.RestApi(this, "GuardianApi", {
      restApiName: "Guardian MCP Toolkit API",
      description: "API Gateway for Guardian MCP Toolkit agents",
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["POST", "OPTIONS"],
      },
    });

    // API Routes — one per agent
    const cleanGuardResource = api.root.addResource("clean-guard");
    cleanGuardResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(cleanGuardFn)
    );

    const tddStrictResource = api.root.addResource("tdd-strict");
    tddStrictResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(tddStrictFn)
    );

    const dddGuardResource = api.root.addResource("ddd-guard");
    dddGuardResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(dddGuardFn)
    );

    const securityGuardResource = api.root.addResource("security-guard");
    securityGuardResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(securityGuardFn)
    );

    const solidCopilotResource = api.root.addResource("solid-copilot");
    solidCopilotResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(solidCopilotFn)
    );

    const concurrencyGuardResource = api.root.addResource("concurrency-guard");
    concurrencyGuardResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(concurrencyGuardFn)
    );

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "Guardian API Gateway URL — set as GUARDIAN_API_URL env var",
      exportName: "GuardianApiUrl",
    });

    new cdk.CfnOutput(this, "ApiId", {
      value: api.restApiId,
      description: "Guardian API Gateway REST API ID",
    });
  }
}

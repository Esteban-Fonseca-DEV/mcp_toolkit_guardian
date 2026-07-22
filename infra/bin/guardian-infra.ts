#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GuardianStack } from "../lib/guardian-stack";

const app = new cdk.App();

new GuardianStack(app, "GuardianStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-2",
  },
  description:
    "Guardian MCP Toolkit — 6 agent Lambda functions + API Gateway",
  tags: {
    project: "guardian-mcp-toolkit",
    environment: "hackathon",
  },
});

#!/usr/bin/env node
import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  CodeAction,
  CodeActionKind,
  CodeActionParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CleanGuardAgent } from "@guardian/clean-guard";
import { DddGuardAgent } from "@guardian/ddd-guard";
import { SecurityGuardAgent } from "@guardian/security-guard";
import { SolidCopilotAgent } from "@guardian/solid-copilot";
import { ConcurrencyGuardAgent } from "@guardian/concurrency-guard";
import { Ruleset, IAgent, DEFAULT_RULESET } from "@guardian/shared";
import * as fs from "fs";
import * as path from "path";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let ruleset: Ruleset = DEFAULT_RULESET;
const agents: IAgent[] = [
  new CleanGuardAgent(),
  new DddGuardAgent(),
  new SecurityGuardAgent(),
  new SolidCopilotAgent(),
  new ConcurrencyGuardAgent(),
];

connection.onInitialize((params: InitializeParams) => {
  // Try to load .guardian.json from workspace
  const workspaceFolders = params.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const wsPath = new URL(workspaceFolders[0].uri).pathname;
    const configPath = path.join(wsPath, ".guardian.json");
    if (fs.existsSync(configPath)) {
      try {
        ruleset = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch { /* use default */ }
    }
  }

  // Initialize all agents
  for (const agent of agents) {
    agent.initialize(ruleset);
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix],
      },
    },
  };
});

// Validate on change
documents.onDidChangeContent(async (change) => {
  const textDocument = change.document;
  const uri = textDocument.uri;
  const filePath = new URL(uri).pathname;

  if (!filePath.endsWith(".ts")) return;

  const diagnostics: Diagnostic[] = [];

  // Run relevant agents on file content
  for (const agent of agents) {
    for (const tool of agent.tools) {
      // Only run file-based tools
      const props = (tool.schema as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
      if (props?.filepath) {
        try {
          const report = await tool.handler({ filepath: filePath }, ruleset);
          for (const violation of report.violations) {
            diagnostics.push({
              severity: violation.severity === "error"
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
              range: {
                start: { line: Math.max(0, violation.line - 1), character: 0 },
                end: { line: Math.max(0, violation.line - 1), character: 999 },
              },
              message: violation.description,
              source: `guardian/${agent.name}`,
              code: violation.rule,
            });
          }
        } catch { /* skip errors silently */ }
      }
    }
  }

  connection.sendDiagnostics({ uri, diagnostics });
});

// Code actions (Quick Fixes)
connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const diagnostics = params.context.diagnostics;
  const actions: CodeAction[] = [];

  for (const diag of diagnostics) {
    if (diag.source?.startsWith("guardian/")) {
      actions.push({
        title: `Guardian Fix: ${diag.code || "auto-remediate"}`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        command: {
          title: "Run guardian fix",
          command: "guardian.fix",
          arguments: [params.textDocument.uri, diag.range.start.line],
        },
      });
    }
  }

  return actions;
});

documents.listen(connection);
connection.listen();

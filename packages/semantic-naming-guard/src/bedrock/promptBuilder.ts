/**
 * Builds the prompt for Claude to perform semantic naming analysis.
 *
 * Instructs the model to detect:
 * - Banned words (trash can words that attract multiple responsibilities)
 * - Empty/ambiguous variable names (data, info, result, val, tmp, obj)
 * - False booleans (boolean variables named as nouns instead of predicates)
 * - Verb inconsistency (synonyms for the same operation in the same interface/class)
 *
 * @param sourceCode - The source code to analyze
 * @param bannedWords - List of banned words to detect
 * @returns The formatted prompt string for Claude
 */
export function buildNamingPrompt(sourceCode: string, bannedWords: string[]): string {
  const bannedWordsList = bannedWords.length > 0
    ? bannedWords.join(", ")
    : "Manager, Util, Utils, Helper, Helpers, Service, Processor, Handler, Controller, Base, Common, Misc, General";

  return `You are a code naming analyzer. Analyze the following source code for naming violations.

## Rules to check:

### 1. NAMING_BANNED_WORD
Detect identifiers (classes, functions, variables, interfaces) that contain any of these banned words: ${bannedWordsList}
These are "trash can words" that attract multiple responsibilities and violate the Single Responsibility Principle.
For each violation, suggest a more specific, role-based alternative name.

### 2. NAMING_EMPTY_VARIABLE
Detect variables with generic/ambiguous names that don't indicate their content. Common offenders include: data, info, result, val, tmp, obj, item, element, value, stuff, thing.
For each violation, suggest a contextual name based on the variable's type or usage.

### 3. NAMING_FALSE_BOOLEAN
Detect boolean variables named as nouns instead of predicates. Booleans should start with prefixes like: is, has, should, can, will, did, was.
Examples of violations: status, flag, error, active, visible, ready, valid, enabled, disabled.
For each violation, suggest a name with an appropriate predicate prefix.

### 4. NAMING_VERB_INCONSISTENCY
Detect when the same interface or class uses different verbs (synonyms) for the same type of operation.
Common synonym groups:
- Read operations: get, fetch, retrieve, find, load, read, obtain, acquire
- Write operations: set, update, modify, change, mutate, alter
- Create operations: create, make, build, construct, generate, produce
- Delete operations: delete, remove, destroy, erase, clear, purge
For each violation, suggest a standardized verb to use consistently.

## Source Code:

\`\`\`
${sourceCode}
\`\`\`

## Response Format:

Respond ONLY with a valid JSON object in this exact format (no markdown, no explanation):

{
  "violations": [
    {
      "line": <number>,
      "identifier": "<the offending identifier name>",
      "rule": "<NAMING_BANNED_WORD | NAMING_EMPTY_VARIABLE | NAMING_FALSE_BOOLEAN | NAMING_VERB_INCONSISTENCY>",
      "description": "<brief description of the issue>",
      "suggestion": "<suggested alternative name>"
    }
  ]
}

If no violations are found, return: {"violations": []}`;
}

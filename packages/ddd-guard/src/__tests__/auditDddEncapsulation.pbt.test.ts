import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { auditDddEncapsulationSync } from "../tools/auditDddEncapsulation";

/**
 * Property 16: Detección exhaustiva de estado mutable público (DDD Encapsulación)
 * Generate arbitrary TypeScript classes with N properties (mix of public, private, protected, readonly).
 * Verify auditDddEncapsulation returns exactly the public mutable properties as violations.
 * **Validates: Requirements 10.1**
 */
describe("Property 16: Detección exhaustiva de encapsulación", () => {
  type PropModifier = "public" | "private" | "protected" | "public readonly" | "readonly";

  const modifierArb: fc.Arbitrary<PropModifier> = fc.oneof(
    fc.constant("public" as PropModifier),
    fc.constant("private" as PropModifier),
    fc.constant("protected" as PropModifier),
    fc.constant("public readonly" as PropModifier),
    fc.constant("readonly" as PropModifier)
  );

  const propertyArb = fc.record({
    name: fc
      .string({ minLength: 1, maxLength: 10, unit: "grapheme" })
      .filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
    modifier: modifierArb,
  });

  const classArb = fc.record({
    className: fc
      .string({ minLength: 1, maxLength: 15, unit: "grapheme" })
      .filter((s) => /^[A-Z][a-zA-Z0-9]*$/.test(s)),
    properties: fc.array(propertyArb, { minLength: 1, maxLength: 8 }),
  });

  function generateClassSource(cls: {
    className: string;
    properties: { name: string; modifier: PropModifier }[];
  }): string {
    const props = cls.properties
      .map((p) => `  ${p.modifier} ${p.name}: string;`)
      .join("\n");
    return `export class ${cls.className} {\n${props}\n}\n`;
  }

  function isMutablePublic(modifier: PropModifier): boolean {
    // Violation only if it's public AND not readonly
    return modifier === "public";
  }

  it("returns exactly the public mutable properties as violations", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(classArb, (cls) => {
        // Deduplicate property names to avoid TypeScript compilation issues
        const uniqueProps = cls.properties.filter(
          (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i
        );
        if (uniqueProps.length === 0) return true;

        const testCls = { ...cls, properties: uniqueProps };
        const source = generateClassSource(testCls);
        const violations = auditDddEncapsulationSync("test.ts", source);

        const expectedViolationCount = testCls.properties.filter((p) =>
          isMutablePublic(p.modifier)
        ).length;

        // Check count matches
        expect(violations).toHaveLength(expectedViolationCount);

        // Check each violation has correct rule
        for (const v of violations) {
          expect(v.rule).toBe("DDD_MUTABLE_PUBLIC_STATE");
          expect(v.severity).toBe("error");
        }

        // Check that violated property names are exactly the public mutable ones
        const violatedNames = violations.map((v) => {
          const match = v.description.match(/'([^']+)'\. Use/);
          return match ? match[1] : "";
        });
        const expectedNames = testCls.properties
          .filter((p) => isMutablePublic(p.modifier))
          .map((p) => p.name);

        expect(violatedNames.sort()).toEqual(expectedNames.sort());

        return true;
      }),
      { numRuns: 50 }
    );
  });

  it("never reports violations for private, protected, or readonly properties", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 10, unit: "grapheme" })
              .filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
            modifier: fc.oneof(
              fc.constant("private" as PropModifier),
              fc.constant("protected" as PropModifier),
              fc.constant("public readonly" as PropModifier),
              fc.constant("readonly" as PropModifier)
            ),
          }),
          { minLength: 1, maxLength: 8 }
        ),
        (properties) => {
          // Deduplicate
          const uniqueProps = properties.filter(
            (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i
          );
          if (uniqueProps.length === 0) return true;

          const source = `export class TestEntity {\n${uniqueProps
            .map((p) => `  ${p.modifier} ${p.name}: string;`)
            .join("\n")}\n}\n`;

          const violations = auditDddEncapsulationSync("test.ts", source);
          expect(violations).toHaveLength(0);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

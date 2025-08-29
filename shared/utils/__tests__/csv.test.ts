/* eslint-disable */

import { CSVHelper } from "../csv";

describe("CSVHelper", () => {
  describe("sanitizeValue", () => {
    it("should leave a value unchanged", () => {
      const value = "Hello, World!";
      const sanitizedValue = CSVHelper.sanitizeValue(value);
      expect(sanitizedValue).toBe(value);
    });

    // Comprehensive tests for formula injection prevention
    describe("formula injection prevention", () => {
      it("should escape all mathematical operators", () => {
        expect(CSVHelper.sanitizeValue("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
        expect(CSVHelper.sanitizeValue("-5")).toBe("'-5");
        expect(CSVHelper.sanitizeValue("=A1+B1")).toBe("'=A1+B1");
        expect(CSVHelper.sanitizeValue("@INDIRECT(A1)")).toBe("'@INDIRECT(A1)");
      });

      it("should escape mathematical symbols", () => {
        expect(CSVHelper.sanitizeValue("∑(1,2,3)")).toBe("'∑(1,2,3)");
        expect(CSVHelper.sanitizeValue("√16")).toBe("'√16");
        expect(CSVHelper.sanitizeValue("∏(1,2,3)")).toBe("'∏(1,2,3)");
        expect(CSVHelper.sanitizeValue("±10")).toBe("'±10");
        expect(CSVHelper.sanitizeValue("÷2")).toBe("'÷2");
        expect(CSVHelper.sanitizeValue("×3")).toBe("'×3");
      });

      it("should escape comparison operators", () => {
        expect(CSVHelper.sanitizeValue("<script>")).toBe("'<script>");
        expect(CSVHelper.sanitizeValue(">5")).toBe("'>5");
        expect(CSVHelper.sanitizeValue("＜test")).toBe("'＜test");
        expect(CSVHelper.sanitizeValue("＞test")).toBe("'＞test");
        expect(CSVHelper.sanitizeValue("≤100")).toBe("'≤100");
        expect(CSVHelper.sanitizeValue("≥0")).toBe("'≥0");
        expect(CSVHelper.sanitizeValue("＝equal")).toBe("'＝equal");
        expect(CSVHelper.sanitizeValue("≠notequal")).toBe("'≠notequal");
      });

      it("should not escape operators in middle of text", () => {
        expect(CSVHelper.sanitizeValue("a+b")).toBe("a+b");
        expect(CSVHelper.sanitizeValue("test=value")).toBe("test=value");
        expect(CSVHelper.sanitizeValue("email@domain.com")).toBe("email@domain.com");
        expect(CSVHelper.sanitizeValue("5<10")).toBe("5<10");
      });
    });

    // Control character removal tests
    describe("control character removal", () => {
      it("should remove ASCII control characters", () => {
        expect(CSVHelper.sanitizeValue("\u0000test")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u0001")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u001Ftest")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u007F")).toBe("test");
      });

      it("should remove common problematic control characters", () => {
        expect(CSVHelper.sanitizeValue("\ttest\t")).toBe("test");
        expect(CSVHelper.sanitizeValue("\ntest\n")).toBe("test");
        expect(CSVHelper.sanitizeValue("\rtest\r")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u0008test")).toBe("test"); // Backspace
        expect(CSVHelper.sanitizeValue("test\u001B")).toBe("test"); // Escape
      });
    });

    // Zero-width character removal tests
    describe("zero-width character removal", () => {
      it("should remove zero-width spaces", () => {
        expect(CSVHelper.sanitizeValue("\u200Btest")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u200C")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u200Dtest")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\uFEFFtest")).toBe("testtest");
      });

      it("should remove zero-width characters from complex strings", () => {
        expect(CSVHelper.sanitizeValue("\u200Bhello\u200Cworld\u200D")).toBe("helloworld");
        expect(CSVHelper.sanitizeValue("\uFEFF\u200B\u200C\u200D")).toBe("");
      });
    });

    // Bidirectional control character removal tests
    describe("bidirectional control character removal", () => {
      it("should remove bidirectional override characters", () => {
        expect(CSVHelper.sanitizeValue("\u202Atest")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u202B")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u202Ctest")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u202D")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u202Etest")).toBe("test");
      });

      it("should remove bidirectional isolate characters", () => {
        expect(CSVHelper.sanitizeValue("\u2066test")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u2067")).toBe("test");
        expect(CSVHelper.sanitizeValue("\u2068test")).toBe("test");
        expect(CSVHelper.sanitizeValue("test\u2069")).toBe("test");
      });
    });

    // Edge cases and combinations
    describe("edge cases", () => {
      it("should handle empty and null values", () => {
        expect(CSVHelper.sanitizeValue("")).toBe("");
        expect(CSVHelper.sanitizeValue(null as any)).toBe("");
        expect(CSVHelper.sanitizeValue(undefined as any)).toBe("");
      });

      it("should handle complex combinations", () => {
        const formulaFirst = "=\u0001SUM\u202A(\u200CA1:A10\u202E)\u200D\t";
        expect(CSVHelper.sanitizeValue(formulaFirst)).toBe("'=SUM(A1:A10)");
      });

      it("should preserve legitimate Unicode characters", () => {
        expect(CSVHelper.sanitizeValue("café")).toBe("café");
        expect(CSVHelper.sanitizeValue("数学")).toBe("数学");
        expect(CSVHelper.sanitizeValue("🚀")).toBe("🚀");
        expect(CSVHelper.sanitizeValue("Ω")).toBe("Ω");
      });

      it("should handle mixed content", () => {
        expect(CSVHelper.sanitizeValue("User: John\u200B Doe")).toBe("User: John Doe");
        expect(CSVHelper.sanitizeValue("=Price: $\u0001100")).toBe("'=Price: $100");
      });
    });

    // Security-focused tests
    describe("security validation", () => {
      it("should prevent CSV injection attacks", () => {
        expect(CSVHelper.sanitizeValue("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
        expect(CSVHelper.sanitizeValue("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
        expect(CSVHelper.sanitizeValue("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
        expect(CSVHelper.sanitizeValue("@SUM(1+1)*cmd|' /C calc'!A0")).toBe("'@SUM(1+1)*cmd|' /C calc'!A0");
      });

      it("should handle suspicious formulas", () => {
        expect(CSVHelper.sanitizeValue("=HYPERLINK(\"http://evil.com\",\"click\")")).toBe("'=HYPERLINK(\"http://evil.com\",\"click\")");
        expect(CSVHelper.sanitizeValue("=IMPORTXML(\"http://evil.com\", \"//div\")")).toBe("'=IMPORTXML(\"http://evil.com\", \"//div\")");
      });
    });
  });
});
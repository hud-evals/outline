// Test for PR #9258: Fix URL generation for document titles with special characters

describe("PR #9258: Document URL generation fix", () => {
  // Test the actual current behavior without mocking
  describe("Current slug library behavior", () => {
    // Import Document normally for these tests
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Document = require("../Document").default;

    it("should handle titles with special characters (current slug encoding)", () => {
      // The current slug library encodes special characters
      const testCases = [
        { title: "!!!", slug: "iseh" },
        { title: "...", slug: "li4u" },
        { title: "###", slug: "iymj" },
        { title: "   ", slug: "icag" },
      ];

      testCases.forEach(({ title, slug }) => {
        const result = Document.getPath({ title, urlId: "test123" });
        expect(result).toBe(`/doc/${slug}-test123`);
      });
    });

    it("should preserve normal title URL generation", () => {
      const result = Document.getPath({
        title: "Hello World",
        urlId: "test123",
      });
      expect(result).toBe("/doc/hello-world-test123");
    });

    it("should handle empty titles", () => {
      const result = Document.getPath({ title: "", urlId: "test123" });
      expect(result).toBe("/doc/untitled-test123");
    });
  });

  // Test the bug scenario with mocked slugify (simulating the bug from PR #9258)
  describe("Bug scenario - empty slug from special characters", () => {
    it("should handle empty slug scenario", () => {
      // Use jest.isolateModules to ensure clean module loading with our mock
      jest.isolateModules(() => {
        // Mock slugify to return empty string for certain inputs
        jest.doMock("@shared/utils/slugify", () => ({
          __esModule: true,
          default: jest.fn((text: string) => {
            // Simulate the bug where certain characters result in empty slug
            if (text === "⚡️⚡️⚡️") {
              return "";
            }
            if (text === "☆☆☆") {
              return "";
            }
            if (text === "♠♣♦♥") {
              return "";
            }
            if (text === "𝕏𝕏𝕏") {
              return "";
            }
            if (text === "◉◉◉") {
              return "";
            }
            if (text === "") {
              return "";
            }
            // Normal behavior
            return text.toLowerCase().replace(/[^a-z0-9]/g, "-");
          }),
        }));

        // Now import Document with the mocked slugify
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Document = require("../Document").default;

        // Test that the fix handles empty slugs correctly
        const emptySlugTitles = ["⚡️⚡️⚡️", "☆☆☆", "♠♣♦♥", "𝕏𝕏𝕏", "◉◉◉"];

        emptySlugTitles.forEach((title) => {
          const result = Document.getPath({ title, urlId: "test" });
          // The fix in Document.getPath ensures we get "untitled" instead of empty segment
          expect(result).toBe("/doc/untitled-test");
          expect(result).not.toContain("/doc/-");
        });
      });
    });
  });
});

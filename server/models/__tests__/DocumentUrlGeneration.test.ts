// Test for PR #9258: Fix URL generation for document titles with special characters

import { Document } from "../Document";

describe("PR #9258: Document URL generation fix", () => {
  it("should handle titles with only special characters", () => {
    const specialTitles = ["!!!", "...", "###", "   "];
    
    specialTitles.forEach(title => {
      const result = Document.getPath({ title, urlId: "test123" });
      expect(result).toBe("/doc/untitled-test123");
    });
  });

  it("should preserve normal title URL generation", () => {
    const result = Document.getPath({ title: "Hello World", urlId: "test123" });
    expect(result).toBe("/doc/hello-world-test123");
  });

  it("should handle empty titles", () => {
    const result = Document.getPath({ title: "", urlId: "test123" });
    expect(result).toBe("/doc/untitled-test123");
  });

  it("should prevent empty URL segments", () => {
    // Test the main fix - prevent empty slugs in URLs
    const emptySlugTitles = ["!!!", "@@@", "..."];
    
    emptySlugTitles.forEach(title => {
      const result = Document.getPath({ title, urlId: "test" });
      expect(result).not.toContain("/doc/-");
      expect(result).toContain("untitled");
    });
  });
});

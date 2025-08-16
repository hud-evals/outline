import Storage from "@shared/utils/Storage";
import codeMenuItems from "../code";

// Mock Storage module
jest.mock("@shared/utils/Storage");

describe("codeMenuItems", () => {
  let mockDictionary: any;
  let mockEditorState: any;
  let mockNode: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock Storage.get to return empty data by default
    (Storage.get as jest.Mock).mockReturnValue(undefined);

    // Mock dictionary
    mockDictionary = {
      copy: "Copy",
    };

    // Create a mock node with language attribute
    mockNode = {
      type: {
        name: "code_block",
      },
      attrs: {
        language: "javascript",
      },
    };

    // Create mock editor state
    mockEditorState = {
      selection: {
        $from: {
          node: () => mockNode,
        },
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("basic menu structure", () => {
    it("should return copy to clipboard item", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);

      const copyItem = items.find((item) => item.name === "copyToClipboard");
      expect(copyItem).toBeDefined();
      expect(copyItem?.tooltip).toBe("Copy");
    });

    it("should hide separator and language selector in read-only mode", () => {
      const items = codeMenuItems(mockEditorState, true, mockDictionary);

      const separator = items.find(
        (item, index) => index > 0 && item.name === "separator"
      );
      expect(separator?.visible).toBe(false);

      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );
      expect(codeBlock?.visible).toBe(false);
    });

    it("should show language selector in edit mode", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);

      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );
      expect(codeBlock).toBeDefined();
      expect(codeBlock?.visible).not.toBe(false);
      expect(codeBlock?.children).toBeDefined();
      expect(Array.isArray(codeBlock?.children)).toBe(true);
    });

    it("should display current language as label", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);

      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );
      expect(codeBlock?.label).toBe("JavaScript");
    });
  });

  describe("language menu items", () => {
    it("should include all available languages", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children?.filter(
        (item: any) => item.name === "code_block"
      );

      // Should have multiple language options
      expect(languageItems?.length).toBeGreaterThan(10);

      // Should include common languages
      const labels = languageItems?.map((item: any) => item.label);
      expect(labels).toContain("JavaScript");
      expect(labels).toContain("Python");
      expect(labels).toContain("TypeScript");
      expect(labels).toContain("Plain text");
    });

    it("should mark current language as active", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const jsItem = codeBlock?.children?.find(
        (item: any) => item.label === "JavaScript"
      );

      expect(jsItem).toBeDefined();
      expect(jsItem?.active?.(mockEditorState)).toBe(true);

      const pythonItem = codeBlock?.children?.find(
        (item: any) => item.label === "Python"
      );
      expect(pythonItem?.active?.(mockEditorState)).toBe(false);
    });

    it("should set language attribute on menu items", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const tsItem = codeBlock?.children?.find(
        (item: any) => item.label === "TypeScript"
      );

      const attrs =
        typeof tsItem?.attrs === "function"
          ? tsItem.attrs(mockEditorState)
          : tsItem?.attrs;
      expect(attrs?.language).toBe("typescript");
    });
  });

  describe("frequent languages", () => {
    beforeEach(() => {
      // Mock Storage to return frequently used languages
      (Storage.get as jest.Mock).mockImplementation((key) => {
        if (key === "frequent-code-languages") {
          return {
            python: 10,
            rust: 8,
            go: 6,
            java: 5,
            cpp: 4,
            ruby: 3,
            csharp: 2,
            php: 1,
          };
        }
        if (key === "rme-code-language") {
          return "python"; // Most recent language
        }
        return undefined;
      });
    });

    it("should show frequently used languages at the top", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children;

      // First 5 items should be the frequent languages
      expect(languageItems?.[0]?.label).toBe("Python");
      expect(languageItems?.[1]?.label).toBe("Rust");
      expect(languageItems?.[2]?.label).toBe("Go");
      expect(languageItems?.[3]?.label).toBe("Java");
      expect(languageItems?.[4]?.label).toBe("C++");
    });

    it("should add separator between frequent and other languages", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children;

      // Should have separator after frequent languages
      const separatorIndex = languageItems?.findIndex(
        (item: any) => item.name === "separator"
      );

      expect(separatorIndex).toBe(5); // After 5 frequent languages
    });

    it("should not duplicate languages in the menu", () => {
      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children?.filter(
        (item: any) => item.name === "code_block"
      );

      const pythonItems = languageItems?.filter(
        (item: any) => item.label === "Python"
      );

      // Python should appear only once despite being frequent
      expect(pythonItems?.length).toBe(1);
    });

    it("should show all languages when no frequent languages exist", () => {
      // Mock Storage to return no frequent languages
      (Storage.get as jest.Mock).mockReturnValue(undefined);

      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children;

      // Should not have a separator when no frequent languages
      const separator = languageItems?.find(
        (item: any) => item.name === "separator"
      );
      expect(separator).toBeUndefined();

      // All items should be language items
      const allLanguageItems = languageItems?.every(
        (item: any) => item.name === "code_block"
      );
      expect(allLanguageItems).toBe(true);
    });

    it("should include recently used language even if not in top frequent", () => {
      // Mock Storage to include Ruby as recent but not in top frequent
      (Storage.get as jest.Mock).mockImplementation((key) => {
        if (key === "frequent-code-languages") {
          return {
            python: 10,
            rust: 8,
            go: 6,
            java: 5,
            cpp: 4,
            // Ruby has lower frequency than top 5
            ruby: 2,
          };
        }
        if (key === "rme-code-language") {
          return "ruby"; // Ruby is the most recent language
        }
        return undefined;
      });

      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      const languageItems = codeBlock?.children?.slice(0, 5);
      const labels = languageItems?.map((item: any) => item.label);

      // Ruby should be in the top 5 because it's the most recent
      expect(labels).toContain("Ruby");
    });
  });

  describe("edge cases", () => {
    it("should handle code blocks with no language attribute", () => {
      // Create node without language
      mockNode.attrs = {};

      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      // Should show "Plain text" as default
      expect(codeBlock?.label).toBe("Plain text");
    });

    it("should handle null language attribute", () => {
      // Create node with null language
      mockNode.attrs.language = null;

      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      // Should show "Plain text" as default
      expect(codeBlock?.label).toBe("Plain text");
    });

    it("should handle unknown language gracefully", () => {
      // Set an unknown language
      mockNode.attrs.language = "unknown_lang";

      const items = codeMenuItems(mockEditorState, false, mockDictionary);
      const codeBlock = items.find(
        (item) => item.name === "code_block" && item.children
      );

      // Should handle gracefully - will be undefined if not in LANGUAGES
      expect(codeBlock?.label).toBeUndefined();
    });
  });
});

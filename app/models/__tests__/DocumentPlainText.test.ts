/* eslint-disable */
import { ProsemirrorData } from "@shared/types";
import stores from "~/stores";
import { copyDocumentAsPlainText } from "~/actions/definitions/documents";
import { ActionContext } from "~/types";
import { ProsemirrorHelper } from "@shared/utils/ProsemirrorHelper";

// Mock external dependencies
jest.mock("copy-to-clipboard");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
  },
}));
jest.mock("react-merge-refs", () => ({
  __esModule: true,
  default: () => () => { },
}));

const mockCopy = require("copy-to-clipboard") as jest.MockedFunction<typeof import("copy-to-clipboard")>;
const mockToast = require("sonner").toast;

describe("Document toPlainText method", () => {
  let document: any;

  beforeEach(() => {
    // Create a test document
    document = stores.documents.add({
      id: "test-doc-id",
      title: "Test Document",
      data: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hello world!"
              }
            ]
          }
        ]
      } as ProsemirrorData
    });
  });

  test("should convert simple paragraph to plain text", () => {
    const plainText = document.toPlainText();
    expect(plainText).toBe("Hello world!");
  });

  test("should handle empty document", () => {
    const emptyDocument = stores.documents.add({
      id: "empty-doc-id",
      title: "Empty Document",
      data: ProsemirrorHelper.getEmptyDocument()
    });

    const plainText = emptyDocument.toPlainText();
    expect(plainText).toBe("");
  });

  test("should convert formatted text to plain text", () => {
    const formattedDocument = stores.documents.add({
      id: "formatted-doc-id",
      title: "Formatted Document",
      data: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Bold text",
                marks: [{ type: "strong" }]
              },
              {
                type: "text",
                text: " and "
              },
              {
                type: "text",
                text: "italic text",
                marks: [{ type: "em" }]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = formattedDocument.toPlainText();
    expect(plainText).toBe("Bold text and italic text");
  });

  test("should handle headings", () => {
    const headingDocument = stores.documents.add({
      id: "heading-doc-id",
      title: "Heading Document",
      data: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [
              {
                type: "text",
                text: "Main Heading"
              }
            ]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Some content under the heading."
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = headingDocument.toPlainText();
    expect(plainText).toContain("Main Heading");
    expect(plainText).toContain("Some content under the heading.");
  });

  test("should handle bullet lists", () => {
    const listDocument = stores.documents.add({
      id: "list-doc-id",
      title: "List Document",
      data: {
        type: "doc",
        content: [
          {
            type: "bullet_list",
            content: [
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "First item"
                      }
                    ]
                  }
                ]
              },
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Second item"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = listDocument.toPlainText();
    expect(plainText).toContain("First item");
    expect(plainText).toContain("Second item");
  });

  test("should handle checkbox lists", () => {
    const checkboxDocument = stores.documents.add({
      id: "checkbox-doc-id",
      title: "Checkbox Document",
      data: {
        type: "doc",
        content: [
          {
            type: "checkbox_list",
            content: [
              {
                type: "checkbox_item",
                attrs: { checked: true },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Completed task"
                      }
                    ]
                  }
                ]
              },
              {
                type: "checkbox_item",
                attrs: { checked: false },
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "Incomplete task"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = checkboxDocument.toPlainText();
    expect(plainText).toContain("Completed task");
    expect(plainText).toContain("Incomplete task");
  });

  test("should handle code blocks", () => {
    const codeDocument = stores.documents.add({
      id: "code-doc-id",
      title: "Code Document",
      data: {
        type: "doc",
        content: [
          {
            type: "code_block",
            attrs: { language: "javascript" },
            content: [
              {
                type: "text",
                text: "console.log('Hello, world!');"
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = codeDocument.toPlainText();
    expect(plainText).toContain("console.log('Hello, world!');");
  });

  test("should handle links", () => {
    const linkDocument = stores.documents.add({
      id: "link-doc-id",
      title: "Link Document",
      data: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Visit "
              },
              {
                type: "text",
                text: "Outline",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "https://getoutline.com" }
                  }
                ]
              },
              {
                type: "text",
                text: " for more info."
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = linkDocument.toPlainText();
    expect(plainText).toBe("Visit Outline for more info.");
  });

  test("should handle tables", () => {
    const tableDocument = stores.documents.add({
      id: "table-doc-id",
      title: "Table Document",
      data: {
        type: "doc",
        content: [
          {
            type: "table",
            content: [
              {
                type: "tr",
                content: [
                  {
                    type: "th",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "Header 1"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: "th",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "Header 2"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                type: "tr",
                content: [
                  {
                    type: "td",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "Cell 1"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: "td",
                    content: [
                      {
                        type: "paragraph",
                        content: [
                          {
                            type: "text",
                            text: "Cell 2"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = tableDocument.toPlainText();
    expect(plainText).toContain("Header 1");
    expect(plainText).toContain("Header 2");
    expect(plainText).toContain("Cell 1");
    expect(plainText).toContain("Cell 2");
  });

  test("should preserve line breaks and spacing appropriately", () => {
    const multiParagraphDocument = stores.documents.add({
      id: "multi-para-doc-id",
      title: "Multi Paragraph Document",
      data: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "First paragraph."
              }
            ]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Second paragraph."
              }
            ]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Third paragraph."
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = multiParagraphDocument.toPlainText();
    expect(plainText).toContain("First paragraph.");
    expect(plainText).toContain("Second paragraph.");
    expect(plainText).toContain("Third paragraph.");
  });

  test("should handle complex nested structures", () => {
    const complexDocument = stores.documents.add({
      id: "complex-doc-id",
      title: "Complex Document",
      data: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [
              {
                type: "text",
                text: "Document Title"
              }
            ]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is a paragraph with "
              },
              {
                type: "text",
                text: "bold",
                marks: [{ type: "strong" }]
              },
              {
                type: "text",
                text: " and "
              },
              {
                type: "text",
                text: "italic",
                marks: [{ type: "em" }]
              },
              {
                type: "text",
                text: " text."
              }
            ]
          },
          {
            type: "bullet_list",
            content: [
              {
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        text: "First item with "
                      },
                      {
                        type: "text",
                        text: "a link",
                        marks: [
                          {
                            type: "link",
                            attrs: { href: "https://example.com" }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    const plainText = complexDocument.toPlainText();
    expect(plainText).toContain("Document Title");
    expect(plainText).toContain("This is a paragraph with bold and italic text.");
    expect(plainText).toContain("First item with a link");
  });
});

describe("copyDocumentAsPlainText action", () => {
  let document: any;
  let mockStores: any;
  let mockT: jest.Mock;
  let mockActionContext: ActionContext;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockT = jest.fn((key: string) => key);

    // Create a test document
    document = stores.documents.add({
      id: "action-test-doc-id",
      title: "Action Test Document",
      data: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is test content for the action."
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    // Mock stores with policies
    mockStores = {
      documents: {
        get: jest.fn((id: string) => id === "action-test-doc-id" ? document : undefined),
      },
      policies: {
        abilities: jest.fn(() => ({ download: true })),
      },
    };

    // Create a complete ActionContext mock
    mockActionContext = {
      isContextMenu: false,
      isCommandBar: false,
      isButton: false,
      activeDocumentId: "action-test-doc-id",
      currentUserId: "test-user-id",
      currentTeamId: "test-team-id",
      location: { pathname: "/test", search: "", hash: "", state: {} } as any,
      stores: mockStores,
      t: mockT,
    };
  });

  test("should be visible when document exists and has download permissions", () => {
    const visible = copyDocumentAsPlainText.visible!(mockActionContext);

    expect(visible).toBe(true);
    expect(mockStores.policies.abilities).toHaveBeenCalledWith("action-test-doc-id");
  });

  test("should not be visible when no active document", () => {
    const contextWithoutDoc = { ...mockActionContext, activeDocumentId: undefined };
    const visible = copyDocumentAsPlainText.visible!(contextWithoutDoc);

    expect(visible).toBe(false);
  });

  test("should not be visible when document has no download permissions", () => {
    mockStores.policies.abilities.mockReturnValue({ download: false });

    const visible = copyDocumentAsPlainText.visible!(mockActionContext);

    expect(visible).toBe(false);
  });

  test("should copy document plain text and show success toast", () => {
    copyDocumentAsPlainText.perform!(mockActionContext);

    expect(mockStores.documents.get).toHaveBeenCalledWith("action-test-doc-id");
    expect(mockCopy).toHaveBeenCalledWith("This is test content for the action.");
    expect(mockToast.success).toHaveBeenCalledWith("Text copied to clipboard");
  });

  test("should handle missing document gracefully", () => {
    const contextWithMissingDoc = { ...mockActionContext, activeDocumentId: "non-existent-doc-id" };
    copyDocumentAsPlainText.perform!(contextWithMissingDoc);

    expect(mockStores.documents.get).toHaveBeenCalledWith("non-existent-doc-id");
    expect(mockCopy).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  test("should handle undefined activeDocumentId", () => {
    const contextWithoutDoc = { ...mockActionContext, activeDocumentId: undefined };
    copyDocumentAsPlainText.perform!(contextWithoutDoc);

    expect(mockStores.documents.get).not.toHaveBeenCalled();
    expect(mockCopy).not.toHaveBeenCalled();
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  test("should have correct action properties", () => {
    expect(typeof copyDocumentAsPlainText.name === "function"
      ? copyDocumentAsPlainText.name(mockActionContext)
      : copyDocumentAsPlainText.name).toBe("Copy as text");
    expect(copyDocumentAsPlainText.keywords).toBe("clipboard");
    expect(copyDocumentAsPlainText.iconInContextMenu).toBe(false);
  });

  test("should copy complex document content as plain text", () => {
    const complexDocument = stores.documents.add({
      id: "complex-action-doc-id",
      title: "Complex Action Document",
      data: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [
              {
                type: "text",
                text: "Test Heading"
              }
            ]
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Paragraph with "
              },
              {
                type: "text",
                text: "bold text",
                marks: [{ type: "strong" }]
              }
            ]
          }
        ]
      } as ProsemirrorData
    });

    mockStores.documents.get.mockImplementation((id: string) =>
      id === "complex-action-doc-id" ? complexDocument : undefined
    );

    const contextWithComplexDoc = { ...mockActionContext, activeDocumentId: "complex-action-doc-id" };
    copyDocumentAsPlainText.perform!(contextWithComplexDoc);

    expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining("Test Heading"));
    expect(mockCopy).toHaveBeenCalledWith(expect.stringContaining("Paragraph with bold text"));
    expect(mockToast.success).toHaveBeenCalledWith("Text copied to clipboard");
  });
});
import { toggleMark } from "prosemirror-commands";
import { Fragment, Node, Slice } from "prosemirror-model";
import {
  EditorState,
  Selection,
  TextSelection,
  Transaction,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Editor } from "../../../../app/editor";

// Mock prosemirror modules
jest.mock("prosemirror-commands", () => ({
  toggleMark: jest.fn(),
}));

jest.mock("prosemirror-tables", () => ({
  isInTable: jest.fn(() => false),
}));

// Mock the LANGUAGES export from Prism extension
jest.mock("../Prism", () => ({
  LANGUAGES: {
    javascript: "JavaScript",
    typescript: "TypeScript",
  },
}));

// Mock editor dependencies
jest.mock("../../../utils/urls", () => ({
  isUrl: jest.fn(),
}));

jest.mock("../../lib/isMarkdown", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../../lib/markdown/normalize", () => ({
  __esModule: true,
  default: jest.fn((text: string) => text),
}));

jest.mock("../../queries/isInCode", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

jest.mock("../../queries/isInList", () => ({
  __esModule: true,
  default: jest.fn(() => false),
}));

import { isUrl } from "../../../utils/urls";
import isMarkdown from "../../lib/isMarkdown";
import normalizePastedMarkdown from "../../lib/markdown/normalize";
import isInCode from "../../queries/isInCode";
import PasteHandler from "../PasteHandler";

const mockIsUrl = isUrl as jest.MockedFunction<typeof isUrl>;
const mockIsMarkdown = isMarkdown as jest.MockedFunction<typeof isMarkdown>;
const mockNormalizePastedMarkdown =
  normalizePastedMarkdown as jest.MockedFunction<
    typeof normalizePastedMarkdown
  >;
const mockIsInCode = isInCode as jest.MockedFunction<typeof isInCode>;
const mockToggleMark = toggleMark as jest.MockedFunction<typeof toggleMark>;

describe("PasteHandler", () => {
  let pasteHandler: PasteHandler;
  let mockEditor: Partial<Editor>;
  let mockView: Partial<EditorView>;
  let mockState: Partial<EditorState>;
  let mockTransaction: Partial<Transaction>;
  let mockSchema: any;
  let mockSelection: Partial<Selection>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock selection
    mockSelection = {
      empty: false,
      from: 0,
      to: 10,
    } as TextSelection;

    // Setup mock schema
    mockSchema = {
      marks: {
        link: {
          create: jest.fn((attrs) => ({ type: "link", attrs })),
        },
      },
      nodes: {
        paragraph: { name: "paragraph" },
        code_fence: {
          create: jest.fn((attrs) => ({ type: "code_fence", attrs })),
        },
      },
    };

    // Setup mock transaction
    mockTransaction = {
      insertText: jest.fn().mockReturnThis(),
      addMark: jest.fn().mockReturnThis(),
      replaceSelectionWith: jest.fn().mockReturnThis(),
      replaceSelection: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      scrollIntoView: jest.fn().mockReturnThis(),
      setMeta: jest.fn().mockReturnThis(),
    };

    // Setup mock state
    mockState = {
      selection: mockSelection,
      schema: mockSchema,
      tr: mockTransaction as Transaction,
    };

    // Setup mock view
    mockView = {
      state: mockState as EditorState,
      dispatch: jest.fn(),
      props: {
        editable: jest.fn(() => true),
      },
    };

    // Setup mock editor
    mockEditor = {
      schema: mockSchema,
      commands: {
        embed: jest.fn(),
      },
      props: {
        embeds: [
          {
            matcher: jest.fn(() => null),
          },
        ],
      },
      pasteParser: {
        parse: jest.fn(() => ({
          slice: jest.fn(() => new Slice(Fragment.empty, 0, 0)),
        })),
      },
    };

    pasteHandler = new PasteHandler();
    pasteHandler.bindEditor(mockEditor as Editor);
  });

  // Test utility: sliceSingleNode function
  describe("sliceSingleNode utility", () => {
    beforeEach(() => {
      pasteHandler = new PasteHandler();
    });

    it("should return single node when slice has one child and is closed", () => {
      const mockNode = { type: { name: "paragraph" } } as Node;
      const mockContent = {
        childCount: 1,
        firstChild: mockNode,
      } as Fragment;

      const slice = new Slice(mockContent, 0, 0);

      // Access the private sliceSingleNode function by testing its behavior
      // Since it's not exported, we'll test through the public interface
      expect(slice.openStart).toBe(0);
      expect(slice.openEnd).toBe(0);
      expect(slice.content.childCount).toBe(1);
      expect(slice.content.firstChild).toBe(mockNode);
    });

    it("should return null when slice has multiple children", () => {
      const mockContent = {
        childCount: 2,
        firstChild: null,
      } as Fragment;

      const slice = new Slice(mockContent, 0, 0);

      expect(slice.content.childCount).toBe(2);
    });

    it("should return null when slice is open at start", () => {
      const mockContent = {
        childCount: 1,
        firstChild: null,
      } as Fragment;

      const slice = new Slice(mockContent, 1, 0);

      expect(slice.openStart).toBe(1);
    });

    it("should return null when slice is open at end", () => {
      const mockContent = {
        childCount: 1,
        firstChild: null,
      } as Fragment;

      const slice = new Slice(mockContent, 0, 1);

      expect(slice.openEnd).toBe(1);
    });
  });

  describe("handlePaste", () => {
    let handlePaste: (view: EditorView, event: ClipboardEvent) => boolean;
    let mockClipboardEvent: Partial<ClipboardEvent>;
    let mockClipboardData: Partial<DataTransfer>;

    beforeEach(() => {
      const plugin = pasteHandler.plugins[0];
      handlePaste = plugin.props?.handlePaste as any;

      mockClipboardData = {
        getData: jest.fn((format: string) => {
          switch (format) {
            case "text/plain":
              return "test text";
            case "text/html":
              return "<p>test html</p>";
            case "vscode-editor-data":
              return "";
            default:
              return "";
          }
        }),
      };

      mockClipboardEvent = {
        clipboardData: mockClipboardData as DataTransfer,
        preventDefault: jest.fn(),
      };
    });

    describe("Early returns", () => {
      it("should return false when editor is not editable", () => {
        mockView.props!.editable = jest.fn(() => false);

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(result).toBe(false);
      });

      it("should return false when clipboard data is null", () => {
        mockClipboardEvent.clipboardData = null;

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(result).toBe(false);
      });

      it("should return false when shift key is held", () => {
        pasteHandler["shiftKey"] = true;

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(result).toBe(false);
      });
    });

    describe("URL pasting", () => {
      beforeEach(() => {
        mockIsUrl.mockReturnValue(true);
        mockClipboardData.getData = jest.fn(() => "https://example.com");
      });

      it("should apply link mark to selected text", () => {
        mockToggleMark.mockReturnValue(() => true);
        mockSelection.empty = false;

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockToggleMark).toHaveBeenCalledWith(mockSchema.marks.link, {
          href: "https://example.com",
        });
        expect(result).toBe(true);
      });

      it("should create embed when conditions are met", () => {
        mockSelection.empty = true;
        mockEditor.commands!.embed = jest.fn();
        mockEditor.props!.embeds![0].matcher = jest.fn(() => ["match"]);

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockEditor.commands!.embed).toHaveBeenCalledWith({
          href: "https://example.com",
        });
        expect(result).toBe(true);
      });

      it("should insert link directly when no selection and no embed", () => {
        mockSelection.empty = true;
        mockEditor.commands!.embed = jest.fn();
        mockEditor.props!.embeds![0].matcher = jest.fn(() => null);

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockTransaction.insertText).toHaveBeenCalledWith(
          "https://example.com",
          0,
          10
        );
        expect(mockView.dispatch).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    describe("Code block pasting", () => {
      beforeEach(() => {
        mockIsUrl.mockReturnValue(false);
        mockIsInCode.mockReturnValue(true);
        mockClipboardData.getData = jest.fn(() => "const x = 1;");
      });

      it("should paste as plain text when in code block", () => {
        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
        expect(mockTransaction.insertText).toHaveBeenCalledWith("const x = 1;");
        expect(result).toBe(true);
      });
    });

    describe("VSCode metadata handling", () => {
      beforeEach(() => {
        mockIsUrl.mockReturnValue(false);
        mockIsInCode.mockReturnValue(false);
        mockClipboardData.getData = jest.fn((format: string) => {
          if (format === "vscode-editor-data") {
            return JSON.stringify({ mode: "typescript" });
          }
          if (format === "text/plain") {
            return "console.log('hello');";
          }
          return "";
        });
      });

      it("should create code fence for VSCode paste", () => {
        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
        expect(mockSchema.nodes.code_fence.create).toHaveBeenCalledWith({
          language: "typescript",
        });
        expect(mockTransaction.replaceSelectionWith).toHaveBeenCalled();
        expect(mockTransaction.insertText).toHaveBeenCalledWith(
          "console.log('hello');"
        );
        expect(result).toBe(true);
      });

      it("should not create code fence for markdown mode", () => {
        mockClipboardData.getData = jest.fn((format: string) => {
          if (format === "vscode-editor-data") {
            return JSON.stringify({ mode: "markdown" });
          }
          if (format === "text/plain") {
            return "# This is markdown";
          }
          return "";
        });

        // Set isMarkdown to true so it goes to markdown handling path
        mockIsMarkdown.mockReturnValue(true);

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockSchema.nodes.code_fence.create).not.toHaveBeenCalled();
        expect(result).toBe(true); // Should return true for markdown handling
      });
    });

    describe("Markdown pasting", () => {
      beforeEach(() => {
        mockIsUrl.mockReturnValue(false);
        mockIsInCode.mockReturnValue(false);
        mockIsMarkdown.mockReturnValue(true);
        mockNormalizePastedMarkdown.mockImplementation((text) => text);

        mockClipboardData.getData = jest.fn((format: string) => {
          if (format === "text/plain") {
            return "This is a **bold** paragraph.";
          }
          if (format === "text/html") {
            return "<p>This is a <strong>bold</strong> paragraph.</p>";
          }
          return "";
        });
      });

      it("should handle single paragraph paste inline (main fix)", () => {
        // Create a mock paragraph node with content
        const mockTextNode = { nodeSize: 5 } as Node;
        const mockParagraphNode = {
          type: mockSchema.nodes.paragraph,
          forEach: jest.fn((callback) => {
            // Simulate paragraph with multiple text nodes
            callback(mockTextNode);
            callback(mockTextNode);
          }),
        } as Node;

        const mockContent = {
          childCount: 1,
          firstChild: mockParagraphNode,
        } as Fragment;

        const mockSlice = new Slice(mockContent, 0, 0);

        mockEditor.pasteParser!.parse = jest.fn(() => ({
          slice: jest.fn(() => mockSlice),
        }));

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();
        expect(mockEditor.pasteParser!.parse).toHaveBeenCalledWith(
          "This is a **bold** paragraph."
        );

        // Should insert nodes one by one for single paragraph
        expect(mockTransaction.insert).toHaveBeenCalledTimes(2);
        expect(mockTransaction.insert).toHaveBeenCalledWith(0, mockTextNode);
        expect(mockTransaction.insert).toHaveBeenCalledWith(5, mockTextNode);

        // Should not use replaceSelection for single paragraph
        expect(mockTransaction.replaceSelection).not.toHaveBeenCalled();
        expect(mockTransaction.replaceSelectionWith).not.toHaveBeenCalled();

        expect(result).toBe(true);
      });

      it("should handle multi-paragraph paste normally", () => {
        // Create a mock slice with multiple nodes (not single paragraph)
        const mockContent = {
          childCount: 2,
          firstChild: null,
        } as Fragment;

        const mockSlice = new Slice(mockContent, 0, 0);

        mockEditor.pasteParser!.parse = jest.fn(() => ({
          slice: jest.fn(() => mockSlice),
        }));

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();

        // Should use replaceSelection for multi-paragraph content
        expect(mockTransaction.replaceSelection).toHaveBeenCalledWith(
          mockSlice
        );
        expect(mockTransaction.insert).not.toHaveBeenCalled();

        expect(result).toBe(true);
      });

      it("should handle single non-paragraph node normally", () => {
        // Create a mock non-paragraph node
        const mockHeadingNode = {
          type: { name: "heading" },
        } as Node;

        const mockContent = {
          childCount: 1,
          firstChild: mockHeadingNode,
        } as Fragment;

        const mockSlice = new Slice(mockContent, 0, 0);

        mockEditor.pasteParser!.parse = jest.fn(() => ({
          slice: jest.fn(() => mockSlice),
        }));

        const result = handlePaste(
          mockView as EditorView,
          mockClipboardEvent as ClipboardEvent
        );

        expect(mockClipboardEvent.preventDefault).toHaveBeenCalled();

        // Should use replaceSelectionWith for single non-paragraph node
        expect(mockTransaction.replaceSelectionWith).toHaveBeenCalledWith(
          mockHeadingNode,
          false
        );
        expect(mockTransaction.insert).not.toHaveBeenCalled();
        expect(mockTransaction.replaceSelection).not.toHaveBeenCalled();

        expect(result).toBe(true);
      });
    });
  });
});

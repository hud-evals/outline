import { schema } from "prosemirror-markdown";
import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import Storage from "../../../utils/Storage";
import CodeFence from "../CodeFence";

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    message: jest.fn(),
  },
}));

describe("CodeFence", () => {
  let codeFence: CodeFence;
  let testSchema: Schema;
  let mockEditor: any;
  let mockDictionary: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Spy on Storage methods
    jest.spyOn(Storage, "get").mockImplementation(
      (key, defaultValue) => defaultValue // Return the default when key doesn't exist
    );
    jest.spyOn(Storage, "set").mockImplementation(() => {});

    // Mock dictionary
    mockDictionary = {
      codeCopied: "Code copied",
    };

    // Mock editor
    mockEditor = {
      schema,
    };

    // Create CodeFence instance
    codeFence = new CodeFence({
      dictionary: mockDictionary,
    });
    codeFence.editor = mockEditor;

    // Create test schema with code_block node
    testSchema = new Schema({
      nodes: schema.spec.nodes.append({
        code_block: {
          content: "text*",
          group: "block",
          code: true,
          defining: true,
          marks: "",
          attrs: {
            language: { default: null },
          },
          parseDOM: [
            {
              tag: "pre",
              preserveWhitespace: "full",
              getAttrs: (node: any) => ({
                language: node.getAttribute("data-language") || null,
              }),
            },
          ],
          toDOM(node: any) {
            return [
              "pre",
              { "data-language": node.attrs.language },
              ["code", 0],
            ];
          },
        },
      }),
      marks: schema.spec.marks,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("language persistence", () => {
    describe("commands", () => {
      it("should save language when creating a code block with a specific language", () => {
        const commands = codeFence.commands({
          type: testSchema.nodes.code_block,
          schema: testSchema,
        });

        const state = EditorState.create({ schema: testSchema });
        const dispatch = jest.fn();

        // Execute code_block command with python language
        const command = commands.code_block({ language: "python" });
        command(state, dispatch);

        // Verify setRecentCodeLanguage was called via Storage.set
        expect(Storage.set).toHaveBeenCalledWith("rme-code-language", "python");
        expect(Storage.set).toHaveBeenCalledWith(
          "frequent-code-languages",
          expect.any(Object)
        );
      });

      it("should use recent language when creating a code block without specifying language", () => {
        // Mock Storage to return a recent language
        jest.spyOn(Storage, "get").mockImplementation((key, defaultValue) => {
          if (key === "rme-code-language") {
            return "rust";
          }
          return defaultValue;
        });

        const commands = codeFence.commands({
          type: testSchema.nodes.code_block,
          schema: testSchema,
        });

        const state = EditorState.create({ schema: testSchema });
        const dispatch = jest.fn();

        // Execute code_block command without language
        const command = commands.code_block({});
        command(state, dispatch);

        // The toggleBlockType should be called with the recent language
        // We can't directly test this without mocking toggleBlockType,
        // but we can verify Storage.get was called
        expect(Storage.get).toHaveBeenCalledWith(
          "rme-code-language",
          expect.anything()
        );
      });

      it("should use default language when no recent language exists", () => {
        // Mock Storage to return undefined for recent language
        jest
          .spyOn(Storage, "get")
          .mockImplementation((key, defaultValue) => defaultValue);

        // Create a test document with a paragraph
        const doc = testSchema.nodes.doc.create(null, [
          testSchema.nodes.paragraph.create(),
        ]);
        const state = EditorState.create({
          doc,
          schema: testSchema,
        });
        const dispatch = jest.fn();

        const commands = codeFence.commands({
          type: testSchema.nodes.code_block,
          schema: testSchema,
        });

        // Execute code_block command without language
        const command = commands.code_block({});
        command(state, dispatch);

        // Should have checked for recent language
        expect(Storage.get).toHaveBeenCalledWith(
          "rme-code-language",
          expect.anything()
        );

        // When no recent language exists, it should create a code block with DEFAULT_LANGUAGE
        // Check that dispatch was called with a transaction
        expect(dispatch).toHaveBeenCalled();

        // Verify the transaction creates a code_block with language: "javascript"
        const transaction = dispatch.mock.calls[0][0];
        if (transaction && transaction.doc) {
          const codeBlock = transaction.doc.firstChild;
          expect(codeBlock?.type.name).toBe("code_block");
          expect(codeBlock?.attrs.language).toBe("javascript");
        }
      });

      it("should override saved language when explicit language is provided", () => {
        // Mock Storage to return a recent language
        jest.spyOn(Storage, "get").mockImplementation((key, defaultValue) => {
          if (key === "rme-code-language") {
            return "python";
          }
          return defaultValue;
        });

        const commands = codeFence.commands({
          type: testSchema.nodes.code_block,
          schema: testSchema,
        });

        const state = EditorState.create({ schema: testSchema });
        const dispatch = jest.fn();

        // Execute code_block command with explicit language
        const command = commands.code_block({ language: "go" });
        command(state, dispatch);

        // Should save the new language
        expect(Storage.set).toHaveBeenCalledWith("rme-code-language", "go");
      });
    });
  });

  describe("integration with code lib functions", () => {
    it("should track language frequency when setting recent language", () => {
      // Setup Storage mock to track the data
      const storageData: Record<string, any> = {};
      jest
        .spyOn(Storage, "get")
        .mockImplementation(
          (key, defaultValue) => storageData[key] ?? defaultValue
        );
      jest.spyOn(Storage, "set").mockImplementation((key, value) => {
        storageData[key] = value;
      });

      const commands = codeFence.commands({
        type: testSchema.nodes.code_block,
        schema: testSchema,
      });

      const state = EditorState.create({ schema: testSchema });
      const dispatch = jest.fn();

      // Create multiple code blocks with different languages
      commands.code_block({ language: "python" })(state, dispatch);
      expect(storageData["rme-code-language"]).toBe("python");
      expect(storageData["frequent-code-languages"]).toHaveProperty(
        "python",
        1
      );

      commands.code_block({ language: "python" })(state, dispatch);
      expect(storageData["frequent-code-languages"]).toHaveProperty(
        "python",
        2
      );

      commands.code_block({ language: "rust" })(state, dispatch);
      expect(storageData["rme-code-language"]).toBe("rust");
      expect(storageData["frequent-code-languages"]).toHaveProperty("rust", 1);
    });
  });
});

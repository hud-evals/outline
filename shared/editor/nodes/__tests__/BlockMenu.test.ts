/**
 * @jest-environment jsdom
 */
/* eslint-disable */

jest.mock("mobx-react", () => ({
  observer: (component: any) => component,
}));

jest.mock("@radix-ui/react-visually-hidden", () => ({
  Root: ({ children }: any) => children,
}));

jest.mock("react-merge-refs", () => ({
  mergeRefs:
    (...refs: any[]) =>
    (element: any) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(element);
        } else if (ref != null) {
          ref.current = element;
        }
      });
    },
}));

// Mock DOM methods
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock document.createElement for the button
const mockButton = {
  className: "",
  type: "button",
  addEventListener: jest.fn(),
};
global.document.createElement = jest.fn().mockImplementation((tag) => {
  if (tag === "button") {
    return mockButton;
  }
  return {};
});

// Mock ReactDOM.render
jest.mock("react-dom", () => ({
  render: jest.fn(),
}));

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid-1234"),
}));

// Mock SuggestionsMenu component to avoid env issues
jest.mock("~/editor/components/SuggestionsMenu", () => ({
  __esModule: true,
  default: () => null,
}));

import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import BlockMenuExtension from "~/editor/extensions/BlockMenu";

describe("BlockMenu", () => {
  let blockMenu: BlockMenuExtension;
  let schema: Schema;

  beforeEach(() => {
    // Create BlockMenu extension with required Suggestion options
    blockMenu = new BlockMenuExtension({
      trigger: "/",
      allowSpaces: false,
      requireSearchTerm: false,
      enabledInCode: false,
    });

    // Mock the dictionary that BlockMenu uses
    (blockMenu as any).options.dictionary = {
      newLineEmpty: "Type / for commands",
      newLineWithSlash: "Start typing to filter…",
    };

    // Create a minimal schema for testing
    schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: {
          content: "inline*",
          group: "block",
          parseDOM: [{ tag: "p" }],
          toDOM() {
            return ["p", 0];
          },
        },
        text: {
          group: "inline",
        },
        image: {
          inline: true,
          group: "inline",
          attrs: {
            src: {},
            alt: { default: null },
          },
          parseDOM: [
            {
              tag: "img[src]",
              getAttrs(dom: any) {
                return {
                  src: dom.getAttribute("src"),
                  alt: dom.getAttribute("alt"),
                };
              },
            },
          ],
          toDOM(node: any) {
            return ["img", node.attrs];
          },
        },
      },
    });
  });

  describe("PlaceholderPlugin from BlockMenu", () => {
    const getBlockMenuPlaceholderDecorations = (state: EditorState) => {
      // BlockMenu returns multiple plugins, find the PlaceholderPlugin
      const plugins = blockMenu.plugins;
      // Find the PlaceholderPlugin (it should be the last one, but let's be explicit)
      const placeholderPlugin =
        plugins.find(
          (plugin) =>
            plugin.constructor.name === "PlaceholderPlugin" ||
            (plugin as any).placeholders !== undefined
        ) || plugins[plugins.length - 1];

      // Initialize plugin state to get decorations
      const pluginState = placeholderPlugin.spec.state!.init!({}, state);
      return pluginState.decorations;
    };

    it("should NOT show placeholder for empty paragraph after text paragraph", () => {
      // Create a document with text in first paragraph, empty second paragraph
      const testDoc = schema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Some text",
              },
            ],
          },
          {
            type: "paragraph", // Empty paragraph
          },
        ],
      });

      const state = EditorState.create({
        schema,
        doc: testDoc,
        // Place cursor in the second (empty) paragraph
        selection: TextSelection.create(
          testDoc,
          testDoc.nodeAt(0)!.nodeSize + 2
        ),
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);

      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder for paragraph with image after text paragraph", () => {
      // Create a document with text in first paragraph, image in second paragraph
      const testDoc = schema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Some text",
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "test.jpg" },
              },
            ],
          },
        ],
      });

      const state = EditorState.create({
        schema,
        doc: testDoc,
        // Place cursor in the second paragraph after the image
        selection: TextSelection.create(
          testDoc,
          testDoc.nodeAt(0)!.nodeSize + 2
        ),
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should show placeholder for slash command", () => {
      const testDoc = schema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "/",
              },
            ],
          },
        ],
      });

      const state = EditorState.create({
        schema,
        doc: testDoc,
        // Cursor after the slash
        selection: TextSelection.create(testDoc, 2),
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);

      // Should show the slash command placeholder
      expect(decorations.find().length).toBe(1);
      const decoration = decorations.find()[0];
      expect((decoration as any)?.type?.attrs?.["data-empty-text"]).toBe(
        "  Start typing to filter…"
      );
    });

    it("should NOT show placeholder when paragraph has text and image", () => {
      const testDoc = schema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Caption: ",
              },
              {
                type: "image",
                attrs: { src: "test.jpg" },
              },
            ],
          },
        ],
      });

      const state = EditorState.create({
        schema,
        doc: testDoc,
        // Cursor after the image
        selection: TextSelection.create(testDoc, 10),
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);

      // Should not show placeholder - has text content
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder for nested paragraphs", () => {
      const extendedSchema = new Schema({
        nodes: {
          doc: { content: "block+" },
          blockquote: {
            content: "block+",
            group: "block",
            parseDOM: [{ tag: "blockquote" }],
            toDOM() {
              return ["blockquote", 0];
            },
          },
          paragraph: {
            content: "inline*",
            group: "block",
            parseDOM: [{ tag: "p" }],
            toDOM() {
              return ["p", 0];
            },
          },
          text: {
            group: "inline",
          },
        },
      });

      const testDoc = extendedSchema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
              },
            ],
          },
        ],
      });

      const state = EditorState.create({
        schema: extendedSchema,
        doc: testDoc,
        // Cursor in the nested paragraph
        selection: TextSelection.create(testDoc, 2),
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);

      // Should not show placeholder - paragraph is nested (depth > 1)
      expect(decorations.find().length).toBe(0);
    });

    it("should handle multiple images correctly", () => {
      const testDoc = schema.nodeFromJSON({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: "test1.jpg" },
              },
              {
                type: "image",
                attrs: { src: "test2.jpg" },
              },
            ],
          },
        ],
      });

      const state = EditorState.create({
        schema,
        doc: testDoc,
        selection: TextSelection.create(testDoc, 3), // After both images
      });

      const decorations = getBlockMenuPlaceholderDecorations(state);

      // Should not show placeholder - paragraph has child nodes
      expect(decorations.find().length).toBe(0);
    });
  });
});

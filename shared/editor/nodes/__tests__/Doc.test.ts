import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import Doc from "../Doc";

describe("Doc", () => {
  let doc: Doc;
  let schema: Schema;

  beforeEach(() => {
    doc = new Doc({ placeholder: "Start writing..." });

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

  describe("placeholder decoration", () => {
    const getPlaceholderDecorations = (state: EditorState): DecorationSet => {
      // Get the placeholder plugin from Doc node
      const plugins = doc.plugins;
      const placeholderPlugin = plugins[0];

      // Initialize plugin state to get decorations
      const pluginState = placeholderPlugin.spec.state!.init!({}, state);
      return pluginState.decorations;
    };

    it("should show placeholder for empty document with single empty paragraph", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(1);

      // Check that the decoration has the placeholder class and text
      const decoration = decorations.find()[0];
      expect((decoration as any)?.type?.attrs?.class).toBe("placeholder");
      expect((decoration as any)?.type?.attrs?.["data-empty-text"]).toBe(
        "Start writing..."
      );
    });

    it("should NOT show placeholder when paragraph contains an image (PR #9593 fix)", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
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
        }),
      });

      const decorations = getPlaceholderDecorations(state);

      // This is the key test for PR #9593 - no placeholder when paragraph has image
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder when paragraph has text content", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Hello world",
                },
              ],
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder when document has multiple paragraphs", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [{ type: "paragraph" }, { type: "paragraph" }],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder for non-first paragraph", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "First" }],
            },
            { type: "paragraph" },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder when parent is not doc type", () => {
      // Create a schema with blockquote
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

      const state = EditorState.create({
        schema: extendedSchema,
        doc: extendedSchema.nodeFromJSON({
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
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should show placeholder only when all conditions are met", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);

      // Should have exactly one decoration
      expect(decorations.find().length).toBe(1);

      // Verify the decoration is applied to the paragraph
      const decoration = decorations.find()[0];
      expect(decoration?.from).toBe(0);
      expect(decoration?.to).toBe(2); // Empty paragraph has size 2
    });

    it("should NOT show placeholder when paragraph has both text and image", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Some text " },
                { type: "image", attrs: { src: "test.jpg" } },
              ],
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder for paragraph with only image (no text) - PR #9593", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "image", attrs: { src: "test.jpg" } }],
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);

      // This is the main bug fixed in PR #9593
      // Before: would show placeholder because textContent === ""
      // After: no placeholder because node.childCount === 1 (has image)
      expect(decorations.find().length).toBe(0);
    });

    it("should update placeholder when document changes", () => {
      // Start with empty doc - should have placeholder
      let state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);
      expect(decorations.find().length).toBe(1);

      // Add text - placeholder should disappear
      const tr = state.tr.insertText("Hello", 1);
      state = state.apply(tr);

      const plugin = doc.plugins[0];
      const newPluginState = plugin.spec.state!.apply!(
        tr,
        { decorations },
        state,
        state
      );
      expect(newPluginState.decorations.find().length).toBe(0);
    });

    it("should handle multiple empty paragraphs correctly", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            { type: "paragraph" },
            { type: "paragraph" },
            { type: "paragraph" },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);

      // Should not show placeholder when multiple paragraphs exist
      expect(decorations.find().length).toBe(0);
    });

    it("should NOT show placeholder for paragraph with multiple images", () => {
      const state = EditorState.create({
        schema,
        doc: schema.nodeFromJSON({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "image", attrs: { src: "test1.jpg" } },
                { type: "image", attrs: { src: "test2.jpg" } },
              ],
            },
          ],
        }),
      });

      const decorations = getPlaceholderDecorations(state);

      // Multiple images, no text - still no placeholder after PR #9593
      expect(decorations.find().length).toBe(0);
    });
  });
});

import { mathSchemaSpec } from "@benrbray/prosemirror-math";
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { REGEX_BLOCK_MATH_DOLLARS } from "../../rules/math";
import MathBlock from "../MathBlock";

describe("MathBlock", () => {
  let mathBlock: MathBlock;
  let schema: Schema;
  let nodeType: any;

  beforeEach(() => {
    mathBlock = new MathBlock();

    // Create a minimal schema for testing
    schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { content: "text*", group: "block" },
        text: {},
        math_block: mathSchemaSpec.nodes.math_display,
      },
    });

    nodeType = schema.nodes.math_block;
  });

  describe("commands", () => {
    test("creates math block and positions cursor correctly", () => {
      // Create initial document with some content
      const doc = schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("Hello world")]),
      ]);

      // Create editor state with selection at end of paragraph
      const state = EditorState.create({
        doc,
        selection: TextSelection.create(doc, 11), // Position at end of "Hello world"
      });

      const command = mathBlock.commands({ type: nodeType });

      let newState: EditorState | undefined;
      const dispatch = jest.fn((tr) => {
        newState = state.apply(tr);
      });

      // Execute the command
      const result = command()(state, dispatch);

      expect(result).toBe(true);
      expect(dispatch).toHaveBeenCalled();
      expect(newState).toBeDefined();

      if (newState) {
        // Check that a math block was inserted
        const mathBlockNodes = [];
        newState.doc.descendants((node) => {
          if (node.type.name === "math_block") {
            mathBlockNodes.push(node);
          }
        });
        expect(mathBlockNodes).toHaveLength(1);

        // Check that cursor is positioned correctly near the math block
        expect(newState.selection).toBeInstanceOf(TextSelection);
        expect(newState.selection.from).toBe(10); // Position before the math block
      }
    });

    test("command works without dispatch", () => {
      const doc = schema.node("doc", null, [
        schema.node("paragraph", null, [schema.text("test")]),
      ]);

      const state = EditorState.create({
        doc,
        selection: TextSelection.create(doc, 4),
      });

      const command = mathBlock.commands({ type: nodeType });
      const result = command()(state);

      expect(result).toBe(true);
    });
  });

  describe("input rules", () => {
    test("creates input rule for block math pattern", () => {
      const inputRules = mathBlock.inputRules({ type: nodeType });

      expect(inputRules).toHaveLength(1);

      // Verify the regex pattern is correct
      const rule = inputRules[0];
      expect(rule.match).toEqual(REGEX_BLOCK_MATH_DOLLARS);
    });
  });

  describe("markdown serialization", () => {
    test("converts math block to markdown", () => {
      const mathContent = "E = mc^2";
      const mathNode = schema.node("math_block", null, [
        schema.text(mathContent),
      ]);

      const mockState = {
        write: jest.fn(),
        text: jest.fn(),
        ensureNewLine: jest.fn(),
        closeBlock: jest.fn(),
      };

      mathBlock.toMarkdown(mockState as any, mathNode);

      expect(mockState.write).toHaveBeenCalledWith("$$$\n");
      expect(mockState.text).toHaveBeenCalledWith(mathContent, false);
      expect(mockState.ensureNewLine).toHaveBeenCalled();
      expect(mockState.write).toHaveBeenCalledWith("$$$");
      expect(mockState.closeBlock).toHaveBeenCalledWith(mathNode);
    });
  });

  describe("markdown parsing", () => {
    test("returns correct parse spec", () => {
      const parseSpec = mathBlock.parseMarkdown();

      expect(parseSpec).toEqual({
        node: "math_block",
        block: "math_block",
        noCloseToken: true,
      });
    });
  });
});

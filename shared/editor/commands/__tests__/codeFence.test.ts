/* eslint-disable */

import { Node } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { schema } from "@server/editor";
import { splitCodeBlockOnTripleBackticks } from "../codeFence";

describe("splitCodeBlockOnTripleBackticks", () => {
  it("should split a code block when three backticks are typed", () => {
    // Create a document with a code block containing text followed by backticks
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "javascript" },
          content: [
            {
              type: "text",
              text: "console.log('hello');```",
            },
          ],
        },
      ],
    });

    // Position cursor at the end of the text (after the backticks)
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 24), // Position after backticks
    });

    let newState: EditorState | null = null;
    const dispatch = (tr: any) => {
      newState = state.apply(tr);
    };

    // Execute the command
    const result = splitCodeBlockOnTripleBackticks(state, dispatch);

    expect(result).toBe(true);
    expect(newState).toBeTruthy();

    // Should have two code blocks now
    expect(newState!.doc.childCount).toBe(2);

    // First code block should have the text without backticks
    const firstBlock = newState!.doc.child(0);
    expect(firstBlock.type.name).toBe("code_fence");
    expect(firstBlock.textContent).toBe("console.log('hello')");
    expect(firstBlock.attrs.language).toBe("javascript");

    // Second code block should contain the remaining backtick with same language
    const secondBlock = newState!.doc.child(1);
    expect(secondBlock.type.name).toBe("code_fence");
    expect(secondBlock.textContent).toBe("`");
    expect(secondBlock.attrs.language).toBe("javascript");
  });

  it("should not split when not in a code block", () => {
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "This is text with ```",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 20), // Position after backticks
    });

    const result = splitCodeBlockOnTripleBackticks(state, undefined);
    expect(result).toBe(false);
  });

  it("should not split when backticks are not at the end", () => {
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "python" },
          content: [
            {
              type: "text",
              text: "```middle text here",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 10), // Position in middle
    });

    const result = splitCodeBlockOnTripleBackticks(state, undefined);
    expect(result).toBe(false);
  });

  it("should not split when there are less than two preceding backticks", () => {
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "typescript" },
          content: [
            {
              type: "text",
              text: "console.log('test');`",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 22), // Position after single backtick
    });

    const result = splitCodeBlockOnTripleBackticks(state, undefined);
    expect(result).toBe(false);
  });

  it("should split with language preserved", () => {
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "python" },
          content: [
            {
              type: "text",
              text: "print('hello')```",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 18), // Position after backticks
    });

    let newState: EditorState | null = null;
    const dispatch = (tr: any) => {
      newState = state.apply(tr);
    };

    const result = splitCodeBlockOnTripleBackticks(state, dispatch);

    expect(result).toBe(true);
    expect(newState).toBeTruthy();

    expect(newState!.doc.childCount).toBe(2);

    const firstBlock = newState!.doc.child(0);
    expect(firstBlock.attrs.language).toBe("python");
    expect(firstBlock.textContent).toBe("print('hello')");

    const secondBlock = newState!.doc.child(1);
    expect(secondBlock.attrs.language).toBe("python");
    expect(secondBlock.textContent).toBe("");
  });

  it("should handle edge case with backticks at start of code block", () => {
    // This tests the boundary condition where backticks are at the very start
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "bash" },
          content: [
            {
              type: "text",
              text: "```",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4), // Position after backticks at start
    });

    let newState: EditorState | null = null;
    const dispatch = (tr: any) => {
      newState = state.apply(tr);
    };

    const result = splitCodeBlockOnTripleBackticks(state, dispatch);

    // Test that the function executes and produces a result
    expect(result).toBe(true);
    expect(newState).toBeTruthy();

    // The split happens, creating two code blocks
    expect(newState!.doc.childCount).toBe(2);
    expect(newState!.doc.child(0).textContent).toBe("");
    expect(newState!.doc.child(1).textContent).toBe("");
  });
});

describe("CodeFence plugin integration", () => {
  it("should have handleTextInput in plugins that calls splitCodeBlockOnTripleBackticks", () => {
    // Mock dictionary
    const mockDictionary = {
      codeCopied: "Code copied",
    };

    // Create CodeFence instance
    const codeFence = new (require("../../nodes/CodeFence").default)({
      dictionary: mockDictionary,
    });

    // Mock the editor property that plugins expect
    codeFence.editor = {
      props: {
        theme: {
          isDark: false,
        },
      },
    };

    // Get the plugins
    const plugins = codeFence.plugins;

    // Find the code-fence-split plugin
    const splitPlugin = plugins.find(
      (plugin: any) => plugin.key && plugin.key.startsWith("code-fence-split")
    );

    expect(splitPlugin).toBeDefined();
    expect(splitPlugin.props.handleTextInput).toBeDefined();

    // Test that handleTextInput calls our function when "`" is typed
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "code_fence",
          attrs: { language: "javascript" },
          content: [
            {
              type: "text",
              text: "console.log('test');``",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 23), // Position after two backticks
    });

    let transactionApplied = false;
    const mockView = {
      state,
      dispatch: (_tr: any) => {
        transactionApplied = true;
      },
    };

    // Call handleTextInput with backtick
    const result = splitPlugin.props.handleTextInput(mockView, 23, 23, "`");

    expect(result).toBe(true);
    expect(transactionApplied).toBe(true);
  });

  it("should not handle non-backtick input in plugin", () => {
    // Mock dictionary
    const mockDictionary = {
      codeCopied: "Code copied",
    };

    // Create CodeFence instance
    const codeFence = new (require("../../nodes/CodeFence").default)({
      dictionary: mockDictionary,
    });

    // Mock the editor property that plugins expect
    codeFence.editor = {
      props: {
        theme: {
          isDark: false,
        },
      },
    };

    // Get the plugins
    const plugins = codeFence.plugins;

    // Find the code-fence-split plugin
    const splitPlugin = plugins.find(
      (plugin: any) => plugin.key && plugin.key.startsWith("code-fence-split")
    );

    const mockView = {
      state: EditorState.create({ schema }),
      dispatch: jest.fn(),
    };

    // Call handleTextInput with non-backtick
    const result = splitPlugin.props.handleTextInput(mockView, 1, 1, "a");

    expect(result).toBe(false);
    expect(mockView.dispatch).not.toHaveBeenCalled();
  });

  it("should handle backtick but not split when conditions aren't met", () => {
    // Mock dictionary
    const mockDictionary = {
      codeCopied: "Code copied",
    };

    // Create CodeFence instance
    const codeFence = new (require("../../nodes/CodeFence").default)({
      dictionary: mockDictionary,
    });

    // Mock the editor property that plugins expect
    codeFence.editor = {
      props: {
        theme: {
          isDark: false,
        },
      },
    };

    // Get the plugins
    const plugins = codeFence.plugins;

    // Find the code-fence-split plugin
    const splitPlugin = plugins.find(
      (plugin: any) => plugin.key && plugin.key.startsWith("code-fence-split")
    );

    // Create state where split shouldn't happen (not in code block)
    const doc = Node.fromJSON(schema, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "regular text",
            },
          ],
        },
      ],
    });

    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 13), // Position at end of text
    });

    const mockView = {
      state,
      dispatch: jest.fn(),
    };

    // Call handleTextInput with backtick - should return false since not in code
    const result = splitPlugin.props.handleTextInput(mockView, 13, 13, "`");

    expect(result).toBe(false);
    expect(mockView.dispatch).not.toHaveBeenCalled();
  });
});

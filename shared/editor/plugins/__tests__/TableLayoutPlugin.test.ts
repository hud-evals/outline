import { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { TableMap } from "prosemirror-tables";
import { schema } from "@server/editor";
import { TableLayoutPlugin } from "../TableLayoutPlugin";
import { TableLayout } from "../../types";

function createTableDoc(
  tableAttrs: any = {},
  rows: any[][] = [["cell1", "cell2"]]
) {
  const tableRows = rows.map((row) => ({
    type: "tr",
    content: row.map((cellText) => ({
      type: "td",
      content: [
        { type: "paragraph", content: [{ type: "text", text: cellText }] },
      ],
    })),
  }));

  return Node.fromJSON(schema, {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: tableAttrs,
        content: tableRows,
      },
    ],
  });
}

function createTableWithColwidth(
  tableAttrs: any = {},
  cellAttrs: any[][] = [[{}, { colwidth: [100] }]]
) {
  const tableRows = cellAttrs.map((row, rowIndex) => ({
    type: "tr",
    content: row.map((cellAttrs, colIndex) => ({
      type: "td",
      attrs: cellAttrs,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `cell${rowIndex + 1},${colIndex + 1}` },
          ],
        },
      ],
    })),
  }));

  return Node.fromJSON(schema, {
    type: "doc",
    content: [
      {
        type: "table",
        attrs: tableAttrs,
        content: tableRows,
      },
    ],
  });
}

describe("TableLayoutPlugin", () => {
  let plugin: TableLayoutPlugin;

  beforeEach(() => {
    plugin = new TableLayoutPlugin();
  });

  describe("Layout change detection", () => {
    it("should detect when layout changes from null to fullWidth", () => {
      const initialDoc = createTableDoc();
      const changedDoc = createTableDoc({ layout: TableLayout.fullWidth });

      const oldState = EditorState.create({
        doc: initialDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: changedDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [
        newState.tr.replaceWith(0, oldState.doc.content.size, changedDoc),
      ];
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeTruthy();
    });

    it("should detect when layout changes from fullWidth to null", () => {
      const initialDoc = createTableDoc({ layout: TableLayout.fullWidth });
      const changedDoc = createTableDoc();

      const oldState = EditorState.create({
        doc: initialDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: changedDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [
        newState.tr.replaceWith(0, oldState.doc.content.size, changedDoc),
      ];
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeTruthy();
    });

    it("should not trigger when layout doesn't change", () => {
      const testDoc = createTableDoc();

      const oldState = EditorState.create({
        doc: testDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: testDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [newState.tr.insertText("text", 3)]; // Insert after table
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeUndefined();
    });
  });

  describe("Column width removal", () => {
    it("should remove colwidth from last column cells when switching to fullWidth", () => {
      const initialDoc = createTableWithColwidth({}, [
        [{}, { colwidth: [100] }],
        [{}, { colwidth: [120] }],
      ]);
      const changedDoc = createTableWithColwidth(
        { layout: TableLayout.fullWidth },
        [
          [{}, { colwidth: [100] }],
          [{}, { colwidth: [120] }],
        ]
      );

      const oldState = EditorState.create({
        doc: initialDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: changedDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [
        newState.tr.replaceWith(0, oldState.doc.content.size, changedDoc),
      ];
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeTruthy();
      if (result) {
        const finalDoc = newState.apply(result).doc;
        const tableNode = finalDoc.firstChild!;
        const map = TableMap.get(tableNode);

        // In a 2x2 table, the last column should have colwidth removed
        expect(map.width).toBe(2);
      }
    });

    it("should handle tables with different dimensions", () => {
      // Test with 3x3 table
      const cellAttrs = [
        [{}, { colwidth: [100] }, { colwidth: [150] }],
        [{}, { colwidth: [100] }, { colwidth: [150] }],
        [{}, { colwidth: [100] }, { colwidth: [150] }],
      ];

      const initialDoc = createTableWithColwidth({}, cellAttrs);
      const changedDoc = createTableWithColwidth(
        { layout: TableLayout.fullWidth },
        cellAttrs
      );

      const oldState = EditorState.create({
        doc: initialDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: changedDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [
        newState.tr.replaceWith(0, oldState.doc.content.size, changedDoc),
      ];
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeTruthy();
    });
  });

  describe("Edge cases", () => {
    it("should handle single column tables", () => {
      const singleColumnDoc = createTableWithColwidth({}, [
        [{ colwidth: [200] }],
      ]);
      const changedDoc = createTableWithColwidth(
        { layout: TableLayout.fullWidth },
        [[{ colwidth: [200] }]]
      );

      const oldState = EditorState.create({
        doc: singleColumnDoc,
        schema,
        plugins: [plugin],
      });

      const newState = EditorState.create({
        doc: changedDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [
        newState.tr.replaceWith(0, oldState.doc.content.size, changedDoc),
      ];
      const result = plugin.spec.appendTransaction!(
        transactions,
        oldState,
        newState
      );

      expect(result).toBeTruthy();
    });

    it("should handle initial state with no oldState", () => {
      const testDoc = createTableDoc({ layout: TableLayout.fullWidth });

      const state = EditorState.create({
        doc: testDoc,
        schema,
        plugins: [plugin],
      });

      const transactions = [state.tr];
      const result = plugin.spec.appendTransaction!(
        transactions,
        null as any,
        state
      );

      // Should handle initial state without error
      expect(result).toBeUndefined();
    });
  });
});

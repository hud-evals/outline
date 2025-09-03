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
      const finalDoc = newState.apply(result).doc;
      const tableNode = finalDoc.firstChild!;
      const map = TableMap.get(tableNode);

      // Verify the layout is fullWidth
      expect(tableNode.attrs.layout).toBe(TableLayout.fullWidth);

      // Verify colwidth was removed from last column cells
      const lastColumnCells = [];
      for (let row = 0; row < map.height; row++) {
        const cellPos = map.map[row * map.width + (map.width - 1)];
        const cell = tableNode.nodeAt(cellPos);
        lastColumnCells.push(cell);
      }

      lastColumnCells.forEach((cell) => {
        expect(cell?.attrs.colwidth).toBeFalsy();
      });
    });

    it("should detect when layout changes from fullWidth to null", () => {
      const initialDoc = createTableWithColwidth(
        { layout: TableLayout.fullWidth },
        [
          [{}, { colwidth: [100] }],
          [{}, { colwidth: [120] }],
        ]
      );
      const changedDoc = createTableWithColwidth({}, [
        [{}, { colwidth: [100] }],
        [{}, { colwidth: [120] }],
      ]);

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
      const finalDoc = newState.apply(result).doc;
      const tableNode = finalDoc.firstChild!;
      const map = TableMap.get(tableNode);

      // Verify the layout is no longer fullWidth
      expect(tableNode.attrs.layout).toBeFalsy();

      // Verify colwidth was removed from last column cells
      const lastColumnCells = [];
      for (let row = 0; row < map.height; row++) {
        const cellPos = map.map[row * map.width + (map.width - 1)];
        const cell = tableNode.nodeAt(cellPos);
        lastColumnCells.push(cell);
      }

      lastColumnCells.forEach((cell) => {
        expect(cell?.attrs.colwidth).toBeFalsy();
      });
    });

    it("should not trigger when layout doesn't change", () => {
      const testDoc = createTableWithColwidth({}, [
        [{}, { colwidth: [100] }],
        [{}, { colwidth: [120] }],
      ]);

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

      // Verify colwidth attributes remain unchanged
      const tableNode = newState.doc.firstChild!;
      const map = TableMap.get(tableNode);

      // Check that last column cells still have their colwidth
      for (let row = 0; row < map.height; row++) {
        const cellPos = map.map[row * map.width + (map.width - 1)];
        const cell = tableNode.nodeAt(cellPos);
        expect(cell?.attrs.colwidth).toBeTruthy();
      }
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
      const finalDoc = newState.apply(result).doc;
      const tableNode = finalDoc.firstChild!;
      const map = TableMap.get(tableNode);

      // Verify table layout is fullWidth
      expect(tableNode.attrs.layout).toBe(TableLayout.fullWidth);
      expect(map.width).toBe(2);

      // Verify colwidth was removed from last column cells
      const lastColumnCells = [];
      for (let row = 0; row < map.height; row++) {
        const cellPos = map.map[row * map.width + (map.width - 1)];
        const cell = tableNode.nodeAt(cellPos);
        lastColumnCells.push(cell);
      }

      lastColumnCells.forEach((cell) => {
        expect(cell?.attrs.colwidth).toBeFalsy();
      });

      // Verify first column cells still have colwidth
      const firstColumnCells = [];
      for (let row = 0; row < map.height; row++) {
        const cellPos = map.map[row * map.width + 0];
        const cell = tableNode.nodeAt(cellPos);
        firstColumnCells.push(cell);
      }

      firstColumnCells.forEach((cell) => {
        // First column should keep colwidth if it had one originally
        // In this test, first column cells have empty attrs {}
        expect(cell?.attrs.colwidth).toBeFalsy();
      });
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
      const finalDoc = newState.apply(result).doc;
      const tableNode = finalDoc.firstChild!;
      const map = TableMap.get(tableNode);

      // Verify table layout is fullWidth
      expect(tableNode.attrs.layout).toBe(TableLayout.fullWidth);
      expect(map.width).toBe(3);

      // Verify colwidth was removed from last column cells only
      for (let row = 0; row < map.height; row++) {
        for (let col = 0; col < map.width; col++) {
          const cellPos = map.map[row * map.width + col];
          const cell = tableNode.nodeAt(cellPos);

          if (col === map.width - 1) {
            // Last column should have colwidth removed
            expect(cell?.attrs.colwidth).toBeFalsy();
          } else {
            // Other columns should retain colwidth if they had it
            const originalCell = cellAttrs[row][col];
            if (originalCell.colwidth) {
              expect(cell?.attrs.colwidth).toBeTruthy();
            }
          }
        }
      }
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
      const finalDoc = newState.apply(result).doc;
      const tableNode = finalDoc.firstChild!;
      const map = TableMap.get(tableNode);

      // Verify table layout is fullWidth
      expect(tableNode.attrs.layout).toBe(TableLayout.fullWidth);
      expect(map.width).toBe(1);

      // Verify colwidth was removed from the single column
      const cellPos = map.map[0];
      const cell = tableNode.nodeAt(cellPos);
      expect(cell?.attrs.colwidth).toBeFalsy();
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

/* eslint-disable */

import { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { exportTable } from "../table";
import { CSVHelper } from "../../../utils/csv";

// Mock dependencies
jest.mock("../../../utils/ProsemirrorHelper", () => ({
  ProsemirrorHelper: {
    toPlainText: jest.fn((node) => node.textContent || ""),
  },
}));

jest.mock("../../../utils/csv", () => ({
  CSVHelper: {
    sanitizeValue: jest.fn((value) => value),
  },
}));

jest.mock("prosemirror-tables", () => ({
  isInTable: jest.fn(() => true),
  selectedRect: jest.fn(() => ({
    map: {
      height: 2,
      width: 2,
      map: [0, 1, 2, 3],
    },
    tableStart: 1,
  })),
}));

Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock DOM APIs
Object.defineProperty(global, "Blob", {
  value: jest.fn().mockImplementation((content, options) => ({
    content,
    options,
  })),
});

Object.defineProperty(global, "URL", {
  value: {
    createObjectURL: jest.fn(() => "mock-url"),
    revokeObjectURL: jest.fn(),
  },
});

Object.defineProperty(global, "document", {
  value: {
    createElement: jest.fn(() => ({
      href: "",
      download: "",
      click: jest.fn(),
    })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
});

describe("exportTable", () => {
  it("should call CSVHelper.sanitizeValue for each cell", () => {
    const sanitizeSpy = jest.spyOn(CSVHelper, 'sanitizeValue');

    const mockNode = (textContent: string) => ({
      textContent,
    } as Node);

    const mockState = {
      doc: {
        nodeAt: jest.fn()
          .mockReturnValueOnce(mockNode("=SUM(A1:A10)"))  // Formula injection
          .mockReturnValueOnce(mockNode("@INDIRECT(B1)"))  // Another formula
          .mockReturnValueOnce(mockNode("Normal text"))     // Safe text
          .mockReturnValueOnce(mockNode("+COMMAND()"))      // Plus formula
      },
      schema: {},
    } as unknown as EditorState;

    const dispatch = jest.fn();
    const command = exportTable({ format: "csv", fileName: "test.csv" });

    command(mockState, dispatch);

    // Verify CSVHelper.sanitizeValue was called for each cell
    expect(sanitizeSpy).toHaveBeenCalledTimes(4);
    expect(sanitizeSpy).toHaveBeenCalledWith("=SUM(A1:A10)");
    expect(sanitizeSpy).toHaveBeenCalledWith("@INDIRECT(B1)");
    expect(sanitizeSpy).toHaveBeenCalledWith("Normal text");
    expect(sanitizeSpy).toHaveBeenCalledWith("+COMMAND()");

    sanitizeSpy.mockRestore();
  });
});
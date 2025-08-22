import turndownService from "../index";

describe("HTML to Markdown Conversion", () => {
  describe("List Item Formatting (PR #9509 fix)", () => {
    it("should use correct spacing between unordered list marker and content", () => {
      const html = `
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- First item");
      expect(markdown).toContain("- Second item");
      expect(markdown).toContain("- Third item");

      // Ensure no double spaces after markers
      expect(markdown).not.toContain("-  ");
    });

    it("should use correct spacing between ordered list marker and content", () => {
      const html = `
        <ol>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ol>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("1.  First item");
      expect(markdown).toContain("2.  Second item");
      expect(markdown).toContain("3.  Third item");

      // Note: Ordered lists use "1.  " format (number, period, two spaces)
      // This is the expected behavior from the fix
    });

    it("should handle ordered lists with custom start attribute", () => {
      const html = `
        <ol start="5">
          <li>Fifth item</li>
          <li>Sixth item</li>
        </ol>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("5.  Fifth item");
      expect(markdown).toContain("6.  Sixth item");
    });

    it("should handle nested lists with proper indentation", () => {
      const html = `
        <ul>
          <li>First level
            <ul>
              <li>Second level</li>
              <li>Another second level</li>
            </ul>
          </li>
          <li>Back to first level</li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- First level");
      expect(markdown).toContain(" - Second level");
      expect(markdown).toContain(" - Another second level");
      expect(markdown).toContain("- Back to first level");
    });

    it("should convert headings in lists to bold text", () => {
      const html = `
        <ul>
          <li><h3>Heading in list</h3></li>
          <li>Regular item</li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- **Heading in list**");
      expect(markdown).toContain("- Regular item");
    });

    it("should handle mixed list types", () => {
      const html = `
        <ul>
          <li>Unordered item
            <ol>
              <li>Ordered nested item</li>
              <li>Another ordered nested item</li>
            </ol>
          </li>
          <li>Another unordered item</li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- Unordered item");
      expect(markdown).toContain(" 1.  Ordered nested item");
      expect(markdown).toContain(" 2.  Another ordered nested item");
      expect(markdown).toContain("- Another unordered item");
    });
  });

  describe("Table Header Detection (PR #9509 fix)", () => {
    it("should detect table headers in thead elements", () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>25</td>
            </tr>
          </tbody>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("| Name | Age |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| John | 25  |");
    });

    it("should detect table headers when all cells in a row are th elements", () => {
      const html = `
        <table>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("| Header 1 | Header 2 |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| Data 1 | Data 2 |");
    });

    it("should not treat mixed th/td rows as headers", () => {
      const html = `
        <table>
          <tr>
            <th>Header</th>
            <td>Not a header</td>
          </tr>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      // Should add empty header since first row isn't all th elements
      expect(markdown).toContain("|     |     |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| Header | Not a header |");
      expect(markdown).toContain("| Data 1 | Data 2 |");
    });

    it("should handle tables without headers", () => {
      const html = `
        <table>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
          <tr>
            <td>Data 3</td>
            <td>Data 4</td>
          </tr>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      // Should add empty header row for valid markdown table
      expect(markdown).toContain("|     |     |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| Data 1 | Data 2 |");
      expect(markdown).toContain("| Data 3 | Data 4 |");
    });

    it("should handle tables with column alignment", () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th align="left">Left</th>
              <th align="center">Center</th>
              <th align="right">Right</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
              <td>Data 3</td>
            </tr>
          </tbody>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("| Left | Center | Right |");
      expect(markdown).toContain("| :--- | :---: | ---: |");
      expect(markdown).toContain("| Data 1 | Data 2 | Data 3 |");
    });

    it("should handle tables with colspan", () => {
      const html = `
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th colspan="2">Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John</td>
              <td>Age: 25</td>
              <td>City: NYC</td>
            </tr>
          </tbody>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("| Name | Details |     |");
      expect(markdown).toContain("| :--- | :--- |     | :--- |");
      expect(markdown).toContain("| John | Age: 25 | City: NYC |");
    });
  });

  describe("Integration Tests", () => {
    it("should handle documents with both lists and tables", () => {
      const html = `
        <h1>Document with Lists and Tables</h1>
        
        <p>Here's a list:</p>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        
        <p>And here's a table:</p>
        <table>
          <thead>
            <tr>
              <th>Column 1</th>
              <th>Column 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Value 1</td>
              <td>Value 2</td>
            </tr>
          </tbody>
        </table>
        
        <p>And another list:</p>
        <ol>
          <li>Numbered item 1</li>
          <li>Numbered item 2</li>
        </ol>
      `;

      const markdown = turndownService.turndown(html);

      // Check list formatting
      expect(markdown).toContain("- First item");
      expect(markdown).toContain("- Second item");
      expect(markdown).toContain("1.  Numbered item 1");
      expect(markdown).toContain("2.  Numbered item 2");

      // Check table formatting
      expect(markdown).toContain("| Column 1 | Column 2 |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| Value 1 | Value 2 |");

      // Check heading
      expect(markdown).toContain("# Document with Lists and Tables");
    });

    it("should handle complex nested structures", () => {
      const html = `
        <ul>
          <li>List item with table:
            <table>
              <tr>
                <th>Header</th>
                <th>Value</th>
              </tr>
              <tr>
                <td>Item</td>
                <td>123</td>
              </tr>
            </table>
          </li>
          <li>Another list item</li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- List item with table:");
      expect(markdown).toContain("| Header | Value |");
      expect(markdown).toContain("| :--- | :--- |");
      expect(markdown).toContain("| Item | 123 |");
      expect(markdown).toContain("- Another list item");
    });

    it("should handle edge case with empty list items", () => {
      const html = `
        <ul>
          <li></li>
          <li>Non-empty item</li>
          <li>   </li>
        </ul>
      `;

      const markdown = turndownService.turndown(html);

      expect(markdown).toContain("- Non-empty item");
      // Empty list items should be handled gracefully
    });

    it("should handle edge case with single cell tables", () => {
      const html = `
        <table>
          <tr>
            <td>Single cell</td>
          </tr>
        </table>
      `;

      const markdown = turndownService.turndown(html);

      // Single cell tables should be skipped and converted to paragraph
      expect(markdown).toContain("Single cell");
      expect(markdown).not.toContain("|");
    });
  });
});

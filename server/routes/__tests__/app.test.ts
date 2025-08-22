/* eslint-disable @typescript-eslint/await-thenable */

import { Node } from "prosemirror-model";
import { schema } from "@server/editor";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import { buildShare, buildDocument } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("app routes", () => {
  describe("shared document screenreader accessibility", () => {
    it("should include screenreader-only content for shared documents", async () => {
      const document = await buildDocument({
        title: "Test Document",
        text: "# Test Document\n\nThis is test content for screenreaders.",
      });
      const share = await buildShare({
        documentId: document.id,
        teamId: document.teamId,
      });

      const res = await server.get(`/s/${share.id}`);
      const body = await res.text();

      expect(res.status).toEqual(200);
      expect(body).toContain('<div class="screenreader-only">');
      expect(body).toContain("Test Document");
      expect(body).toContain("This is test content for screenreaders");
    });

    it("should have empty screenreader content for unpublished shares", async () => {
      const share = await buildShare({
        published: false,
      });

      const res = await server.get(`/s/${share.id}`);
      const body = await res.text();

      expect(res.status).toEqual(404);
      expect(body).toContain('<div class="screenreader-only">');
      // Check that the div is empty (only whitespace)
      const match = body.match(/<div class="screenreader-only">\s*<\/div>/);
      expect(match).toBeTruthy();
    });

    it("should have empty screenreader content when document is deleted", async () => {
      const document = await buildDocument();
      const share = await buildShare({
        documentId: document.id,
        teamId: document.teamId,
      });
      await document.destroy();

      const res = await server.get(`/s/${share.id}`);
      const body = await res.text();

      expect(res.status).toEqual(404);
      expect(body).toContain('<div class="screenreader-only">');
      // Check that the div is empty (only whitespace)
      const match = body.match(/<div class="screenreader-only">\s*<\/div>/);
      expect(match).toBeTruthy();
    });
  });

  describe("DocumentHelper.toHTML with includeHead option", () => {
    it("should pass includeHead option to ProsemirrorHelper", async () => {
      const document = await buildDocument({
        text: "# Test\n\nContent here",
      });

      const htmlWithHead = await DocumentHelper.toHTML(document, {
        includeHead: true,
      });
      const htmlWithoutHead = await DocumentHelper.toHTML(document, {
        includeHead: false,
      });

      expect(htmlWithHead).toContain("<!DOCTYPE html>");
      expect(htmlWithHead).toContain("<html>");
      expect(htmlWithHead).toContain("<head>");
      expect(htmlWithHead).toContain("<body>");

      expect(htmlWithoutHead).not.toContain("<!DOCTYPE html>");
      expect(htmlWithoutHead).not.toContain("<html>");
      expect(htmlWithoutHead).not.toContain("<head>");
      expect(htmlWithoutHead).not.toContain("<body>");
      expect(htmlWithoutHead).toContain("Test");
    });
  });

  describe("ProsemirrorHelper.toHTML with includeHead option", () => {
    it("should strip head and body tags when includeHead is false", async () => {
      const content = Node.fromJSON(schema, {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Test Heading" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Test paragraph content." }],
          },
        ],
      });

      const htmlWithHead = await ProsemirrorHelper.toHTML(content, {
        includeHead: true,
      });
      const htmlWithoutHead = await ProsemirrorHelper.toHTML(content, {
        includeHead: false,
      });

      // With head should include full HTML structure
      expect(htmlWithHead).toContain("<!DOCTYPE html>");
      expect(htmlWithHead).toContain("<html>");
      expect(htmlWithHead).toContain("<head>");
      expect(htmlWithHead).toContain("<body>");
      expect(htmlWithHead).toContain("</body>");
      expect(htmlWithHead).toContain("</html>");

      // Without head should only include content
      expect(htmlWithoutHead).not.toContain("<!DOCTYPE html>");
      expect(htmlWithoutHead).not.toContain("<html>");
      expect(htmlWithoutHead).not.toContain("<head>");
      expect(htmlWithoutHead).not.toContain("<body>");
      expect(htmlWithoutHead).not.toContain("</body>");
      expect(htmlWithoutHead).not.toContain("</html>");

      // Both should contain the actual content
      expect(htmlWithHead).toContain("Test Heading");
      expect(htmlWithHead).toContain("Test paragraph content");
      expect(htmlWithoutHead).toContain("Test Heading");
      expect(htmlWithoutHead).toContain("Test paragraph content");
    });

    it("should default to including head tags when includeHead is not specified", async () => {
      const content = Node.fromJSON(schema, {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Default behavior test" }],
          },
        ],
      });

      const html = await ProsemirrorHelper.toHTML(content);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
      expect(html).toContain("Default behavior test");
    });
  });
});

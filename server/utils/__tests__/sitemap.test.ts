/* eslint-disable import/no-unresolved */
import { NavigationNode } from "@shared/types";
import {
  buildUser,
  buildDocument,
  buildShare,
  buildCollection,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import { navigationNodeToSitemap } from "../sitemap";

const server = getTestServer();

describe("navigationNodeToSitemap", () => {
  const baseUrl = "https://example.com/s/share123";

  describe("single node scenarios", () => {
    it("should generate sitemap for a single node without children", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: "/doc/test-document",
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      expect(result).toMatch(
        /<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
      );
      expect(result).toMatch(
        /<urlset[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/
      );
      expect(result).toContain(`${baseUrl}/doc/test-document`);
      expect(result).toMatch(/<changefreq>\w+<\/changefreq>/);
      expect(result).toContain("</urlset>");
    });

    it("should handle node with no children property", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: "/doc/test-document",
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      expect(result).toContain(`${baseUrl}/doc/test-document`);
    });
  });

  describe("nested children scenarios", () => {
    it("should generate sitemap for nested navigation tree", () => {
      const tree: NavigationNode = {
        id: "root",
        title: "Root Document",
        url: "/doc/root",
        children: [
          {
            id: "child1",
            title: "Child 1",
            url: "/doc/child-1",
            children: [
              {
                id: "grandchild1",
                title: "Grandchild 1",
                url: "/doc/grandchild-1",
                children: [],
              },
            ],
          },
          {
            id: "child2",
            title: "Child 2",
            url: "/doc/child-2",
            children: [],
          },
        ],
      };

      const result = navigationNodeToSitemap(tree, baseUrl);

      expect(result).toContain(`${baseUrl}/doc/root`);
      expect(result).toContain(`${baseUrl}/doc/child-1`);
      expect(result).toContain(`${baseUrl}/doc/child-2`);
      expect(result).toContain(`${baseUrl}/doc/grandchild-1`);

      // Should contain 4 URL entries
      const urlMatches = result.match(/<url>/g);
      expect(urlMatches).toHaveLength(4);
    });

    it("should maintain proper order in sitemap", () => {
      const tree: NavigationNode = {
        id: "root",
        title: "Root",
        url: "/doc/root",
        children: [
          {
            id: "first",
            title: "First Child",
            url: "/doc/first",
            children: [],
          },
          {
            id: "second",
            title: "Second Child",
            url: "/doc/second",
            children: [],
          },
        ],
      };

      const result = navigationNodeToSitemap(tree, baseUrl);

      const rootIndex = result.indexOf(`${baseUrl}/doc/root`);
      const firstIndex = result.indexOf(`${baseUrl}/doc/first`);
      const secondIndex = result.indexOf(`${baseUrl}/doc/second`);

      expect(rootIndex).toBeLessThan(firstIndex);
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });

  describe("edge cases", () => {
    it("should return empty sitemap for null tree", () => {
      const result = navigationNodeToSitemap(null, baseUrl);

      expect(result).toMatch(
        /<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
      );
      expect(result).toMatch(
        /<urlset[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/
      );
      expect(result).toContain("</urlset>");
      expect(result).not.toContain("<url>");
    });

    it("should return empty sitemap for undefined tree", () => {
      const result = navigationNodeToSitemap(undefined, baseUrl);

      expect(result).toMatch(
        /<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
      );
      expect(result).toMatch(
        /<urlset[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/
      );
      expect(result).toContain("</urlset>");
      expect(result).not.toContain("<url>");
    });
  });

  describe("XML escaping", () => {
    it("should properly escape special characters in URLs", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: "/doc/test-&-document?param=value&other=true",
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      expect(result).toContain(
        "test-&amp;-document?param=value&amp;other=true"
      );
      expect(result).not.toContain("test-&-document");
    });

    it("should handle URLs with quotes and brackets", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: '/doc/test-"quotes"-and-<brackets>',
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      expect(result).toContain("test-&quot;quotes&quot;-and-&lt;brackets&gt;");
      expect(result).not.toContain('test-"quotes"-and-<brackets>');
    });
  });

  describe("XML structure validation", () => {
    it("should generate valid XML structure", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: "/doc/test",
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      // Just check it starts with XML declaration and has proper structure
      expect(result).toMatch(
        /^<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
      );
      expect(result).toMatch(/<urlset[^>]*>/);
      expect(result).toMatch(/<\/urlset>$/);
    });

    it("should include changefreq for all URLs", () => {
      const tree: NavigationNode = {
        id: "root",
        title: "Root",
        url: "/doc/root",
        children: [
          {
            id: "child",
            title: "Child",
            url: "/doc/child",
            children: [],
          },
        ],
      };

      const result = navigationNodeToSitemap(tree, baseUrl);

      const changefreqMatches = result.match(/<changefreq>\w+<\/changefreq>/g);
      const urlMatches = result.match(/<url>/g);

      expect(changefreqMatches).toHaveLength(urlMatches?.length || 0);
    });

    it("should format URLs with proper XML structure", () => {
      const node: NavigationNode = {
        id: "doc1",
        title: "Test Document",
        url: "/doc/test",
        children: [],
      };

      const result = navigationNodeToSitemap(node, baseUrl);

      // Just check that URLs have loc and changefreq elements (order doesn't matter)
      expect(result).toMatch(
        /<url[^>]*>.*<loc>.*<\/loc>.*<changefreq>\w+<\/changefreq>.*<\/url>/
      );
    });
  });
});

describe("#documents.sitemap API endpoint", () => {
  it("should return XML sitemap for shared document with indexing enabled", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      userId: user.id,
      teamId: user.teamId,
    });
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
    });
    const childDocument = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
      parentDocumentId: document.id,
    });

    // Set up the document structure properly
    await collection.addDocumentToStructure(document, 0);
    await document.collection?.addDocumentToStructure(childDocument, 0);

    const share = await buildShare({
      documentId: document.id,
      teamId: document.teamId,
      userId: user.id,
      includeChildDocuments: true,
      allowIndexing: true,
    });

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toContain("application/xml");

    const xml = await res.text();
    expect(xml).toMatch(
      /<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
    );
    expect(xml).toMatch(
      /<urlset[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/
    );
    expect(xml).toMatch(new RegExp(`/s/${share.id}`)); // Check share URL is included
    expect(xml).toMatch(/<changefreq>\w+<\/changefreq>/);
    expect(xml).toContain("</urlset>");
    expect(xml).toContain("<url>"); // Should have at least one URL
  });

  it("should return empty sitemap when indexing is disabled", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const share = await buildShare({
      documentId: document.id,
      teamId: document.teamId,
      userId: user.id,
      includeChildDocuments: true,
      allowIndexing: false, // indexing disabled
    });

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toContain("application/xml");

    const xml = await res.text();
    expect(xml).toMatch(
      /<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?>/
    );
    expect(xml).toMatch(
      /<urlset[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["'][^>]*>/
    );
    expect(xml).toContain("</urlset>");
    // Should not contain any URLs
    expect(xml).not.toContain("<url>");
  });

  it("should return empty sitemap when child documents not included", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const share = await buildShare({
      documentId: document.id,
      teamId: document.teamId,
      userId: user.id,
      includeChildDocuments: false, // child documents not included
      allowIndexing: true,
    });

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(200);
    const xml = await res.text();
    expect(xml).not.toContain("<url>");
  });

  it("should return 400 for invalid shareId", async () => {
    const res = await server.get(
      `/api/documents.sitemap?shareId=invalid-share-id`
    );

    expect(res.status).toEqual(400);
  });

  it("should return 400 for missing shareId", async () => {
    const res = await server.get(`/api/documents.sitemap`);

    expect(res.status).toEqual(400);
  });

  it("should return 400 for archived document share", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const share = await buildShare({
      documentId: document.id,
      teamId: document.teamId,
      userId: user.id,
      includeChildDocuments: true,
      allowIndexing: true,
    });

    await document.archive(user);

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(400);
  });

  it("should work without authentication (optional auth)", async () => {
    const user = await buildUser();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });
    const share = await buildShare({
      documentId: document.id,
      teamId: document.teamId,
      userId: user.id,
      includeChildDocuments: true,
      allowIndexing: true,
    });

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
  });

  it("should include multiple documents in nested structure", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      userId: user.id,
      teamId: user.teamId,
    });
    const rootDoc = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
    });
    const child1 = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
      parentDocumentId: rootDoc.id,
    });
    const child2 = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
      parentDocumentId: rootDoc.id,
    });
    const grandchild = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      collectionId: collection.id,
      parentDocumentId: child1.id,
    });

    // Set up the document structure properly
    await collection.addDocumentToStructure(rootDoc, 0);
    await rootDoc.collection?.addDocumentToStructure(child1, 0);
    await rootDoc.collection?.addDocumentToStructure(child2, 1);
    await child1.collection?.addDocumentToStructure(grandchild, 0);

    const share = await buildShare({
      documentId: rootDoc.id,
      teamId: rootDoc.teamId,
      userId: user.id,
      includeChildDocuments: true,
      allowIndexing: true,
    });

    const res = await server.get(`/api/documents.sitemap?shareId=${share.id}`);

    expect(res.status).toEqual(200);

    const xml = await res.text();
    const urlMatches = xml.match(/<url>/g);
    expect(urlMatches?.length || 0).toBeGreaterThan(1); // Should include multiple documents

    expect(xml).toMatch(new RegExp(`/s/${share.id}`)); // Check share URL is included
  });
});

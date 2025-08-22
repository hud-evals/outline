import {
  buildDocument,
  buildDraftDocument,
  buildCollection,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#suggestions.mention", () => {
  it("should include published documents in mention suggestions", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create a published document
    const publishedDoc = await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Published Test Document",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Test",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].id).toBe(publishedDoc.id);
    expect(body.data.documents[0].title).toBe("Published Test Document");
  });

  it("should NOT include archived documents in mention suggestions", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create a published document
    const publishedDoc = await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Published Test Document",
    });

    // Create an archived document
    const archivedDoc = await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Archived Test Document",
      archivedAt: new Date(),
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Test",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);

    // Should only include the published document, not the archived one
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].id).toBe(publishedDoc.id);
    expect(body.data.documents[0].title).toBe("Published Test Document");

    // Verify archived document is not in results
    const documentIds = body.data.documents.map((doc: any) => doc.id);
    expect(documentIds).not.toContain(archivedDoc.id);
  });

  it("should NOT include draft documents in mention suggestions", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create a published document
    await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Published Test Document",
    });

    // Create a draft document by the user
    await buildDraftDocument({
      teamId: team.id,
      userId: testUser.id,
      createdById: testUser.id,
      collectionId: collection.id,
      title: "Draft Test Document",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Test",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);

    // Should only include the published document, not the draft
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].title).toBe("Published Test Document");

    const documentTitles = body.data.documents.map((doc: any) => doc.title);
    expect(documentTitles).not.toContain("Draft Test Document");
  });

  it("should only include published documents regardless of creator", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const otherUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create a published document by another user
    await buildDocument({
      teamId: team.id,
      userId: otherUser.id,
      createdById: otherUser.id,
      collectionId: collection.id,
      title: "Other User Published",
    });

    // Create a draft document by another user
    await buildDraftDocument({
      teamId: team.id,
      userId: otherUser.id,
      createdById: otherUser.id,
      collectionId: collection.id,
      title: "Other User Draft",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Other",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);

    // Should only include the published document, not the draft
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].title).toBe("Other User Published");

    const documentTitles = body.data.documents.map((doc: any) => doc.title);
    expect(documentTitles).not.toContain("Other User Draft");
  });

  it("should filter results based on query parameter", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create documents with different titles
    await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "React Components Guide",
    });

    await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Vue.js Tutorial",
    });

    // Search for "React"
    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "React",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.documents).toHaveLength(1);
    expect(body.data.documents[0].title).toBe("React Components Guide");
  });

  it("should include users matching the query", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({
      teamId: team.id,
      name: "John Test",
      email: "john.test@example.com",
    });

    // Create another user that matches the search
    await buildUser({
      teamId: team.id,
      name: "Jane Testing",
      email: "jane.testing@example.com",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Test",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.users.length).toBeGreaterThan(0);

    const userNames = body.data.users.map((u: any) => u.name);
    expect(userNames).toContain("Jane Testing");
  });

  it("should include collections matching the query", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });

    // Create a collection with matching name
    await buildCollection({
      teamId: team.id,
      userId: testUser.id,
      name: "Test Collection",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Test",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.collections.length).toBeGreaterThan(0);

    const collectionNames = body.data.collections.map((c: any) => c.name);
    expect(collectionNames).toContain("Test Collection");
  });

  it("should handle empty query by returning accessible items", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Any Document",
    });

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data).toHaveProperty("documents");
    expect(body.data).toHaveProperty("users");
    expect(body.data).toHaveProperty("collections");
  });

  it("should respect pagination parameters", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create multiple documents
    for (let i = 1; i <= 5; i++) {
      await buildDocument({
        teamId: team.id,
        userId: testUser.id,
        collectionId: collection.id,
        title: `Document ${i}`,
      });
    }

    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Document",
        limit: 2,
        offset: 0,
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.documents).toHaveLength(2);
    expect(body.pagination).toHaveProperty("limit", 2);
    expect(body.pagination).toHaveProperty("offset", 0);
  });

  it("should not include archived documents even when explicitly searching for them", async () => {
    const team = await buildTeam();
    const testUser = await buildUser({ teamId: team.id });
    const collection = await buildCollection({
      teamId: team.id,
      userId: testUser.id,
    });

    // Create an archived document with distinctive title
    await buildDocument({
      teamId: team.id,
      userId: testUser.id,
      collectionId: collection.id,
      title: "Archived Unique Document",
      archivedAt: new Date(),
    });

    // Search specifically for the archived document
    const res = await server.post("/api/suggestions.mention", {
      body: {
        token: testUser.getJwtToken(),
        query: "Archived Unique",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);

    // Should not find the archived document
    expect(body.data.documents).toHaveLength(0);
  });
});

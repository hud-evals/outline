import { CollectionPermission, CollectionStatusFilter } from "@shared/types";
import { User, Team } from "@server/models";
import {
  buildUser,
  buildAdmin,
  buildCollection,
  buildTeam,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#collections.list query parameter", () => {
  let team: Team;
  let user: User;
  let admin: User;

  beforeEach(async () => {
    team = await buildTeam();
    user = await buildUser({ teamId: team.id });
    admin = await buildAdmin({ teamId: team.id });
  });

  describe("basic query functionality", () => {
    it("should return collections matching the query string", async () => {
      const collection1 = await buildCollection({
        name: "Engineering Documentation",
        userId: user.id,
        teamId: team.id,
      });
      await buildCollection({
        name: "Product Roadmap",
        userId: user.id,
        teamId: team.id,
      });
      await buildCollection({
        name: "Marketing Materials",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Engineering",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection1.id);
      expect(body.data[0].name).toEqual("Engineering Documentation");
    });

    it("should perform case-insensitive search", async () => {
      await buildCollection({
        name: "Some Documents",
        userId: user.id,
        teamId: team.id,
      });
      const collection2 = await buildCollection({
        name: "IMPORTANT Documents",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "important",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection2.id);
    });

    it("should handle partial name matches", async () => {
      await buildCollection({
        name: "Marketing Strategy",
        userId: user.id,
        teamId: team.id,
      });
      const collection1 = await buildCollection({
        name: "Development Guidelines",
        userId: user.id,
        teamId: team.id,
      });
      const collection2 = await buildCollection({
        name: "Developer Tools",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Develop",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      const returnedIds = body.data.map((c: any) => c.id);
      expect(returnedIds).toContain(collection1.id);
      expect(returnedIds).toContain(collection2.id);
    });

    it("should match query anywhere in the name", async () => {
      await buildCollection({
        name: "Product Documentation",
        userId: user.id,
        teamId: team.id,
      });
      const collection1 = await buildCollection({
        name: "Team Handbook",
        userId: user.id,
        teamId: team.id,
      });
      const collection2 = await buildCollection({
        name: "Engineering Team Resources",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Team",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      const returnedIds = body.data.map((c: any) => c.id);
      expect(returnedIds).toContain(collection1.id);
      expect(returnedIds).toContain(collection2.id);
    });
  });

  describe("accent handling", () => {
    it("should match collections with accented characters", async () => {
      const collection = await buildCollection({
        name: "Café Documentation",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Cafe",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });

    it("should match when query has accents and name doesn't", async () => {
      const collection = await buildCollection({
        name: "Resume Templates",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Résumé",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });

    it("should handle various accented characters", async () => {
      const collections = await Promise.all([
        buildCollection({
          name: "Überblick",
          userId: user.id,
          teamId: team.id,
        }),
        buildCollection({
          name: "Señor's Notes",
          userId: user.id,
          teamId: team.id,
        }),
        buildCollection({
          name: "Naïve Approach",
          userId: user.id,
          teamId: team.id,
        }),
      ]);

      const queries = [
        { query: "Uberblick", expectedId: collections[0].id },
        { query: "Senor", expectedId: collections[1].id },
        { query: "Naive", expectedId: collections[2].id },
      ];

      for (const testCase of queries) {
        const res = await server.post("/api/collections.list", {
          body: {
            token: user.getJwtToken(),
            query: testCase.query,
          },
        });

        const body = await res.json();
        expect(res.status).toEqual(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toEqual(testCase.expectedId);
      }
    });
  });

  describe("edge cases", () => {
    it("should return all collections when query is empty", async () => {
      const collection1 = await buildCollection({
        name: "First Collection",
        userId: user.id,
        teamId: team.id,
      });
      const collection2 = await buildCollection({
        name: "Second Collection",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      const returnedIds = body.data.map((c: any) => c.id);
      expect(returnedIds).toContain(collection1.id);
      expect(returnedIds).toContain(collection2.id);
    });

    it("should return empty array when query matches nothing", async () => {
      await buildCollection({
        name: "Engineering Docs",
        userId: user.id,
        teamId: team.id,
      });
      await buildCollection({
        name: "Product Specs",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "NonexistentCollection",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(0);
    });

    it("should handle special characters in query", async () => {
      const collection = await buildCollection({
        name: "Team's Best Practices",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Team's",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });

    it("should handle SQL wildcard characters safely", async () => {
      const collection = await buildCollection({
        name: "100% Complete",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "100%",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });

    it("should handle underscore in query", async () => {
      const collection = await buildCollection({
        name: "test_collection_name",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "test_collection",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });
  });

  describe("permissions", () => {
    it("should only return collections user has access to", async () => {
      const publicCollection = await buildCollection({
        name: "Public Engineering Docs",
        userId: user.id,
        teamId: team.id,
        permission: CollectionPermission.ReadWrite,
      });
      await buildCollection({
        name: "Private Engineering Notes",
        userId: admin.id,
        teamId: team.id,
        permission: null,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Engineering",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(publicCollection.id);
    });

    it("should return all matching collections for admin with includeListOnly", async () => {
      const publicCollection = await buildCollection({
        name: "Public Docs",
        userId: user.id,
        teamId: team.id,
        permission: CollectionPermission.ReadWrite,
      });
      const privateCollection = await buildCollection({
        name: "Private Docs",
        userId: user.id,
        teamId: team.id,
        permission: null,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: admin.getJwtToken(),
          query: "Docs",
          includeListOnly: true,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      const returnedIds = body.data.map((c: any) => c.id);
      expect(returnedIds).toContain(publicCollection.id);
      expect(returnedIds).toContain(privateCollection.id);
    });

    it("should not return all collections for non-admin with includeListOnly", async () => {
      const publicCollection = await buildCollection({
        name: "Public Resources",
        userId: admin.id,
        teamId: team.id,
        permission: CollectionPermission.ReadWrite,
      });
      await buildCollection({
        name: "Private Resources",
        userId: admin.id,
        teamId: team.id,
        permission: null,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Resources",
          includeListOnly: true,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(publicCollection.id);
    });
  });

  describe("combined filters", () => {
    it("should work with statusFilter for archived collections", async () => {
      const archivedCollection = await buildCollection({
        name: "Archived Project Docs",
        userId: user.id,
        teamId: team.id,
        archivedAt: new Date(),
        archivedById: user.id,
      });
      await buildCollection({
        name: "Active Project Docs",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Project",
          statusFilter: [CollectionStatusFilter.Archived],
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(archivedCollection.id);
      expect(body.data[0].archivedAt).toBeTruthy();
    });

    it("should work with pagination", async () => {
      const collections = [];
      for (let i = 1; i <= 5; i++) {
        const collection = await buildCollection({
          name: `Test Collection ${i}`,
          userId: user.id,
          teamId: team.id,
        });
        collections.push(collection);
      }

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Test Collection",
          limit: 2,
          offset: 0,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toEqual(5);
      expect(body.pagination.limit).toEqual(2);
      expect(body.pagination.offset).toEqual(0);
    });

    it("should return correct pagination info with query filter", async () => {
      await buildCollection({
        name: "Engineering Guidelines",
        userId: user.id,
        teamId: team.id,
      });
      await buildCollection({
        name: "Engineering Standards",
        userId: user.id,
        teamId: team.id,
      });
      await buildCollection({
        name: "Product Roadmap",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Engineering",
          limit: 10,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toEqual(2);
    });

    it("should handle query with multiple filters", async () => {
      await buildCollection({
        name: "Private Engineering Docs",
        userId: admin.id,
        teamId: team.id,
        permission: null,
      });
      const collection2 = await buildCollection({
        name: "Archived Engineering Notes",
        userId: admin.id,
        teamId: team.id,
        archivedAt: new Date(),
        archivedById: admin.id,
      });
      await buildCollection({
        name: "Active Engineering Wiki",
        userId: admin.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: admin.getJwtToken(),
          query: "Engineering",
          statusFilter: [CollectionStatusFilter.Archived],
          includeListOnly: true,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection2.id);
    });
  });

  describe("whitespace handling", () => {
    it("should not trim whitespace from query", async () => {
      const collection = await buildCollection({
        name: "Important Documents",
        userId: user.id,
        teamId: team.id,
      });

      // Query with leading/trailing spaces won't match
      const res1 = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "  Important  ",
        },
      });

      const body1 = await res1.json();
      expect(res1.status).toEqual(200);
      expect(body1.data).toHaveLength(0);

      // Query without extra spaces will match
      const res2 = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Important",
        },
      });

      const body2 = await res2.json();
      expect(res2.status).toEqual(200);
      expect(body2.data).toHaveLength(1);
      expect(body2.data[0].id).toEqual(collection.id);
    });

    it("should match collections with spaces in the middle", async () => {
      const collection = await buildCollection({
        name: "Team Resources Guide",
        userId: user.id,
        teamId: team.id,
      });

      const res = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Team Resources",
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toEqual(collection.id);
    });

    it("should handle multiple spaces in query literally", async () => {
      const collection = await buildCollection({
        name: "Team  Resources  Guide",
        userId: user.id,
        teamId: team.id,
      });

      // Query with matching multiple spaces will work
      const res1 = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Team  Resources",
        },
      });

      const body1 = await res1.json();
      expect(res1.status).toEqual(200);
      expect(body1.data).toHaveLength(1);
      expect(body1.data[0].id).toEqual(collection.id);

      // Query with single spaces won't match
      const res2 = await server.post("/api/collections.list", {
        body: {
          token: user.getJwtToken(),
          query: "Team Resources",
        },
      });

      const body2 = await res2.json();
      expect(res2.status).toEqual(200);
      expect(body2.data).toHaveLength(0);
    });
  });
});

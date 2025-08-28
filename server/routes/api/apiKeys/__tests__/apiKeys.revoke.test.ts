import {
  buildAdmin,
  buildApiKey,
  buildUser,
  buildTeam,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import { UserRole } from "@shared/types";

const server = getTestServer();

describe("#apiKeys.delete - Admin revoking workspace API keys", () => {
  // From golden branch
  describe("Basic tests", () => {
    it("should not allow deleting another user's api key", async () => {
      const user = await buildUser();
      const otherUser = await buildUser({ teamId: user.teamId });
      const apiKey = await buildApiKey({
        name: "Other User's API Key",
        userId: otherUser.id,
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: user.getJwtToken(),
          id: apiKey.id,
        },
      });
      expect(res.status).toEqual(403);
    });

    it("should allow admin to delete another user's api key", async () => {
      const user = await buildUser();
      const admin = await buildAdmin({ teamId: user.teamId });

      const apiKey = await buildApiKey({
        name: "User's API Key",
        userId: user.id,
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res.status).toEqual(200);
    });
  });

  describe("Admin permissions", () => {
    it("should not allow admin to revoke API key from user in different workspace", async () => {
      const team1 = await buildTeam();
      const team2 = await buildTeam();
      const admin = await buildAdmin({ teamId: team1.id });
      const userInOtherTeam = await buildUser({ teamId: team2.id });
      const apiKey = await buildApiKey({
        name: "Other Team API Key",
        userId: userInOtherTeam.id,
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res.status).toEqual(403);
    });
  });

  describe("Regular user permissions", () => {
    it("should allow user to delete their own API key", async () => {
      const user = await buildUser();
      const apiKey = await buildApiKey({
        name: "My API Key",
        userId: user.id,
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: user.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res.status).toEqual(200);
    });

    it("should not allow suspended user to delete any API key", async () => {
      const user = await buildUser({ suspendedAt: new Date() });
      const apiKey = await buildApiKey({
        name: "My API Key",
        userId: user.id,
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: user.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res.status).toEqual(403);
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("should handle non-existent API key ID", async () => {
      const admin = await buildAdmin();

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: "non-existent-id",
        },
      });

      expect(res.status).toEqual(400);
    });

    it("should handle already deleted API key", async () => {
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });
      const user = await buildUser({ teamId: team.id });
      const apiKey = await buildApiKey({
        name: "Test API Key",
        userId: user.id,
      });

      // Delete the key first time
      const res1 = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res1.status).toEqual(200);

      // Try to delete again
      const res2 = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res2.status).toEqual(403);
    });

    it("should require authentication", async () => {
      const res = await server.post("/api/apiKeys.delete", {
        body: {
          id: "some-id",
        },
      });
      expect(res.status).toEqual(401);
    });

    it("should validate required parameters", async () => {
      const admin = await buildAdmin();

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
        },
      });

      expect(res.status).toEqual(400);
    });

    it("should handle expired API keys correctly", async () => {
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });
      const user = await buildUser({ teamId: team.id });
      const apiKey = await buildApiKey({
        name: "Expired API Key",
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const res = await server.post("/api/apiKeys.delete", {
        body: {
          token: admin.getJwtToken(),
          id: apiKey.id,
        },
      });

      expect(res.status).toEqual(200);
    });

    it("should not allow viewer or guest role to delete any API key", async () => {
      const team = await buildTeam();
      const viewer = await buildUser({
        teamId: team.id,
        role: UserRole.Viewer,
      });
      const viewerApiKey = await buildApiKey({
        name: "Viewer API Key",
        userId: viewer.id,
      });
      const res1 = await server.post("/api/apiKeys.delete", {
        body: {
          token: viewer.getJwtToken(),
          id: viewerApiKey.id,
        },
      });
      expect(res1.status).toEqual(403);

      const guest = await buildUser({ teamId: team.id, role: UserRole.Guest });
      const guestApiKey = await buildApiKey({
        name: "Guest API Key",
        userId: guest.id,
      });
      const res2 = await server.post("/api/apiKeys.delete", {
        body: {
          token: guest.getJwtToken(),
          id: guestApiKey.id,
        },
      });

      expect(res2.status).toEqual(403);
    });
  });
});

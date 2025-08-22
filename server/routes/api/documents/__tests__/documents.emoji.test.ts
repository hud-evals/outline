import { Document } from "@server/models";
import { buildDocument } from "@server/test/factories";
import { seed, getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#documents.emoji", () => {
  describe("Emoji Picker Feature Implementation", () => {
    it("should support emoji field in documents.update API", async () => {
      const { user, document } = await seed();

      const res = await server.post("/api/documents.update", {
        body: {
          token: user.getJwtToken(),
          id: document.id,
          emoji: "🚀",
        },
      });

      const body = await res.json();

      // BASELINE: Should fail with 400 because emoji field doesn't exist in schema
      // MERGE COMMIT: Should succeed with 200 and return the emoji
      expect(res.status).toEqual(200);
      expect(body.data.emoji).toBe("🚀");

      // Verify emoji is actually saved to database
      const updated = await Document.findByPk(document.id);
      expect(updated?.emoji).toBe("🚀");
    });

    it("should support setting emoji to null", async () => {
      const { user, document } = await seed();

      const res = await server.post("/api/documents.update", {
        body: {
          token: user.getJwtToken(),
          id: document.id,
          emoji: null,
        },
      });

      const body = await res.json();

      // BASELINE: Should fail with 400 because emoji field doesn't exist
      // MERGE COMMIT: Should succeed with 200 and set emoji to null
      expect(res.status).toEqual(200);
      expect(body.data.emoji).toBeNull();
    });

    it("should validate emoji format properly", async () => {
      const { user, document } = await seed();

      const res = await server.post("/api/documents.update", {
        body: {
          token: user.getJwtToken(),
          id: document.id,
          emoji: "not-an-emoji",
        },
      });

      const body = await res.json();

      // Both versions should return 400, but for different reasons
      expect(res.status).toEqual(400);
      expect(body.message).toBe("emoji: Invalid");
    });

    it("should include emoji in document.info responses", async () => {
      const { user } = await seed();

      // Try to create document with emoji using factory
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
        emoji: "🔥",
      });

      const res = await server.post("/api/documents.info", {
        body: {
          token: user.getJwtToken(),
          id: document.id,
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);

      // BASELINE: emoji field should not exist in response
      // MERGE COMMIT: emoji field should be present and correct
      expect(body.data.emoji).toBe("🔥");
    });

    it("should handle emoji in documents.list responses", async () => {
      const { user } = await seed();

      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
        emoji: "⭐",
      });

      const res = await server.post("/api/documents.list", {
        body: {
          token: user.getJwtToken(),
        },
      });

      const body = await res.json();
      expect(res.status).toEqual(200);

      const docWithEmoji = body.data.find(
        (doc: { id: string; emoji?: string }) => doc.id === document.id
      );
      expect(docWithEmoji).toBeDefined();

      // BASELINE: emoji field won't exist in list responses
      // MERGE COMMIT: emoji field should be present
      expect(docWithEmoji.emoji).toBe("⭐");
    });

    it("should support various emoji characters", async () => {
      const { user, document } = await seed();

      const testEmojis = ["😀", "🎉", "🔥", "💖", "🚀", "📚", "🎨", "🌟"];

      for (const emoji of testEmojis) {
        const res = await server.post("/api/documents.update", {
          body: {
            token: user.getJwtToken(),
            id: document.id,
            emoji,
          },
        });

        const body = await res.json();

        // BASELINE: All should fail with unknown field error
        // MERGE COMMIT: All should succeed
        expect(res.status).toEqual(200);
        expect(body.data.emoji).toBe(emoji);
      }
    });

    it("should store emoji in Document model database field", async () => {
      const { user, document } = await seed();

      // Try to set emoji via API
      const res = await server.post("/api/documents.update", {
        body: {
          token: user.getJwtToken(),
          id: document.id,
          emoji: "🎯",
        },
      });

      expect(res.status).toEqual(200);
      // MERGE COMMIT: Check that emoji is actually stored in database
      const updatedDoc = await Document.findByPk(document.id);
      expect(updatedDoc?.emoji).toBe("🎯");

      // Also check that emoji appears in toJSON serialization
      const json = updatedDoc?.toJSON();
      expect(json?.emoji).toBe("🎯");
    });
  });
});

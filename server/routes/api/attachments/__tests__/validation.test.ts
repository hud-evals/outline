import { AttachmentPreset } from "@shared/types";
import Attachment from "@server/models/Attachment";
import { buildUser, buildDocument } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

jest.mock("@server/utils/s3");

const server = getTestServer();

describe("Attachment API Validation", () => {
  describe("#attachments.create validation", () => {
    it("should reject request with missing name field", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          size: 1000,
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("name");
    });

    it("should reject request with missing size field", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("size");
    });

    it("should reject request with missing preset field", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("preset");
    });

    it("should reject request with invalid name type", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: 123, // should be string
          size: 1000,
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
    });

    it("should reject request with invalid size type", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: "1000", // should be number
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
    });

    it("should reject request with invalid documentId format", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          documentId: "invalid-uuid",
          preset: AttachmentPreset.DocumentAttachment,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("uuid");
    });

    it("should reject request with invalid preset value", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          preset: "invalid-preset",
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
    });

    it("should accept request with valid optional contentType", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          contentType: "image/png",
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(200);
    });

    it("should use default contentType when not provided for Import preset", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.file",
          size: 1000,
          preset: AttachmentPreset.Import,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(200);

      const body = await res.json();
      const attachment = await Attachment.findByPk(body.data.attachment.id);
      expect(attachment!.contentType).toEqual("application/octet-stream");
    });

    it("should accept valid documentId when provided", async () => {
      const user = await buildUser();
      const document = await buildDocument({ teamId: user.teamId });
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          documentId: document.id,
          preset: AttachmentPreset.DocumentAttachment,
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(200);
    });

    it("should ignore deprecated 'public' parameter if provided", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          contentType: "image/png", // Avatar preset requires valid image content type
          size: 1000,
          preset: AttachmentPreset.Avatar,
          public: true, // deprecated parameter should be ignored
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(200);
    });
  });

  describe("#attachments.delete validation", () => {
    it("should reject request with missing id field", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.delete", {
        body: {
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("id");
    });

    it("should reject request with invalid id type", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.delete", {
        body: {
          id: 123, // should be string
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
    });

    it("should reject request with invalid UUID format", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.delete", {
        body: {
          id: "invalid-uuid",
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
      const body = await res.json();
      expect(body.message).toContain("uuid");
    });

    it("should accept request with valid UUID (even if attachment doesn't exist)", async () => {
      const user = await buildUser();
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const res = await server.post("/api/attachments.delete", {
        body: {
          id: validUuid,
          token: user.getJwtToken(),
        },
      });
      // Should pass validation but fail at model level (404 or 403)
      expect([404, 403]).toContain(res.status);
    });
  });

  describe("Preset requirement enforcement", () => {
    it("should require preset for all attachment creation requests", async () => {
      const user = await buildUser();
      const document = await buildDocument({ teamId: user.teamId });

      // Test that each valid preset works with appropriate content
      const validCases = [
        {
          preset: AttachmentPreset.Avatar,
          contentType: "image/png",
          name: "avatar.png",
        },
        {
          preset: AttachmentPreset.DocumentAttachment,
          contentType: "application/pdf",
          name: "document.pdf",
          documentId: document.id,
        },
        {
          preset: AttachmentPreset.Import,
          contentType: "application/zip",
          name: "import.zip",
        },
      ];

      for (const testCase of validCases) {
        const res = await server.post("/api/attachments.create", {
          body: {
            name: testCase.name,
            contentType: testCase.contentType,
            size: 1000,
            preset: testCase.preset,
            ...(testCase.documentId && { documentId: testCase.documentId }),
            token: user.getJwtToken(),
          },
        });
        expect(res.status).toEqual(200);
      }
    });

    it("should not accept requests without explicit preset", async () => {
      const user = await buildUser();
      const res = await server.post("/api/attachments.create", {
        body: {
          name: "test.png",
          size: 1000,
          // no preset provided
          token: user.getJwtToken(),
        },
      });
      expect(res.status).toEqual(400);
    });

    it("should enforce Avatar preset content type restrictions", async () => {
      const user = await buildUser();

      // Test valid avatar content types
      const validAvatarTypes = ["image/png", "image/jpg", "image/jpeg"];
      for (const contentType of validAvatarTypes) {
        const res = await server.post("/api/attachments.create", {
          body: {
            name: "avatar.png",
            contentType,
            size: 1000,
            preset: AttachmentPreset.Avatar,
            token: user.getJwtToken(),
          },
        });
        expect(res.status).toEqual(200);
      }

      // Test invalid avatar content type
      const invalidRes = await server.post("/api/attachments.create", {
        body: {
          name: "avatar.pdf",
          contentType: "application/pdf",
          size: 1000,
          preset: AttachmentPreset.Avatar,
          token: user.getJwtToken(),
        },
      });
      expect(invalidRes.status).toEqual(400);
    });
  });
});

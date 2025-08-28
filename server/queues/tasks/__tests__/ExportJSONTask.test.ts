import JSZip from "jszip";
import { Attachment } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import {
  buildAttachment,
  buildCollection,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import ExportJSONTask from "../ExportJSONTask";

describe("ExportJSONTask", () => {
  describe("Collection attachments export", () => {
    let zip: JSZip;
    let task: ExportJSONTask;

    beforeEach(() => {
      zip = new JSZip();
      task = new ExportJSONTask();
    });

    it("should include collection attachments when includeAttachments is true", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });

      // Create an attachment
      const attachment = await buildAttachment({
        teamId: team.id,
        userId: user.id,
      });

      // Mock the attachment buffer
      jest
        .spyOn(attachment, "buffer", "get")
        .mockResolvedValue(Buffer.from("test-attachment-content"));

      // Mock ProsemirrorHelper to return our attachment ID
      jest
        .spyOn(ProsemirrorHelper, "parseAttachmentIds")
        .mockReturnValue([attachment.id]);

      // Mock DocumentHelper to return a mock prosemirror doc
      jest.spyOn(DocumentHelper, "toProsemirror").mockReturnValue({
        toJSON: () => ({ type: "doc", content: [] }),
      } as any);

      // Mock Attachment.findAll to return our attachment when queried
      jest.spyOn(Attachment, "findAll").mockImplementation((options: any) => {
        if (options?.where?.id?.includes(attachment.id)) {
          return Promise.resolve([attachment]);
        }
        return Promise.resolve([]);
      });

      // Call the private method directly
      await (task as any).addCollectionToArchive(zip, collection, true);

      // Verify that the attachment was added to the zip
      const files = Object.keys((zip as any).files || {});
      const attachmentFile = files.find((f) => f === attachment.key);
      expect(attachmentFile).toBeDefined();

      // Verify Attachment.findAll was called with correct parameters
      expect(Attachment.findAll).toHaveBeenCalledWith({
        where: {
          teamId: collection.teamId,
          id: [attachment.id],
        },
      });
    });

    it("should not include collection attachments when includeAttachments is false", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });

      // Mock DocumentHelper to return a mock prosemirror doc
      jest.spyOn(DocumentHelper, "toProsemirror").mockReturnValue({
        toJSON: () => ({ type: "doc", content: [] }),
      } as any);

      // Mock Attachment.findAll
      jest.spyOn(Attachment, "findAll").mockResolvedValue([]);

      // Spy on ProsemirrorHelper
      const parseSpy = jest.spyOn(ProsemirrorHelper, "parseAttachmentIds");

      // Call the private method with includeAttachments = false
      await (task as any).addCollectionToArchive(zip, collection, false);

      // Verify that ProsemirrorHelper.parseAttachmentIds was NOT called
      expect(parseSpy).not.toHaveBeenCalled();

      // Verify that Attachment.findAll was not called (or called with empty conditions)
      const attachmentCalls = (Attachment.findAll as jest.Mock).mock.calls;
      const collectionAttachmentCall = attachmentCalls.find(
        (call) => call[0]?.where?.id !== undefined
      );
      if (collectionAttachmentCall) {
        expect(collectionAttachmentCall[0].where.id).toEqual([]);
      }
    });

    it("should handle collections without attachments gracefully", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });

      // Mock ProsemirrorHelper to return empty array
      jest.spyOn(ProsemirrorHelper, "parseAttachmentIds").mockReturnValue([]);

      // Mock DocumentHelper to return a mock prosemirror doc
      jest.spyOn(DocumentHelper, "toProsemirror").mockReturnValue({
        toJSON: () => ({ type: "doc", content: [] }),
      } as any);

      // Mock Attachment.findAll to return empty array
      jest.spyOn(Attachment, "findAll").mockResolvedValue([]);

      // Call the private method
      await (task as any).addCollectionToArchive(zip, collection, true);

      // Verify the JSON file was created
      const files = Object.keys((zip as any).files || {});
      const jsonFile = files.find((f) => f.endsWith(".json"));
      expect(jsonFile).toBeDefined();

      // Verify no attachment files were added
      const attachmentFiles = files.filter((f) => !f.endsWith(".json"));
      expect(attachmentFiles).toHaveLength(0);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});

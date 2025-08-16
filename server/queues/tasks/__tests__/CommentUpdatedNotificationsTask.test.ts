import { NotificationEventType } from "@shared/types";
import { Comment, Document, Notification, User } from "@server/models";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import {
  buildUser,
  buildDocument,
  buildComment,
  buildCollection,
} from "@server/test/factories";
import { CommentUpdateEvent } from "@server/types";
import { canUserAccessDocument } from "@server/utils/policies";
import CommentUpdatedNotificationsTask from "../CommentUpdatedNotificationsTask";

// Mock external dependencies
jest.mock("@server/models/helpers/ProsemirrorHelper");
jest.mock("@server/utils/policies");

const mockProsemirrorHelper = ProsemirrorHelper as jest.Mocked<
  typeof ProsemirrorHelper
>;
const mockCanUserAccessDocument = canUserAccessDocument as jest.MockedFunction<
  typeof canUserAccessDocument
>;

describe("CommentUpdatedNotificationsTask", () => {
  let task: CommentUpdatedNotificationsTask;
  let user: User;
  let author: User;
  let document: Document;
  let comment: Comment;

  beforeEach(async () => {
    jest.resetAllMocks();

    task = new CommentUpdatedNotificationsTask();

    // Set up test data
    user = await buildUser();
    author = await buildUser({ teamId: user.teamId });

    const collection = await buildCollection({ teamId: user.teamId });
    document = await buildDocument({
      teamId: user.teamId,
      collectionId: collection.id,
      createdById: author.id,
    });

    comment = await buildComment({
      userId: author.id,
      documentId: document.id,
    });

    // Default mocks
    mockCanUserAccessDocument.mockResolvedValue(true);
    mockProsemirrorHelper.toProsemirror.mockReturnValue({} as any);
    mockProsemirrorHelper.parseMentions.mockReturnValue([]);
  });

  describe("Event routing", () => {
    test("should call handleResolvedComment when comment is resolved", async () => {
      const handleResolvedCommentSpy = jest.spyOn(
        task as any,
        "handleResolvedComment"
      );
      const handleMentionedCommentSpy = jest.spyOn(
        task as any,
        "handleMentionedComment"
      );

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(handleResolvedCommentSpy).toHaveBeenCalledWith(event);
      expect(handleMentionedCommentSpy).not.toHaveBeenCalled();
    });

    test("should call handleMentionedComment for mention updates", async () => {
      const handleResolvedCommentSpy = jest.spyOn(
        task as any,
        "handleResolvedComment"
      );
      const handleMentionedCommentSpy = jest.spyOn(
        task as any,
        "handleMentionedComment"
      );

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        data: {
          newMentionIds: ["mention-1"],
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(handleMentionedCommentSpy).toHaveBeenCalledWith(event);
      expect(handleResolvedCommentSpy).not.toHaveBeenCalled();
    });

    test("should call handleMentionedComment when not resolving", async () => {
      const handleResolvedCommentSpy = jest.spyOn(
        task as any,
        "handleResolvedComment"
      );
      const handleMentionedCommentSpy = jest.spyOn(
        task as any,
        "handleMentionedComment"
      );

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: {
            data: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "old", content: [] }],
                },
              ],
            },
          },
          attributes: {
            data: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "new", content: [] }],
                },
              ],
            },
          },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(handleMentionedCommentSpy).toHaveBeenCalledWith(event);
      expect(handleResolvedCommentSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleResolvedComment", () => {
    test("should create notification for comment author", async () => {
      const notificationSpy = jest.spyOn(Notification, "create");

      // Mock comment author subscribes to resolve notifications
      author.setNotificationEventType(NotificationEventType.ResolveComment);
      await author.save();

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id, // Different from author
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).toHaveBeenCalledWith({
        event: NotificationEventType.ResolveComment,
        userId: author.id,
        actorId: user.id,
        teamId: document.teamId,
        documentId: document.id,
        commentId: comment.id,
      });
    });

    test("should not notify the resolver", async () => {
      const notificationSpy = jest.spyOn(Notification, "create");

      // User who resolves subscribes to notifications
      user.setNotificationEventType(NotificationEventType.ResolveComment);
      await user.save();

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id, // Same as resolver
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          userId: user.id, // Should not notify resolver
        })
      );
    });

    test("should create notification for mentioned users", async () => {
      const mentionedUser = await buildUser({ teamId: user.teamId });
      mentionedUser.setNotificationEventType(
        NotificationEventType.ResolveComment
      );
      await mentionedUser.save();

      const notificationSpy = jest.spyOn(Notification, "create");

      // Mock mentions in comment
      mockProsemirrorHelper.parseMentions.mockReturnValue([
        {
          id: "mention-1",
          type: "user",
          modelId: mentionedUser.id,
          actorId: author.id,
          label: mentionedUser.name,
        },
      ]);

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).toHaveBeenCalledWith({
        event: NotificationEventType.ResolveComment,
        userId: mentionedUser.id,
        actorId: user.id,
        teamId: document.teamId,
        documentId: document.id,
        commentId: comment.id,
      });
    });

    test("should create notification for reply authors", async () => {
      const replyAuthor = await buildUser({ teamId: user.teamId });
      replyAuthor.setNotificationEventType(
        NotificationEventType.ResolveComment
      );
      await replyAuthor.save();

      // Create a reply to the comment
      await buildComment({
        userId: replyAuthor.id,
        documentId: document.id,
        parentCommentId: comment.id,
      });

      const notificationSpy = jest.spyOn(Notification, "create");

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).toHaveBeenCalledWith({
        event: NotificationEventType.ResolveComment,
        userId: replyAuthor.id,
        actorId: user.id,
        teamId: document.teamId,
        documentId: document.id,
        commentId: comment.id,
      });
    });

    test("should not create duplicate notifications", async () => {
      const notificationSpy = jest.spyOn(Notification, "create");

      // Author subscribes to notifications
      author.setNotificationEventType(NotificationEventType.ResolveComment);
      await author.save();

      // Mock mentions that include the same user as author
      mockProsemirrorHelper.parseMentions.mockReturnValue([
        {
          id: "mention-1",
          type: "user",
          modelId: author.id, // Same as comment author
          actorId: author.id,
          label: author.name,
        },
      ]);

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      // Should only be called once for the author, not twice
      expect(notificationSpy).toHaveBeenCalledTimes(1);
      expect(notificationSpy).toHaveBeenCalledWith({
        event: NotificationEventType.ResolveComment,
        userId: author.id,
        actorId: user.id,
        teamId: document.teamId,
        documentId: document.id,
        commentId: comment.id,
      });
    });

    test("should not notify users without document access", async () => {
      const notificationSpy = jest.spyOn(Notification, "create");

      author.setNotificationEventType(NotificationEventType.ResolveComment);
      await author.save();

      // Mock no document access for author
      mockCanUserAccessDocument.mockResolvedValue(false);

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).not.toHaveBeenCalled();
    });

    test("should not notify unsubscribed users", async () => {
      const notificationSpy = jest.spyOn(Notification, "create");

      // Author doesn't subscribe to resolve notifications
      author.setNotificationEventType(
        NotificationEventType.ResolveComment,
        false
      );
      await author.save();

      const event: CommentUpdateEvent = {
        name: "comments.update",
        modelId: comment.id,
        teamId: user.teamId,
        actorId: user.id,
        documentId: document.id,
        changes: {
          previous: { resolvedAt: null },
          attributes: { resolvedAt: new Date() },
        },
        ip: "127.0.0.1",
      };

      await task.perform(event);

      expect(notificationSpy).not.toHaveBeenCalled();
    });
  });
});

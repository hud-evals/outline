import { NotificationEventType } from "@shared/types";
import { Minute } from "@shared/utils/time";
import { Notification } from "@server/models";
import {
  buildUser,
  buildDocument,
  buildComment,
  buildCollection,
} from "@server/test/factories";
import { NotificationEvent } from "@server/types";

// Only mock the schedule method to prevent actual email sending
const mockSchedule = jest.fn().mockResolvedValue(undefined);
const mockConstructor = jest.fn();

// Use real CommentResolvedEmail, only mock schedule method
jest.mock("@server/emails/templates/CommentResolvedEmail", () => {
  const ActualCommentResolvedEmail = jest.requireActual(
    "@server/emails/templates/CommentResolvedEmail"
  ).default;

  return {
    __esModule: true,
    default: jest.fn().mockImplementation((props, options) => {
      mockConstructor(props, options);
      const instance = new ActualCommentResolvedEmail(props, options);
      instance.schedule = mockSchedule;
      return instance;
    }),
  };
});

describe("EmailsProcessor - ResolveComment", () => {
  let processor: any;
  let user: any;
  let author: any;
  let document: any;
  let comment: any;
  let notification: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSchedule.mockClear();
    mockConstructor.mockClear();

    const { default: EmailsProcessor } = await import(
      "@server/queues/processors/EmailsProcessor"
    );
    processor = new EmailsProcessor();

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

    // Create a notification for resolved comment
    notification = await Notification.create({
      event: NotificationEventType.ResolveComment,
      userId: user.id,
      actorId: author.id,
      teamId: user.teamId,
      documentId: document.id,
      commentId: comment.id,
    });
  });

  test("should process ResolveComment notification and schedule email", async () => {
    const event: NotificationEvent = {
      name: "notifications.create",
      modelId: notification.id,
      teamId: user.teamId,
      userId: user.id,
      actorId: author.id,
      ip: "127.0.0.1",
    };

    await processor.perform(event);

    // Verify CommentResolvedEmail was instantiated with correct props
    expect(mockConstructor).toHaveBeenCalledWith(
      {
        to: user.email,
        userId: user.id,
        documentId: document.id,
        teamUrl: user.team.url,
        actorName: author.name,
        commentId: comment.id,
      },
      { notificationId: notification.id }
    );

    // Verify schedule was called with proper delay
    expect(mockSchedule).toHaveBeenCalledWith({
      delay: Minute.ms,
    });
  });

  test("should not process notification if user is suspended", async () => {
    // Suspend the user
    user.suspendedAt = new Date();
    await user.save();

    const event: NotificationEvent = {
      name: "notifications.create",
      modelId: notification.id,
      teamId: user.teamId,
      userId: user.id,
      actorId: author.id,
      ip: "127.0.0.1",
    };

    await processor.perform(event);

    // Should not have called CommentResolvedEmail constructor
    expect(mockConstructor).not.toHaveBeenCalled();
  });

  test("should only process ResolveComment notifications", async () => {
    // Create a different notification type
    const mentionNotification = await Notification.create({
      event: NotificationEventType.MentionedInComment,
      userId: user.id,
      actorId: author.id,
      teamId: user.teamId,
      documentId: document.id,
      commentId: comment.id,
    });

    const event: NotificationEvent = {
      name: "notifications.create",
      modelId: mentionNotification.id,
      teamId: user.teamId,
      userId: user.id,
      actorId: author.id,
      ip: "127.0.0.1",
    };

    await processor.perform(event);

    // Should not have called CommentResolvedEmail constructor for mention notification
    expect(mockConstructor).not.toHaveBeenCalled();
  });
});

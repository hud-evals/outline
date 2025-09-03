/* eslint-disable */
import { NotificationEventType } from "@shared/types";
import { Notification } from "@server/models";
import { buildComment, buildDocument, buildUser } from "@server/test/factories";
import { CommentReactionEvent } from "@server/types";
import ReactionCreatedNotificationsTask from "../ReactionCreatedNotificationsTask";
import ReactionRemovedNotificationsTask from "../ReactionRemovedNotificationsTask";

const ip = "127.0.0.1";

beforeEach(async () => {
  jest.resetAllMocks();
});

// We needed to move this test to its own file to avoid transaction isolation issues
describe("Reaction Notifications - Integration Test", () => {
  test("complete end-to-end flow: create reaction → notification created → remove reaction → notification archived", async () => {
    const uniqueEmoji = "🎭";

    const commentAuthor = await buildUser();
    const reactor = await buildUser({ teamId: commentAuthor.teamId });
    const document = await buildDocument({
      teamId: commentAuthor.teamId,
      createdById: commentAuthor.id,
    });
    const comment = await buildComment({
      userId: commentAuthor.id,
      documentId: document.id,
    });

    commentAuthor.setNotificationEventType(
      NotificationEventType.ReactionsCreate
    );
    await commentAuthor.save();
    await reactor.save();

    // Step 1: Add reaction - this creates a notification
    const addEvent: CommentReactionEvent = {
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: uniqueEmoji },
      ip,
    };

    const createTask = new ReactionCreatedNotificationsTask();
    await createTask.perform(addEvent);

    // Verify notification was created
    let notification = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });

    expect(notification).toBeDefined();
    expect(notification).not.toBeNull();
    expect(notification?.archivedAt).toBeNull();
    expect(notification?.actorId).toBe(reactor.id);
    expect(notification?.data).toEqual({ emoji: uniqueEmoji });

    // Verify the notification matches the conditions for ReactionRemovedNotificationsTask
    expect(notification?.actorId).toBe(reactor.id);
    expect(notification?.commentId).toBe(comment.id);
    expect(notification?.viewedAt).toBeNull(); // Only unviewed notifications are archived
    expect(notification?.event).toBe(NotificationEventType.ReactionsCreate);
    expect(notification?.data?.emoji).toBe(uniqueEmoji);

    // Step 2: Remove reaction
    const removeEvent: CommentReactionEvent = {
      name: "comments.remove_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: uniqueEmoji },
      ip,
    };

    // Ensure the reactor user exists (required by ReactionRemovedNotificationsTask)
    const reactorExists = await reactor.reload();
    expect(reactorExists).toBeDefined();

    const removeTask = new ReactionRemovedNotificationsTask();
    await removeTask.perform(removeEvent);

    await notification?.reload();

    expect(notification?.actorId).toBe(reactor.id);
    expect(notification?.commentId).toBe(comment.id);
    expect(notification?.data).toEqual({ emoji: uniqueEmoji });
    expect(notification?.archivedAt).not.toBeNull();
  });
});

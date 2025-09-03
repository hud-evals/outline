/* eslint-disable */
import { NotificationEventType } from "@shared/types";
import { Notification } from "@server/models";
import { sequelize } from "@server/storage/database";
import {
  buildComment,
  buildDocument,
  buildUser,
  buildNotification,
} from "@server/test/factories";
import { CommentReactionEvent } from "@server/types";
import ReactionCreatedNotificationsTask from "../ReactionCreatedNotificationsTask";
import ReactionRemovedNotificationsTask from "../ReactionRemovedNotificationsTask";

const ip = "127.0.0.1";

beforeEach(async () => {
  jest.resetAllMocks();
});

describe("ReactionCreatedNotificationsTask", () => {
  describe("comments.add_reaction", () => {
    test("should create notification when user reacts to another user's comment", async () => {
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

      // Enable reaction notifications for comment author
      commentAuthor.setNotificationEventType(
        NotificationEventType.ReactionsCreate
      );
      await commentAuthor.save();

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "👍" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      const notification = await Notification.findOne({
        where: {
          userId: commentAuthor.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeDefined();
      expect(notification?.actorId).toBe(reactor.id);
      expect(notification?.data).toEqual({ emoji: "👍" });
      expect(notification?.documentId).toBe(document.id);
      expect(notification?.teamId).toBe(document.teamId);
    });

    test("should NOT create notification when user reacts to their own comment", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        teamId: user.teamId,
        createdById: user.id,
      });
      const comment = await buildComment({
        userId: user.id,
        documentId: document.id,
      });

      user.setNotificationEventType(NotificationEventType.ReactionsCreate);
      await user.save();

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: user.id, // Same user reacting to their own comment
        data: { emoji: "❤️" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      const notification = await Notification.findOne({
        where: {
          userId: user.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeNull();
    });

    test("should NOT create notification if recipient has disabled ReactionsCreate notifications", async () => {
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

      // ReactionsCreate notifications are enabled by default, so we need to explicitly disable them
      commentAuthor.notificationSettings = {
        ...commentAuthor.notificationSettings,
        [NotificationEventType.ReactionsCreate]: false,
      };
      await commentAuthor.save();

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "🎉" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      const notification = await Notification.findOne({
        where: {
          userId: commentAuthor.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeNull();
    });

    test("should NOT create notification if recipient cannot access document", async () => {
      const commentAuthor = await buildUser();
      const reactor = await buildUser({ teamId: commentAuthor.teamId });
      const anotherUser = await buildUser(); // User from different team
      const document = await buildDocument({
        teamId: commentAuthor.teamId,
        createdById: commentAuthor.id,
      });
      const comment = await buildComment({
        userId: anotherUser.id, // Comment by user from different team
        documentId: document.id,
      });

      anotherUser.setNotificationEventType(
        NotificationEventType.ReactionsCreate
      );
      await anotherUser.save();

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "🚀" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      const notification = await Notification.findOne({
        where: {
          userId: anotherUser.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeNull();
    });

    test("should update existing notification instead of creating duplicate", async () => {
      const commentAuthor = await buildUser();
      const reactor1 = await buildUser({ teamId: commentAuthor.teamId });
      const reactor2 = await buildUser({ teamId: commentAuthor.teamId });
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

      // Create initial notification from first reactor
      const existingNotification = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor1.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "👍" },
        viewedAt: new Date(), // Mark as viewed
      });

      // Second reactor reacts to same comment
      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor2.id,
        data: { emoji: "❤️" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      // Should update existing notification
      await existingNotification.reload();
      expect(existingNotification.actorId).toBe(reactor2.id);
      expect(existingNotification.data).toEqual({ emoji: "❤️" });
      expect(existingNotification.viewedAt).toBeNull(); // Reset viewed status
      expect(existingNotification.archivedAt).toBeNull(); // Reset archived status

      // Verify only one notification exists
      const count = await Notification.count({
        where: {
          userId: commentAuthor.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });
      expect(count).toBe(1);
    });

    test("should handle missing document gracefully", async () => {
      const commentAuthor = await buildUser();
      const reactor = await buildUser({ teamId: commentAuthor.teamId });
      const document = await buildDocument({
        teamId: commentAuthor.teamId,
        createdById: commentAuthor.id,
      });

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: "00000000-0000-0000-0000-000000000000", // Valid UUID but non-existent comment
        documentId: document.id,
        teamId: commentAuthor.teamId,
        actorId: reactor.id,
        data: { emoji: "😊" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();

      // Should not throw an error
      await expect(task.perform(event)).resolves.not.toThrow();

      const notification = await Notification.findOne({
        where: {
          event: NotificationEventType.ReactionsCreate,
          actorId: reactor.id,
        },
      });

      expect(notification).toBeNull();
    });

    test("should handle missing actor gracefully", async () => {
      const commentAuthor = await buildUser();
      const document = await buildDocument({
        teamId: commentAuthor.teamId,
        createdById: commentAuthor.id,
      });
      const comment = await buildComment({
        userId: commentAuthor.id,
        documentId: document.id,
      });

      const event: CommentReactionEvent = {
        name: "comments.add_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: "00000000-0000-0000-0000-000000000000", // Valid UUID but non-existent user
        data: { emoji: "😄" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();

      await expect(task.perform(event)).resolves.not.toThrow();

      const notification = await Notification.findOne({
        where: {
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeNull();
    });

    test("should only process comments.add_reaction events", async () => {
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

      const event: CommentReactionEvent = {
        name: "comments.remove_reaction", // Wrong event type
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "👎" },
        ip,
      };

      const task = new ReactionCreatedNotificationsTask();
      await task.perform(event);

      const notification = await Notification.findOne({
        where: {
          userId: commentAuthor.id,
          commentId: comment.id,
          event: NotificationEventType.ReactionsCreate,
        },
      });

      expect(notification).toBeNull();
    });
  });
});

describe("ReactionRemovedNotificationsTask", () => {
  describe("comments.remove_reaction", () => {
    test("should archive unviewed notification when reaction is removed", async () => {
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

      // Create unviewed notification
      const notification = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "👍" },
        viewedAt: null, // Not viewed
      });

      const event: CommentReactionEvent = {
        name: "comments.remove_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "👍" },
        ip,
      };

      const task = new ReactionRemovedNotificationsTask();
      await task.perform(event);

      await notification.reload();
      expect(notification.archivedAt).not.toBeNull();
    });

    test("should NOT archive viewed notification", async () => {
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

      // Create viewed notification
      const notification = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "❤️" },
        viewedAt: new Date(), // Already viewed
      });

      const event: CommentReactionEvent = {
        name: "comments.remove_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "❤️" },
        ip,
      };

      const task = new ReactionRemovedNotificationsTask();
      await task.perform(event);

      await notification.reload();
      expect(notification.archivedAt).toBeNull(); // Should not be archived
    });

    test("should only archive notifications matching the exact emoji", async () => {
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

      // Create notifications with different emojis
      const notification1 = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "👍" },
        viewedAt: null,
      });

      const notification2 = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "❤️" },
        viewedAt: null,
      });

      const event: CommentReactionEvent = {
        name: "comments.remove_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "👍" }, // Only remove thumbs up
        ip,
      };

      const task = new ReactionRemovedNotificationsTask();
      await task.perform(event);

      await notification1.reload();
      await notification2.reload();

      expect(notification1.archivedAt).not.toBeNull(); // Should be archived
      expect(notification2.archivedAt).toBeNull(); // Should NOT be archived
    });

    test("should only process comments.remove_reaction events", async () => {
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

      const notification = await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "🎉" },
        viewedAt: null,
      });

      const event: CommentReactionEvent = {
        name: "comments.add_reaction", // Wrong event type
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "🎉" },
        ip,
      };

      const task = new ReactionRemovedNotificationsTask();
      await task.perform(event);

      await notification.reload();
      expect(notification.archivedAt).toBeNull(); // Should not be archived
    });

    test("should handle transaction properly", async () => {
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

      await buildNotification({
        event: NotificationEventType.ReactionsCreate,
        userId: commentAuthor.id,
        actorId: reactor.id,
        teamId: document.teamId,
        commentId: comment.id,
        documentId: document.id,
        data: { emoji: "🚀" },
        viewedAt: null,
      });

      const event: CommentReactionEvent = {
        name: "comments.remove_reaction",
        modelId: comment.id,
        documentId: document.id,
        teamId: document.teamId,
        actorId: reactor.id,
        data: { emoji: "🚀" },
        ip,
      };

      // Spy on transaction to ensure it's being used
      const transactionSpy = jest.spyOn(sequelize, "transaction");

      const task = new ReactionRemovedNotificationsTask();
      await task.perform(event);

      expect(transactionSpy).toHaveBeenCalled();
    });
  });
});

describe("Reaction Notifications - Integration & Edge Cases", () => {
  test("multiple reactions from different users", async () => {
    const commentAuthor = await buildUser();
    const reactor1 = await buildUser({ teamId: commentAuthor.teamId });
    const reactor2 = await buildUser({ teamId: commentAuthor.teamId });
    const reactor3 = await buildUser({ teamId: commentAuthor.teamId });
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

    const task = new ReactionCreatedNotificationsTask();

    // First reaction
    await task.perform({
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor1.id,
      data: { emoji: "👍" },
      ip,
    });

    let notification = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });
    expect(notification?.actorId).toBe(reactor1.id);
    expect(notification?.data).toEqual({ emoji: "👍" });

    // Second reaction (updates existing)
    await task.perform({
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor2.id,
      data: { emoji: "❤️" },
      ip,
    });

    await notification?.reload();
    expect(notification?.actorId).toBe(reactor2.id);
    expect(notification?.data).toEqual({ emoji: "❤️" });

    // Third reaction (updates again)
    await task.perform({
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor3.id,
      data: { emoji: "🎉" },
      ip,
    });

    await notification?.reload();
    expect(notification?.actorId).toBe(reactor3.id);
    expect(notification?.data).toEqual({ emoji: "🎉" });

    // Verify still only one notification
    const count = await Notification.count({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });
    expect(count).toBe(1);
  });

  test("same user reacting with different emojis", async () => {
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

    const createTask = new ReactionCreatedNotificationsTask();

    // First emoji
    await createTask.perform({
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: "😊" },
      ip,
    });

    let notification = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });
    expect(notification?.data).toEqual({ emoji: "😊" });

    // Same user, different emoji
    await createTask.perform({
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: "😎" },
      ip,
    });

    await notification?.reload();
    expect(notification?.data).toEqual({ emoji: "😎" });
    expect(notification?.actorId).toBe(reactor.id); // Still same actor
  });

  test("notification settings when explicitly disabled", async () => {
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

    // First verify default is enabled
    expect(
      commentAuthor.subscribedToEventType(NotificationEventType.ReactionsCreate)
    ).toBe(true);

    // Now explicitly disable reaction notifications
    commentAuthor.notificationSettings = {
      ...commentAuthor.notificationSettings,
      [NotificationEventType.ReactionsCreate]: false,
    };
    await commentAuthor.save();

    // Verify it's now disabled
    expect(
      commentAuthor.subscribedToEventType(NotificationEventType.ReactionsCreate)
    ).toBe(false);

    // Try to create a reaction
    const event: CommentReactionEvent = {
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: "🚫" },
      ip,
    };

    const task = new ReactionCreatedNotificationsTask();
    await task.perform(event);

    // Verify NO notification was created
    const notification = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });

    expect(notification).toBeNull();

    // Now re-enable notifications
    commentAuthor.notificationSettings = {
      ...commentAuthor.notificationSettings,
      [NotificationEventType.ReactionsCreate]: true,
    };
    await commentAuthor.save();

    // Try another reaction
    const event2: CommentReactionEvent = {
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: "✅" },
      ip,
    };

    await task.perform(event2);

    // Now notification SHOULD be created
    const notification2 = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });

    expect(notification2).toBeDefined();
    expect(notification2?.data).toEqual({ emoji: "✅" });
    // Email should still never be sent for reaction notifications
    expect(notification2?.emailedAt).toBeNull();
  });

  test("proper notification data structure with emoji field", async () => {
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

    const emojiToTest = "🦄";

    const event: CommentReactionEvent = {
      name: "comments.add_reaction",
      modelId: comment.id,
      documentId: document.id,
      teamId: document.teamId,
      actorId: reactor.id,
      data: { emoji: emojiToTest },
      ip,
    };

    const task = new ReactionCreatedNotificationsTask();
    await task.perform(event);

    const notification = await Notification.findOne({
      where: {
        userId: commentAuthor.id,
        commentId: comment.id,
        event: NotificationEventType.ReactionsCreate,
      },
    });

    // Verify the data structure
    expect(notification?.data).toEqual({ emoji: emojiToTest });
    expect(notification?.data).toHaveProperty("emoji");
    expect(typeof notification?.data?.emoji).toBe("string");
  });

  test("task priority is set to Background", () => {
    const createTask = new ReactionCreatedNotificationsTask();
    const removeTask = new ReactionRemovedNotificationsTask();

    // Both tasks should have Background priority
    expect(createTask.options.priority).toBe(40); // TaskPriority.Background = 40
    expect(removeTask.options.priority).toBe(40);
  });
});

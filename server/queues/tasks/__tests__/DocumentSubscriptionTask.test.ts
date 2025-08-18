/* eslint-disable import/no-unresolved */

import { Subscription } from "@server/models";
import {
  buildDocument,
  buildSubscription,
  buildUser,
} from "@server/test/factories";
import { AuthenticationType } from "@server/types";
import DocumentSubscriptionTask from "../DocumentSubscriptionTask";

const ip = "127.0.0.1";

describe("DocumentSubscriptionTask", () => {
  describe("documents.add_user", () => {
    it("should create a subscription for the user", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const task = new DocumentSubscriptionTask();
      await task.perform({
        name: "documents.add_user",
        documentId: document.id,
        userId: user.id,
        modelId: user.id,
        teamId: user.teamId,
        actorId: user.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true },
      });

      const subscription = await Subscription.findOne({
        where: {
          userId: user.id,
          documentId: document.id,
          event: "documents.update",
        },
      });

      expect(subscription).toBeDefined();
      expect(subscription!.userId).toBe(user.id);
      expect(subscription!.documentId).toBe(document.id);
      expect(subscription!.event).toBe("documents.update");
      expect(subscription!.deletedAt).toBeNull();
    });

    it("should not create duplicate subscriptions", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      // Create an existing subscription
      await buildSubscription({
        userId: user.id,
        documentId: document.id,
        event: "documents.update",
      });

      const task = new DocumentSubscriptionTask();
      await task.perform({
        name: "documents.add_user",
        documentId: document.id,
        userId: user.id,
        modelId: user.id,
        teamId: user.teamId,
        actorId: user.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true },
      });

      const subscriptions = await Subscription.findAll({
        where: {
          userId: user.id,
          documentId: document.id,
          event: "documents.update",
        },
      });

      // Should still only have one subscription
      expect(subscriptions).toHaveLength(1);
    });

    it("should handle non-existent user gracefully", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const task = new DocumentSubscriptionTask();

      // Should not throw an error
      await expect(
        task.perform({
          name: "documents.add_user",
          documentId: document.id,
          userId: "00000000-0000-0000-0000-000000000000",
          modelId: "00000000-0000-0000-0000-000000000000",
          teamId: user.teamId,
          actorId: user.id,
          authType: AuthenticationType.APP,
          ip,
          data: { isNew: true },
        })
      ).resolves.toBeUndefined();

      // Should not create any subscription
      const subscriptions = await Subscription.findAll({
        where: {
          documentId: document.id,
          event: "documents.update",
        },
      });

      expect(subscriptions).toHaveLength(0);
    });
  });

  describe("documents.remove_user", () => {
    it("should remove the user's subscription", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      // Create a subscription first
      const subscription = await buildSubscription({
        userId: user.id,
        documentId: document.id,
        event: "documents.update",
      });

      expect(subscription.deletedAt).toBeNull();

      const task = new DocumentSubscriptionTask();
      await task.perform({
        name: "documents.remove_user",
        documentId: document.id,
        userId: user.id,
        modelId: user.id,
        teamId: user.teamId,
        actorId: user.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false },
      });

      // Reload the subscription to check if it was soft-deleted
      await subscription.reload({ paranoid: false });
      expect(subscription.deletedAt).not.toBeNull();
    });

    it("should handle removal when no subscription exists", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const task = new DocumentSubscriptionTask();

      // Should not throw an error when no subscription exists
      await expect(
        task.perform({
          name: "documents.remove_user",
          documentId: document.id,
          userId: user.id,
          modelId: user.id,
          teamId: user.teamId,
          actorId: user.id,
          authType: AuthenticationType.APP,
          ip,
          data: { isNew: false },
        })
      ).resolves.toBeUndefined();
    });

    it("should handle non-existent user gracefully", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const task = new DocumentSubscriptionTask();

      // Should not throw an error
      await expect(
        task.perform({
          name: "documents.remove_user",
          documentId: document.id,
          userId: "00000000-0000-0000-0000-000000000000",
          modelId: "00000000-0000-0000-0000-000000000000",
          teamId: user.teamId,
          actorId: user.id,
          authType: AuthenticationType.APP,
          ip,
          data: { isNew: false },
        })
      ).resolves.toBeUndefined();
    });

    it("should only remove the specific user's subscription", async () => {
      const user1 = await buildUser();
      const user2 = await buildUser({ teamId: user1.teamId });
      const document = await buildDocument({
        userId: user1.id,
        teamId: user1.teamId,
      });

      // Create subscriptions for both users
      const subscription1 = await buildSubscription({
        userId: user1.id,
        documentId: document.id,
        event: "documents.update",
      });

      const subscription2 = await buildSubscription({
        userId: user2.id,
        documentId: document.id,
        event: "documents.update",
      });

      const task = new DocumentSubscriptionTask();
      await task.perform({
        name: "documents.remove_user",
        documentId: document.id,
        userId: user1.id,
        modelId: user1.id,
        teamId: user1.teamId,
        actorId: user1.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false },
      });

      // Check that only user1's subscription was removed
      await subscription1.reload({ paranoid: false });
      await subscription2.reload();

      expect(subscription1.deletedAt).not.toBeNull();
      expect(subscription2.deletedAt).toBeNull();
    });
  });

  describe("unknown event", () => {
    it("should handle unknown event types gracefully", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const task = new DocumentSubscriptionTask();

      // Should not throw an error for unknown event types
      await expect(
        task.perform({
          name: "documents.unknown_event" as any,
          documentId: document.id,
          userId: user.id,
          modelId: user.id,
          teamId: user.teamId,
          actorId: user.id,
          authType: AuthenticationType.APP,
          ip,
          data: { isNew: false },
        })
      ).resolves.toBeUndefined();
    });
  });
});

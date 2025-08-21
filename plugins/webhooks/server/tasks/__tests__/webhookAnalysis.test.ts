import { subHours, subMinutes } from "date-fns";
import { WebhookSubscription } from "@server/models";
import {
  buildWebhookSubscription,
  buildWebhookDelivery,
  buildUser,
} from "@server/test/factories";
import DeliverWebhookTask from "../DeliverWebhookTask";

// Test for PR #9800: Improve webhook disabling heuristic with time-based analysis
describe("PR #9800: Webhook disabling time-based heuristic", () => {
  let subscription: WebhookSubscription;
  let user: any;

  beforeEach(async () => {
    subscription = await buildWebhookSubscription({
      url: "http://example.com",
      events: ["*"],
    });
    user = await buildUser({ teamId: subscription.teamId });
  });

  describe("Time window analysis", () => {
    it("should only consider deliveries within the time window (24 hours)", async () => {
      const now = new Date();

      // Create 5 old failed deliveries (25 hours ago) - should be ignored
      for (let i = 0; i < 5; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subHours(now, 25),
        });
      }

      // Create 15 recent deliveries: 12 failed, 3 successful (80% failure rate)
      for (let i = 0; i < 12; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 30 + i * 10), // Spread over last 2 hours
        });
      }

      for (let i = 0; i < 3; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "success",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      // Test that checkAndDisableSubscription only considers recent deliveries
      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();

      // Should be disabled because recent failure rate is 80% with 15 deliveries (>= 10 minimum)
      // Old failures should not count toward the rate
      expect(subscription.enabled).toBe(false);
    });

    it("should not disable if old failures make total count high but recent rate is low", async () => {
      const now = new Date();

      // Create 25 old failed deliveries (25 hours ago) - should be ignored
      for (let i = 0; i < 25; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subHours(now, 25),
        });
      }

      // Create 10 recent successful deliveries (0% failure rate)
      for (let i = 0; i < 10; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "success",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();

      // Should not be disabled because recent failure rate is 0%
      expect(subscription.enabled).toBe(true);
    });
  });

  describe("Failure rate threshold", () => {
    it("should disable webhook when failure rate equals 80%", async () => {
      const now = new Date();

      // Create exactly 80% failure rate: 8 failed, 2 successful out of 10 deliveries
      for (let i = 0; i < 8; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 60 + i * 10),
        });
      }

      for (let i = 0; i < 2; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "success",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(false);
    });

    it("should disable webhook when failure rate exceeds 80%", async () => {
      const now = new Date();

      // Create 90% failure rate: 9 failed, 1 successful out of 10 deliveries
      for (let i = 0; i < 9; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 60 + i * 10),
        });
      }

      await buildWebhookDelivery({
        webhookSubscriptionId: subscription.id,
        status: "success",
        createdAt: subMinutes(now, 5),
      });

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(false);
    });

    it("should not disable webhook when failure rate is below 80%", async () => {
      const now = new Date();

      // Create 70% failure rate: 7 failed, 3 successful out of 10 deliveries
      for (let i = 0; i < 7; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 60 + i * 10),
        });
      }

      for (let i = 0; i < 3; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "success",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(true);
    });
  });

  describe("Minimum delivery requirement", () => {
    it("should not disable webhook with less than 10 deliveries even at 100% failure rate", async () => {
      const now = new Date();

      // Create only 9 failed deliveries (100% failure rate but below minimum)
      for (let i = 0; i < 9; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(true);
    });

    it("should disable webhook with exactly 10 deliveries at 100% failure rate", async () => {
      const now = new Date();

      // Create exactly 10 failed deliveries (100% failure rate, meets minimum)
      for (let i = 0; i < 10; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(false);
    });

    it("should disable webhook with more than 10 deliveries at high failure rate", async () => {
      const now = new Date();

      // Create 20 deliveries: 16 failed, 4 successful (80% failure rate)
      for (let i = 0; i < 16; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 120 + i * 5),
        });
      }

      for (let i = 0; i < 4; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "success",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();
      expect(subscription.enabled).toBe(false);
    });
  });

  describe("Mixed scenarios", () => {
    it("should handle complex mixed success/failure patterns correctly", async () => {
      const now = new Date();

      // Create a complex pattern: 15 total deliveries within 24h
      // Pattern: F F S F F F S F F F S F F F S = 11 failed, 4 successful = 73.33% failure rate
      const pattern = [
        "failed",
        "failed",
        "success",
        "failed",
        "failed",
        "failed",
        "success",
        "failed",
        "failed",
        "failed",
        "success",
        "failed",
        "failed",
        "failed",
        "success",
      ];

      for (let i = 0; i < pattern.length; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: pattern[i] as "failed" | "success",
          createdAt: subMinutes(now, 120 + i * 8), // Spread over 2 hours
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();

      // Should not be disabled because failure rate (73.33%) is below 80% threshold
      expect(subscription.enabled).toBe(true);
    });

    it("should ignore pending deliveries when calculating failure rate", async () => {
      const now = new Date();

      // Create 8 failed, 1 successful, 1 pending out of 10 deliveries
      // Should calculate rate as 8/9 = 88.89% (ignoring pending)
      for (let i = 0; i < 8; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "failed",
          createdAt: subMinutes(now, 60 + i * 7),
        });
      }

      await buildWebhookDelivery({
        webhookSubscriptionId: subscription.id,
        status: "success",
        createdAt: subMinutes(now, 30),
      });

      await buildWebhookDelivery({
        webhookSubscriptionId: subscription.id,
        status: "pending",
        createdAt: subMinutes(now, 5),
      });

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();

      // Should be disabled because failure rate among completed deliveries is 88.89% > 80%
      expect(subscription.enabled).toBe(false);
    });

    it("should handle edge case where all deliveries are pending", async () => {
      const now = new Date();

      // Create 10 pending deliveries
      for (let i = 0; i < 10; i++) {
        await buildWebhookDelivery({
          webhookSubscriptionId: subscription.id,
          status: "pending",
          createdAt: subMinutes(now, 10 + i * 5),
        });
      }

      const task = new DeliverWebhookTask();
      await (task as any).checkAndDisableSubscription(subscription);

      await subscription.reload();

      // Should not be disabled because there are no completed deliveries to analyze
      expect(subscription.enabled).toBe(true);
    });
  });
});

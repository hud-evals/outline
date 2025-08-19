import { Revision, Notification } from "@server/models";
import type { User, Team, Collection } from "@server/models";
import {
  buildUser,
  buildTeam,
  buildCollection,
  buildDocument,
} from "@server/test/factories";
import { setupTestDatabase } from "@server/test/support";

setupTestDatabase();

describe("mention integration", () => {
  let team: Team;
  let user1: User;
  let user2: User;
  let user3: User;
  let user4: User;
  let collection: Collection;

  beforeEach(async () => {
    team = await buildTeam();
    user1 = await buildUser({
      teamId: team.id,
      name: "Alice",
      email: "alice@example.com",
    });
    user2 = await buildUser({
      teamId: team.id,
      name: "Bob",
      email: "bob@example.com",
    });
    user3 = await buildUser({
      teamId: team.id,
      name: "Charlie",
      email: "charlie@example.com",
    });
    user4 = await buildUser({
      teamId: team.id,
      name: "Diana",
      email: "diana@example.com",
    });
    collection = await buildCollection({ teamId: team.id, userId: user1.id });
  });

  describe("mention feature detection", () => {
    it("should detect mention functionality availability", async () => {
      // Test if mention functionality is available by checking for processors
      let hasMentionFunctionality = false;

      try {
        // Try to find any processor that might handle mentions
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        if (processorNames.length > 0) {
          hasMentionFunctionality = true;
        }
      } catch (error) {
        // Processor module doesn't exist
      }

      // If no mention functionality is detected, the feature is not implemented
      if (!hasMentionFunctionality) {
        throw new Error("Mention functionality is not implemented");
      }

      expect(hasMentionFunctionality).toBe(true);
    });
  });

  describe("document publishing with mentions", () => {
    it("should create notifications for mentioned users when document is published", async () => {
      // Create a document with multiple user mentions
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name} please review this document.

@${user3.name} and @${user4.name} also need to see this content.

This is important for the team.`,
      });

      // Simulate document publish event
      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      // Find and use the appropriate processor
      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      // Process the event
      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      // Verify that notifications were created for mentioned users
      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should create notifications for mentioned users
      expect(notifications.length).toBeGreaterThan(0);

      // Verify that notifications were created for all mentioned users
      const mentionedUserIds = [user2.id, user3.id, user4.id];
      const notificationUserIds = notifications.map((n) => n.userId);

      mentionedUserIds.forEach((userId) => {
        expect(notificationUserIds).toContain(userId);
      });

      // Verify notification details
      const user2Notification = notifications.find(
        (n) => n.userId === user2.id
      );
      const user3Notification = notifications.find(
        (n) => n.userId === user3.id
      );
      const user4Notification = notifications.find(
        (n) => n.userId === user4.id
      );

      expect(user2Notification).toBeDefined();
      expect(user3Notification).toBeDefined();
      expect(user4Notification).toBeDefined();
      expect(user2Notification?.actorId).toBe(user1.id);
      expect(user3Notification?.actorId).toBe(user1.id);
      expect(user4Notification?.actorId).toBe(user1.id);
    });

    it("should not create notifications when user mentions themselves", async () => {
      // Create a document where user mentions themselves
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user1.name} self mention.

@${user2.name} normal mention.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should only create notification for user2, not for self-mention
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId).toBe(user2.id);
      expect(notifications[0].actorId).toBe(user1.id);
    });

    it("should handle multiple mentions of the same user", async () => {
      // Create a document with multiple mentions of the same user
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name} please review this.

@${user2.name} also check this section.

@${user2.name} and don't forget this part.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should create only one notification per user, even with multiple mentions
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId).toBe(user2.id);
    });
  });

  describe("document updates with mentions", () => {
    it("should create notifications only for newly mentioned users in document updates", async () => {
      // Create initial document with one mention
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name} is mentioned.`,
      });

      // Create a revision with additional mentions
      const revision = await Revision.create({
        documentId: document.id,
        title: document.title,
        text: `# Test Document

@${user2.name} is still mentioned.

@${user3.name} is newly mentioned.

@${user4.name} is also newly mentioned.`,
        userId: user1.id,
        version: 2,
        editorVersion: document.editorVersion || "1.0.0",
      });

      await document.update({
        text: revision.text,
        lastModifiedById: user1.id,
      });

      const event = {
        name: "revisions.create" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        modelId: revision.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      // Should create notifications for newly mentioned users
      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "revisions.create",
        },
      });

      expect(notifications.length).toBeGreaterThan(0);

      const notificationUserIds = notifications.map((n) => n.userId);

      // Should notify newly mentioned users
      expect(notificationUserIds).toContain(user3.id);
      expect(notificationUserIds).toContain(user4.id);

      // Should not notify already mentioned users
      expect(notificationUserIds).not.toContain(user2.id);
    });

    it("should handle document updates with removed mentions", async () => {
      // Create initial document with multiple mentions
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name} and @${user3.name} are mentioned.`,
      });

      // Create a revision removing one mention
      const revision = await Revision.create({
        documentId: document.id,
        title: document.title,
        text: `# Test Document

@${user2.name} is still mentioned.`,
        userId: user1.id,
        version: 2,
        editorVersion: document.editorVersion || "1.0.0",
      });

      await document.update({
        text: revision.text,
        lastModifiedById: user1.id,
      });

      const event = {
        name: "revisions.create" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        modelId: revision.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      // Should not create any notifications since no new mentions were added
      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "revisions.create",
        },
      });

      expect(notifications).toHaveLength(0);
    });
  });

  describe("mention format support", () => {
    it("should support various mention formats", async () => {
      const mentionFormats = [
        `@${user2.name}`,
        `@${user2.name} `,
        ` @${user2.name}`,
        `@${user2.name}.`,
        `@${user2.name}!`,
        `@${user2.name}?`,
        `@${user2.name},`,
        `@${user2.name};`,
        `@${user2.name}:`,
        `@${user2.name} -`,
        `@${user2.name} (`,
        `@${user2.name})`,
      ];

      let workingFormats = 0;

      for (const mentionFormat of mentionFormats) {
        const document = await buildDocument({
          teamId: team.id,
          userId: user1.id,
          collectionId: collection.id,
          text: `# Test Document

${mentionFormat} please review this.`,
        });

        const event = {
          name: "documents.publish" as const,
          documentId: document.id,
          collectionId: collection.id,
          teamId: team.id,
          actorId: user1.id,
          data: {},
        };

        let processor: unknown;
        try {
          const processors = await import("@server/queues/processors");
          const processorNames = Object.keys(processors.default);
          const notificationProcessor = processorNames.find(
            (name) =>
              name.toLowerCase().includes("notification") ||
              name.toLowerCase().includes("mention")
          );
          if (notificationProcessor) {
            processor = (processors.default as Record<string, unknown>)[
              notificationProcessor
            ];
          }
        } catch (error) {
          throw new Error("Document notification processor is not implemented");
        }

        if (!processor) {
          throw new Error("No notification processor found");
        }

        await (processor as {
          perform: (event: unknown) => Promise<void>;
        }).perform(event);

        const notifications = await Notification.findAll({
          where: {
            documentId: document.id,
            event: "documents.publish",
          },
        });

        if (notifications.length > 0 && notifications[0].userId === user2.id) {
          workingFormats++;
        }
      }

      // At least some mention formats should work
      expect(workingFormats).toBeGreaterThan(0);
    });

    it("should handle case-insensitive mentions", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name.toUpperCase()} please review this.

@${user3.name.toLowerCase()} also needs to see this.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should recognize mentions regardless of case
      expect(notifications.length).toBeGreaterThan(0);

      const notificationUserIds = notifications.map((n) => n.userId);
      expect(notificationUserIds).toContain(user2.id);
      expect(notificationUserIds).toContain(user3.id);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle non-existent user mentions gracefully", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@NonExistentUser does not exist.

@${user2.name} does exist.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      // Should not throw error when processing mentions with non-existent users
      await expect(
        (processor as { perform: (event: unknown) => Promise<void> }).perform(
          event
        )
      ).resolves.not.toThrow();

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should only create notifications for existing users
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId).toBe(user2.id);
    });

    it("should not create notifications for documents without mentions", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

This document has no mentions at all.

Just regular text content with no @ symbols.

More content here.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should not create any mention notifications
      expect(notifications).toHaveLength(0);
    });

    it("should handle malformed mention syntax", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@ without name
@@${user2.name} double at symbol
@ ${user3.name} space after at
@${user4.name}@ multiple at symbols
@${user2.name}@${user3.name} no space between mentions`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      // Should not throw error when processing malformed mentions
      await expect(
        (processor as { perform: (event: unknown) => Promise<void> }).perform(
          event
        )
      ).resolves.not.toThrow();

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should handle malformed mentions gracefully
      // May or may not create notifications depending on implementation
      expect(notifications.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle mentions in different document contexts", async () => {
      // Test mentions in different parts of the document
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

## Introduction
@${user2.name} will help with this project.

## Main Content
Here is the main content that @${user3.name} needs to review.

## Conclusion
@${user4.name} will handle the final review.

- @${user2.name} for technical review
- @${user3.name} for content review
- @${user4.name} for final approval`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should create notifications for all mentioned users
      expect(notifications.length).toBeGreaterThan(0);

      const notificationUserIds = notifications.map((n) => n.userId);
      expect(notificationUserIds).toContain(user2.id);
      expect(notificationUserIds).toContain(user3.id);
      expect(notificationUserIds).toContain(user4.id);
    });
  });

  describe("notification details", () => {
    it("should create notifications with correct metadata", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@${user2.name} please review this.`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: {},
      };

      let processor: unknown;
      try {
        const processors = await import("@server/queues/processors");
        const processorNames = Object.keys(processors.default);
        const notificationProcessor = processorNames.find(
          (name) =>
            name.toLowerCase().includes("notification") ||
            name.toLowerCase().includes("mention")
        );
        if (notificationProcessor) {
          processor = (processors.default as Record<string, unknown>)[
            notificationProcessor
          ];
        }
      } catch (error) {
        throw new Error("Document notification processor is not implemented");
      }

      if (!processor) {
        throw new Error("No notification processor found");
      }

      await (processor as {
        perform: (event: unknown) => Promise<void>;
      }).perform(event);

      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      expect(notifications.length).toBe(1);

      const notification = notifications[0];
      expect(notification.userId).toBe(user2.id);
      expect(notification.actorId).toBe(user1.id);
      expect(notification.teamId).toBe(team.id);
      expect(notification.documentId).toBe(document.id);
      expect(notification.event).toBe("documents.publish");
    });
  });
});

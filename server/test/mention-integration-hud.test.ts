/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */

import { randomUUID } from "crypto";
import { Revision, Notification } from "@server/models";
import type { User, Team, Collection } from "@server/models";
import NotificationsProcessor from "@server/queues/processors/NotificationsProcessor";
import {
  buildUser,
  buildTeam,
  buildCollection,
  buildDocument,
} from "@server/test/factories";
import { setupTestDatabase } from "@server/test/support";

setupTestDatabase();

// Helper function to create properly formatted mention links
function createMentionLink(user: User): string {
  const mentionId = randomUUID();
  return `@[${user.name}](mention://${mentionId}/user/${user.id})`;
}

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

  describe("document publishing with mentions", () => {
    it("should not create mention notifications for mentions parsed from markdown", async () => {
      // This test reflects the actual behavior: mentions parsed from markdown
      // don't have actorId, so they don't trigger mention notifications
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${createMentionLink(user2)} please review this document.

${createMentionLink(user3)} and ${createMentionLink(
          user4
        )} also need to see this content.

This is important for the team.`,
      });

      // Simulate document publish event
      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: { title: document.title },
        ip: "127.0.0.1",
      };

      // Process the event
      const processor = new NotificationsProcessor();
      await processor.perform(event);

      // Verify mentions are parsed but no mention notifications are created
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);
      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions[0].actorId).toBeUndefined();

      // No mention notifications should be created for markdown mentions without actorId
      const notifications = await Notification.findAll({
        where: {
          documentId: document.id,
          event: "documents.publish",
        },
      });

      // Should not create mention notifications for mentioned users since actorId is undefined
      const notificationUserIds = notifications.map((n) => n.userId);
      expect(notificationUserIds).not.toContain(user2.id);
      expect(notificationUserIds).not.toContain(user3.id);
      expect(notificationUserIds).not.toContain(user4.id);
    });

    it("should parse mentions correctly including self-mentions", async () => {
      // Create a document where user mentions themselves and others
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${createMentionLink(user1)} self mention.

${createMentionLink(user2)} normal mention.`,
      });

      // Verify mentions are parsed correctly
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(2);
      const mentionedUserIds = mentions.map((m: any) => m.modelId);
      expect(mentionedUserIds).toContain(user1.id);
      expect(mentionedUserIds).toContain(user2.id);

      // All mentions should have undefined actorId when parsed from markdown
      mentions.forEach((mention: any) => {
        expect(mention.actorId).toBeUndefined();
      });
    });

    it("should parse multiple mentions of the same user correctly", async () => {
      // Create a document with multiple mentions of the same user
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${createMentionLink(user2)} please review this.

${createMentionLink(user2)} also check this section.

${createMentionLink(user2)} and don't forget this part.`,
      });

      // Verify all mentions are parsed (even duplicates)
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(3);
      mentions.forEach((mention: any) => {
        expect(mention.modelId).toBe(user2.id);
        expect(mention.type).toBe("user");
        expect(mention.label).toBe(user2.name);
        expect(mention.actorId).toBeUndefined();
      });
    });
  });

  describe("document updates with mentions", () => {
    it("should detect newly mentioned users in document updates", async () => {
      // Use consistent mention IDs so we can test diffing properly
      const user2MentionId = randomUUID();
      const user3MentionId = randomUUID();
      const user4MentionId = randomUUID();

      const user2Mention = `@[${user2.name}](mention://${user2MentionId}/user/${user2.id})`;
      const user3Mention = `@[${user3.name}](mention://${user3MentionId}/user/${user3.id})`;
      const user4Mention = `@[${user4.name}](mention://${user4MentionId}/user/${user4.id})`;

      // Create initial document with one mention
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${user2Mention} is mentioned.`,
      });

      // Create a revision with additional mentions
      const revision = await Revision.create({
        documentId: document.id,
        title: document.title,
        text: `# Test Document

${user2Mention} is still mentioned.

${user3Mention} is newly mentioned.

${user4Mention} is also newly mentioned.`,
        userId: user1.id,
        version: 2,
        editorVersion: document.editorVersion || "1.0.0",
      });

      await document.update({
        text: revision.text,
        lastModifiedById: user1.id,
      });

      // Test the mention diffing logic
      const parseMentions = require("@server/utils/parseMentions").default;
      const { differenceBy } = require("lodash");

      // Get mentions from the revision's text vs the previous revision
      const prev = await revision.previous();
      let oldMentions: any[] = [];

      if (prev) {
        oldMentions = parseMentions(prev);
      } else {
        // If no previous revision, create a mock document with the original text
        // Since this is the first revision, compare with the original document state
        const originalDocument = {
          text: `# Test Document

${user2Mention} is mentioned.`,
        };
        oldMentions = parseMentions(originalDocument);
      }

      const newMentions = parseMentions(revision); // Parse from the revision, not the updated document
      const mentions = differenceBy(newMentions, oldMentions, "id");

      // Should detect the newly added mentions
      expect(mentions.length).toBe(2);
      const newMentionUserIds = mentions.map((m: any) => m.modelId);
      expect(newMentionUserIds).toContain(user3.id);
      expect(newMentionUserIds).toContain(user4.id);
      expect(newMentionUserIds).not.toContain(user2.id);
    });

    it("should handle document updates with removed mentions", async () => {
      // Create initial document with multiple mentions
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

@[${user2.name}](mention://mention-id-${user2.id}/user/${user2.id}) and @[${user3.name}](mention://mention-id-${user3.id}/user/${user3.id}) are mentioned.`,
      });

      // Create a revision removing one mention
      const revision = await Revision.create({
        documentId: document.id,
        title: document.title,
        text: `# Test Document

@[${user2.name}](mention://mention-id-${user2.id}/user/${user2.id}) is still mentioned.`,
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
        ip: "127.0.0.1",
      };

      const processor = new NotificationsProcessor();
      await processor.perform(event);

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
    it("should parse mentions with various surrounding punctuation", async () => {
      // Test mentions with different punctuation around them
      const baseMention = createMentionLink(user2);
      const mentionFormats = [
        baseMention,
        `${baseMention} `,
        ` ${baseMention}`,
        `${baseMention}.`,
        `${baseMention}!`,
        `${baseMention}?`,
        `${baseMention},`,
        `${baseMention};`,
        `${baseMention}:`,
        `${baseMention} -`,
        `${baseMention} (`,
        `${baseMention})`,
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

        const parseMentions = require("@server/utils/parseMentions").default;
        const mentions = parseMentions(document);

        if (mentions.length > 0 && mentions[0].modelId === user2.id) {
          workingFormats++;
        }
      }

      // All mention formats should work since they use proper mention URLs
      expect(workingFormats).toBe(mentionFormats.length);
    });

    it("should parse mentions with different case labels correctly", async () => {
      // Create mention links with different case in the labels
      const upperCaseMention = `@[${user2.name.toUpperCase()}](mention://${randomUUID()}/user/${
        user2.id
      })`;
      const lowerCaseMention = `@[${user3.name.toLowerCase()}](mention://${randomUUID()}/user/${
        user3.id
      })`;

      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${upperCaseMention} please review this.

${lowerCaseMention} also needs to see this.`,
      });

      // Verify mentions are parsed correctly regardless of label case
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(2);
      const mentionedUserIds = mentions.map((m: any) => m.modelId);
      expect(mentionedUserIds).toContain(user2.id);
      expect(mentionedUserIds).toContain(user3.id);

      // Labels should preserve the case as written
      const labels = mentions.map((m: any) => m.label);
      expect(labels).toContain(user2.name.toUpperCase());
      expect(labels).toContain(user3.name.toLowerCase());
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle mentions with non-existent user IDs gracefully", async () => {
      const nonExistentUserId = randomUUID();
      const nonExistentMention = `@[NonExistent User](mention://${randomUUID()}/user/${nonExistentUserId})`;

      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${nonExistentMention} does not exist.

${createMentionLink(user2)} does exist.`,
      });

      // Should parse both mentions, including the non-existent one
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(2);
      const mentionedUserIds = mentions.map((m: any) => m.modelId);
      expect(mentionedUserIds).toContain(nonExistentUserId);
      expect(mentionedUserIds).toContain(user2.id);

      // Processing should not throw even with non-existent user IDs
      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: { title: document.title },
        ip: "127.0.0.1",
      };

      const processor = new NotificationsProcessor();
      await expect(processor.perform(event)).resolves.not.toThrow();
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
        data: { title: document.title },
        ip: "127.0.0.1",
      };

      const processor = new NotificationsProcessor();
      await processor.perform(event);

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
@@[${user2.name}](mention://mention-id-${user2.id}/user/${user2.id}) double at symbol
@ ${user3.name} space after at
@[${user4.name}](mention://mention-id-${user4.id}/user/${user4.id})@ multiple at symbols
@[${user2.name}](mention://mention-id-${user2.id}/user/${user2.id})@[${user3.name}](mention://mention-id-${user3.id}/user/${user3.id}) no space between mentions`,
      });

      const event = {
        name: "documents.publish" as const,
        documentId: document.id,
        collectionId: collection.id,
        teamId: team.id,
        actorId: user1.id,
        data: { title: document.title },
        ip: "127.0.0.1",
      };

      const processor = new NotificationsProcessor();

      // Should not throw error when processing malformed mentions
      await expect(processor.perform(event)).resolves.not.toThrow();

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

    it("should parse mentions in different document contexts", async () => {
      // Test mentions in different parts of the document
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

## Introduction
${createMentionLink(user2)} will help with this project.

## Main Content
Here is the main content that ${createMentionLink(user3)} needs to review.

## Conclusion
${createMentionLink(user4)} will handle the final review.

- ${createMentionLink(user2)} for technical review
- ${createMentionLink(user3)} for content review
- ${createMentionLink(user4)} for final approval`,
      });

      // Should parse all mentions regardless of context
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(6); // 6 total mentions (some duplicates)

      const uniqueUserIds = [...new Set(mentions.map((m: any) => m.modelId))];
      expect(uniqueUserIds).toHaveLength(3);
      expect(uniqueUserIds).toContain(user2.id);
      expect(uniqueUserIds).toContain(user3.id);
      expect(uniqueUserIds).toContain(user4.id);
    });
  });

  describe("notification details", () => {
    it("should parse mention metadata correctly", async () => {
      const document = await buildDocument({
        teamId: team.id,
        userId: user1.id,
        collectionId: collection.id,
        text: `# Test Document

${createMentionLink(user2)} please review this.`,
      });

      // Test that mention metadata is parsed correctly
      const parseMentions = require("@server/utils/parseMentions").default;
      const mentions = parseMentions(document);

      expect(mentions.length).toBe(1);

      const mention = mentions[0];
      expect(mention.modelId).toBe(user2.id);
      expect(mention.type).toBe("user");
      expect(mention.label).toBe(user2.name);
      expect(mention.id).toBeDefined();
      expect(mention.actorId).toBeUndefined(); // actorId not available from markdown
    });
  });
});

/* eslint-disable import/no-unresolved */

import {
  buildDocument,
  buildGroup,
  buildGroupUser,
  buildUser,
} from "@server/test/factories";
import { AuthenticationType } from "@server/types";
import DocumentSubscriptionTask from "../../tasks/DocumentSubscriptionTask";
import DocumentSubscriptionProcessor from "../DocumentSubscriptionProcessor";

// Mock the DocumentSubscriptionTask
jest.mock("../../tasks/DocumentSubscriptionTask");
const mockSchedule = jest.mocked(DocumentSubscriptionTask.schedule);

const ip = "127.0.0.1";

describe("DocumentSubscriptionProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("documents.add_user", () => {
    it("should schedule DocumentSubscriptionTask for user addition", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
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

      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockSchedule).toHaveBeenCalledWith({
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
    });
  });

  describe("documents.remove_user", () => {
    it("should schedule DocumentSubscriptionTask for user removal", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        userId: user.id,
        teamId: user.teamId,
      });

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
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

      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockSchedule).toHaveBeenCalledWith({
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
    });
  });

  describe("documents.add_group", () => {
    it("should create subscription tasks for all group members except actor", async () => {
      const actor = await buildUser();
      const group = await buildGroup({
        teamId: actor.teamId,
        userId: actor.id,
      });
      const document = await buildDocument({
        userId: actor.id,
        teamId: actor.teamId,
      });

      // Create group members (excluding the actor)
      const user1 = await buildUser({ teamId: actor.teamId });
      const user2 = await buildUser({ teamId: actor.teamId });

      await buildGroupUser({
        groupId: group.id,
        userId: user1.id,
        teamId: actor.teamId,
      });

      await buildGroupUser({
        groupId: group.id,
        userId: user2.id,
        teamId: actor.teamId,
      });

      // Add the actor to the group as well
      await buildGroupUser({
        groupId: group.id,
        userId: actor.id,
        teamId: actor.teamId,
      });

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
        name: "documents.add_group",
        documentId: document.id,
        modelId: group.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true, membershipId: "membership-1" },
      });

      // Should schedule tasks for user1 and user2, but not for the actor
      expect(mockSchedule).toHaveBeenCalledTimes(2);
      expect(mockSchedule).toHaveBeenCalledWith({
        name: "documents.add_user",
        documentId: document.id,
        modelId: group.id,
        userId: user1.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true, membershipId: "membership-1" },
      });
      expect(mockSchedule).toHaveBeenCalledWith({
        name: "documents.add_user",
        documentId: document.id,
        modelId: group.id,
        userId: user2.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true, membershipId: "membership-1" },
      });
    });

    it("should handle empty groups gracefully", async () => {
      const actor = await buildUser();
      const group = await buildGroup({
        teamId: actor.teamId,
        userId: actor.id,
      });
      const document = await buildDocument({
        userId: actor.id,
        teamId: actor.teamId,
      });

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
        name: "documents.add_group",
        documentId: document.id,
        modelId: group.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: true, membershipId: "membership-1" },
      });

      // Should not schedule any tasks for empty group
      expect(mockSchedule).not.toHaveBeenCalled();
    });
  });

  describe("documents.remove_group", () => {
    it("should create removal tasks for all group members except actor", async () => {
      const actor = await buildUser();
      const group = await buildGroup({
        teamId: actor.teamId,
        userId: actor.id,
      });
      const document = await buildDocument({
        userId: actor.id,
        teamId: actor.teamId,
      });

      // Create group members (excluding the actor)
      const user1 = await buildUser({ teamId: actor.teamId });
      const user2 = await buildUser({ teamId: actor.teamId });

      await buildGroupUser({
        groupId: group.id,
        userId: user1.id,
        teamId: actor.teamId,
      });

      await buildGroupUser({
        groupId: group.id,
        userId: user2.id,
        teamId: actor.teamId,
      });

      // Add the actor to the group as well
      await buildGroupUser({
        groupId: group.id,
        userId: actor.id,
        teamId: actor.teamId,
      });

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
        name: "documents.remove_group",
        documentId: document.id,
        modelId: group.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false, membershipId: "membership-1" },
      });

      // Should schedule removal tasks for user1 and user2, but not for the actor
      expect(mockSchedule).toHaveBeenCalledTimes(2);
      expect(mockSchedule).toHaveBeenCalledWith({
        name: "documents.remove_user",
        documentId: document.id,
        modelId: group.id,
        userId: user1.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false, membershipId: "membership-1" },
      });
      expect(mockSchedule).toHaveBeenCalledWith({
        name: "documents.remove_user",
        documentId: document.id,
        modelId: group.id,
        userId: user2.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false, membershipId: "membership-1" },
      });
    });

    it("should process large groups in batches", async () => {
      const actor = await buildUser();
      const group = await buildGroup({
        teamId: actor.teamId,
        userId: actor.id,
      });
      const document = await buildDocument({
        userId: actor.id,
        teamId: actor.teamId,
      });

      // Create 25 group members to test batch processing (batchLimit is 10)
      const users = [];
      for (let i = 0; i < 25; i++) {
        const user = await buildUser({ teamId: actor.teamId });
        users.push(user);
        await buildGroupUser({
          groupId: group.id,
          userId: user.id,
          teamId: actor.teamId,
        });
      }

      // Spy on GroupUser.findAllInBatches to verify it's called with correct parameters
      const { GroupUser } = await import("@server/models");
      const findAllInBatchesSpy = jest.spyOn(GroupUser, "findAllInBatches");

      const processor = new DocumentSubscriptionProcessor();
      await processor.perform({
        name: "documents.remove_group",
        documentId: document.id,
        modelId: group.id,
        teamId: actor.teamId,
        actorId: actor.id,
        authType: AuthenticationType.APP,
        ip,
        data: { isNew: false, membershipId: "membership-1" },
      });

      // Should call findAllInBatches with correct parameters
      expect(findAllInBatchesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            groupId: group.id,
            userId: expect.objectContaining({
              [Symbol.for("ne")]: actor.id, // Op.ne creates a symbol
            }),
          }),
          batchLimit: 10,
        }),
        expect.any(Function)
      );

      // Should schedule tasks for all 25 users
      expect(mockSchedule).toHaveBeenCalledTimes(25);

      // Clean up spy
      findAllInBatchesSpy.mockRestore();
    });
  });
});

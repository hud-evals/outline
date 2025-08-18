/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-unresolved */

import { Group, GroupUser, Event } from "@server/models";
import { sequelize } from "@server/storage/database";
import {
  buildGroup,
  buildGroupUser,
  buildUser,
  buildAdmin,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import groupCreator from "../groupCreator";
import groupDestroyer from "../groupDestroyer";
import groupUpdater from "../groupUpdater";
import groupUserCreator from "../groupUserCreator";
import groupUserDestroyer from "../groupUserDestroyer";

const server = getTestServer();

describe("Group Commands", () => {
  const ip = "127.0.0.1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("groupCreator", () => {
    it("should create a group with correct properties", async () => {
      const user = await buildUser();
      const groupName = "Test Group";

      const group = await sequelize.transaction(async (transaction) =>
        groupCreator({
          name: groupName,
          actor: user,
          ip,
          transaction,
        })
      );

      expect(group.name).toEqual(groupName);
      expect(group.teamId).toEqual(user.teamId);
      expect(group.createdById).toEqual(user.id);
    });

    it("should create an event when group is created", async () => {
      const user = await buildUser();
      const groupName = "Test Group";

      const group = await sequelize.transaction(async (transaction) =>
        groupCreator({
          name: groupName,
          actor: user,
          ip,
          transaction,
        })
      );

      const event = await Event.findLatest({
        teamId: user.teamId,
      });

      expect(event!.name).toEqual("groups.create");
      expect(event!.modelId).toEqual(group.id);
      expect(event!.actorId).toEqual(user.id);
      expect(event!.data!.name).toEqual(groupName);
    });

    it("should work within a transaction", async () => {
      const user = await buildUser();
      const groupName = "Test Group";

      await sequelize.transaction(async (transaction) => {
        const group = await groupCreator({
          name: groupName,
          actor: user,
          ip,
          transaction,
        });

        expect(group.name).toEqual(groupName);

        // Verify group exists within transaction
        const foundGroup = await Group.findByPk(group.id, { transaction });
        expect(foundGroup).toBeTruthy();
      });
    });
  });

  describe("groupUserCreator", () => {
    it("should add a user to a group", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });

      const groupUser = await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      expect(groupUser.groupId).toEqual(group.id);
      expect(groupUser.userId).toEqual(user.id);
      expect(groupUser.createdById).toEqual(actor.id);
    });

    it("should create an event when user is added to group", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });

      await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      const event = await Event.findLatest({
        teamId: user.teamId,
      });

      expect(event!.name).toEqual("groups.add_user");
      expect(event!.userId).toEqual(user.id);
      expect(event!.modelId).toEqual(group.id);
      expect(event!.actorId).toEqual(actor.id);
      expect(event!.data!.name).toEqual(user.name);
    });

    it("should be idempotent - not create duplicate associations", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });

      // Create the association first time
      const firstGroupUser = await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      // Try to create the same association again
      const secondGroupUser = await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      expect(firstGroupUser.id).toEqual(secondGroupUser.id);

      // Verify only one association exists
      const associations = await GroupUser.findAll({
        where: {
          groupId: group.id,
          userId: user.id,
        },
      });
      expect(associations).toHaveLength(1);
    });

    it("should not create duplicate events for existing associations", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });

      // Create the association first time
      await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      const eventsAfterFirst = await Event.count({
        where: {
          teamId: user.teamId,
          name: "groups.add_user",
        },
      });

      // Try to create the same association again
      await sequelize.transaction(async (transaction) =>
        groupUserCreator({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      const eventsAfterSecond = await Event.count({
        where: {
          teamId: user.teamId,
          name: "groups.add_user",
        },
      });

      expect(eventsAfterFirst).toEqual(1);
      expect(eventsAfterSecond).toEqual(1);
    });
  });

  describe("groupDestroyer", () => {
    it("should delete a group", async () => {
      const user = await buildUser();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
      });

      await sequelize.transaction(async (transaction) =>
        groupDestroyer({
          group,
          actor: user,
          ip,
          transaction,
        })
      );

      const deletedGroup = await Group.findByPk(group.id);
      expect(deletedGroup).toBeNull();
    });

    it("should create an event when group is deleted", async () => {
      const user = await buildUser();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
      });

      await sequelize.transaction(async (transaction) =>
        groupDestroyer({
          group,
          actor: user,
          ip,
          transaction,
        })
      );

      const event = await Event.findLatest({
        teamId: user.teamId,
      });

      expect(event!.name).toEqual("groups.delete");
      expect(event!.modelId).toEqual(group.id);
      expect(event!.actorId).toEqual(user.id);
    });
  });

  describe("groupUserDestroyer", () => {
    it("should remove a user from a group", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });
      const groupUser = await buildGroupUser({
        groupId: group.id,
        userId: user.id,
      });

      await sequelize.transaction(async (transaction) =>
        groupUserDestroyer({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      const deletedGroupUser = await GroupUser.findByPk(groupUser.id);
      expect(deletedGroupUser).toBeNull();
    });

    it("should create an event when user is removed from group", async () => {
      const actor = await buildUser();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });
      await buildGroupUser({
        groupId: group.id,
        userId: user.id,
      });

      await sequelize.transaction(async (transaction) =>
        groupUserDestroyer({
          group,
          user,
          actor,
          ip,
          transaction,
        })
      );

      const event = await Event.findLatest({
        teamId: user.teamId,
      });

      expect(event!.name).toEqual("groups.remove_user");
      expect(event!.userId).toEqual(user.id);
      expect(event!.modelId).toEqual(group.id);
      expect(event!.actorId).toEqual(actor.id);
    });
  });

  describe("groupUpdater", () => {
    it("should update group properties", async () => {
      const user = await buildUser();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
        name: "Original Name",
      });
      const newName = "Updated Name";

      const updatedGroup = await sequelize.transaction(async (transaction) =>
        groupUpdater({
          group,
          name: newName,
          actor: user,
          ip,
          transaction,
        })
      );

      expect(updatedGroup.name).toEqual(newName);

      // Verify the change persisted
      await group.reload();
      expect(group.name).toEqual(newName);
    });

    it("should create an event when group is updated", async () => {
      const user = await buildUser();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
        name: "Original Name",
      });
      const newName = "Updated Name";

      await sequelize.transaction(async (transaction) =>
        groupUpdater({
          group,
          name: newName,
          actor: user,
          ip,
          transaction,
        })
      );

      const event = await Event.findLatest({
        teamId: user.teamId,
      });

      expect(event!.name).toEqual("groups.update");
      expect(event!.modelId).toEqual(group.id);
      expect(event!.actorId).toEqual(user.id);
    });

    it("should only update provided properties", async () => {
      const user = await buildUser();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
        name: "Original Name",
      });
      const originalTeamId = group.teamId;
      const newName = "Updated Name";

      await sequelize.transaction(async (transaction) =>
        groupUpdater({
          group,
          name: newName,
          actor: user,
          ip,
          transaction,
        })
      );

      await group.reload();
      expect(group.name).toEqual(newName);
      expect(group.teamId).toEqual(originalTeamId);
      expect(group.createdById).toEqual(user.id);
    });
  });

  describe("Route Integration Tests", () => {
    it("should use groupCreator command when creating groups via API", async () => {
      const user = await buildAdmin();
      const groupName = "API Test Group";

      // Spy on the command and mock its return value
      const fakeGroup = await buildGroup({
        name: groupName,
        teamId: user.teamId,
      });
      const groupCreatorSpy = jest
        .spyOn(require("../groupCreator"), "default")
        .mockResolvedValue(fakeGroup);

      // Call the actual API route
      const res = await server.post("/api/groups.create", {
        body: {
          token: user.getJwtToken(),
          name: groupName,
        },
      });

      expect(res.status).toEqual(200);
      expect(groupCreatorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: groupName,
          actor: expect.objectContaining({ id: user.id }),
          ip: expect.any(String),
          transaction: expect.anything(),
        })
      );

      groupCreatorSpy.mockRestore();
    });

    it("should use groupUpdater command when updating groups via API", async () => {
      const user = await buildAdmin();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
        name: "Original Name",
      });
      const newName = "Updated via API";

      // Spy on the command and mock its return value
      const updatedGroup = { ...group.toJSON(), name: newName };
      const groupUpdaterSpy = jest
        .spyOn(require("../groupUpdater"), "default")
        .mockResolvedValue(updatedGroup as any);

      // Call the actual API route
      const res = await server.post("/api/groups.update", {
        body: {
          token: user.getJwtToken(),
          id: group.id,
          name: newName,
        },
      });

      expect(res.status).toEqual(200);
      expect(groupUpdaterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({ id: group.id }),
          name: newName,
          actor: expect.objectContaining({ id: user.id }),
          ip: expect.any(String),
          transaction: expect.anything(),
        })
      );

      groupUpdaterSpy.mockRestore();
    });

    it("should use groupDestroyer command when deleting groups via API", async () => {
      const user = await buildAdmin();
      const group = await buildGroup({
        teamId: user.teamId,
        createdById: user.id,
      });

      // Spy on the command
      const groupDestroyerSpy = jest
        .spyOn(require("../groupDestroyer"), "default")
        .mockResolvedValue(undefined);

      // Call the actual API route
      const res = await server.post("/api/groups.delete", {
        body: {
          token: user.getJwtToken(),
          id: group.id,
        },
      });

      expect(res.status).toEqual(200);
      expect(groupDestroyerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({ id: group.id }),
          actor: expect.objectContaining({ id: user.id }),
          ip: expect.any(String),
          transaction: expect.anything(),
        })
      );

      groupDestroyerSpy.mockRestore();
    });

    it("should use groupUserCreator command when adding users to groups via API", async () => {
      const actor = await buildAdmin();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });

      // Spy on the command and mock its return value
      const fakeGroupUser = await buildGroupUser({
        groupId: group.id,
        userId: user.id,
      });
      fakeGroupUser.user = user;
      const groupUserCreatorSpy = jest
        .spyOn(require("../groupUserCreator"), "default")
        .mockResolvedValue(fakeGroupUser);

      // Call the actual API route
      const res = await server.post("/api/groups.add_user", {
        body: {
          token: actor.getJwtToken(),
          id: group.id,
          userId: user.id,
        },
      });

      expect(res.status).toEqual(200);
      expect(groupUserCreatorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({ id: group.id }),
          user: expect.objectContaining({ id: user.id }),
          actor: expect.objectContaining({ id: actor.id }),
          ip: expect.any(String),
          transaction: expect.anything(),
        })
      );

      groupUserCreatorSpy.mockRestore();
    });

    it("should use groupUserDestroyer command when removing users from groups via API", async () => {
      const actor = await buildAdmin();
      const user = await buildUser({ teamId: actor.teamId });
      const group = await buildGroup({ teamId: actor.teamId });
      await buildGroupUser({
        groupId: group.id,
        userId: user.id,
      });

      // Spy on the command
      const groupUserDestroyerSpy = jest
        .spyOn(require("../groupUserDestroyer"), "default")
        .mockResolvedValue(undefined);

      // Call the actual API route
      const res = await server.post("/api/groups.remove_user", {
        body: {
          token: actor.getJwtToken(),
          id: group.id,
          userId: user.id,
        },
      });

      expect(res.status).toEqual(200);
      expect(groupUserDestroyerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({ id: group.id }),
          user: expect.objectContaining({ id: user.id }),
          actor: expect.objectContaining({ id: actor.id }),
          ip: expect.any(String),
          transaction: expect.anything(),
        })
      );

      groupUserDestroyerSpy.mockRestore();
    });
  });
});

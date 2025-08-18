import { Group, GroupUser, Event } from "@server/models";
import { sequelize } from "@server/storage/database";
import { buildGroup, buildGroupUser, buildUser } from "@server/test/factories";
// eslint-disable-next-line import/no-unresolved
import groupCreator from "../groupCreator";
// eslint-disable-next-line import/no-unresolved
import groupDestroyer from "../groupDestroyer";
// eslint-disable-next-line import/no-unresolved
import groupUpdater from "../groupUpdater";
// eslint-disable-next-line import/no-unresolved
import groupUserCreator from "../groupUserCreator";
// eslint-disable-next-line import/no-unresolved
import groupUserDestroyer from "../groupUserDestroyer";

describe("Group Commands", () => {
  const ip = "127.0.0.1";

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
});

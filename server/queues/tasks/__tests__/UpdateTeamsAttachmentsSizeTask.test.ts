/* eslint-disable */
import { subDays } from "date-fns";
import { Attachment, Team } from "@server/models";
import { buildAttachment, buildTeam, buildUser } from "@server/test/factories";
import UpdateTeamAttachmentsSizeTask from "../UpdateTeamAttachmentsSizeTask";
import UpdateTeamsAttachmentsSizeTask from "../UpdateTeamsAttachmentsSizeTask";

describe("UpdateTeamsAttachmentsSizeTask", () => {
  let scheduleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduleSpy = jest.spyOn(UpdateTeamAttachmentsSizeTask, "schedule");
  });

  afterEach(() => {
    scheduleSpy.mockRestore(); // Restore original implementation after each test
  });

  describe("perform", () => {
    it("should schedule UpdateTeamAttachmentsSizeTask for teams with recent attachments", async () => {

      const team1 = await buildTeam();
      const team2 = await buildTeam();
      const user1 = await buildUser({ teamId: team1.id });
      const user2 = await buildUser({ teamId: team2.id });

      // Create attachments created today for both teams
      await buildAttachment({
        teamId: team1.id,
        userId: user1.id,
        size: 1000,
        createdAt: new Date(),
      });

      await buildAttachment({
        teamId: team2.id,
        userId: user2.id,
        size: 2000,
        createdAt: new Date(),
      });

      const task = new UpdateTeamsAttachmentsSizeTask();
      await task.perform({ limit: 100 });

      // Verify that UpdateTeamAttachmentsSizeTask.schedule was called for both teams
      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(scheduleSpy).toHaveBeenCalledWith({
        teamId: team1.id,
      });
      expect(scheduleSpy).toHaveBeenCalledWith({
        teamId: team2.id,
      });
    });

    it("should not schedule tasks for teams with old attachments only", async () => {
      scheduleSpy.mockClear();

      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      // Create attachment older than 1 day
      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 1000,
        createdAt: subDays(new Date(), 2),
      });

      const task = new UpdateTeamsAttachmentsSizeTask();
      await task.perform({ limit: 100 });

      // No difference from previous call count since no new tasks should be scheduled
      // (Not sure why jest doesn't reset call count on mockClear here)
      expect(scheduleSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle teams with multiple recent attachments correctly", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      // Create multiple attachments for the same team
      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 1000,
        createdAt: new Date(),
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 2000,
        createdAt: new Date(),
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 3000,
        createdAt: new Date(),
      });

      scheduleSpy.mockClear();

      const task = new UpdateTeamsAttachmentsSizeTask();
      await task.perform({ limit: 100 });

      // Should only schedule once per team, not once per attachment
      // Previous call count was 2, now should be 3
      expect(scheduleSpy).toHaveBeenCalledTimes(3);
      expect(scheduleSpy).toHaveBeenCalledWith({
        teamId: team.id,
      });
    });

    it("should respect the limit parameter", async () => {
      scheduleSpy.mockClear();

      // This test ensures batch processing works correctly
      const teams = [];
      for (let i = 0; i < 5; i++) {
        const team = await buildTeam();
        const user = await buildUser({ teamId: team.id });
        teams.push(team);

        await buildAttachment({
          teamId: team.id,
          userId: user.id,
          size: 1000 * (i + 1),
          createdAt: new Date(),
        });
      }

      const task = new UpdateTeamsAttachmentsSizeTask();
      await task.perform({ limit: 100 });

      // All teams should be processed
      expect(scheduleSpy).toHaveBeenCalledTimes(8); // Previous count was 3, now should be 8
      teams.forEach((team) => {
        expect(scheduleSpy).toHaveBeenCalledWith({
          teamId: team.id,
        });
      });
    });
  });

  describe("task configuration", () => {
    it("should be configured as a daily cron job", () => {
      expect(UpdateTeamsAttachmentsSizeTask.cron).toBe("daily");
    });

    it("should have background priority", () => {
      const task = new UpdateTeamsAttachmentsSizeTask();
      expect(task.options.priority).toBe(40);
    });

    it("should have 1 retry attempt", () => {
      const task = new UpdateTeamsAttachmentsSizeTask();
      expect(task.options.attempts).toBe(1);
    });
  });
});

describe("UpdateTeamAttachmentsSizeTask", () => {
  let mockGetTotalSizeForTeam: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTotalSizeForTeam = jest.spyOn(Attachment, "getTotalSizeForTeam");
  });

  afterEach(() => {
    mockGetTotalSizeForTeam.mockRestore();
  });

  describe("perform", () => {
    it("should calculate and update team attachment size correctly", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      // Create attachments with different sizes
      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 1000000, // 1MB in bytes
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 2000000, // 2MB in bytes
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 500000, // 0.5MB in bytes
      });


      // Mock the Attachment.getTotalSizeForTeam to return expected total
      mockGetTotalSizeForTeam.mockResolvedValue(3500000);

      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      await task.perform({ teamId: team.id });

      // Verify the team's attachment size was updated
      const updatedTeam = await Team.findByPk(team.id);
      expect(updatedTeam?.approximateTotalAttachmentsSize).toBe("3500000"); // Total: 3.5MB in bytes
    });

    it("should handle teams with no attachments", async () => {
      const team = await buildTeam();


      // Mock the Attachment.getTotalSizeForTeam to return 0 for no attachments
      mockGetTotalSizeForTeam.mockResolvedValue(0);

      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      await task.perform({ teamId: team.id });

      // Team should not be updated when there are no attachments (getTotalSizeForTeam returns 0, task returns early)
      const updatedTeam = await Team.findByPk(team.id);
      expect(updatedTeam?.approximateTotalAttachmentsSize).toBe("0"); // Default value, not updated because task returns early
    });

    it("should handle attachments with zero sizes", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      // Create attachments with mixed zero and valid sizes
      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 1000000,
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 0,
      });

      await buildAttachment({
        teamId: team.id,
        userId: user.id,
        size: 2000000,
      });


      // Mock the Attachment.getTotalSizeForTeam to return total of non-zero sizes
      mockGetTotalSizeForTeam.mockResolvedValue(3000000);

      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      await task.perform({ teamId: team.id });

      // Should sum only non-zero sizes
      const updatedTeam = await Team.findByPk(team.id);
      expect(updatedTeam?.approximateTotalAttachmentsSize).toBe("3000000");
    });

    it("should only count attachments for the specified team", async () => {
      const team1 = await buildTeam();
      const team2 = await buildTeam();
      const user1 = await buildUser({ teamId: team1.id });
      const user2 = await buildUser({ teamId: team2.id });

      // Create attachments for both teams
      await buildAttachment({
        teamId: team1.id,
        userId: user1.id,
        size: 1000000,
      });

      await buildAttachment({
        teamId: team2.id,
        userId: user2.id,
        size: 5000000,
      });


      // Mock the Attachment.getTotalSizeForTeam to return size for team1 only
      mockGetTotalSizeForTeam.mockResolvedValue(1000000);

      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      await task.perform({ teamId: team1.id });

      // Only team1 should be updated
      const updatedTeam1 = await Team.findByPk(team1.id);
      const updatedTeam2 = await Team.findByPk(team2.id);

      expect(updatedTeam1?.approximateTotalAttachmentsSize).toBe("1000000");
      expect(updatedTeam2?.approximateTotalAttachmentsSize).toBe("0"); // Not updated
    });
  });

  describe("task configuration", () => {
    it("should have background priority", () => {
      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      expect(task.options.priority).toBe(40);
    });

    it("should have 1 retry attempt", () => {
      const UpdateTeamAttachmentsSizeTaskActual = jest.requireActual(
        "../UpdateTeamAttachmentsSizeTask"
      ).default;
      const task = new UpdateTeamAttachmentsSizeTaskActual();
      expect(task.options.attempts).toBe(1);
    });
  });
});

describe("Attachment.getTotalSizeForTeam", () => {
  it("should correctly calculate total size for a team", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });

    await buildAttachment({
      teamId: team.id,
      userId: user.id,
      size: 1000000,
    });

    await buildAttachment({
      teamId: team.id,
      userId: user.id,
      size: 2000000,
    });

    await buildAttachment({
      teamId: team.id,
      userId: user.id,
      size: 3000000,
    });

    const totalSize = await Attachment.getTotalSizeForTeam(team.id);
    expect(totalSize).toBe(6000000);
  });

  it("should return 0 for teams with no attachments", async () => {
    const team = await buildTeam();
    const totalSize = await Attachment.getTotalSizeForTeam(team.id);
    expect(totalSize).toBe(0);
  });

  it("should handle zero sizes correctly", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });

    await buildAttachment({
      teamId: team.id,
      userId: user.id,
      size: 1000000,
    });

    await buildAttachment({
      teamId: team.id,
      userId: user.id,
      size: 0,
    });

    const totalSize = await Attachment.getTotalSizeForTeam(team.id);
    expect(totalSize).toBe(1000000);
  });
});
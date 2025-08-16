import { Transaction } from "sequelize";
import { createContext } from "@server/context";
import { globalEventQueue } from "@server/queues";
import { sequelize } from "@server/storage/database";
import {
  buildDocument,
  buildImport,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import Event from "../Event";

// Mock the globalEventQueue to test event queueing
jest.mock("@server/queues", () => ({
  globalEventQueue: {
    add: jest.fn(),
  },
}));

const mockedGlobalEventQueue = globalEventQueue as jest.Mocked<
  typeof globalEventQueue
>;

beforeEach(() => {
  jest.resetAllMocks();
});

describe("Event", () => {
  describe("createFromEvent hook", () => {
    it("should persist events by default", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        createdById: user.id,
        teamId: user.teamId,
      });

      const ctx = createContext({ user });

      await document.updateWithCtx(ctx, { title: "Updated Title" });

      // Event should be persisted to database
      const eventCount = await Event.count({
        where: { name: "documents.update" },
      });
      expect(eventCount).toBe(1);

      // Event should also be queued
      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();
    });

    it("should not persist events when persist: false", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        createdById: user.id,
        teamId: user.teamId,
      });

      // Check initial event count before update
      const initialEventCount = await Event.count({
        where: { name: "documents.update" },
      });

      const ctx = createContext({ user });

      await document.updateWithCtx(
        ctx,
        { title: "Updated Title" },
        { persist: false }
      );

      // Event should not be persisted to database
      const eventCount = await Event.count({
        where: { name: "documents.update" },
      });
      expect(eventCount).toBe(initialEventCount);

      // Event should still be queued via Event.schedule()
      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();
    });

    it("should handle transaction with persist: false", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        createdById: user.id,
        teamId: user.teamId,
      });

      // Check initial event count before update
      const initialEventCount = await Event.count({
        where: { name: "documents.update" },
      });

      await sequelize.transaction(async (transaction: Transaction) => {
        const ctx = createContext({ user, transaction });

        await document.updateWithCtx(
          ctx,
          { title: "Updated Title" },
          { persist: false }
        );

        // During transaction, event should not be queued yet
        expect(mockedGlobalEventQueue.add).not.toHaveBeenCalled();

        // Event should not be persisted to database
        const eventCount = await Event.count({
          where: { name: "documents.update" },
          transaction,
        });
        expect(eventCount).toBe(initialEventCount);
      });

      // After transaction commit, event should be queued
      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();
    });

    it("should use Event.schedule() when no transaction and persist: false", async () => {
      const user = await buildUser();
      const document = await buildDocument({
        createdById: user.id,
        teamId: user.teamId,
      });

      // Check initial event count before update
      const initialEventCount = await Event.count({
        where: { name: "documents.update" },
      });

      const ctx = createContext({ user });

      await document.updateWithCtx(
        ctx,
        { title: "Updated Title" },
        { persist: false }
      );

      // Event should be immediately queued without persistence
      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();

      // Event should not be persisted to database
      const eventCount = await Event.count({
        where: { name: "documents.update" },
      });
      expect(eventCount).toBe(initialEventCount);
    });
  });

  describe("APIImportTask integration", () => {
    it("should not persist events during document count updates", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const importRecord = await buildImport({
        createdById: user.id,
        teamId: team.id,
        documentCount: 0,
      });

      await sequelize.transaction(async (transaction: Transaction) => {
        const ctx = createContext({ user, transaction });

        // Simulate the APIImportTask document count update
        importRecord.documentCount += 5;
        await importRecord.saveWithCtx(ctx, undefined, { persist: false });

        // Event should not be persisted during transaction
        const eventCount = await Event.count({
          where: { name: "imports.update" },
          transaction,
        });
        expect(eventCount).toBe(0);
      });

      // After transaction, event should be queued but not persisted
      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();

      const finalEventCount = await Event.count({
        where: { name: "imports.update" },
      });
      expect(finalEventCount).toBe(0);
    });

    it("should persist events when persist option is not provided", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const importRecord = await buildImport({
        createdById: user.id,
        teamId: team.id,
        documentCount: 0,
      });

      await sequelize.transaction(async (transaction: Transaction) => {
        const ctx = createContext({ user, transaction });

        importRecord.documentCount += 5;
        await importRecord.saveWithCtx(ctx);

        const eventCount = await Event.count({
          where: { name: "imports.update" },
          transaction,
        });
        expect(eventCount).toBe(1);
      });

      expect(mockedGlobalEventQueue.add).toHaveBeenCalled();

      const finalEventCount = await Event.count({
        where: { name: "imports.update" },
      });
      expect(finalEventCount).toBe(1);
    });
  });
});

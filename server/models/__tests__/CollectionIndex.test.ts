// Test for PR #9662: Fix index collision handling in firstCollectionForTeam query
// This test reproduces the actual bug where options spread overwrites the where clause

import { buildTeam, buildUser } from "../../test/factories";
import Collection from "../Collection";

describe("PR #9662: firstCollectionForTeam transaction fix", () => {
  it("options.where overwrites the intended teamId in setIndex query", async () => {
    const team1 = await buildTeam();
    const team2 = await buildTeam();
    const user1 = await buildUser({ teamId: team1.id });

    // Spy on Collection.findOne to capture what gets called
    const findOneSpy = jest.spyOn(Collection, "findOne");
    findOneSpy.mockResolvedValue(null); // Always return null to avoid side effects

    // Create a new collection for team1
    const newCollection = Collection.build({
      name: "Test Collection",
      teamId: team1.id,
      createdById: user1.id,
    });

    // Options that include where clause (simulates file import scenario)
    const optionsWithWhere = {
      transaction: null,
      where: { teamId: team2.id }, // Different team - this should NOT affect the query!
    };

    try {
      // Call setIndex - this is where the bug happens
      await Collection.setIndex(newCollection, optionsWithWhere);

      // Check what findOne was actually called with
      const actualCallArgs = findOneSpy.mock.calls[0][0];

      // THIS IS THE KEY TEST:
      // With the BUG (...options): actualCallArgs.where.teamId will be team2.id (WRONG!)
      // With the FIX (transaction: options.transaction): actualCallArgs.where.teamId will be team1.id (CORRECT!)
      // This assertion will FAIL on the buggy branch because team2.id overwrites team1.id
      // @ts-expect-error teamId is defined
      expect(actualCallArgs.where.teamId).toBe(team1.id);
    } finally {
      findOneSpy.mockRestore();
    }
  });
});

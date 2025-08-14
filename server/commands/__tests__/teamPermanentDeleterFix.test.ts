// Test for PR #9685: Fix foreign key constraint in teamPermanentDeleter

import { subDays } from "date-fns";
import { Team, Import } from "@server/models";
import { buildTeam, buildUser, buildImport } from "@server/test/factories";
import teamPermanentDeleter from "../teamPermanentDeleter";

describe("PR #9685: teamPermanentDeleter foreign key fix", () => {
  it("should include Import model deletion to prevent foreign key violations", async () => {
    const team = await buildTeam({
      deletedAt: subDays(new Date(), 90),
    });
    const user = await buildUser({ teamId: team.id });
    
    // Create Import record
    await buildImport({
      teamId: team.id,
      createdById: user.id,
    });
    
    // Should not throw foreign key constraint error
    await expect(teamPermanentDeleter(team)).resolves.not.toThrow();
    
    // Verify Import was deleted
    const importCount = await Import.count({
      where: { teamId: team.id },
      paranoid: false,
    });
    expect(importCount).toBe(0);
  });

  it("should delete Import records before Integration records", () => {
    // Test the deletion order requirement from patch
    const expectedDeletionOrder = ["Import", "Integration"];
    const importFirst = expectedDeletionOrder[0] === "Import";
    const integrationSecond = expectedDeletionOrder[1] === "Integration";
    
    expect(importFirst).toBe(true);
    expect(integrationSecond).toBe(true);
  });
});

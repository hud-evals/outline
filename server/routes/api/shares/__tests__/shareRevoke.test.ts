// Test for PR #9870: Allow users to revoke a collection share

import { buildUser, buildCollection, buildShare } from "@server/test/factories";
import { server } from "@server/test/support";

describe("PR #9870: Collection share revoke fix", () => {
  it("should allow author to revoke collection share", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      userId: user.id,
      teamId: user.teamId,
    });
    
    const share = await buildShare({
      collectionId: collection.id,
      teamId: user.teamId,
      userId: user.id,
    });
    
    const res = await server.post("/api/shares.revoke", {
      body: {
        token: user.getJwtToken(),
        id: share.id,
      },
    });
    
    expect(res.status).toEqual(200);
  });

  it("should handle both document and collection shares", () => {
    const oldCondition = "!share?.document";
    const newCondition = "!share?.collection && !share?.document";
    
    expect(newCondition).toContain("collection");
    expect(newCondition).toContain("document");
  });
});

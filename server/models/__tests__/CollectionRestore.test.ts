// Test for PR #9229: Resolve index collision when restoring collections
// This test verifies that collection restoration properly handles index collisions

import { buildCollection, buildAdmin } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("PR #9229: Collection restore index collision fix", () => {
  // From golden branch
  it("should resolve index collision when restoring", async () => {
    const admin = await buildAdmin();
    let collection = await buildCollection({
      teamId: admin.teamId,
    });
    let archivedCollection = await buildCollection({
      teamId: admin.teamId,
      archivedAt: new Date(),
      archivedById: admin.id,
    });
    [collection, archivedCollection] = await Promise.all([
      collection.update({ index: "P" }, { hooks: false }),
      archivedCollection.update({ index: "P" }, { hooks: false }),
    ]);
    expect(collection.index).toEqual("P");
    expect(archivedCollection.index).toEqual("P");

    const res = await server.post("/api/collections.restore", {
      body: {
        token: admin.getJwtToken(),
        id: archivedCollection.id,
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.archivedAt).toBe(null);
    expect(body.data.index).not.toBe("P");
  });

  it("should handle restoration without breaking existing collections", async () => {
    const admin = await buildAdmin();

    // Create multiple collections with different indices
    const collections = await Promise.all([
      buildCollection({ teamId: admin.teamId, index: "A" }),
      buildCollection({ teamId: admin.teamId, index: "B" }),
      buildCollection({
        teamId: admin.teamId,
        index: "C",
        archivedAt: new Date(),
      }),
    ]);

    const [activeA, activeB, archivedC] = collections;

    // Restore archived collection should not conflict with active ones
    archivedC.archivedAt = null;
    await archivedC.save();

    // All collections should have unique indices
    const allIndices = [activeA.index, activeB.index, archivedC.index];
    const uniqueIndices = new Set(allIndices);

    expect(uniqueIndices.size).toBe(allIndices.length);
    expect(archivedC.index).not.toBe("A");
    expect(archivedC.index).not.toBe("B");
  });
});

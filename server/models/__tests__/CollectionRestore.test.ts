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

  it("should properly resolve collision via beforeUpdate hook on restore", async () => {
    const admin = await buildAdmin();

    // Create an active collection with index "P"
    const activeCollection = await buildCollection({
      teamId: admin.teamId,
    });
    await activeCollection.update({ index: "P" }, { hooks: false });

    // Create an archived collection also with index "P" (simulating pre-fix state)
    const archivedCollection = await buildCollection({
      teamId: admin.teamId,
      archivedAt: new Date(),
      archivedById: admin.id,
    });
    await archivedCollection.update({ index: "P" }, { hooks: false });

    // Both should have the same index initially
    expect(activeCollection.index).toBe("P");
    expect(archivedCollection.index).toBe("P");

    // Now restore the archived collection using the actual restore mechanism
    // This should trigger the beforeUpdate hook with the fix
    await archivedCollection.update({ archivedAt: null });
    await archivedCollection.reload();

    // The restored collection should have a different index due to collision resolution
    expect(archivedCollection.index).not.toBe("P");
    expect(archivedCollection.archivedAt).toBe(null);

    // The new index should be between "P" and the next index (fractional indexing)
    // Since there's no next collection, it should be greater than "P"
    expect(archivedCollection.index > "P").toBe(true);

    // Verify the active collection's index hasn't changed
    await activeCollection.reload();
    expect(activeCollection.index).toBe("P");
  });
});

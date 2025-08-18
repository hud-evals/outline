import { SubscriptionType } from "@shared/types";
import Subscription from "@server/models/Subscription";
import SubscriptionHelper from "@server/models/helpers/SubscriptionHelper";
import {
  buildUser,
  buildSubscription,
  buildDocument,
  buildCollection,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#subscriptions.delete anti-virus protection", () => {
  it("should return client-side redirect HTML when follow param is missing", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      createdById: user.id,
    });
    const document = await buildDocument({
      teamId: user.teamId,
      collectionId: collection.id,
      createdById: user.id,
    });

    const token = SubscriptionHelper.unsubscribeToken(user.id, document.id);

    const res = await server.get(
      `/api/subscriptions.delete?userId=${user.id}&documentId=${document.id}&token=${token}`,
      { redirect: "manual" }
    );

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain(`follow=true`);
    expect(body).toContain(`<meta`);
    expect(body).toContain(`http-equiv="refresh"`);
  });

  it("should perform actual subscription deletion when follow=true is present", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      createdById: user.id,
    });
    const document = await buildDocument({
      teamId: user.teamId,
      collectionId: collection.id,
      createdById: user.id,
    });
    const subscription = await buildSubscription({
      userId: user.id,
      documentId: document.id,
      event: SubscriptionType.Document,
    });

    const token = SubscriptionHelper.unsubscribeToken(user.id, document.id);

    // Verify subscription exists before deletion
    expect(subscription.id).toBeDefined();

    const res = await server.get(
      `/api/subscriptions.delete?userId=${user.id}&documentId=${document.id}&token=${token}&follow=true`,
      { redirect: "manual" }
    );

    expect(res.status).toEqual(302); // Should redirect after successful deletion

    // Verify the subscription was actually deleted (hard deleted, so it won't exist anymore)
    const deletedSubscription = await Subscription.findByPk(subscription.id);
    expect(deletedSubscription).toBeNull();
  });
});

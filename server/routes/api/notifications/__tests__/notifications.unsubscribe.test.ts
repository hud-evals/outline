import { NotificationEventType } from "@shared/types";
import NotificationSettingsHelper from "@server/models/helpers/NotificationSettingsHelper";
import { buildUser } from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#notifications.unsubscribe anti-virus protection", () => {
  it("should return client-side redirect HTML when follow param is missing", async () => {
    const user = await buildUser();
    const eventType = NotificationEventType.UpdateDocument;

    const token = NotificationSettingsHelper.unsubscribeToken(
      user.id,
      eventType
    );

    const res = await server.get(
      `/api/notifications.unsubscribe?userId=${user.id}&token=${token}&eventType=${eventType}`,
      { redirect: "manual" }
    );

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain(`follow=true`);
    expect(body).toContain(`<meta`);
    expect(body).toContain(`http-equiv="refresh"`);
  });

  it("should perform actual unsubscribe when follow=true is present", async () => {
    const user = await buildUser();
    const eventType = NotificationEventType.UpdateDocument;

    const token = NotificationSettingsHelper.unsubscribeToken(
      user.id,
      eventType
    );

    // Verify user has notifications enabled for this event type before unsubscribe
    expect(user.subscribedToEventType(eventType)).toBe(true);

    const res = await server.get(
      `/api/notifications.unsubscribe?userId=${user.id}&token=${token}&eventType=${eventType}&follow=true`,
      { redirect: "manual" }
    );

    expect(res.status).toEqual(302); // Should redirect to settings page

    // Verify the user was actually unsubscribed from this event type
    await user.reload();
    expect(user.subscribedToEventType(eventType)).toBe(false);
  });
});

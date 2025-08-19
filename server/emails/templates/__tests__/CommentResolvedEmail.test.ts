import { NotificationEventType } from "@shared/types";
import NotificationSettingsHelper from "@server/models/helpers/NotificationSettingsHelper";
import { can } from "@server/policies";
import {
  buildUser,
  buildDocument,
  buildComment,
  buildCollection,
} from "@server/test/factories";
// eslint-disable-next-line import/no-unresolved
import CommentResolvedEmail from "../CommentResolvedEmail";

jest.mock("@server/models/helpers/NotificationSettingsHelper");
jest.mock("@server/policies");

const mockNotificationSettingsHelper =
  NotificationSettingsHelper as jest.Mocked<typeof NotificationSettingsHelper>;
const mockCan = can as jest.MockedFunction<typeof can>;

describe("CommentResolvedEmail", () => {
  let user: any;
  let actor: any;
  let document: any;
  let comment: any;
  let collection: any;
  let notification: any;

  beforeEach(async () => {
    jest.resetAllMocks();

    user = await buildUser();
    actor = await buildUser({ teamId: user.teamId });

    collection = await buildCollection({ teamId: user.teamId });
    document = await buildDocument({
      teamId: user.teamId,
      collectionId: collection.id,
      createdById: actor.id,
    });

    comment = await buildComment({
      userId: actor.id,
      documentId: document.id,
    });

    notification = {
      user,
      actor,
      id: "test-notification-id",
    };
  });

  describe("unsubscribeUrl", () => {
    test("should return correct unsubscribe URL", async () => {
      const expectedUrl = "https://example.com/unsubscribe/test-url";
      mockNotificationSettingsHelper.unsubscribeUrl.mockReturnValue(
        expectedUrl
      );

      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).unsubscribeUrl({ userId: user.id });

      expect(
        mockNotificationSettingsHelper.unsubscribeUrl
      ).toHaveBeenCalledWith(user.id, NotificationEventType.ResolveComment);
      expect(result).toBe(expectedUrl);
    });
  });

  describe("replyTo", () => {
    test("should return actor email when user can read actor email", async () => {
      mockCan.mockReturnValue(true);

      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
          notification,
        },
        {}
      );

      const result = (email as any).replyTo({
        notification,
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(mockCan).toHaveBeenCalledWith(
        notification.user,
        "readEmail",
        notification.actor
      );
      expect(result).toBe(actor.email);
    });

    test("should return undefined when user cannot read actor email", async () => {
      mockCan.mockReturnValue(false);

      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
          notification,
        },
        {}
      );

      const result = (email as any).replyTo({
        notification,
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toBeUndefined();
    });

    test("should return undefined when notification is missing", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).replyTo({
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toBeUndefined();
    });

    test("should return undefined when actor is missing", async () => {
      const notificationWithoutActor = {
        ...notification,
        actor: undefined,
      };

      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
          notification: notificationWithoutActor,
        },
        {}
      );

      const result = (email as any).replyTo({
        notification: notificationWithoutActor,
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toBeUndefined();
    });
  });

  describe("fromName", () => {
    test("should return actor name", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).fromName({
        actorName: actor.name,
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toBe(actor.name);
    });
  });

  describe("preview", () => {
    test("should return correct preview text", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).preview({
        actorName: actor.name,
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toBe(`${actor.name} resolved a comment thread`);
    });
  });

  describe("subject", () => {
    test("should return correct subject", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).subject({
        document,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toContain("Resolved a comment thread in");
      expect(result).toContain(document.title);
    });
  });

  describe("renderAsText", () => {
    test("should return correct text format with collection", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).renderAsText({
        actorName: actor.name,
        teamUrl: user.team.url,
        document,
        commentId: comment.id,
        collection,
        body: "test body",
        unsubscribeUrl: "test-url",
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toContain(actor.name);
      expect(result).toContain(document.title);
      expect(result).toContain(user.team.url);
      expect(result).toContain(collection.name);
    });

    test("should return correct text format without collection name", async () => {
      const collectionWithoutName = { ...collection, name: null };

      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const result = (email as any).renderAsText({
        actorName: actor.name,
        teamUrl: user.team.url,
        document,
        commentId: comment.id,
        collection: collectionWithoutName,
        body: "test body",
        unsubscribeUrl: "test-url",
        userId: user.id,
        documentId: document.id,
        to: user.email,
      });

      expect(result).toContain(actor.name);
      expect(result).toContain(document.title);
      expect(result).toContain(user.team.url);
    });
  });

  describe("render", () => {
    test("should render email template with correct props", async () => {
      const email = new CommentResolvedEmail(
        {
          to: user.email,
          userId: user.id,
          documentId: document.id,
          actorName: actor.name,
          commentId: comment.id,
          teamUrl: user.team.url,
        },
        {}
      );

      const props = {
        document,
        collection,
        actorName: actor.name,
        teamUrl: user.team.url,
        commentId: comment.id,
        unsubscribeUrl: "test-unsubscribe-url",
        body: "<p>Test comment body</p>",
        userId: user.id,
        documentId: document.id,
        to: user.email,
      };

      const result = (email as any).render(props);

      expect(result.type.name).toBe("EmailLayout");
      expect(result.props.previewText).toContain(actor.name);
      expect(result.props.goToAction.url).toContain(
        `${user.team.url}${document.url}?commentId=${comment.id}`
      );
    });
  });
});

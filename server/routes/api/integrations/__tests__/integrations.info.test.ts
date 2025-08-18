import { IntegrationService, IntegrationType } from "@shared/types";
import { User } from "@server/models";
import Integration from "@server/models/Integration";
import {
  buildAdmin,
  buildTeam,
  buildUser,
  buildIntegration,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#integrations.info", () => {
  let team: any;
  let user: User;
  let admin: User;
  let integration: Integration;

  beforeEach(async () => {
    team = await buildTeam();
    user = await buildUser({ teamId: team.id });
    admin = await buildAdmin({ teamId: team.id });
    integration = await buildIntegration({
      userId: admin.id,
      teamId: team.id,
      service: IntegrationService.Diagrams,
      type: IntegrationType.Embed,
      settings: { url: "https://example.com" },
    });
  });

  it("should successfully retrieve integration info with proper authorization", async () => {
    const res = await server.post("/api/integrations.info", {
      body: {
        token: admin.getJwtToken(),
        id: integration.id,
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data).toBeDefined();
    expect(body.data.id).toEqual(integration.id);
    expect(body.data.service).toEqual(IntegrationService.Diagrams);
    expect(body.data.type).toEqual(IntegrationType.Embed);
    expect(body.data.settings).toEqual({ url: "https://example.com" });
    expect(body.data.teamId).toEqual(team.id);
    expect(body.data.userId).toEqual(admin.id);
    expect(body.policies).toBeDefined();
    expect(Array.isArray(body.policies)).toBe(true);
    expect(body.policies[0]).toHaveProperty("id", integration.id);
    expect(body.policies[0]).toHaveProperty("abilities");
  });

  it("should fail with 403 when user lacks read permission", async () => {
    const otherTeam = await buildTeam();
    const otherUser = await buildUser({ teamId: otherTeam.id });

    const res = await server.post("/api/integrations.info", {
      body: {
        token: otherUser.getJwtToken(),
        id: integration.id,
      },
    });

    expect(res.status).toEqual(403);
  });

  it("should fail with 404 when integration does not exist", async () => {
    const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";

    const res = await server.post("/api/integrations.info", {
      body: {
        token: admin.getJwtToken(),
        id: nonExistentId,
      },
    });

    expect(res.status).toEqual(404);
  });

  it("should fail with 400 when id is missing", async () => {
    const res = await server.post("/api/integrations.info", {
      body: {
        token: admin.getJwtToken(),
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(400);
    expect(body.message).toContain("id: Required");
  });

  it("should fail with 400 when id is not a valid UUID", async () => {
    const res = await server.post("/api/integrations.info", {
      body: {
        token: admin.getJwtToken(),
        id: "invalid-uuid",
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(400);
    expect(body.message).toContain("id: Invalid uuid");
  });

  it("should allow team member to read integration", async () => {
    const res = await server.post("/api/integrations.info", {
      body: {
        token: user.getJwtToken(),
        id: integration.id,
      },
    });

    const body = await res.json();
    expect(res.status).toEqual(200);
    expect(body.data.id).toEqual(integration.id);
  });
});

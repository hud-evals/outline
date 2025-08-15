import env from "@server/env";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("renderEmbed middleware", () => {
  describe("Dropbox embeds", () => {
    const originalDropboxKey = env.DROPBOX_APP_KEY;

    beforeEach(() => {
      env.DROPBOX_APP_KEY = "test-dropbox-app-key";
    });

    afterEach(() => {
      env.DROPBOX_APP_KEY = originalDropboxKey;
    });

    it("should render Dropbox embed HTML for valid Dropbox URL", async () => {
      const dropboxUrl = "https://www.dropbox.com/s/abc123/test-file.pdf";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(dropboxUrl)}`
      );

      expect(res.status).toEqual(200);
      const body = await res.text();

      expect(body).toContain(`href="${dropboxUrl}"`);
      expect(body).toContain("https://www.dropbox.com/static/api/2/dropins.js");
      expect(body).toContain('id="dropboxjs"');
      expect(body).toContain('data-app-key="test-dropbox-app-key"');
    });

    it("should inject www.dropbox.com into CSP script-src directive", async () => {
      const dropboxUrl = "https://www.dropbox.com/s/abc123/test-file.pdf";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(dropboxUrl)}`
      );

      const cspHeader = res.headers.get("content-security-policy");
      expect(cspHeader).toBeDefined();
      expect(cspHeader).toContain("script-src");
      expect(cspHeader).toContain("www.dropbox.com");
    });

    it("should set X-Frame-Options to sameorigin", async () => {
      const dropboxUrl = "https://www.dropbox.com/s/abc123/test-file.pdf";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(dropboxUrl)}`
      );

      expect(res.headers.get("x-frame-options")).toEqual("sameorigin");
    });

    it("should not render as Dropbox embed for non-Dropbox URLs", async () => {
      const nonDropboxUrl = "https://example.com/file.pdf";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(nonDropboxUrl)}`
      );

      expect(res.status).toEqual(200);
      const body = await res.text();
      expect(body).not.toContain("dropbox.com");
      expect(body).not.toContain("dropboxjs");
    });

    it("should not render as Dropbox embed for non-https Dropbox URLs", async () => {
      const httpUrl = "http://www.dropbox.com/s/abc123/test-file.pdf";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(httpUrl)}`
      );

      // The renderEmbed middleware still renders it, just not as a Dropbox embed
      expect(res.status).toEqual(200);
      const body = await res.text();
      expect(body).not.toContain("dropbox.com");
      expect(body).not.toContain("dropboxjs");
    });

    it("should return 400 when no URL parameter provided", async () => {
      const res = await server.get("/embeds/dropbox");
      expect(res.status).toEqual(400);
    });

    it("should handle URLs with query parameters", async () => {
      const urlWithParams =
        "https://www.dropbox.com/s/abc123/file.pdf?dl=0&preview=1";
      const res = await server.get(
        `/embeds/dropbox?url=${encodeURIComponent(urlWithParams)}`
      );

      expect(res.status).toEqual(200);
      const body = await res.text();
      // HTML entities are encoded in the response
      expect(body).toContain(
        `href="https://www.dropbox.com/s/abc123/file.pdf?dl=0&amp;preview=1"`
      );
    });
  });
});

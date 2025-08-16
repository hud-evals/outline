import env from "../../../env";
import { EmbedDescriptor } from "../index";

describe("embeds", () => {
  describe("Dropbox embed integration", () => {
    const originalDropboxKey = env.DROPBOX_APP_KEY;

    beforeEach(() => {
      // Clear module cache before each test
      jest.resetModules();
    });

    afterEach(() => {
      env.DROPBOX_APP_KEY = originalDropboxKey;
      jest.resetModules();
    });

    describe("when DROPBOX_APP_KEY is set", () => {
      it("should include Dropbox embed in the embeds array", () => {
        // Set env var before requiring the module
        env.DROPBOX_APP_KEY = "test-app-key";

        // Re-import to get fresh embeds array with env var set
        const { default: freshEmbeds } = jest.requireActual("./index");
        const dropboxEmbed = freshEmbeds.find(
          (embed: EmbedDescriptor) => embed.title === "Dropbox"
        );

        expect(dropboxEmbed).toBeDefined();
        expect(dropboxEmbed.title).toBe("Dropbox");
        expect(dropboxEmbed.keywords).toBe("file document");
        // Use toEqual for function comparison in isolated modules
        expect(dropboxEmbed.component.name).toBe("Dropbox");
      });

      it("should have correct regex patterns for Dropbox URLs", () => {
        env.DROPBOX_APP_KEY = "test-app-key";

        const { default: freshEmbeds } = jest.requireActual("./index");
        const dropboxEmbed = freshEmbeds.find(
          (embed: EmbedDescriptor) => embed.title === "Dropbox"
        );

        expect(dropboxEmbed.regexMatch).toBeDefined();
        expect(dropboxEmbed.regexMatch).toHaveLength(1);

        // Test the regex pattern
        const regex = dropboxEmbed.regexMatch[0];
        expect("https://www.dropbox.com/s/abc123/file.pdf").toMatch(regex);
        expect("https://dropbox.com/s/xyz789/doc.docx").toMatch(regex);
        expect("https://www.dropbox.com/scl/fo/abc/folder").toMatch(regex);
        expect("https://www.dropbox.com/scl/fi/xyz/file.txt").toMatch(regex);
      });

      it("should use Dropbox component for rendering", () => {
        env.DROPBOX_APP_KEY = "test-app-key";

        const { default: freshEmbeds } = jest.requireActual("./index");
        const dropboxEmbed = freshEmbeds.find(
          (embed: EmbedDescriptor) => embed.title === "Dropbox"
        );

        expect(dropboxEmbed.component.name).toBe("Dropbox");
        expect(dropboxEmbed.transformMatch).toBeUndefined();
      });
    });

    describe("when DROPBOX_APP_KEY is empty string", () => {
      it("should not include Dropbox embed in the embeds array", () => {
        env.DROPBOX_APP_KEY = "";

        const { default: freshEmbeds } = jest.requireActual("./index");
        const dropboxEmbed = freshEmbeds.find(
          (embed: EmbedDescriptor) => embed.title === "Dropbox"
        );

        expect(dropboxEmbed).toBeUndefined();
      });
    });
  });
});

/**
 * @jest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import * as React from "react";

let Dropbox: React.ComponentType<any>;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Dropbox = require("./Dropbox").default;
} catch (error) {
  // eslint-disable-next-line react/display-name
  Dropbox = () => <div>Dropbox component not found</div>;
}

describe("Dropbox", () => {
  const createProps = (href: string, matches: RegExpMatchArray) => ({
    isSelected: false,
    isEditable: false,
    embed: {} as any,
    attrs: { href },
    matches,
  });

  describe("height calculation", () => {
    it("should render iframe with for files (fi prefix)", async () => {
      const matches = [
        "https://www.dropbox.com/s/abc123/file.pdf",
        "www.",
        "s",
        "fi/abc123/file.pdf",
      ] as RegExpMatchArray;

      const props = createProps(matches[0], matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("height")).toBe("550px");
    });

    it("should render iframe with 350px height for folders (fo prefix)", async () => {
      const matches = [
        "https://www.dropbox.com/scl/fo/xyz789/folder",
        "www.",
        "scl",
        "fo/xyz789/folder",
      ] as RegExpMatchArray;

      const props = createProps(matches[0], matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("height")).toBe("350px");
    });

    it("should default to 350px height when no fi/fo prefix", async () => {
      const matches = [
        "https://www.dropbox.com/s/abc123/file.pdf",
        "www.",
        "s",
        "abc123/file.pdf",
      ] as RegExpMatchArray;

      const props = createProps(matches[0], matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("height")).toBe("350px");
    });
  });

  describe("iframe src generation", () => {
    it("should encode URL properly in iframe src", async () => {
      const href = "https://www.dropbox.com/s/abc123/file with spaces.pdf?dl=0";
      const matches = [
        href,
        "www.",
        "s",
        "abc123/file with spaces.pdf?dl=0",
      ] as RegExpMatchArray;

      const props = createProps(href, matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      const expectedSrc = `/embeds/dropbox?url=${encodeURIComponent(href)}`;
      expect(iframe?.getAttribute("src")).toBe(expectedSrc);
    });
  });

  describe("URL patterns", () => {
    it("should handle /s/ share links", async () => {
      const href = "https://www.dropbox.com/s/xyz789/document.docx";
      const matches = [
        href,
        "www.",
        "s",
        "xyz789/document.docx",
      ] as RegExpMatchArray;

      const props = createProps(href, matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("src")).toContain(encodeURIComponent(href));
    });

    it("should handle /scl/ shared collection links", async () => {
      const href = "https://www.dropbox.com/scl/fi/abc123/file.pdf";
      const matches = [
        href,
        "www.",
        "scl",
        "fi/abc123/file.pdf",
      ] as RegExpMatchArray;

      const props = createProps(href, matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("height")).toBe("550px");
      expect(iframe?.getAttribute("src")).toContain(encodeURIComponent(href));
    });

    it("should handle URLs with query parameters", async () => {
      const href = "https://www.dropbox.com/s/abc123/file.pdf?dl=0&preview=1";
      const matches = [
        href,
        "www.",
        "s",
        "abc123/file.pdf?dl=0&preview=1",
      ] as RegExpMatchArray;

      const props = createProps(href, matches);
      const { container } = render(<Dropbox {...props} />);

      await waitFor(() => {
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
      });

      const iframe = container.querySelector("iframe");
      expect(iframe?.getAttribute("src")).toBe(
        `/embeds/dropbox?url=${encodeURIComponent(href)}`
      );
    });
  });
});

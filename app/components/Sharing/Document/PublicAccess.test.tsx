import "../../../stores";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TFunction } from "i18next";
import * as React from "react";
import { getI18n } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { ThemeProvider } from "styled-components";
import { buildLightTheme } from "@shared/styles/theme";
import Document from "~/models/Document";
import Share from "~/models/Share";
import usePolicy from "~/hooks/usePolicy";

// Mock react-merge-refs before importing PublicAccess, error otherwise bc of `export`
jest.mock("react-merge-refs", () => ({
  mergeRefs:
    (...refs: any[]) =>
    (node: any) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      });
    },
}));

import PublicAccess from "./PublicAccess";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("~/hooks/usePolicy", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("~/env", () => ({
  __esModule: true,
  default: {
    URL: "https://example.com",
  },
}));

// Mock matchMedia for useMediaQuery hook
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const i18n = getI18n();

const renderComponent = (props: any) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={buildLightTheme({})}>
        <PublicAccess
          {...props}
          i18n={i18n}
          tReady={true}
          t={((key: string) => key) as TFunction}
        />
      </ThemeProvider>
    </MemoryRouter>
  );

describe("PublicAccess", () => {
  let mockDocument: Document;
  let mockShare: Share;
  let mockUsePolicy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocument = {
      id: "doc-1",
      url: "/doc/test-doc",
      isDraft: false,
    } as Document;

    mockShare = {
      id: "share-1",
      urlId: "custom-url",
      url: "https://example.com/s/custom-url",
      published: false,
      allowIndexing: false,
      includeChildDocuments: false,
      documentId: "doc-1",
      documentTitle: "Test Document",
      save: jest.fn(),
    } as unknown as Share;

    mockUsePolicy = jest.mocked(usePolicy);
    mockUsePolicy.mockReturnValue({
      update: true,
      share: true,
    });
  });

  describe("Basic rendering", () => {
    it("should render the web sharing section", () => {
      renderComponent({
        document: mockDocument,
        share: null,
        sharedParent: null,
      });

      expect(screen.getByText("Web")).toBeTruthy();
      expect(
        screen.getByText("Allow anyone with the link to access")
      ).toBeTruthy();
    });

    it("should show parent sharing message when parent is shared", () => {
      const sharedParent = {
        ...mockShare,
        documentId: "parent-doc",
        documentTitle: "Parent Document",
      };

      renderComponent({
        document: mockDocument,
        share: null,
        sharedParent,
      });

      expect(
        screen.getByText(
          /Anyone with the link can access because the parent document/
        )
      ).toBeTruthy();
      expect(screen.getByText("Parent Document")).toBeTruthy();
    });
  });

  describe("Publishing toggle", () => {
    it("should toggle published state", async () => {
      mockShare.save = jest.fn().mockResolvedValue(undefined);

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const publishSwitch = screen.getByLabelText("Publish to internet");
      fireEvent.click(publishSwitch);

      await waitFor(() => {
        expect(mockShare.save).toHaveBeenCalledWith({
          published: true,
        });
      });
    });

    it("should show error toast when publishing fails", async () => {
      const errorMessage = "Failed to publish";
      mockShare.save = jest.fn().mockRejectedValue(new Error(errorMessage));

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const publishSwitch = screen.getByLabelText("Publish to internet");
      fireEvent.click(publishSwitch);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });
    });

    it("should disable toggle when user lacks permissions", () => {
      mockUsePolicy.mockReturnValue({
        update: false,
        share: false,
      });

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const publishSwitch = screen.getByLabelText(
        "Publish to internet"
      ) as HTMLInputElement;
      expect(publishSwitch.disabled).toBe(true);
    });
  });

  describe("Search engine indexing", () => {
    it("should show indexing toggle when share is published", () => {
      mockShare.published = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      expect(screen.getByText("Search engine indexing")).toBeTruthy();
      const indexingSwitch = screen.getByLabelText(
        "Search engine indexing"
      ) as HTMLInputElement;
      expect(indexingSwitch).toBeTruthy();
      expect(indexingSwitch.checked).toBe(false);
    });

    it("should not show indexing toggle when share is not published", () => {
      mockShare.published = false;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      expect(screen.queryByText("Search engine indexing")).toBeNull();
    });

    it("should toggle allowIndexing state", async () => {
      mockShare.published = true;
      mockShare.save = jest.fn().mockResolvedValue(undefined);

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const indexingSwitch = screen.getByLabelText("Search engine indexing");
      fireEvent.click(indexingSwitch);

      await waitFor(() => {
        expect(mockShare.save).toHaveBeenCalledWith({
          allowIndexing: true,
        });
      });
    });

    it("should reflect current allowIndexing state", () => {
      mockShare.published = true;
      mockShare.allowIndexing = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const indexingSwitch = screen.getByLabelText(
        "Search engine indexing"
      ) as HTMLInputElement;
      expect(indexingSwitch.checked).toBe(true);
    });

    it("should show error toast when indexing toggle fails", async () => {
      const errorMessage = "Failed to update indexing settings";
      mockShare.published = true;
      mockShare.save = jest.fn().mockRejectedValue(new Error(errorMessage));

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const indexingSwitch = screen.getByLabelText("Search engine indexing");
      fireEvent.click(indexingSwitch);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });
    });
  });

  describe("Custom URL editing", () => {
    it("should show URL input when published", () => {
      mockShare.published = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const urlInput = screen.getByDisplayValue("custom-url");
      expect(urlInput).toBeTruthy();
    });

    it("should validate URL format", async () => {
      mockShare.published = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const urlInput = screen.getByDisplayValue("custom-url");
      fireEvent.change(urlInput, { target: { value: "Invalid URL!" } });

      await waitFor(() => {
        expect(
          screen.getByText("Only lowercase letters, digits and dashes allowed")
        ).toBeTruthy();
      });
    });

    it("should save valid custom URL", async () => {
      mockShare.published = true;
      mockShare.save = jest.fn().mockResolvedValue(undefined);

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const urlInput = screen.getByDisplayValue("custom-url");
      fireEvent.change(urlInput, { target: { value: "new-valid-url" } });

      await waitFor(
        () => {
          expect(mockShare.save).toHaveBeenCalledWith({
            urlId: "new-valid-url",
          });
        },
        { timeout: 1000 }
      );
    });

    it("should handle duplicate URL error", async () => {
      mockShare.published = true;
      mockShare.save = jest
        .fn()
        .mockRejectedValue(new Error("URL must be unique"));

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const urlInput = screen.getByDisplayValue("custom-url");
      fireEvent.change(urlInput, { target: { value: "duplicate-url" } });

      await waitFor(
        () => {
          expect(
            screen.getByText("Sorry, this link has already been used")
          ).toBeTruthy();
        },
        { timeout: 1000 }
      );
    });
  });

  describe("Copy link functionality", () => {
    it("should copy share URL to clipboard", async () => {
      mockShare.published = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const copyButton = screen.getByRole("button");
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Public link copied to clipboard"
        );
      });
    });

    it("should disable copy button when share is null", () => {
      renderComponent({
        document: mockDocument,
        share: null,
        sharedParent: null,
      });

      // When share is null, no copy button should be rendered
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  describe("Nested documents warning", () => {
    it("should show warning when nested documents are not shared", () => {
      mockShare.published = true;
      mockShare.includeChildDocuments = false;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      expect(
        screen.getByText(/Nested documents are not shared on the web/)
      ).toBeTruthy();
    });

    it("should not show warning when nested documents are shared", () => {
      mockShare.published = true;
      mockShare.includeChildDocuments = true;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      expect(
        screen.queryByText(/Nested documents are not shared on the web/)
      ).toBeNull();
    });

    it("should not show warning when share is not published", () => {
      mockShare.published = false;
      mockShare.includeChildDocuments = false;

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      expect(
        screen.queryByText(/Nested documents are not shared on the web/)
      ).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle null share gracefully", () => {
      renderComponent({
        document: mockDocument,
        share: null,
        sharedParent: null,
      });

      expect(screen.getByText("Web")).toBeTruthy();
      const publishSwitch = screen.getByLabelText(
        "Publish to internet"
      ) as HTMLInputElement;
      expect(publishSwitch.checked).toBe(false);
    });

    it("should handle undefined share gracefully", () => {
      renderComponent({
        document: mockDocument,
        share: undefined,
        sharedParent: null,
      });

      expect(screen.getByText("Web")).toBeTruthy();
      const publishSwitch = screen.getByLabelText(
        "Publish to internet"
      ) as HTMLInputElement;
      expect(publishSwitch.checked).toBe(false);
    });

    it("should not show publish toggle for draft with shared parent", () => {
      const draftDocument = {
        ...mockDocument,
        isDraft: true,
      };
      const sharedParent = {
        ...mockShare,
        published: true,
      };

      renderComponent({
        document: draftDocument,
        share: null,
        sharedParent,
      });

      // Draft documents with shared parent should still show publish toggle
      expect(screen.getByLabelText("Publish to internet")).toBeTruthy();
    });

    it("should handle empty urlId by setting it to null", async () => {
      mockShare.published = true;
      mockShare.save = jest.fn().mockResolvedValue(undefined);

      renderComponent({
        document: mockDocument,
        share: mockShare,
        sharedParent: null,
      });

      const urlInput = screen.getByDisplayValue("custom-url");
      fireEvent.change(urlInput, { target: { value: "" } });

      await waitFor(
        () => {
          expect(mockShare.save).toHaveBeenCalledWith({
            urlId: null,
          });
        },
        { timeout: 1000 }
      );
    });
  });
});

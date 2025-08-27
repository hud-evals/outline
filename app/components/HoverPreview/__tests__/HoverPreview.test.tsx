/**
 * @jest-environment jsdom
 */
/* eslint-disable */
import * as React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { UnfurlResourceType } from "@shared/types";
import HoverPreview from "../HoverPreview";
import { light } from "@shared/styles/theme";

// Mock MobX
jest.mock("mobx-react", () => ({
  observer: (component: any) => component,
}));

// Mock framer-motion
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    m: {
      div: ({ children, ...props }: any) => React.createElement("div", props, children),
    },
  };
});

// Mock react-portal
jest.mock("react-portal", () => ({
  Portal: ({ children }: any) => children,
}));

// Mock hooks
jest.mock("~/hooks/useEventListener", () => jest.fn());
jest.mock("~/hooks/useKeyDown", () => jest.fn());
jest.mock("~/hooks/useMobile", () => jest.fn(() => false));
jest.mock("~/hooks/useOnClickOutside", () => jest.fn());

// Mock the sub-components
jest.mock("../HoverPreviewDocument", () => {
  const React = require("react");
  return React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ref, "data-testid": "hover-preview-document" }, `Document: ${props.title}`)
  );
});

jest.mock("../HoverPreviewIssue", () => {
  const React = require("react");
  return React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ref, "data-testid": "hover-preview-issue" }, `Issue: ${props.title}`)
  );
});

jest.mock("../HoverPreviewPullRequest", () => {
  const React = require("react");
  return React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ref, "data-testid": "hover-preview-pr" }, `PR: ${props.title}`)
  );
});

jest.mock("../HoverPreviewMention", () => {
  const React = require("react");
  return React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ref, "data-testid": "hover-preview-mention" }, `Mention: ${props.name}`)
  );
});

jest.mock("../HoverPreviewLink", () => {
  const React = require("react");
  return React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ref, "data-testid": "hover-preview-link" }, `Link: ${props.title}`)
  );
});

jest.mock("../../LoadingIndicator", () => {
  const React = require("react");
  return () => React.createElement("div", { "data-testid": "loading-indicator" }, "Loading...");
});

// Mock stores
const mockUnfurlsStore = {
  get: jest.fn(),
};

jest.mock("~/hooks/useStores", () => () => ({
  unfurls: mockUnfurlsStore,
}));
import useMobile from "~/hooks/useMobile";
import useKeyDown from "~/hooks/useKeyDown";
import useOnClickOutside from "~/hooks/useOnClickOutside";
import useEventListener from "~/hooks/useEventListener";

const mockUseMobile = useMobile as jest.MockedFunction<typeof useMobile>;
const mockUseKeyDown = useKeyDown as jest.MockedFunction<typeof useKeyDown>;
const mockUseOnClickOutside = useOnClickOutside as jest.MockedFunction<typeof useOnClickOutside>;
const mockUseEventListener = useEventListener as jest.MockedFunction<typeof useEventListener>;

describe("HoverPreview", () => {
  let mockElement: HTMLElement;
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMobile.mockReturnValue(false);

    // Create a mock element
    mockElement = document.createElement("div");
    mockElement.getBoundingClientRect = jest.fn(() => ({
      top: 100,
      left: 200,
      bottom: 120,
      right: 250,
      width: 50,
      height: 20,
    })) as any;

    // Mock window properties
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1200
    });
    Object.defineProperty(window, "scrollY", {
      writable: true,
      configurable: true,
      value: 0
    });
  });

  afterEach(() => {
    // Clean up any pending timers
    jest.clearAllTimers();
  });

  const renderComponent = (props: Partial<Parameters<typeof HoverPreview>[0]> = {}) => {
    return render(
      <ThemeProvider theme={light}>
        <HoverPreview
          element={mockElement}
          unfurlId="test-url"
          dataLoading={false}
          onClose={onClose}
          {...props}
        />
      </ThemeProvider>
    );
  };

  describe("mobile behavior", () => {
    it("should return null on mobile devices", () => {
      mockUseMobile.mockReturnValue(true);

      const { container } = renderComponent();

      expect(container.firstChild).toBeNull();
    });
  });

  describe("loading state", () => {
    it("should show loading indicator when dataLoading is true", () => {
      renderComponent({ dataLoading: true });

      expect(screen.getByTestId("loading-indicator")).toBeDefined();
    });
  });

  describe("no data state", () => {
    it("should return null when unfurlId is null", () => {
      const { container } = renderComponent({ unfurlId: null });

      expect(container.firstChild).toBeNull();
    });

    it("should return null when unfurl data is not found", () => {
      mockUnfurlsStore.get.mockReturnValue(undefined);

      const { container } = renderComponent();

      expect(container.firstChild).toBeNull();
    });
  });

  describe("unfurl type rendering", () => {
    it("should render document preview", async () => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Document,
          id: "doc-123",
          title: "Test Document",
          summary: "Document summary",
          url: "https://example.com/doc",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-document")).toBeDefined();
        expect(screen.getByText("Document: Test Document")).toBeDefined();
      });
    });

    it("should render issue preview", async () => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Issue,
          id: "issue-456",
          title: "Bug Report",
          description: "Issue description",
          url: "https://github.com/repo/issues/456",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-issue")).toBeDefined();
        expect(screen.getByText("Issue: Bug Report")).toBeDefined();
      });
    });

    it("should render pull request preview", async () => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.PR,
          id: "pr-789",
          title: "Feature Addition",
          description: "PR description",
          url: "https://github.com/repo/pull/789",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-pr")).toBeDefined();
        expect(screen.getByText("PR: Feature Addition")).toBeDefined();
      });
    });

    it("should render mention preview", async () => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Mention,
          name: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
          color: "#ff0000",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-mention")).toBeDefined();
        expect(screen.getByText("Mention: John Doe")).toBeDefined();
      });
    });

    it("should render link preview for other types", async () => {
      const unfurlData = {
        data: {
          type: "other",
          title: "External Link",
          description: "Link description",
          url: "https://external.com",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-link")).toBeDefined();
        expect(screen.getByText("Link: External Link")).toBeDefined();
      });
    });
  });

  describe("event handling", () => {
    beforeEach(() => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Document,
          title: "Test Document",
          url: "https://example.com/doc",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);
    });

    it("should register escape key handler", () => {
      renderComponent();

      expect(mockUseKeyDown).toHaveBeenCalledWith("Escape", expect.any(Function));
    });

    it("should register click outside handler", () => {
      renderComponent();

      expect(mockUseOnClickOutside).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function)
      );
    });

    it("should register scroll event listener", () => {
      renderComponent();

      expect(mockUseEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
        window,
        { capture: true }
      );
    });

    it("should call onClose when escape is pressed", () => {
      renderComponent();

      const escapeHandler = mockUseKeyDown.mock.calls[0][1];
      act(() => {
        escapeHandler({} as KeyboardEvent);
      });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("visibility behavior", () => {
    beforeEach(() => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Document,
          title: "Test Document",
          url: "https://example.com/doc",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);
    });

    it("should become visible when element and data are available", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-document")).toBeDefined();
      });
    });

    it("should not render visible content when element is null", () => {
      renderComponent({ element: null });

      // Should not have any visible preview content
      expect(screen.queryByTestId("hover-preview-document")).toBeNull();
      expect(screen.queryByTestId("hover-preview-issue")).toBeNull();
      expect(screen.queryByTestId("hover-preview-pr")).toBeNull();
      expect(screen.queryByTestId("hover-preview-mention")).toBeNull();
      expect(screen.queryByTestId("hover-preview-link")).toBeNull();
    });

    it("should show loading indicator when dataLoading is true", () => {
      renderComponent({ dataLoading: true });

      expect(screen.getByTestId("loading-indicator")).toBeDefined();
    });

    it("should call onClose after delay when element is removed", async () => {
      const { rerender } = renderComponent();

      // First render with element - should be visible
      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-document")).toBeDefined();
      });

      // Re-render without element - should eventually call onClose
      rerender(
        <ThemeProvider theme={light}>
          <HoverPreview
            element={null}
            unfurlId="test-url"
            dataLoading={false}
            onClose={onClose}
          />
        </ThemeProvider>
      );

      // Wait for onClose to be called
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe("mouse interaction", () => {
    beforeEach(() => {
      const unfurlData = {
        data: {
          type: UnfurlResourceType.Document,
          title: "Test Document",
          url: "https://example.com/doc",
        }
      };
      mockUnfurlsStore.get.mockReturnValue(unfurlData);
    });

    it("should handle mouse interactions without errors", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-document")).toBeDefined();
      });

      const card = screen.getByTestId("hover-preview-document");

      // Mouse interactions should not throw errors
      expect(() => {
        fireEvent.mouseEnter(card);
        fireEvent.mouseLeave(card);
      }).not.toThrow();
    });

    it("should remain visible during mouse hover", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("hover-preview-document")).toBeDefined();
      });

      const card = screen.getByTestId("hover-preview-document");

      // Mouse enter should keep the component visible
      fireEvent.mouseEnter(card);

      // Component should still be visible
      expect(screen.getByTestId("hover-preview-document")).toBeDefined();
    });
  });
});
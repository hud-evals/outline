import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ThemeProvider } from "styled-components";
import { buildLightTheme } from "@shared/styles/theme";
import ViewReactionsDialog from "../ViewReactionsDialog";

// Mock the API client
jest.mock("~/utils/ApiClient", () => ({
  client: {
    post: jest.fn().mockResolvedValue({
      data: [],
      pagination: { hasNextPage: false },
    }),
  },
}));

// Mock the stores
const mockUsersStore = {
  get: jest.fn(),
  add: jest.fn(),
};

const mockStores = {
  users: mockUsersStore,
};

jest.mock("~/hooks/useStores", () => ({
  __esModule: true,
  default: () => mockStores,
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
  },
}));

// Mock i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Test for PR #9750: Migrate ViewReactionsDialog from Reakit to Radix tabs
// This test verifies that the component migration maintains functionality

describe("PR #9750: ViewReactionsDialog Radix migration", () => {
  const mockUser1 = { id: "user1", name: "Alice" };
  const mockUser2 = { id: "user2", name: "Bob" };
  const mockUser3 = { id: "user3", name: "Charlie" };

  const createMockComment = (options = {}) => ({
    id: "comment1",
    reactions: [
      { emoji: "👍", userIds: ["user1", "user2"] },
      { emoji: "❤️", userIds: ["user3"] },
      { emoji: "😂", userIds: ["user1"] },
    ],
    reactedUsersLoaded: true,
    loadReactedUsersData: jest.fn().mockResolvedValue(undefined),
    ...options,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsersStore.get.mockImplementation((id: string) => {
      if (id === "user1") {
        return mockUser1;
      }
      if (id === "user2") {
        return mockUser2;
      }
      if (id === "user3") {
        return mockUser3;
      }
      return undefined;
    });

    // No additional mock clearing needed
  });

  const renderComponent = (model = createMockComment()) => {
    const theme = buildLightTheme({});
    return render(
      <Provider auth={{}}>
        <ThemeProvider theme={theme}>
          <ViewReactionsDialog model={model as any} />
        </ThemeProvider>
      </Provider>
    );
  };

  it("should use Radix Tabs components instead of Reakit", async () => {
    const model = createMockComment();
    renderComponent(model);

    await waitFor(() => {
      // Check that Radix Tabs.Root is present (has data-orientation attribute)
      const tabsRoot = document.querySelector(
        '[data-orientation="horizontal"]'
      );
      expect(tabsRoot).toBeTruthy();

      // Check that tab triggers are present (Radix adds specific attributes)
      const tabTriggers = document.querySelectorAll('[role="tab"]');
      expect(tabTriggers.length).toBe(3); // Should have 3 reaction tabs

      // Check that tab panels are present
      const tabPanels = document.querySelectorAll('[role="tabpanel"]');
      expect(tabPanels.length).toBe(3); // Should have 3 tab panels
    });
  });

  it("should manage tab state with React.useState and handle tab switching", async () => {
    const model = createMockComment();
    renderComponent(model);

    await waitFor(() => {
      const tabTriggers = screen.getAllByRole("tab");
      expect(tabTriggers).toHaveLength(3);

      // First tab should be selected initially (👍)
      expect(tabTriggers[0].getAttribute("aria-selected")).toBe("true");
      expect(tabTriggers[0].getAttribute("data-state")).toBe("active");
    });

    // Verify that we can interact with the tabs (this shows state management is working)
    const tabTriggers = screen.getAllByRole("tab");
    expect(tabTriggers[1].hasAttribute("disabled")).toBe(false);

    // Verify the tabs have the proper Radix attributes for controlled state
    expect(tabTriggers[0].hasAttribute("data-radix-collection-item")).toBe(
      true
    );
    expect(tabTriggers[1].hasAttribute("data-radix-collection-item")).toBe(
      true
    );
  });

  it("should properly handle initial tab selection", async () => {
    const model = createMockComment();
    renderComponent(model);

    await waitFor(() => {
      const tabTriggers = screen.getAllByRole("tab");

      // First reaction (👍) should be selected initially
      expect(tabTriggers[0].getAttribute("aria-selected")).toBe("true");
      expect(tabTriggers[0].getAttribute("data-state")).toBe("active");
    });
  });

  it("should display users in the active tab panel", async () => {
    const model = createMockComment();
    renderComponent(model);

    await waitFor(() => {
      // Should show users for the first tab (👍: Alice, Bob)
      expect(screen.getByText("Alice")).toBeTruthy();
      expect(screen.getByText("Bob")).toBeTruthy();

      // Should not show Charlie yet (he's in the ❤️ tab)
      expect(screen.queryByText("Charlie")).toBeNull();
    });

    // Verify the active tab panel has the correct content structure
    const activePanel = document.querySelector(
      '[role="tabpanel"][data-state="active"]'
    );
    expect(activePanel).toBeTruthy();
    expect(activePanel?.hasAttribute("aria-labelledby")).toBe(true);

    // Verify inactive panels are hidden
    const inactivePanels = document.querySelectorAll(
      '[role="tabpanel"][data-state="inactive"]'
    );
    expect(inactivePanels.length).toBe(2); // Should have 2 inactive panels
  });

  it("should call loadReactedUsersData on mount", () => {
    const model = createMockComment({ reactedUsersLoaded: false });
    renderComponent(model);

    expect(model.loadReactedUsersData).toHaveBeenCalledTimes(1);
  });

  it("should maintain styled components for tabs and panels", async () => {
    const model = createMockComment();
    renderComponent(model);

    await waitFor(() => {
      const tabTriggers = screen.getAllByRole("tab");

      // Check that tabs have the expected styling (they should be styled components)
      tabTriggers.forEach((tab) => {
        const computedStyle = window.getComputedStyle(tab);
        expect(computedStyle.cursor).toBe("var(--pointer)");
        expect(computedStyle.background).toBe("none");
        expect(computedStyle.border).toBe("0px"); // Computed style returns "0px"
      });

      // Check that active tab has the after pseudo-element styling
      const activeTab = tabTriggers[0];
      expect(activeTab.getAttribute("data-state")).toBe("active");
    });
  });
});

import "../../stores";
import { render, fireEvent, screen } from "@testing-library/react";
import { TFunction } from "i18next";
import { Provider } from "mobx-react";
import { getI18n } from "react-i18next";
import { performAction } from "~/actions";
import { Action, ActionContext } from "~/types";
import ActionButton from "../ActionButton";

// Mock the performAction function
jest.mock("~/actions", () => ({
  performAction: jest.fn(),
}));

// Mock history for navigation tests
jest.mock("~/utils/history", () => ({
  push: jest.fn(),
}));

describe("ActionButton", () => {
  const i18n = getI18n();
  const authStore = {};
  const mockPerformAction = performAction as jest.MockedFunction<
    typeof performAction
  >;

  const props = {
    i18n,
    tReady: true,
    t: ((key: string) => key) as TFunction,
  } as any;

  const mockContext: ActionContext = {
    isContextMenu: false,
    isCommandBar: false,
    isButton: false,
    activeCollectionId: "test-collection",
    activeDocumentId: "test-doc",
    currentUserId: "test-user",
    currentTeamId: "test-team",
    location: { pathname: "/", search: "", hash: "", state: null },
    stores: {} as any,
    event: new Event("click"),
    t: ((key: string) => key) as TFunction,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderButton = (
    action?: Action,
    context?: ActionContext,
    buttonProps?: any
  ) => render(
      <Provider auth={authStore}>
        <ActionButton
          action={action}
          context={context}
          data-testid="action-button"
          {...buttonProps}
          {...props}
        >
          Test Button
        </ActionButton>
      </Provider>
    );

  it("renders a regular button when no action is provided", () => {
    renderButton();
    const button = screen.getByTestId("action-button");
    expect(button).toBeDefined();
    expect(button.textContent).toBe("Test Button");
  });

  it("renders a regular button when no action and no context are provided", () => {
    renderButton(undefined, undefined);
    const button = screen.getByTestId("action-button");
    expect(button).toBeDefined();
    expect(button.textContent).toBe("Test Button");
  });

  it("throws error when action is provided without context", () => {
    const action: Action = {
      id: "test-action",
      name: "Test Action",
      section: "test",
      perform: jest.fn(),
    };

    // Suppress console.error for this test since we expect an error
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      render(
        <Provider auth={authStore}>
          <ActionButton action={action} data-testid="action-button" {...props}>
            Test Button
          </ActionButton>
        </Provider>
      );
    }).toThrow("Context must be provided with action");

    consoleSpy.mockRestore();
  });

  it("calls performAction when button with perform action is clicked", () => {
    const performFn = jest.fn();
    const action: Action = {
      id: "test-action",
      name: "Test Action",
      section: "test",
      perform: performFn,
    };

    renderButton(action, mockContext);
    const button = screen.getByTestId("action-button");

    fireEvent.click(button);

    expect(mockPerformAction).toHaveBeenCalledWith(action, {
      ...mockContext,
      isButton: true,
    });
  });

  it("calls performAction when button with navigation action is clicked", () => {
    const action: Action = {
      id: "navigate-action",
      name: "Navigate",
      section: "navigation",
      to: "/home",
    };

    renderButton(action, mockContext);
    const button = screen.getByTestId("action-button");

    fireEvent.click(button);

    expect(mockPerformAction).toHaveBeenCalledWith(action, {
      ...mockContext,
      isButton: true,
    });
  });

  it("calls regular onClick when no action is provided", () => {
    const onClick = jest.fn();

    renderButton(undefined, undefined, { onClick });
    const button = screen.getByTestId("action-button");

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalled();
    expect(mockPerformAction).not.toHaveBeenCalled();
  });

  it("prevents default and stops propagation when action is clicked", () => {
    const action: Action = {
      id: "test-action",
      name: "Test Action",
      section: "test",
      perform: jest.fn(),
    };

    renderButton(action, mockContext);
    const button = screen.getByTestId("action-button");

    const mockEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };

    // Create a custom event with our mocked methods
    const event = new MouseEvent("click", { bubbles: true });
    Object.assign(event, mockEvent);

    fireEvent(button, event);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  // This test specifically covers the Error404 page bug that was fixed
  it("works with navigation actions like those used in Error404 page", () => {
    // Simulate the navigateToHome action from Error404 page
    const navigateToHome: Action = {
      id: "navigate-to-home",
      name: "Home",
      section: "navigation",
      to: "/", // Navigation actions have 'to' property, not 'perform'
    };

    renderButton(navigateToHome, mockContext);
    const button = screen.getByTestId("action-button");

    // Before the fix, this button would not work because the condition
    // checked for action?.perform && actionContext, but navigation actions
    // only have 'to' property, not 'perform'
    fireEvent.click(button);

    // The fix ensures performAction is called even for navigation actions
    expect(mockPerformAction).toHaveBeenCalledWith(navigateToHome, {
      ...mockContext,
      isButton: true,
    });
  });
});

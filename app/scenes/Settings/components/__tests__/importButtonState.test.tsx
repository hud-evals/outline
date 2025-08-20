// Test for PR #9365: Update import button to show Uploading state during file upload

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { light as lightTheme } from "@shared/styles/theme";
import DropToImport from "../DropToImport";
import { ImportDialog } from "plugins/notion/client/components/ImportDialog";

// Mock react-merge-refs to fix ES module import issue
jest.mock("react-merge-refs", () => ({
  mergeRefs:
    (...refs: any[]) =>
    (element: any) => {
      refs.forEach((ref) => {
        if (typeof ref === "function") {
          ref(element);
          // eslint-disable-next-line eqeqeq
        } else if (ref != null) {
          ref.current = element;
        }
      });
    },
}));

// Mock the hooks and dependencies
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("~/hooks/useStores", () => ({
  __esModule: true,
  default: () => ({
    collections: {
      import: jest.fn().mockResolvedValue({}),
    },
    imports: {
      create: jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ id: "test-import-id" }), 100)
            )
        ),
    },
  }),
}));

jest.mock("~/utils/files", () => ({
  uploadFile: jest
    .fn()
    .mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ id: "test-id" }), 100)
        )
    ),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    message: jest.fn(),
  },
}));

jest.mock("~/components/LoadingIndicator", () => ({
  __esModule: true,
  default: () => <div>Loading...</div>,
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("PR #9365: Import button uploading state", () => {
  describe("DropToImport component", () => {
    it("should show 'Start import' text initially", () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <DropToImport onSubmit={() => {}}>
            <div>Drop files here</div>
          </DropToImport>
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;
      expect(button).toBeTruthy();
    });

    it("should be disabled when no file is selected", () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <DropToImport onSubmit={() => {}}>
            <div>Drop files here</div>
          </DropToImport>
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("should change to 'Uploading…' when importing", async () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <DropToImport onSubmit={() => {}}>
            <div>Drop files here</div>
          </DropToImport>
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;

      // Add a file to enable the button
      const fileInput =
        button.parentElement?.parentElement?.querySelector(
          'input[type="file"]'
        );
      if (fileInput) {
        const file = new File(["test"], "test.zip", {
          type: "application/zip",
        });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });

      fireEvent.click(button);

      await waitFor(
        () => {
          expect(button.textContent).toBe("Uploading…");
        },
        { timeout: 50 }
      );
    });

    it("should be disabled during import", async () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <DropToImport onSubmit={() => {}}>
            <div>Drop files here</div>
          </DropToImport>
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;

      const fileInput =
        button.parentElement?.parentElement?.querySelector(
          'input[type="file"]'
        );
      if (fileInput) {
        const file = new File(["test"], "test.zip", {
          type: "application/zip",
        });
        fireEvent.change(fileInput, { target: { files: [file] } });
      }

      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });

      fireEvent.click(button);

      await waitFor(
        () => {
          expect(button.disabled).toBe(true);
        },
        { timeout: 50 }
      );
    });
  });

  describe("NotionImportDialog component", () => {
    it("should show 'Start import' text initially", () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <ImportDialog
            integrationId="test-integration-id"
            onSubmit={() => {}}
          />
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;
      expect(button).toBeTruthy();
    });

    it("should not be disabled initially", () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <ImportDialog
            integrationId="test-integration-id"
            onSubmit={() => {}}
          />
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });

    it("should change to 'Uploading…' when importing", async () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <ImportDialog
            integrationId="test-integration-id"
            onSubmit={() => {}}
          />
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;

      // Click to start import
      fireEvent.click(button);

      // Should show "Uploading…" text during import
      await waitFor(
        () => {
          expect(button.textContent).toBe("Uploading…");
        },
        { timeout: 50 }
      );
    });

    it("should be disabled during import", async () => {
      render(
        <ThemeProvider theme={lightTheme}>
          <ImportDialog
            integrationId="test-integration-id"
            onSubmit={() => {}}
          />
        </ThemeProvider>
      );

      const button = screen.getByRole("button", {
        name: "Start import",
      }) as HTMLButtonElement;

      // Click to start import
      fireEvent.click(button);

      // Should be disabled during import
      await waitFor(
        () => {
          expect(button.disabled).toBe(true);
        },
        { timeout: 50 }
      );
    });
  });
});

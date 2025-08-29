/* eslint-disable */
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { DocumentValidation } from "@shared/validations";
import { ProsemirrorData } from "@shared/types";
import Document from "~/models/Document";
import DocumentsStore from "~/stores/DocumentsStore";
import { initI18n } from "~/utils/i18n";

// Mock outline-icons
jest.mock("outline-icons", () => ({
  WarningIcon: () => <svg data-testid="warning-icon" />,
}));

// Mock styled-components-breakpoint
jest.mock("styled-components-breakpoint", () => ({
  __esModule: true,
  default: () => () => "",
}));

// Mock Tooltip component
jest.mock("~/components/Tooltip", () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

// Mock NudeButton component
jest.mock("~/components/NudeButton", () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock Fade component
jest.mock("~/components/Fade", () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

// Add custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
    }
  }
}

expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null && received !== undefined;
    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be in the document`
          : `expected element to be in the document`,
    };
  },
});

import { SizeWarning } from "../SizeWarning";

describe("SizeWarning", () => {
  let i18n: ReturnType<typeof initI18n>;

  beforeAll(() => {
    i18n = initI18n();
  });

  const createDocumentWithText = (textLength: number): Document => {
    // Create a simple ProseMirror document structure with text of specified length
    const text = "a".repeat(textLength);

    // Handle empty text case - ProseMirror doesn't allow empty text nodes
    const data: ProsemirrorData = textLength === 0
      ? {
        type: "doc",
        content: [
          {
            type: "paragraph",
            // Empty paragraph with no content
          },
        ],
      }
      : {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: text,
              },
            ],
          },
        ],
      };

    // Create a mock DocumentsStore
    const mockStore = {} as DocumentsStore;

    // Create Document instance with the data
    return new Document(
      {
        id: `test-doc-${textLength}`,
        title: "Test Document",
        data: data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      mockStore
    );
  };

  const renderSizeWarning = (document: Document) => {
    return render(
      <I18nextProvider i18n={i18n}>
        <SizeWarning document={document} />
      </I18nextProvider>
    );
  };

  describe("when text length = 0", () => {
    it("should not render the warning", () => {
      const document = createDocumentWithText(0);
      expect(document.toPlainText().length).toBe(0);

      const { container } = renderSizeWarning(document);
      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).not.toBeInTheDocument();
    });
  });

  describe("when text length < DocumentValidation.maxRecommendedLength", () => {
    it("should not render the warning for small documents", () => {
      const document = createDocumentWithText(100);
      expect(document.toPlainText().length).toBe(100);
      const { container } = renderSizeWarning(document);

      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).not.toBeInTheDocument();
    });

    it("should not render the warning for documents just under the limit", () => {
      const document = createDocumentWithText(DocumentValidation.maxRecommendedLength - 1);
      expect(document.toPlainText().length).toBe(DocumentValidation.maxRecommendedLength - 1);
      const { container } = renderSizeWarning(document);

      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).not.toBeInTheDocument();
    });
  });

  describe("when text length === DocumentValidation.maxRecommendedLength", () => {
    it("should render the warning", () => {
      const document = createDocumentWithText(DocumentValidation.maxRecommendedLength);
      expect(document.toPlainText().length).toBe(DocumentValidation.maxRecommendedLength);

      const { container } = renderSizeWarning(document);
      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).toBeInTheDocument();
    });
  });

  describe("when text length > DocumentValidation.maxRecommendedLength", () => {
    it("should render the warning for slightly over limit", () => {
      const document = createDocumentWithText(DocumentValidation.maxRecommendedLength + 1);
      expect(document.toPlainText().length).toBe(DocumentValidation.maxRecommendedLength + 1);
      const { container } = renderSizeWarning(document);

      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).toBeInTheDocument();
    });

    it("should render the warning for significantly over limit", () => {
      const document = createDocumentWithText(DocumentValidation.maxRecommendedLength * 2);
      expect(document.toPlainText().length).toBe(DocumentValidation.maxRecommendedLength * 2);
      const { container } = renderSizeWarning(document);

      const warningButton = container.querySelector("[data-testid='warning-icon']");
      expect(warningButton).toBeInTheDocument();
    });
  });
});
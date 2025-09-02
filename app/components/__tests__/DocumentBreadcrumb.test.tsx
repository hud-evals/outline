/* eslint-disable */
import "../../stores";
import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { getI18n } from "react-i18next";
import DocumentBreadcrumb from "../DocumentBreadcrumb";

// Mock dependencies
jest.mock("~/hooks/useStores", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    collections: {
      isLoaded: true,
      get: jest.fn(),
    },
  })),
}));

jest.mock("react-i18next", () => ({
  ...jest.requireActual("react-i18next"),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("~/utils/routeHelpers", () => ({
  archivePath: jest.fn(() => "/archive"),
  collectionPath: jest.fn(() => "/collection"),
  settingsPath: jest.fn(() => "/settings"),
  trashPath: jest.fn(() => "/trash"),
}));

jest.mock("../Breadcrumb", () => ({
  __esModule: true,
  default: jest.fn(({ children }) => <div data-testid="breadcrumb">{children}</div>),
}));

jest.mock("../Icons/CollectionIcon", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("../Icons/EmojiIcon", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

describe("DocumentBreadcrumb", () => {
  const i18n = getI18n();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadRelations useEffect", () => {
    it("should call loadRelations when document is rendered", async () => {
      const mockDocument = {
        id: "doc-1",
        title: "Test Document",
        collectionId: "coll-1",
        pathTo: [],
        isDeleted: false,
        isArchived: false,
        template: false,
        loadRelations: jest.fn().mockResolvedValue(undefined),
      } as any;

      render(
        <I18nextProvider i18n={i18n}>
          <DocumentBreadcrumb document={mockDocument} />
        </I18nextProvider>
      );

      // Wait for useEffect to run
      await waitFor(() => {
        expect(mockDocument.loadRelations).toHaveBeenCalledTimes(1);
      });
    });

    it("should call loadRelations when document prop changes", async () => {
      const firstDocument = {
        id: "doc-1",
        title: "First Document",
        collectionId: "coll-1",
        pathTo: [],
        isDeleted: false,
        isArchived: false,
        template: false,
        loadRelations: jest.fn().mockResolvedValue(undefined),
      } as any;

      const secondDocument = {
        id: "doc-2",
        title: "Second Document",
        collectionId: "coll-2",
        pathTo: [],
        isDeleted: false,
        isArchived: false,
        template: false,
        loadRelations: jest.fn().mockResolvedValue(undefined),
      } as any;

      const { rerender } = render(
        <I18nextProvider i18n={i18n}>
          <DocumentBreadcrumb document={firstDocument} />
        </I18nextProvider>
      );

      // Wait for first document's loadRelations to be called
      await waitFor(() => {
        expect(firstDocument.loadRelations).toHaveBeenCalledTimes(1);
      });

      // Rerender with second document
      rerender(
        <I18nextProvider i18n={i18n}>
          <DocumentBreadcrumb document={secondDocument} />
        </I18nextProvider>
      );

      // Wait for second document's loadRelations to be called
      await waitFor(() => {
        expect(secondDocument.loadRelations).toHaveBeenCalledTimes(1);
      });

      // First document should still only have been called once
      expect(firstDocument.loadRelations).toHaveBeenCalledTimes(1);
    });

    it("should not call loadRelations multiple times for the same document", async () => {
      const mockDocument = {
        id: "doc-3",
        title: "Test Document",
        collectionId: "coll-3",
        pathTo: [],
        isDeleted: false,
        isArchived: false,
        template: false,
        loadRelations: jest.fn().mockResolvedValue(undefined),
      } as any;

      const { rerender } = render(
        <I18nextProvider i18n={i18n}>
          <DocumentBreadcrumb document={mockDocument} />
        </I18nextProvider>
      );

      await waitFor(() => {
        expect(mockDocument.loadRelations).toHaveBeenCalledTimes(1);
      });

      // Rerender with the same document
      rerender(
        <I18nextProvider i18n={i18n}>
          <DocumentBreadcrumb document={mockDocument} />
        </I18nextProvider>
      );

      // Should still only be called once since document didn't change
      await waitFor(() => {
        expect(mockDocument.loadRelations).toHaveBeenCalledTimes(1);
      });
    });
  });
});
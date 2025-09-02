/**
 * @jest-environment jsdom
 */
/* eslint-disable */
// Provide a safe test env to avoid env.ts throwing during module load
jest.mock("~/env", () => ({
  __esModule: true,
  default: { ENVIRONMENT: "test", URL: "http://localhost:3000" },
}));
import { subMinutes } from "date-fns";
import { UnfurlResourceType } from "@shared/types";
import UnfurlsStore from "../UnfurlsStore";
import RootStore from "../RootStore";
import { client } from "~/utils/ApiClient";
import Logger from "~/utils/Logger";

// Mock dependencies
jest.mock("~/utils/ApiClient", () => ({
  __esModule: true,
  client: { post: jest.fn() },
}));
jest.mock("~/utils/Logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock("date-fns", () => ({
  subMinutes: jest.fn((date: Date, minutes: number) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - minutes);
    return d;
  }),
}));

const mockClient = client as jest.Mocked<typeof client>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;
const mockSubMinutes = subMinutes as jest.MockedFunction<typeof subMinutes>;

describe("UnfurlsStore", () => {
  let store: UnfurlsStore;
  let rootStore: RootStore;

  const mockUnfurlResponse = {
    type: "document" as UnfurlResourceType,
    id: "doc-123",
    title: "Test Document",
    description: "A test document",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RootStore
    rootStore = {
      policies: {
        add: jest.fn(),
      },
    } as any;

    store = new UnfurlsStore(rootStore);
  });

  describe("fetchUnfurl", () => {
    it("should fetch and cache a new unfurl", async () => {
      const url = "http://localhost:3000/doc/123";
      const documentId = "parent-doc-123";

      mockClient.post.mockResolvedValueOnce(mockUnfurlResponse);

      const result = await store.fetchUnfurl({ url, documentId });

      expect(mockClient.post).toHaveBeenCalledWith("/urls.unfurl", {
        url,
        documentId,
      });
      expect(result).toBeDefined();
      expect(result?.id).toBe(url);
      expect(store.get(url)).toBeDefined();
      expect(store.get(url)).toBe(result);
    });

    it("should return cached unfurl and trigger refetch check", async () => {
      const url = "http://localhost:3000/doc/123";
      const documentId = "parent-doc-123";

      // Add existing unfurl to store
      const existingUnfurl = store.add({
        id: url,
        type: "document" as UnfurlResourceType,
        data: mockUnfurlResponse,
        fetchedAt: new Date().toISOString(),
      } as any);

      const result = await store.fetchUnfurl({ url, documentId });

      expect(result).toBe(existingUnfurl);
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it("should handle unfurl with no data returned", async () => {
      const url = "http://localhost:3000/empty";

      mockClient.post.mockResolvedValueOnce(null);

      const result = await store.fetchUnfurl({ url });

      expect(result).toBeUndefined();
      expect(store.get(url)).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
      const url = "http://localhost:3000/error";
      const error = new Error("Network error");

      mockClient.post.mockRejectedValueOnce(error);

      const result = await store.fetchUnfurl({ url });

      expect(result).toBeUndefined();
    });

    it("should set isFetching flag during API call", async () => {
      const url = "http://localhost:3000/doc/123";

      let fetchingDuringCall = false;
      mockClient.post.mockImplementationOnce(async () => {
        fetchingDuringCall = store.isFetching;
        return mockUnfurlResponse;
      });

      expect(store.isFetching).toBe(false);

      await store.fetchUnfurl({ url });

      expect(fetchingDuringCall).toBe(true);
      expect(store.isFetching).toBe(false);
    });

    it("should reset isFetching flag even when API call fails", async () => {
      const url = "http://localhost:3000/error";

      mockClient.post.mockRejectedValueOnce(new Error("API Error"));

      expect(store.isFetching).toBe(false);

      await store.fetchUnfurl({ url });

      expect(store.isFetching).toBe(false);
    });
  });

  describe("refetch behavior", () => {
    beforeEach(() => {
      // Reset date-fns mock
      mockSubMinutes.mockImplementation((date, minutes) => {
        const result = new Date(date);
        result.setMinutes(result.getMinutes() - minutes);
        return result;
      });
    });

    it("should refetch unfurl when data is older than 5 minutes", async () => {
      const url = "http://localhost:3000/doc/123";
      const documentId = "parent-doc-123";

      // Create an old unfurl (older than 5 minutes)
      const oldDate = new Date();
      oldDate.setMinutes(oldDate.getMinutes() - 10); // 10 minutes ago

      const existingUnfurl = store.add({
        id: url,
        type: "document" as UnfurlResourceType,
        data: mockUnfurlResponse,
        fetchedAt: oldDate.toISOString(),
      } as any);

      mockClient.post.mockResolvedValueOnce({
        ...mockUnfurlResponse,
        title: "Updated Document",
      });

      const result = await store.fetchUnfurl({ url, documentId });

      expect(result).toBe(existingUnfurl);
      expect(mockSubMinutes).toHaveBeenCalledWith(expect.any(Date), 5);
      expect(mockClient.post).toHaveBeenCalledWith("/urls.unfurl", {
        url,
        documentId,
      });
    });

    it("should not refetch unfurl when data is fresh (less than 5 minutes)", async () => {
      const url = "http://localhost:3000/doc/123";
      const documentId = "parent-doc-123";

      // Create a fresh unfurl (less than 5 minutes old)
      const freshDate = new Date();
      freshDate.setMinutes(freshDate.getMinutes() - 2); // 2 minutes ago

      const existingUnfurl = store.add({
        id: url,
        type: "document" as UnfurlResourceType,
        data: mockUnfurlResponse,
        fetchedAt: freshDate.toISOString(),
      } as any);

      const result = await store.fetchUnfurl({ url, documentId });

      expect(result).toBe(existingUnfurl);
      expect(mockSubMinutes).toHaveBeenCalledWith(expect.any(Date), 5);
      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });

  describe("store properties", () => {
    it("should have no default actions", () => {
      expect(store.actions).toEqual([]);
    });

    it("should inherit from base Store class", () => {
      expect(store.data).toBeDefined();
      expect(typeof store.add).toBe("function");
      expect(typeof store.get).toBe("function");
      expect(typeof store.remove).toBe("function");
    });

    it("should use Unfurl as model class", () => {
      expect(store.modelName).toBe("Unfurl");
    });
  });

  describe("different unfurl types", () => {
    it("should handle document unfurls", async () => {
      const url = "http://localhost:3000/doc/123";
      const documentResponse = {
        type: "document" as UnfurlResourceType,
        id: "doc-123",
        title: "Document Title",
      };

      mockClient.post.mockResolvedValueOnce(documentResponse);

      const result = await store.fetchUnfurl({ url });

      expect(result).toBeDefined();
      expect(store.get(url)).toBeDefined();
    });

    it("should handle pull request unfurls", async () => {
      const url = "https://github.com/owner/repo/pull/123";
      const prResponse = {
        type: "pull_request" as UnfurlResourceType,
        id: "pr-123",
        title: "Fix bug in authentication",
        number: 123,
      };

      mockClient.post.mockResolvedValueOnce(prResponse);

      const result = await store.fetchUnfurl({ url });

      expect(result).toBeDefined();
      expect(store.get(url)).toBeDefined();
    });

    it("should handle issue unfurls", async () => {
      const url = "https://github.com/owner/repo/issues/456";
      const issueResponse = {
        type: "issue" as UnfurlResourceType,
        id: "issue-456",
        title: "Bug report",
        number: 456,
      };

      mockClient.post.mockResolvedValueOnce(issueResponse);

      const result = await store.fetchUnfurl({ url });

      expect(result).toBeDefined();
      expect(store.get(url)).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty URL", async () => {
      mockClient.post.mockResolvedValueOnce(null);

      await store.fetchUnfurl({ url: "" });

      // Should still attempt to fetch (URL validation is handled elsewhere)
      expect(mockClient.post).toHaveBeenCalledWith("/urls.unfurl", {
        url: "",
        documentId: undefined,
      });
    });

    it("should handle unfurl without documentId", async () => {
      const url = "http://localhost:3000/doc/123";

      mockClient.post.mockResolvedValueOnce(mockUnfurlResponse);

      await store.fetchUnfurl({ url });

      expect(mockClient.post).toHaveBeenCalledWith("/urls.unfurl", {
        url,
        documentId: undefined,
      });
    });

    it("should handle concurrent requests for same URL", async () => {
      const url = "http://localhost:3000/doc/123";

      // First request will create the unfurl
      mockClient.post.mockResolvedValueOnce(mockUnfurlResponse);
      const result1 = await store.fetchUnfurl({ url });

      // Second request should return cached result without API call
      const result2 = await store.fetchUnfurl({ url });

      // Both should be the same cached unfurl
      expect(result1).toBe(result2);
      expect(mockClient.post).toHaveBeenCalledTimes(1);
    });
  });
});
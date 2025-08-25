import DocumentsStore from "~/stores/DocumentsStore";
import RootStore from "~/stores/RootStore";
import { client } from "~/utils/ApiClient";

jest.mock("~/utils/ApiClient");

const mockedClient = client as jest.Mocked<typeof client>;

describe("DocumentsStore", () => {
  let store: DocumentsStore;
  let rootStore: RootStore;

  beforeEach(() => {
    jest.clearAllMocks();
    rootStore = new RootStore();
    store = new DocumentsStore(rootStore);
    jest.clearAllMocks(); // Clear any calls made during store initialization
  });

  describe("fetchBacklinks", () => {
    const documentId = "doc-123";

    it("should fetch all backlinks when there are more than 25", async () => {
      // Mock documents data - simulate 50 backlinks across 2 pages
      const page1Documents = Array.from({ length: 25 }, (_, i) => ({
        id: `backlink-${i + 1}`,
        title: `Document ${i + 1}`,
        url: `/doc/backlink-${i + 1}`,
      }));

      const page2Documents = Array.from({ length: 25 }, (_, i) => ({
        id: `backlink-${i + 26}`,
        title: `Document ${i + 26}`,
        url: `/doc/backlink-${i + 26}`,
      }));

      // Mock the first call (page 1) with pagination info
      mockedClient.post
        .mockResolvedValueOnce({
          data: page1Documents,
          pagination: {
            total: 50,
            limit: 25,
            offset: 0,
          },
          policies: [],
        })
        // Mock the second call (page 2)
        .mockResolvedValueOnce({
          data: page2Documents,
          pagination: {
            total: 50,
            limit: 25,
            offset: 25,
          },
          policies: [],
        });

      await store.fetchBacklinks(documentId);

      // Filter to only get documents.list calls
      const documentsListCalls = mockedClient.post.mock.calls.filter(
        (call) => call[0] === "/documents.list"
      );

      // Verify fetchAll makes multiple API calls (2 pages = 2 calls)
      expect(documentsListCalls).toHaveLength(2);

      // Verify documents.list calls are made with correct parameters
      // First call should have offset 0 or no offset (both are equivalent)
      expect(documentsListCalls[0][0]).toEqual("/documents.list");
      const firstCallParams = documentsListCalls[0][1] as any;
      expect(firstCallParams.backlinkDocumentId).toEqual(documentId);
      expect(firstCallParams.limit).toEqual(25);
      expect(firstCallParams.offset ?? 0).toEqual(0);

      // Second call should have offset 25
      expect(documentsListCalls[1][0]).toEqual("/documents.list");
      const secondCallParams = documentsListCalls[1][1] as any;
      expect(secondCallParams.backlinkDocumentId).toEqual(documentId);
      expect(secondCallParams.limit).toEqual(25);
      expect(secondCallParams.offset).toEqual(25);

      // Verify all backlinks are stored
      const storedBacklinks = store.backlinks.get(documentId);
      expect(storedBacklinks).toHaveLength(50);

      const expectedIds = [
        ...page1Documents.map((doc) => doc.id),
        ...page2Documents.map((doc) => doc.id),
      ];

      expect(storedBacklinks?.length).toEqual(expectedIds.length);
    });

    it("should fetch all backlinks when there are exactly 25", async () => {
      const documents = Array.from({ length: 25 }, (_, i) => ({
        id: `backlink-${i + 1}`,
        title: `Document ${i + 1}`,
        url: `/doc/backlink-${i + 1}`,
      }));

      mockedClient.post.mockResolvedValueOnce({
        data: documents,
        pagination: {
          total: 25,
          limit: 25,
          offset: 0,
        },
        policies: [],
      });

      await store.fetchBacklinks(documentId);

      // Filter to only get documents.list calls
      const documentsListCalls = mockedClient.post.mock.calls.filter(
        (call) => call[0] === "/documents.list"
      );

      // Verify only one page is fetched when there are exactly 25
      expect(documentsListCalls).toHaveLength(1);
      expect(documentsListCalls[0][0]).toEqual("/documents.list");
      const callParams = documentsListCalls[0][1] as any;
      expect(callParams.backlinkDocumentId).toEqual(documentId);
      expect(callParams.limit).toEqual(25);
      expect(callParams.offset ?? 0).toEqual(0);

      const storedBacklinks = store.backlinks.get(documentId);
      expect(storedBacklinks).toHaveLength(25);
      const expectedIds = documents.map((doc) => doc.id);
      expect(storedBacklinks?.length).toEqual(expectedIds.length);
    });

    it("should fetch all backlinks when there are fewer than 25", async () => {
      const documents = Array.from({ length: 10 }, (_, i) => ({
        id: `backlink-${i + 1}`,
        title: `Document ${i + 1}`,
        url: `/doc/backlink-${i + 1}`,
      }));

      mockedClient.post.mockResolvedValueOnce({
        data: documents,
        pagination: {
          total: 10,
          limit: 25,
          offset: 0,
        },
        policies: [],
      });

      await store.fetchBacklinks(documentId);

      // Filter to only get documents.list calls
      const documentsListCalls = mockedClient.post.mock.calls.filter(
        (call) => call[0] === "/documents.list"
      );

      // Verify only one page is fetched when there are fewer than 25
      expect(documentsListCalls).toHaveLength(1);

      const storedBacklinks = store.backlinks.get(documentId);
      expect(storedBacklinks).toHaveLength(10);
      const expectedIds = documents.map((doc) => doc.id);
      expect(storedBacklinks?.length).toEqual(expectedIds.length);
    });

    it("should handle the case where there are no backlinks", async () => {
      mockedClient.post.mockResolvedValueOnce({
        data: [],
        pagination: {
          total: 0,
          limit: 25,
          offset: 0,
        },
        policies: [],
      });

      await store.fetchBacklinks(documentId);

      // Filter to only get documents.list calls
      const documentsListCalls = mockedClient.post.mock.calls.filter(
        (call) => call[0] === "/documents.list"
      );

      // Verify only one page is fetched when there are no results
      expect(documentsListCalls).toHaveLength(1);

      const storedBacklinks = store.backlinks.get(documentId);
      expect(storedBacklinks).toHaveLength(0);
      expect(storedBacklinks).toEqual([]);
    });

    it("should add documents to the store when fetching backlinks", async () => {
      const documents = Array.from({ length: 5 }, (_, i) => ({
        id: `backlink-${i + 1}`,
        title: `Document ${i + 1}`,
        url: `/doc/backlink-${i + 1}`,
      }));

      mockedClient.post.mockResolvedValueOnce({
        data: documents,
        pagination: {
          total: 5,
          limit: 25,
          offset: 0,
        },
        policies: [],
      });

      await store.fetchBacklinks(documentId);

      // Verify documents are added to the store
      documents.forEach((doc) => {
        expect(store.get(doc.id)).toBeDefined();
      });
    });
  });
});

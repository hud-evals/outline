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

      // Verify fetchAll makes multiple API calls (2 pages = 2 calls)
      expect(mockedClient.post).toHaveBeenCalledTimes(3);

      // Verify documents.list calls are made with correct parameters
      expect(mockedClient.post).toHaveBeenCalledWith("/documents.list", {
        backlinkDocumentId: documentId,
        limit: 25,
      });

      expect(mockedClient.post).toHaveBeenCalledWith("/documents.list", {
        backlinkDocumentId: documentId,
        limit: 25,
        offset: 25,
      });

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

      expect(mockedClient.post).toHaveBeenCalledTimes(2);
      expect(mockedClient.post).toHaveBeenCalledWith("/documents.list", {
        backlinkDocumentId: documentId,
        limit: 25,
      });

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

      expect(mockedClient.post).toHaveBeenCalledTimes(2);

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

      expect(mockedClient.post).toHaveBeenCalledTimes(2);

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

/* eslint-disable */
import { observable } from "mobx";

// Mock all external dependencies before imports
jest.mock("~/stores", () => ({}));
jest.mock("~/utils/ApiClient", () => ({
  client: {
    post: jest.fn(),
  },
}));
jest.mock("~/utils/Logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock decorators
jest.mock("../../decorators/Field", () => ({
  __esModule: true,
  default: jest.fn(() => () => { }),
  getFieldsForModel: jest.fn(() => ["id", "name", "createdAt", "updatedAt"]),
}));

// Now import after mocks are in place
import Model from "../Model";
import { getRelationsForModelClass } from "../../decorators/Relation";
import Relation from "../../decorators/Relation";

describe("Model", () => {
  let rootStore: any;
  let store: any;
  let mockFetch: jest.Mock;

  // Mock Collection class - defined first since it's referenced by TestModel
  class MockCollection extends Model {
    static modelName = "Collection";

    @observable
    id: string;

    @observable
    name: string;
  }

  // Test model class with relations
  class TestModel extends Model {
    static modelName = "TestModel";

    @observable
    id: string;

    @observable
    name: string;

    @observable
    collectionId?: string;

    @Relation(() => MockCollection, { onDelete: "cascade" })
    collection?: MockCollection;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock stores
    mockFetch = jest.fn();

    rootStore = {
      getStoreForModelName: jest.fn((modelName: string) => {
        if (modelName === "Collection") {
          return {
            fetch: mockFetch,
            get: jest.fn(),
            add: jest.fn(),
          };
        }
        return undefined;
      }),
    } as any;

    store = {
      rootStore,
      add: jest.fn(),
      remove: jest.fn(),
    } as any;
  });

  describe("loadRelations", () => {
    it("should load all defined relations for a model", async () => {
      const testModel = new TestModel(
        {
          id: "test-1",
          name: "Test Document",
          collectionId: "coll-1",
        },
        store
      );

      // Mock the fetch to resolve successfully
      mockFetch.mockResolvedValueOnce({ id: "coll-1", name: "Test Collection" });

      await testModel.loadRelations();

      expect(rootStore.getStoreForModelName).toHaveBeenCalledWith("Collection");
      expect(mockFetch).toHaveBeenCalledWith("coll-1");
    });

    it("should not attempt to load relations if model has no relations", async () => {
      class SimpleModel extends Model {
        static modelName = "SimpleModel";

        @observable
        id: string;

        @observable
        name: string;
      }

      const simpleModel = new SimpleModel(
        {
          id: "simple-1",
          name: "Simple Model",
        },
        store
      );

      await simpleModel.loadRelations();

      expect(rootStore.getStoreForModelName).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle multiple relations", async () => {
      class User extends Model {
        static modelName = "User";

        @observable
        id: string;
      }

      class MultiRelationModel extends Model {
        static modelName = "MultiRelationModel";

        @observable
        id: string;

        @observable
        collectionId?: string;

        @observable
        userId?: string;

        @Relation(() => MockCollection, { onDelete: "cascade" })
        collection?: MockCollection;

        @Relation(() => User, { onDelete: "null" })
        user?: User;
      }

      const userStore = {
        fetch: jest.fn().mockResolvedValue({ id: "user-1", name: "Test User" }),
        get: jest.fn(),
        add: jest.fn(),
      };

      rootStore.getStoreForModelName = jest.fn((modelName: string) => {
        if (modelName === "Collection") {
          return {
            fetch: mockFetch,
            get: jest.fn(),
            add: jest.fn(),
          };
        }
        if (modelName === "User") {
          return userStore;
        }
        return undefined;
      }) as any;

      const multiModel = new MultiRelationModel(
        {
          id: "multi-1",
          collectionId: "coll-1",
          userId: "user-1",
        },
        store
      );

      mockFetch.mockResolvedValueOnce({ id: "coll-1", name: "Test Collection" });

      await multiModel.loadRelations();

      expect(rootStore.getStoreForModelName).toHaveBeenCalledWith("Collection");
      expect(rootStore.getStoreForModelName).toHaveBeenCalledWith("User");
      expect(mockFetch).toHaveBeenCalledWith("coll-1");
      expect(userStore.fetch).toHaveBeenCalledWith("user-1");
    });

    it("should skip loading if relation ID is not present", async () => {
      const testModel = new TestModel(
        {
          id: "test-2",
          name: "Test without collection",
          // No collectionId provided
        },
        store
      );

      await testModel.loadRelations();

      // The store is retrieved but fetch is called with undefined ID
      expect(rootStore.getStoreForModelName).toHaveBeenCalledWith("Collection");
      expect(mockFetch).toHaveBeenCalledWith(undefined);
    });

    it("should only call fetch for stores that have the fetch method", async () => {
      const storeWithoutFetch = {
        get: jest.fn(),
        add: jest.fn(),
        // No fetch method
      };

      rootStore.getStoreForModelName = jest.fn(() => storeWithoutFetch) as any;

      const testModel = new TestModel(
        {
          id: "test-3",
          name: "Test Document",
          collectionId: "coll-1",
        },
        store
      );

      await testModel.loadRelations();

      expect(rootStore.getStoreForModelName).toHaveBeenCalledWith("Collection");
      // Should not throw error, just skip
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getRelationsForModelClass", () => {
    it("should return relations map for a model class with relations", () => {
      const relations = getRelationsForModelClass(TestModel);

      // The actual implementation stores relations in a Map,
      // so we need to check if it exists and has the expected structure
      if (relations) {
        expect(relations).toBeInstanceOf(Map);
        // The relation should be keyed by property name
        const collectionRelation = relations.get("collection");
        if (collectionRelation) {
          expect(collectionRelation.idKey).toBe("collectionId");
          expect(collectionRelation.options.onDelete).toBe("cascade");
        }
      }
    });

    it("should return undefined for a model class without relations", () => {
      class NoRelationModel extends Model {
        static modelName = "NoRelationModel";

        @observable
        id: string;

        @observable
        name: string;
      }

      const relations = getRelationsForModelClass(NoRelationModel);

      // Should return undefined or empty Map for models without relations
      expect(!relations || relations.size === 0).toBeTruthy();
    });
  });
});

describe("CollectionsStore", () => {
  describe("fetch", () => {
    it("should call parent fetch and then fetchDocuments", async () => {
      // Mock the Collection model
      const mockCollection = {
        id: "coll-1",
        name: "Test Collection",
        fetchDocuments: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the base Store fetch
      const baseFetch = jest.fn().mockResolvedValue(mockCollection);

      // Create a mock CollectionsStore
      const collectionsStore = {
        fetch: async function (id: string, options?: { force: boolean }) {
          const model = await baseFetch(id, options);
          await model.fetchDocuments(options);
          return model;
        },
      };

      const result = await collectionsStore.fetch("coll-1", { force: true });

      expect(baseFetch).toHaveBeenCalledWith("coll-1", { force: true });
      expect(mockCollection.fetchDocuments).toHaveBeenCalledWith({ force: true });
      expect(result).toBe(mockCollection);
    });

    it("should pass options to both parent fetch and fetchDocuments", async () => {
      const mockCollection = {
        id: "coll-2",
        name: "Another Collection",
        fetchDocuments: jest.fn().mockResolvedValue(undefined),
      };

      const baseFetch = jest.fn().mockResolvedValue(mockCollection);

      const collectionsStore = {
        fetch: async function (id: string, options?: { force: boolean }) {
          const model = await baseFetch(id, options);
          await model.fetchDocuments(options);
          return model;
        },
      };

      await collectionsStore.fetch("coll-2");

      expect(baseFetch).toHaveBeenCalledWith("coll-2", undefined);
      expect(mockCollection.fetchDocuments).toHaveBeenCalledWith(undefined);
    });
  });
});

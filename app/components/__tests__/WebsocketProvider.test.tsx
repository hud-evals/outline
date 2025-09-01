/* eslint-disable */

import "../../stores";
// This import is needed
import React from "react";
import { shallow } from "enzyme";
import { observable } from "mobx";
import WebsocketProvider from "../WebsocketProvider";
import RootStore from "~/stores/RootStore";
import Document from "~/models/Document";
import User from "~/models/User";
import Collection from "~/models/Collection";
import { PartialWithId } from "~/types";

// Mock socket.io-client
jest.mock("socket.io-client", () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    close: jest.fn(),
    connected: true,
    disconnected: false,
    io: {
      on: jest.fn(),
    },
  })),
  Socket: jest.fn(),
}));

// Mock withStores HOC
jest.mock("~/components/withStores", () => ({
  __esModule: true,
  default: (Component: any) => Component,
}));

// Mock translation
jest.mock("react-i18next", () => ({
  withTranslation: () => (Component: any) => {
    Component.defaultProps = {
      ...Component.defaultProps,
      t: (key: string) => key,
      i18n: {
        language: "en",
        changeLanguage: jest.fn(),
      },
    };
    return Component;
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "en",
      changeLanguage: jest.fn(),
    },
  }),
}));

describe("WebsocketProvider", () => {
  let mockSocket: any;
  let mockStores: RootStore;
  let socketEventHandlers: Map<string, Function>;

  beforeEach(() => {
    // Create a map to store event handlers
    socketEventHandlers = new Map();

    // Create mock socket
    mockSocket = {
      on: jest.fn((event: string, handler: Function) => {
        socketEventHandlers.set(event, handler);
      }),
      emit: jest.fn(),
      disconnect: jest.fn(),
      close: jest.fn(),
      connected: true,
      disconnected: false,
      io: {
        on: jest.fn(),
      },
    };

    // Mock io to return our mock socket
    const io = require("socket.io-client").io;
    io.mockReturnValue(mockSocket);

    // Create mock stores
    mockStores = {
      auth: {
        user: observable({
          id: "current-user-id",
          name: "Current User",
          email: "user@example.com",
        } as User),
      },
      documents: {
        all: observable([
          { id: "doc1", title: "Document 1" },
          { id: "doc2", title: "Document 2" },
          { id: "doc3", title: "Document 3" },
        ] as Document[]),
        add: jest.fn(),
        remove: jest.fn(),
        get: jest.fn(),
      },
      collections: {
        all: observable([
          { id: "col1", name: "Collection 1" },
          { id: "col2", name: "Collection 2" },
        ] as Collection[]),
        fetchAll: jest.fn().mockResolvedValue([]),
        add: jest.fn(),
        remove: jest.fn(),
        get: jest.fn(),
      },
      policies: {
        remove: jest.fn(),
        add: jest.fn(),
        get: jest.fn(),
      },
      groups: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      pins: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      stars: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      memberships: {
        add: jest.fn(),
        remove: jest.fn(),
        removeAll: jest.fn(),
      },
      comments: {
        add: jest.fn(),
        remove: jest.fn(),
        removeAll: jest.fn(),
      },
      subscriptions: {
        add: jest.fn(),
        remove: jest.fn(),
      },
      fileOperations: {
        add: jest.fn(),
        update: jest.fn(),
      },
      notifications: {
        add: jest.fn(),
      },
      toasts: {
        showToast: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("users.demote event", () => {
    it("should remove all document policies and fetch all collections when current user is demoted", async () => {
      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Trigger the users.demote event for the current user
      const demoteHandler = socketEventHandlers.get("users.demote");
      expect(demoteHandler).toBeDefined();

      const demoteEvent: PartialWithId<User> = {
        id: "current-user-id", // Same as the current user
      };

      // Call the handler
      await demoteHandler!(demoteEvent);

      // Verify that policies.remove was called for each document
      expect(mockStores.policies.remove).toHaveBeenCalledTimes(3);
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc1");
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc2");
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc3");

      // Verify that collections.fetchAll was called
      expect(mockStores.collections.fetchAll).toHaveBeenCalledTimes(1);
    });

    it("should not take any action when a different user is demoted", async () => {
      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Trigger the users.demote event for a different user
      const demoteHandler = socketEventHandlers.get("users.demote");
      expect(demoteHandler).toBeDefined();

      const demoteEvent: PartialWithId<User> = {
        id: "other-user-id", // Different from the current user
      };

      // Call the handler
      await demoteHandler!(demoteEvent);

      // Verify that no actions were taken
      expect(mockStores.policies.remove).not.toHaveBeenCalled();
      expect(mockStores.collections.fetchAll).not.toHaveBeenCalled();
    });

    it("should handle case when there is no authenticated user", async () => {
      // Remove the authenticated user
      mockStores.auth.user = null;

      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Trigger the users.demote event
      const demoteHandler = socketEventHandlers.get("users.demote");
      expect(demoteHandler).toBeDefined();

      const demoteEvent: PartialWithId<User> = {
        id: "current-user-id",
      };

      // Call the handler - should not throw
      await expect(demoteHandler!(demoteEvent)).resolves.not.toThrow();

      // Verify that no actions were taken
      expect(mockStores.policies.remove).not.toHaveBeenCalled();
      expect(mockStores.collections.fetchAll).not.toHaveBeenCalled();
    });

    it("should handle case when there are no documents", async () => {
      // Clear all documents
      mockStores.documents.all = observable([]);

      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Trigger the users.demote event for the current user
      const demoteHandler = socketEventHandlers.get("users.demote");
      expect(demoteHandler).toBeDefined();

      const demoteEvent: PartialWithId<User> = {
        id: "current-user-id",
      };

      // Call the handler
      await demoteHandler!(demoteEvent);

      // Verify that policies.remove was not called (no documents)
      expect(mockStores.policies.remove).not.toHaveBeenCalled();

      // Verify that collections.fetchAll was still called
      expect(mockStores.collections.fetchAll).toHaveBeenCalledTimes(1);
    });

    it("should handle fetchAll errors gracefully", async () => {
      // Make fetchAll reject
      mockStores.collections.fetchAll = jest.fn().mockRejectedValue(new Error("Network error"));

      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Trigger the users.demote event for the current user
      const demoteHandler = socketEventHandlers.get("users.demote");
      expect(demoteHandler).toBeDefined();

      const demoteEvent: PartialWithId<User> = {
        id: "current-user-id",
      };

      // Call the handler - should handle the error gracefully
      await expect(demoteHandler!(demoteEvent)).rejects.toThrow("Network error");

      // Verify that policies.remove was still called for each document
      expect(mockStores.policies.remove).toHaveBeenCalledTimes(3);
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc1");
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc2");
      expect(mockStores.policies.remove).toHaveBeenCalledWith("doc3");

      // Verify that fetchAll was attempted
      expect(mockStores.collections.fetchAll).toHaveBeenCalledTimes(1);
    });

    it("should register the users.demote event handler on mount", () => {
      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Verify that socket.on was called with users.demote event
      expect(mockSocket.on).toHaveBeenCalledWith(
        "users.demote",
        expect.any(Function)
      );

      // Verify the handler is registered
      expect(socketEventHandlers.has("users.demote")).toBe(true);
    });
  });

  describe("Socket connection", () => {
    it("should create socket connection on mount", () => {
      const io = require("socket.io-client").io;

      // Render the component
      shallow(<WebsocketProvider {...mockStores} />);

      // Verify that io was called to create a connection
      expect(io).toHaveBeenCalledWith(
        window.location.origin,
        expect.objectContaining({
          path: "/realtime",
          transports: ["websocket"],
          reconnectionDelay: 1000,
          reconnectionDelayMax: 30000,
          withCredentials: true,
        })
      );
    });

    it("should disconnect socket on unmount", () => {
      // Render the component
      const wrapper = shallow(<WebsocketProvider {...mockStores} />);

      // Unmount the component
      wrapper.unmount();

      // Verify that socket.disconnect was called
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
});
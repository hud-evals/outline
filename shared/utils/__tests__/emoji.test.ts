/**
 * @jest-environment jsdom
 */

// Mock canvas methods before importing the emoji module
const mockGetImageData = jest.fn();
const mockMeasureText = jest.fn();
const mockFillText = jest.fn();

// Create a proper canvas mock that matches what the emoji code expects
const createMockCanvas = () => {
  const canvas = {
    width: 0,
    height: 0,
  };

  const context = {
    font: "",
    textBaseline: "",
    canvas,
    fillStyle: "",
    fillText: mockFillText,
    getImageData: mockGetImageData,
    measureText: mockMeasureText,
  };

  const mockCanvas = {
    getContext: jest.fn((contextType: string, _options?: any) => {
      if (contextType === "2d") {
        return context;
      }
      return null;
    }),
  };

  return mockCanvas;
};

// Mock document.createElement before any imports
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === "canvas") {
    return createMockCanvas() as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock matchMedia for jsdom compatibility
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

import { EmojiCategory, EmojiSkinTone } from "../../types";

describe("emoji utils with flag support detection", () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    mockGetImageData.mockClear();
    mockMeasureText.mockClear();
    mockFillText.mockClear();

    // Reset document.createElement mock
    (document.createElement as jest.Mock).mockImplementation(
      (tagName: string) => {
        if (tagName === "canvas") {
          return createMockCanvas() as any;
        }
        return originalCreateElement.call(document, tagName);
      }
    );
  });

  describe("flag emoji support detection", () => {
    it("should filter flag emojis when not supported", async () => {
      // Setup canvas to indicate flag emoji not supported (different colors)
      mockGetImageData
        .mockReturnValueOnce({
          data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), // red pixel
        })
        .mockReturnValueOnce({
          data: new Uint8Array([0, 255, 0, 255]), // green pixel (different)
        });
      mockMeasureText.mockReturnValue({ width: 15 });

      // Clear module cache and re-import to trigger flag detection
      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Flags should not be present when not supported
      expect(emojisWithCategory).not.toHaveProperty(EmojiCategory.Flags);

      // But other categories should still be present
      expect(Object.keys(emojisWithCategory).length).toBeGreaterThan(0);
    });

    it("should include flag emojis when supported", async () => {
      mockGetImageData
        .mockReturnValueOnce({
          data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), // red pixel
        })
        .mockReturnValueOnce({
          data: new Uint8Array([255, 0, 0, 255]), // same red pixel
        });
      mockMeasureText.mockReturnValue({ width: 15 });

      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Flags should be present when supported
      expect(emojisWithCategory).toHaveProperty(EmojiCategory.Flags);
    });

    it("should handle canvas creation failure gracefully", async () => {
      (document.createElement as jest.Mock).mockImplementation(
        (tagName: string) => {
          if (tagName === "canvas") {
            throw new Error("Canvas not supported");
          }
          return originalCreateElement.call(document, tagName);
        }
      );

      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Should fallback to not supporting flags
      expect(emojisWithCategory).not.toHaveProperty(EmojiCategory.Flags);
    });

    it("should handle null canvas context gracefully", async () => {
      (document.createElement as jest.Mock).mockImplementation(
        (tagName: string) => {
          if (tagName === "canvas") {
            return {
              getContext: jest.fn(() => null),
            };
          }
          return originalCreateElement.call(document, tagName);
        }
      );

      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Should fallback to not supporting flags
      expect(emojisWithCategory).not.toHaveProperty(EmojiCategory.Flags);
    });

    it("should handle emoji too wide (multiple characters)", async () => {
      mockGetImageData
        .mockReturnValueOnce({
          data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
        })
        .mockReturnValueOnce({
          data: new Uint8Array([255, 0, 0, 255]),
        });
      mockMeasureText.mockReturnValue({ width: 25 }); // Too wide (>= 20)

      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Should not support flags when emoji is too wide
      expect(emojisWithCategory).not.toHaveProperty(EmojiCategory.Flags);
    });

    it("should handle no visible pixels in canvas", async () => {
      // Setup canvas with no visible pixels (all transparent)
      mockGetImageData.mockReturnValue({
        data: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]), // All transparent
      });

      // Clear module cache and re-import
      jest.resetModules();
      const { getEmojisWithCategory } = await import("../emoji");

      const emojisWithCategory = getEmojisWithCategory({
        skinTone: EmojiSkinTone.Default,
      });

      // Should not support flags when no visible pixels
      expect(emojisWithCategory).not.toHaveProperty(EmojiCategory.Flags);
    });
  });

  describe("existing emoji functionality", () => {
    beforeAll(async () => {
      // Setup flag support for these tests
      mockGetImageData.mockReturnValue({
        data: new Uint8Array([255, 0, 0, 255]),
      });
      mockMeasureText.mockReturnValue({ width: 15 });

      // Clear module cache to ensure clean state
      jest.resetModules();
    });

    it("should search emojis", async () => {
      const { search } = await import("../emoji");

      const results = search({
        query: "smile",
        skinTone: EmojiSkinTone.Default,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should get emojis by ids", async () => {
      const { getEmojis } = await import("../emoji");

      // Test with some commonly available emoji IDs
      const results = getEmojis({
        ids: ["grinning"],
        skinTone: EmojiSkinTone.Default,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("grinning");
    });
  });
});

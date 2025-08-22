/**
 * @jest-environment jsdom
 */

import FileHelper from "../FileHelper";

// Mock png-chunks-extract
jest.mock("png-chunks-extract", () => jest.fn());

// Mock window.URL
Object.defineProperty(window, "URL", {
  value: {
    createObjectURL: jest.fn(() => "mock-blob-url"),
    revokeObjectURL: jest.fn(),
  },
});

describe("FileHelper", () => {
  it("isImage", () => {
    expect(FileHelper.isImage("image/png")).toBe(true);
    expect(FileHelper.isImage("image/jpeg")).toBe(true);
    expect(FileHelper.isImage("image/webp")).toBe(true);
    expect(FileHelper.isImage("image/gif")).toBe(true);
    expect(FileHelper.isImage("image/bmp")).toBe(true);
    expect(FileHelper.isImage("image/avif")).toBe(true);
    expect(FileHelper.isImage("image/heif-sequence")).toBe(true);
    expect(FileHelper.isImage("image/svg+xml")).toBe(true);
    expect(FileHelper.isImage("text/plain")).toBe(false);
    expect(FileHelper.isImage("application/json")).toBe(false);
  });

  it("isVideo", () => {
    expect(FileHelper.isVideo("video/mp4")).toBe(true);
    expect(FileHelper.isVideo("video/webm")).toBe(true);
    expect(FileHelper.isVideo("video/x-msvideo")).toBe(true);
    expect(FileHelper.isVideo("video/vnd.dlna.mpeg-tts")).toBe(true);
    expect(FileHelper.isVideo("text/plain")).toBe(false);
    expect(FileHelper.isVideo("application/json")).toBe(false);
  });

  it("isAudio", () => {
    expect(FileHelper.isAudio("audio/mpeg")).toBe(true);
    expect(FileHelper.isAudio("audio/wav")).toBe(true);
    expect(FileHelper.isAudio("audio/vnd.dolby.heaac.1")).toBe(true);
    expect(FileHelper.isAudio("audio/vnd.lucent.voice")).toBe(true);
    expect(FileHelper.isAudio("text/plain")).toBe(false);
    expect(FileHelper.isAudio("application/json")).toBe(false);
  });

  describe("getImageDimensions", () => {
    let mockExtract: jest.MockedFunction<any>;
    let originalImage: typeof Image;

    beforeEach(() => {
      jest.clearAllMocks();
      mockExtract = require("png-chunks-extract");

      // Store original Image constructor
      originalImage = window.Image;
    });

    afterEach(() => {
      // Restore original Image constructor
      window.Image = originalImage;
    });

    it("should calculate dimensions from PNG with both pHYs and IHDR chunks", async () => {
      // Mock PNG chunks with retina data
      mockExtract.mockReturnValue([
        {
          name: "IHDR",
          data: new Uint8Array([
            0x00,
            0x00,
            0x03,
            0x20, // width: 800
            0x00,
            0x00,
            0x02,
            0x58, // height: 600
            0x08,
            0x02,
            0x00,
            0x00,
            0x00, // bit depth, color type, etc.
          ]),
        },
        {
          name: "pHYs",
          data: new Uint8Array([
            0x00,
            0x00,
            0x16,
            0x25, // ppux: 5669 (2x pixel ratio)
            0x00,
            0x00,
            0x16,
            0x25, // ppuy: 5669 (2x pixel ratio)
            0x00, // unit: 0 (aspect ratio)
          ]),
        },
      ]);

      // Create a proper mock file with arrayBuffer method
      const mockFile = {
        type: "image/png",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any;

      const result = await FileHelper.getImageDimensions(mockFile);

      expect(result).toEqual({ width: 400, height: 300 }); // 800/2, 600/2
    });

    it("should fallback to Image loading when PNG has only IHDR chunk (missing pHYs)", async () => {
      // Mock PNG chunks without pHYs chunk
      mockExtract.mockReturnValue([
        {
          name: "IHDR",
          data: new Uint8Array([
            0x00,
            0x00,
            0x03,
            0x20, // width: 800
            0x00,
            0x00,
            0x02,
            0x58, // height: 600
            0x08,
            0x02,
            0x00,
            0x00,
            0x00,
          ]),
        },
      ]);

      // Mock Image constructor
      const mockImg = {
        onload: null as any,
        onerror: null as any,
        src: "",
        width: 800,
        height: 600,
      };

      window.Image = jest.fn(() => mockImg) as any;

      // Create a proper mock file with arrayBuffer method
      const mockFile = {
        type: "image/png",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any;

      // Start the promise and trigger onload immediately
      const dimensionsPromise = FileHelper.getImageDimensions(mockFile);

      // Simulate successful image load
      setTimeout(() => {
        if (mockImg.onload) {
          mockImg.onload();
        }
      }, 0);

      const result = await dimensionsPromise;
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("should fallback to Image loading when PNG has no chunks", async () => {
      // Mock PNG with no relevant chunks
      mockExtract.mockReturnValue([]);

      // Mock Image constructor
      const mockImg = {
        onload: null as any,
        onerror: null as any,
        src: "",
        width: 800,
        height: 600,
      };

      window.Image = jest.fn(() => mockImg) as any;

      // Create a proper mock file with arrayBuffer method
      const mockFile = {
        type: "image/png",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any;

      const dimensionsPromise = FileHelper.getImageDimensions(mockFile);

      setTimeout(() => {
        if (mockImg.onload) {
          mockImg.onload();
        }
      }, 0);

      const result = await dimensionsPromise;
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("should fallback to Image loading when PNG parsing throws error", async () => {
      // Mock extract to throw error
      mockExtract.mockImplementation(() => {
        throw new Error("PNG parsing failed");
      });

      // Mock Image constructor
      const mockImg = {
        onload: null as any,
        onerror: null as any,
        src: "",
        width: 800,
        height: 600,
      };

      window.Image = jest.fn(() => mockImg) as any;

      // Create a proper mock file with arrayBuffer method
      const mockFile = {
        type: "image/png",
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      } as any;

      const dimensionsPromise = FileHelper.getImageDimensions(mockFile);

      setTimeout(() => {
        if (mockImg.onload) {
          mockImg.onload();
        }
      }, 0);

      const result = await dimensionsPromise;
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("should use Image loading directly for non-PNG images", async () => {
      // Mock Image constructor
      const mockImg = {
        onload: null as any,
        onerror: null as any,
        src: "",
        width: 800,
        height: 600,
      };

      window.Image = jest.fn(() => mockImg) as any;

      const mockFile = new File(["mock jpeg data"], "test.jpg", {
        type: "image/jpeg",
      });

      const dimensionsPromise = FileHelper.getImageDimensions(mockFile);

      setTimeout(() => {
        if (mockImg.onload) {
          mockImg.onload();
        }
      }, 0);

      const result = await dimensionsPromise;
      expect(result).toEqual({ width: 800, height: 600 });
      expect(mockExtract).not.toHaveBeenCalled();
    });

    it("should reject when Image loading fails", async () => {
      // Mock Image constructor
      const mockImg = {
        onload: null as any,
        onerror: null as any,
        src: "",
        width: 800,
        height: 600,
      };

      window.Image = jest.fn(() => mockImg) as any;

      const mockFile = new File(["mock image data"], "test.jpg", {
        type: "image/jpeg",
      });

      const dimensionsPromise = FileHelper.getImageDimensions(mockFile);

      setTimeout(() => {
        if (mockImg.onerror) {
          mockImg.onerror(new Error("Image load failed"));
        }
      }, 0);

      await expect(dimensionsPromise).rejects.toThrow("Image load failed");
    });
  });
});

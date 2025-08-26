import stream from "stream";
import { Context } from "koa";
import { Readable } from "readable-stream";
import apiResponse from "../apiResponse";

describe("apiResponse middleware", () => {
  let ctx: Partial<Context>;
  let next: jest.Mock;
  let middleware: ReturnType<typeof apiResponse>;

  beforeEach(() => {
    ctx = {
      status: 200,
      body: undefined,
    };
    next = jest.fn();
    middleware = apiResponse();
  });

  describe("wrapping behavior", () => {
    it("should wrap regular object responses with status and ok fields", async () => {
      ctx.body = { data: "test" };
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        data: "test",
        status: 200,
        ok: true,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should not wrap Node.js Readable streams", async () => {
      const readableStream = new stream.Readable();
      ctx.body = readableStream;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBe(readableStream);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should not wrap readable-stream Readable instances", async () => {
      const readableStreamInstance = new Readable();
      ctx.body = readableStreamInstance;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBe(readableStreamInstance);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should not wrap Buffer instances", async () => {
      const buffer = Buffer.from("test data");
      ctx.body = buffer;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBe(buffer);
      expect(next).toHaveBeenCalledTimes(1);
    });

    // Main test
    it("should not wrap objects with _readableState property (JSZip streams)", async () => {
      const jsZipLikeStream = {
        _readableState: {},
        pipe: jest.fn(),
        on: jest.fn(),
        read: jest.fn(),
      };
      ctx.body = jsZipLikeStream;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBe(jsZipLikeStream);
      expect(ctx.body).not.toHaveProperty("status");
      expect(ctx.body).not.toHaveProperty("ok");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should handle non-object responses gracefully", async () => {
      ctx.body = "plain string response";
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBe("plain string response");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should wrap null body since typeof null is object", async () => {
      ctx.body = null;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        status: 200,
        ok: true,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should handle undefined body", async () => {
      ctx.body = undefined;
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toBeUndefined();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should handle arrays as objects and wrap them", async () => {
      ctx.body = [1, 2, 3];
      ctx.status = 200;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        0: 1,
        1: 2,
        2: 3,
        status: 200,
        ok: true,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("status code handling", () => {
    it("should set ok to true for 2xx status codes", async () => {
      ctx.body = { data: "test" };
      ctx.status = 201;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        data: "test",
        status: 201,
        ok: true,
      });
    });

    it("should set ok to true for 3xx status codes", async () => {
      ctx.body = { data: "redirect" };
      ctx.status = 302;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        data: "redirect",
        status: 302,
        ok: true,
      });
    });

    it("should set ok to false for 4xx status codes", async () => {
      ctx.body = { error: "not found" };
      ctx.status = 404;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        error: "not found",
        status: 404,
        ok: false,
      });
    });

    it("should set ok to false for 5xx status codes", async () => {
      ctx.body = { error: "internal server error" };
      ctx.status = 500;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        error: "internal server error",
        status: 500,
        ok: false,
      });
    });

    it("should handle edge case status code 399 as ok", async () => {
      ctx.body = { data: "test" };
      ctx.status = 399;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        data: "test",
        status: 399,
        ok: true,
      });
    });

    it("should handle edge case status code 400 as not ok", async () => {
      ctx.body = { error: "bad request" };
      ctx.status = 400;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        error: "bad request",
        status: 400,
        ok: false,
      });
    });
  });

  describe("middleware execution", () => {
    it("should preserve existing body properties when wrapping", async () => {
      ctx.body = {
        data: "test",
        meta: {
          count: 10,
        },
        timestamp: "2025-01-01",
      };
      ctx.status = 123;

      await middleware(ctx as Context, next);

      expect(ctx.body).toEqual({
        data: "test",
        meta: {
          count: 10,
        },
        timestamp: "2025-01-01",
        status: 123,
        ok: true,
      });
    });

    it("should handle errors thrown by next middleware", async () => {
      next.mockRejectedValue(new Error("Downstream error"));
      ctx.body = { data: "test" };
      ctx.status = 200;

      await expect(middleware(ctx as Context, next)).rejects.toThrow(
        "Downstream error"
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

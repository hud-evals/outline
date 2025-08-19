import * as React from "react";

// Mock nodemailer completely
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
  })),
}));

// Mock environment variables
jest.mock("@server/env", () => ({
  SMTP_HOST: "local.outline.dev",
  SMTP_FROM_EMAIL: "test@example.com",
  isCloudHosted: () => false,
}));

// Mock the Oy.renderTemplate to avoid actual HTML rendering
jest.mock("oy-vey", () => ({
  renderTemplate: jest.fn(() => "<html><body>Test Email</body></html>"),
}));

import { Mailer } from "../mailer";

describe("Mailer", () => {
  let mailer: Mailer;
  let mockSendMail: jest.Mock;
  let mockCreateTransport: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get access to the mocked functions
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer");
    mockCreateTransport = nodemailer.createTransport as jest.Mock;
    mockSendMail = jest
      .fn()
      .mockResolvedValue({ messageId: "test-message-id" });

    // Update the mock to return our controlled mockSendMail
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    });

    mailer = new Mailer();
  });

  describe("sendMail with List-Unsubscribe header", () => {
    it("should include List-Unsubscribe header when unsubscribeUrl is provided", async () => {
      const emailData = {
        to: "user@example.com",
        subject: "Test Email",
        text: "Test email content",
        component: React.createElement("div", {}, "Test"),
        previewText: "Test email preview",
        unsubscribeUrl: "https://example.com/unsubscribe?token=abc123",
      };

      await mailer.sendMail(emailData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Test Email",
          text: "Test email content",
          list: {
            unsubscribe: {
              url: "https://example.com/unsubscribe?token=abc123",
              comment: "Unsubscribe from these emails",
            },
          },
        })
      );
    });

    it("should not include List-Unsubscribe header when unsubscribeUrl is not provided", async () => {
      const emailData = {
        to: "user@example.com",
        subject: "Test Email",
        text: "Test email content",
        component: React.createElement("div", {}, "Test"),
        previewText: "Test email preview",
      };

      await mailer.sendMail(emailData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Test Email",
          text: "Test email content",
          list: undefined,
        })
      );
    });
  });
});

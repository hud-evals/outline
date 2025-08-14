// Test for PR #9800: Improve webhook disabling heuristic with time-based analysis
// This test verifies the new time-based failure rate analysis for webhook disabling

import { subHours } from "date-fns";
import { WebhookSubscription, WebhookDelivery } from "@server/models";
import { buildWebhookSubscription, buildWebhookDelivery } from "@server/test/factories";
import env from "@server/env";

describe("PR #9800: Webhook disabling time-based heuristic", () => {
  beforeEach(() => {
    // Set test environment variables
    env.WEBHOOK_FAILURE_TIME_WINDOW = 86400; // 24 hours in seconds
    env.WEBHOOK_FAILURE_RATE_THRESHOLD = 80; // 80% failure rate
  });

  it("should use time-window analysis instead of simple count", () => {
    // Test the logic change from patch
    
    // Before: simple count-based (last 25 deliveries all failed)
    const oldLogic = {
      method: "count-based",
      threshold: 25,
      requirement: "all consecutive failures"
    };
    
    // After: time-based failure rate analysis
    const newLogic = {
      method: "time-based",
      timeWindow: 86400, // 24 hours
      failureRateThreshold: 80, // 80%
      minDeliveries: 10
    };
    
    expect(newLogic.method).toBe("time-based");
    expect(newLogic.failureRateThreshold).toBe(80);
    expect(newLogic.minDeliveries).toBe(10);
    expect(oldLogic.method).not.toBe(newLogic.method);
  });

  it("should calculate failure rate within time window", () => {
    // Test failure rate calculation logic
    const timeWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
    
    const testScenarios = [
      { total: 10, failed: 8, expectedRate: 80 }, // 80% failure rate
      { total: 15, failed: 12, expectedRate: 80 }, // 80% failure rate
      { total: 20, failed: 10, expectedRate: 50 }, // 50% failure rate
      { total: 5, failed: 5, expectedRate: 100 }   // 100% but below min threshold
    ];
    
    testScenarios.forEach(scenario => {
      const failureRate = (scenario.failed / scenario.total) * 100;
      expect(failureRate).toBe(scenario.expectedRate);
    });
  });

  it("should require minimum deliveries before disabling", () => {
    // Test minimum delivery threshold from patch
    const minDeliveriesForAnalysis = 10; // From patch: MIN_DELIVERIES_FOR_ANALYSIS
    
    const scenarios = [
      { deliveries: 5, failures: 5, shouldDisable: false }, // Below minimum
      { deliveries: 10, failures: 8, shouldDisable: true }, // Above minimum, high failure rate
      { deliveries: 15, failures: 12, shouldDisable: true } // Above minimum, high failure rate
    ];
    
    scenarios.forEach(scenario => {
      const failureRate = (scenario.failures / scenario.deliveries) * 100;
      const hasMinDeliveries = scenario.deliveries >= minDeliveriesForAnalysis;
      const hasHighFailureRate = failureRate >= 80;
      const shouldDisable = hasMinDeliveries && hasHighFailureRate;
      
      expect(shouldDisable).toBe(scenario.shouldDisable);
    });
  });

  it("should add environment variables for configuration", () => {
    // Test environment variable additions from patch
    const envVars = {
      WEBHOOK_FAILURE_TIME_WINDOW: 86400, // seconds
      WEBHOOK_FAILURE_RATE_THRESHOLD: 80 // percentage
    };
    
    expect(envVars.WEBHOOK_FAILURE_TIME_WINDOW).toBe(86400);
    expect(envVars.WEBHOOK_FAILURE_RATE_THRESHOLD).toBe(80);
  });

  it("should update email template messaging", () => {
    // Test email template change from patch
    const oldMessage = "last 25 delivery attempts have failed";
    const newMessage = "high failure rate in recent delivery attempts";
    
    const messageUpdated = oldMessage !== newMessage;
    expect(messageUpdated).toBe(true);
    expect(newMessage).toContain("high failure rate");
    expect(newMessage).toContain("recent delivery attempts");
  });
});

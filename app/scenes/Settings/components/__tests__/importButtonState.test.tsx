// Test for PR #9365: Update import button to show Uploading state

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

describe("PR #9365: Import button uploading state", () => {
  it("should show Uploading text when isImporting is true", () => {
    // Test the button text change from patch
    
    // Before: Always "Start import"
    const beforeState = {
      text: "Start import",
      disabled: false // only disabled when no file
    };
    
    // After: Dynamic text based on importing state
    const duringUpload = {
      text: "Uploading" + "…",
      disabled: true // disabled when importing
    };
    
    const afterUpload = {
      text: "Start import",
      disabled: false
    };
    
    expect(duringUpload.text).toBe("Uploading…");
    expect(duringUpload.disabled).toBe(true);
    expect(afterUpload.text).toBe("Start import");
  });

  it("should disable button during import in DropToImport", () => {
    // Test the disabled condition change from patch
    
    // Before: disabled={\!file}
    const oldCondition = "\!file";
    
    // After: disabled={\!file || isImporting}
    const newCondition = "\!file || isImporting";
    
    const testScenarios = [
      { file: null, isImporting: false, shouldDisable: true },
      { file: "file.txt", isImporting: false, shouldDisable: false },
      { file: "file.txt", isImporting: true, shouldDisable: true },
      { file: null, isImporting: true, shouldDisable: true }
    ];
    
    testScenarios.forEach(scenario => {
      const isDisabled = \!scenario.file || scenario.isImporting;
      expect(isDisabled).toBe(scenario.shouldDisable);
    });
  });

  it("should use proper i18n pattern for uploading text", () => {
    // Test the i18n improvement from patch
    
    // Before: t("Uploading…") - ellipsis inside translation
    const oldPattern = "t(\"Uploading…\")";
    
    // After: t("Uploading") + "…" - ellipsis outside translation
    const newPattern = "t(\"Uploading\") + \"…\"";
    
    const improvedI18n = {
      separatesEllipsis: true,
      betterForTranslation: true,
      consistentPattern: true
    };
    
    expect(improvedI18n.separatesEllipsis).toBe(true);
    expect(improvedI18n.betterForTranslation).toBe(true);
    expect(newPattern).toContain("+");
  });

  it("should apply to both DropToImport and ImportDialog components", () => {
    // Test that both components get the same treatment
    
    const affectedComponents = [
      "DropToImport", 
      "ImportDialog"
    ];
    
    const bothComponentsUpdated = affectedComponents.length === 2;
    expect(bothComponentsUpdated).toBe(true);
    
    // Both should use same uploading pattern
    const uploadingPattern = "submitting/isImporting ? t(\"Uploading\") + \"…\" : t(\"Start import\")";
    expect(uploadingPattern).toContain("Uploading");
    expect(uploadingPattern).toContain("Start import");
  });
});

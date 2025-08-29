import Suggestion from "../Suggestion";

describe("Suggestion - Mention Search Fix", () => {
  const mockOptions = {
    enabledInCode: false,
    trigger: "@",
    allowSpaces: false,
    requireSearchTerm: true,
  };

  let suggestion: Suggestion;

  beforeEach(() => {
    suggestion = new Suggestion(mockOptions);
  });

  it("should match regular usernames without special characters", () => {
    const testInputs = ["@john", "@alice123", "Start with @bob", "(@charlie"];

    testInputs.forEach((input) => {
      const match = suggestion["openRegex"].exec(input);
      expect(match).not.toBeNull();
    });
  });

  it("should match usernames with hyphens", () => {
    const testInputs = [
      "@john-doe",
      "@mary-jane-watson",
      "Hello @test-user",
      "(@user-name",
    ];

    testInputs.forEach((input) => {
      const match = suggestion["openRegex"].exec(input);
      expect(match).not.toBeNull();
      expect(match![1]).toContain("-");
    });
  });

  it("should match usernames with em-dashes", () => {
    const testInputs = [
      "@john–doe",
      "@mary–jane",
      "Hello @test–user",
      "(@user–name",
    ];

    testInputs.forEach((input) => {
      const match = suggestion["openRegex"].exec(input);
      expect(match).not.toBeNull();
      expect(match![1]).toContain("–");
    });
  });

  it("should match usernames with underscores", () => {
    const testInputs = [
      "@john_doe",
      "@mary_jane_watson",
      "Hello @test_user",
      "(@user_name",
    ];

    testInputs.forEach((input) => {
      const match = suggestion["openRegex"].exec(input);
      expect(match).not.toBeNull();
      expect(match![1]).toContain("_");
    });
  });

  it("should match usernames with combined special characters", () => {
    const testInputs = [
      "@john-doe_test",
      "@mary–jane_watson",
      "@user_name-test–example",
      "Hello @complex-user–name_test",
    ];

    testInputs.forEach((input) => {
      const match = suggestion["openRegex"].exec(input);
      expect(match).not.toBeNull();
      // Verify at least one special character is present
      expect(match![1]).toMatch(/[-–_]/);
    });
  });
});

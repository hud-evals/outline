import { User, UserAuthentication } from "@server/models";
import ValidateSSOAccessTask from "../ValidateSSOAccessTask";

jest.mock("@server/models");

describe("ValidateSSOAccessTask", () => {
  let mockUser: any;
  let mockUserAuthentications: any[];
  let task: ValidateSSOAccessTask;

  beforeEach(() => {
    task = new ValidateSSOAccessTask();

    mockUser = {
      id: "user-123",
      rotateJwtSecret: jest.fn().mockResolvedValue(undefined),
    };

    mockUserAuthentications = [];

    (UserAuthentication.findAll as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockUserAuthentications)
    );
    (User.findByPk as jest.Mock).mockImplementation(() =>
      Promise.resolve(mockUser)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should NOT revoke user sessions when at least one authentication is valid, even if others throw errors", async () => {
    // Setup: Mix of valid and error authentications
    const validAuth = {
      validateAccess: jest.fn().mockResolvedValue(true),
    };
    const errorAuth = {
      validateAccess: jest.fn().mockRejectedValue(new Error("Network error")),
    };

    mockUserAuthentications = [errorAuth, validAuth];

    // Execute
    await task.perform({ userId: "user-123" });

    // Verify: User sessions should NOT be revoked because one auth is valid
    expect(mockUser.rotateJwtSecret).not.toHaveBeenCalled();
  });

  it("should revoke user sessions when all authentications are invalid", async () => {
    // Setup: Create multiple authentications that all return false (invalid)
    const invalidAuth1 = {
      validateAccess: jest.fn().mockResolvedValue(false),
    };
    const invalidAuth2 = {
      validateAccess: jest.fn().mockResolvedValue(false),
    };

    mockUserAuthentications = [invalidAuth1, invalidAuth2];

    // Execute
    await task.perform({ userId: "user-123" });

    // Verify: User sessions should be revoked
    expect(mockUser.rotateJwtSecret).toHaveBeenCalledWith({
      transaction: expect.any(Object),
    });
    expect(invalidAuth1.validateAccess).toHaveBeenCalled();
    expect(invalidAuth2.validateAccess).toHaveBeenCalled();
  });

  it("should throw error for retry when all authentications throw errors", async () => {
    // Setup: Create multiple authentications that all throw errors
    const firstError = new Error("Network timeout");
    const errorAuth1 = {
      validateAccess: jest.fn().mockRejectedValue(firstError),
    };
    const errorAuth2 = {
      validateAccess: jest
        .fn()
        .mockRejectedValue(new Error("Service unavailable")),
    };

    mockUserAuthentications = [errorAuth1, errorAuth2];

    // Execute & Verify: Should throw an error for retry
    await expect(task.perform({ userId: "user-123" })).rejects.toThrow();

    // Verify: User sessions should NOT be revoked (error indicates retry needed)
    expect(mockUser.rotateJwtSecret).not.toHaveBeenCalled();
  });

  it("should handle multiple OIDC tokens correctly - the core bug this PR fixes", async () => {
    // This test captures the real bug: Promise.any() resolves with the FIRST result,
    // not necessarily a valid one. If the first auth returns false (invalid),
    // Promise.any() will use that result and logout the user, even if other auths are valid.
    //
    // The bug scenario:
    // 1. User has multiple OIDC tokens
    // 2. First token is invalid (returns false)
    // 3. Second token is valid (returns true)
    // 4. Promise.any() takes the first result (false) and logs out user
    //
    // The fix: Promise.all() + some() checks if ANY auth is valid

    const invalidOidcAuth = {
      validateAccess: jest.fn().mockResolvedValue(false), // This resolves first
    };
    const validOidcAuth = {
      validateAccess: jest.fn().mockResolvedValue(true), // This would save the user
    };

    // Order matters here - invalid first, valid second
    mockUserAuthentications = [invalidOidcAuth, validOidcAuth];

    // Execute
    await task.perform({ userId: "user-123" });

    // Critical assertion: With Promise.any(), this test FAILS because it takes the first
    // result (false) and logs out the user, ignoring the valid second authentication.
    // With Promise.all() + some(), this test PASSES because it checks all results.
    expect(mockUser.rotateJwtSecret).not.toHaveBeenCalled();
  });
});

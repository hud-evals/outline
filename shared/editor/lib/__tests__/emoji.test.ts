import {
  snakeCase,
  getNameFromEmoji,
  getEmojiFromName,
  nameToEmoji,
} from "../emoji";

describe("snakeCase", () => {
  it("converts kebab-case to snake_case", () => {
    expect(snakeCase("flag-sg")).toBe("flag_sg");
  });

  it("handles multiple hyphens", () => {
    expect(snakeCase("some-kebab-case")).toBe("some_kebab_case");
    expect(snakeCase("very-long-kebab-case-string")).toBe(
      "very_long_kebab_case_string"
    );
  });

  it("leaves already snake_case strings unchanged", () => {
    expect(snakeCase("already_snake")).toBe("already_snake");
    expect(snakeCase("snake_case_string")).toBe("snake_case_string");
  });

  it("handles strings without hyphens", () => {
    expect(snakeCase("nohyphens")).toBe("nohyphens");
    expect(snakeCase("singleword")).toBe("singleword");
  });

  it("handles mixed cases", () => {
    expect(snakeCase("part-kebab_part_snake")).toBe("part_kebab_part_snake");
    expect(snakeCase("one-two_three-four")).toBe("one_two_three_four");
  });
});

describe("Flag emoji mapping", () => {
  it("correctly maps flag emoji shortcodes", () => {
    expect(getEmojiFromName("flag_sg")).toBe("🇸🇬");
    expect(getEmojiFromName("us")).toBe("🇺🇸");
    expect(getEmojiFromName("gb")).toBe("🇬🇧");
    expect(getEmojiFromName("jp")).toBe("🇯🇵");
    expect(getEmojiFromName("flag_ca")).toBe("🇨🇦");
  });

  it("handles flag shortcodes with colons", () => {
    expect(getEmojiFromName(":flag_sg:")).toBe("🇸🇬");
    expect(getEmojiFromName(":us:")).toBe("🇺🇸");
  });

  it("nameToEmoji contains flag mappings with snake_case", () => {
    expect(nameToEmoji["flag_sg"]).toBe("🇸🇬");
    expect(nameToEmoji["us"]).toBe("🇺🇸");
    expect(nameToEmoji["gb"]).toBe("🇬🇧");

    expect(nameToEmoji["flag-sg"]).toBeUndefined();
    expect(nameToEmoji["flag-us"]).toBeUndefined();
  });

  it("retrieves correct flag emoji from native character", () => {
    expect(getNameFromEmoji("🇸🇬")).toBe("flag_sg");
    expect(getNameFromEmoji("🇺🇸")).toBe("us");
    expect(getNameFromEmoji("🇬🇧")).toBe("gb");
  });
});

describe("getNameFromEmoji", () => {
  it("returns the correct shortcode", () => {
    expect(getNameFromEmoji("🤔")).toBe("thinking_face");
    expect(getNameFromEmoji("😊")).toBe("blush");
    expect(getNameFromEmoji("👍")).toBe("thumbs_up");
  });

  it("returns undefined for unknown emojis", () => {
    expect(getNameFromEmoji("unknown")).toBeUndefined();
    expect(getNameFromEmoji("💀")).toBeDefined();
  });
});

describe("getEmojiFromName", () => {
  it("returns the correct native character", () => {
    expect(getEmojiFromName("thinking_face")).toBe("🤔");
    expect(getEmojiFromName("blush")).toBe("😊");
    expect(getEmojiFromName("thumbs_up")).toBe("👍");
  });

  it("returns undefined for unknown names", () => {
    expect(getEmojiFromName("unknown_emoji")).toBeUndefined();
    expect(getEmojiFromName("not_an_emoji")).toBeUndefined();
  });

  it("handles special mapped cases", () => {
    expect(getEmojiFromName("thumbs_up")).toBe("👍");
    expect(getEmojiFromName("thumbs_down")).toBe("👎");
  });
});

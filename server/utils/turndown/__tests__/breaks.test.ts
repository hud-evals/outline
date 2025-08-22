import MarkdownIt from "markdown-it";
import breaksRule from "../../../../shared/editor/rules/breaks";

describe("Break Handling (PR #9550 fix)", () => {
  let md: MarkdownIt;

  beforeEach(() => {
    md = new MarkdownIt();
    md.use(breaksRule);
  });

  it("should convert hardbreak tokens to br tokens during markdown parsing", () => {
    const state = {
      tokens: [
        {
          type: "paragraph_open",
          tag: "p",
          nesting: 1,
          children: null,
        },
        {
          type: "inline",
          tag: "",
          nesting: 0,
          children: [
            { type: "text", content: "Line one" },
            { type: "hardbreak", tag: "br", nesting: 0 },
            { type: "text", content: "Line two" },
          ],
        },
        {
          type: "paragraph_close",
          tag: "p",
          nesting: -1,
          children: null,
        },
      ],
      Token(type, tag, nesting) {
        return { type, tag, nesting, children: null };
      },
    };

    // Look for the hardbreaks rule (added in PR #9550)
    const hardbreaksRule = md.core.ruler.__rules__.find(
      (r) => r.name === "hardbreaks"
    );

    if (hardbreaksRule) {
      // Apply the rule that converts hardbreak to br
      hardbreaksRule.fn(state);
    }

    // Count token types after rule application
    const inlineToken = state.tokens.find((t) => t.type === "inline");
    const hardbreakCount =
      inlineToken?.children?.filter((c) => c.type === "hardbreak").length || 0;
    const brCount =
      inlineToken?.children?.filter((c) => c.type === "br").length || 0;

    // After PR #9550 fix: hardbreak should be converted to br
    // Without fix: hardbreak remains as hardbreak
    expect(hardbreakCount).toBe(0); // Should be converted
    expect(brCount).toBe(1); // Should have one br token
  });
});

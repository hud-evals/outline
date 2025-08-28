/** @jest-environment jsdom */
import { EditorStyleHelper } from "../../styles/EditorStyleHelper";
import Paragraph from "../Paragraph";

describe("Paragraph", () => {
  const paragraph = new Paragraph();
  const parseRule = paragraph.schema.parseDOM![0];
  const getAttrs = parseRule.getAttrs as (dom: HTMLElement) => any;

  it("should return empty object for regular paragraph elements", () => {
    const p = document.createElement("p");
    p.textContent = "Regular paragraph text";

    const result = getAttrs(p);
    expect(result).toEqual({});
  });

  it("should return false for paragraphs with image caption class", () => {
    const p = document.createElement("p");
    p.className = EditorStyleHelper.imageCaption;
    p.textContent = "Image caption text";

    const result = getAttrs(p);
    expect(result).toBe(false);
  });

  it("should return false for paragraphs with image caption class among other classes", () => {
    const p = document.createElement("p");
    p.className = `some-other-class ${EditorStyleHelper.imageCaption} another-class`;
    p.textContent = "Image caption text";

    const result = getAttrs(p);
    expect(result).toBe(false);
  });

  it("should handle non-HTMLElement DOM nodes by returning false", () => {
    // Create a text node (which is not an HTMLElement)
    const textNode = document.createTextNode("text");

    const result = getAttrs(textNode as any);
    expect(result).toBe(false);
  });

  it("should handle paragraphs with only whitespace in caption class", () => {
    const p = document.createElement("p");
    p.className = ` ${EditorStyleHelper.imageCaption} `;
    p.textContent = "Image caption text";

    const result = getAttrs(p);
    expect(result).toBe(false);
  });

  it("should not match partial class names", () => {
    const p = document.createElement("p");
    p.className = `not-${EditorStyleHelper.imageCaption}-suffix`;
    p.textContent = "Regular paragraph text";

    const result = getAttrs(p);
    expect(result).toEqual({});
  });
});

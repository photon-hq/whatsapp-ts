import { describe, expect, test } from "bun:test";
import { parseTextContent } from "../../src/utils/text-content.ts";

describe("text content parser contract", () => {
  test("normalizes plain string content into one normal block and one run", () => {
    expect(parseTextContent("Hello WhatsApp")).toEqual([
      {
        type: "normal",
        text: [{ text: "Hello WhatsApp", styles: [] }],
      },
    ]);
  });

  test("preserves leading and trailing whitespace in plain string content", () => {
    expect(parseTextContent("  hello  ")).toEqual([
      {
        type: "normal",
        text: [{ text: "  hello  ", styles: [] }],
      },
    ]);
  });

  test("normalizes a normal block with plain string text", () => {
    expect(parseTextContent([{ text: "Intro" }])).toEqual([
      {
        type: "normal",
        text: [{ text: "Intro", styles: [] }],
      },
    ]);
  });

  test("normalizes a normal block with mixed styled runs", () => {
    expect(
      parseTextContent([
        {
          text: [
            { text: "Hello " },
            { text: "WhatsApp", styles: ["bold"] },
            { text: " users", styles: ["italic"] },
          ],
        },
      ])
    ).toEqual([
      {
        type: "normal",
        text: [
          { text: "Hello ", styles: [] },
          { text: "WhatsApp", styles: ["bold"] },
          { text: " users", styles: ["italic"] },
        ],
      },
    ]);
  });

  test("supports every inline style and preserves style order", () => {
    for (const style of ["bold", "italic", "strikethrough", "code"] as const) {
      expect(
        parseTextContent([
          {
            text: [
              {
                text: "styled",
                styles: [style],
              },
            ],
          },
        ])[0]?.text[0]?.styles
      ).toEqual([style]);
    }
  });

  test("allows every inline style combination", () => {
    const styles = ["bold", "italic", "strikethrough", "code"] as const;
    const combinations: (typeof styles)[number][][] = [];

    function collect(
      startIndex: number,
      combination: (typeof styles)[number][]
    ): void {
      if (combination.length > 0) {
        combinations.push([...combination]);
      }
      for (let index = startIndex; index < styles.length; index++) {
        combination.push(styles[index]);
        collect(index + 1, combination);
        combination.pop();
      }
    }

    collect(0, []);

    for (const combination of combinations) {
      expect(
        parseTextContent([
          {
            text: [
              {
                text: "styled",
                styles: combination,
              },
            ],
          },
        ])[0]?.text[0]?.styles
      ).toEqual(combination);
    }
  });

  test("preserves combined inline style order", () => {
    expect(
      parseTextContent([
        {
          text: [
            {
              text: "styled",
              styles: ["bold", "italic", "strikethrough", "code"],
            },
          ],
        },
      ])[0]?.text[0]?.styles
    ).toEqual(["bold", "italic", "strikethrough", "code"]);
  });

  test("normalizes repeated styles to first occurrence", () => {
    expect(
      parseTextContent([
        {
          text: [
            {
              text: "important",
              styles: ["bold", "italic", "bold", "strikethrough", "italic"],
            },
          ],
        },
      ])[0]?.text[0]?.styles
    ).toEqual(["bold", "italic", "strikethrough"]);
  });

  test("normalizes a quote block with mixed styled runs", () => {
    expect(
      parseTextContent([
        {
          type: "quote",
          text: [
            { text: "Do " },
            { text: "not", styles: ["bold"] },
            { text: " forget" },
          ],
        },
      ])
    ).toEqual([
      {
        type: "quote",
        text: [
          { text: "Do ", styles: [] },
          { text: "not", styles: ["bold"] },
          { text: " forget", styles: [] },
        ],
      },
    ]);
  });

  test("normalizes consecutive bullet blocks as separate items", () => {
    expect(
      parseTextContent([
        { type: "bullet", text: "First item" },
        {
          type: "bullet",
          text: [
            { text: "Second " },
            { text: "important", styles: ["bold"] },
            { text: " item" },
          ],
        },
      ])
    ).toEqual([
      {
        type: "bullet",
        text: [{ text: "First item", styles: [] }],
      },
      {
        type: "bullet",
        text: [
          { text: "Second ", styles: [] },
          { text: "important", styles: ["bold"] },
          { text: " item", styles: [] },
        ],
      },
    ]);
  });

  test("normalizes consecutive numbered blocks as separate items", () => {
    expect(
      parseTextContent([
        { type: "numbered", text: "First step" },
        { type: "numbered", text: "Second step" },
      ])
    ).toEqual([
      {
        type: "numbered",
        text: [{ text: "First step", styles: [] }],
      },
      {
        type: "numbered",
        text: [{ text: "Second step", styles: [] }],
      },
    ]);
  });

  test("normalizes mixed normal, quote, bullet, and numbered blocks", () => {
    expect(
      parseTextContent([
        { text: "Intro" },
        { type: "quote", text: "Remember this" },
        { type: "bullet", text: "Buy milk" },
        { type: "numbered", text: "Pay invoice" },
      ]).map((block) => block.type)
    ).toEqual(["normal", "quote", "bullet", "numbered"]);
  });

  test("uses block boundaries when deciding whether content is blank", () => {
    expect(parseTextContent([{ text: "   " }, { text: "hello" }])).toEqual([
      {
        type: "normal",
        text: [{ text: "   ", styles: [] }],
      },
      {
        type: "normal",
        text: [{ text: "hello", styles: [] }],
      },
    ]);
  });

  test("preserves emoji, composed emoji, Chinese, Arabic, and RTL text", () => {
    const content = parseTextContent([
      {
        text: [
          { text: "你好 " },
          { text: "👨‍👩‍👧‍👦", styles: ["bold"] },
          { text: " مرحبا", styles: ["italic"] },
        ],
      },
    ]);

    expect(content[0]?.text.map((run) => run.text).join("")).toBe(
      "你好 👨‍👩‍👧‍👦 مرحبا"
    );
  });

  test("rejects blank plain string content", () => {
    expect(() => parseTextContent("   ")).toThrow("content must not be blank");
  });

  test("rejects empty content arrays", () => {
    expect(() => parseTextContent([])).toThrow(
      "content must contain at least one block"
    );
  });

  test("rejects empty block string text", () => {
    expect(() => parseTextContent([{ text: "" }])).toThrow(
      "content[0].text must not be empty"
    );
  });

  test("rejects empty run arrays", () => {
    expect(() => parseTextContent([{ text: [] }])).toThrow(
      "content[0].text must contain at least one run"
    );
  });

  test("rejects empty run text", () => {
    expect(() => parseTextContent([{ text: [{ text: "" }] }])).toThrow(
      "content[0].text[0].text must not be empty"
    );
  });

  test("rejects content where all blocks are whitespace", () => {
    expect(() =>
      parseTextContent([{ text: "   " }, { type: "quote", text: "\t" }])
    ).toThrow("content must not be blank");
  });

  test("rejects unsupported block types", () => {
    expect(() =>
      parseTextContent([{ type: "heading" as never, text: "Title" }])
    ).toThrow("content[0].type is not supported");
  });

  test("rejects unsupported run styles", () => {
    expect(() =>
      parseTextContent([
        { text: [{ text: "hello", styles: ["underline" as never] }] },
      ])
    ).toThrow("content[0].text[0].styles contains unsupported style");
  });

  test("rejects object-like invalid content at runtime", () => {
    expect(() => parseTextContent({ text: "hello" } as never)).toThrow(
      "content must be a string or an array of blocks"
    );
  });

  test("rejects invalid block and run shapes at runtime", () => {
    expect(() => parseTextContent(["hello" as never])).toThrow(
      "content[0] must be a block object"
    );
    expect(() => parseTextContent([new Date() as never])).toThrow(
      "content[0] must be a block object"
    );
    expect(() => parseTextContent([{ text: [null as never] }])).toThrow(
      "content[0].text[0] must be a run object"
    );
    expect(() => parseTextContent([{ text: [new Map() as never] }])).toThrow(
      "content[0].text[0] must be a run object"
    );
    expect(() => parseTextContent([{ text: [{ text: 1 as never }] }])).toThrow(
      "content[0].text[0].text must be a string"
    );
    expect(() =>
      parseTextContent([{ text: [{ text: "hello", styles: "bold" as never }] }])
    ).toThrow("content[0].text[0].styles must be an array");
  });

  test("rejects unknown block and run fields", () => {
    expect(() =>
      parseTextContent([{ text: "hello", styles: ["bold"] } as never])
    ).toThrow("content[0].styles is not supported");
    expect(() =>
      parseTextContent([{ text: [{ text: "hello", style: "bold" } as never] }])
    ).toThrow("content[0].text[0].style is not supported");
  });
});

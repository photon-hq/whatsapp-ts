import { validationError } from "../errors/validation-error.ts";
import type {
  TextBlock,
  TextBlockType,
  TextContent,
  TextRun,
  TextStyle,
} from "../types/messages.ts";

export interface NormalizedTextRun {
  readonly styles: readonly TextStyle[];
  readonly text: string;
}

export interface NormalizedTextBlock {
  readonly text: readonly NormalizedTextRun[];
  readonly type: TextBlockType;
}

const textStyles = new Set<TextStyle>([
  "bold",
  "italic",
  "strikethrough",
  "code",
]);

const blockTypes = new Set<TextBlockType>([
  "normal",
  "quote",
  "bullet",
  "numbered",
]);

export function parseTextContent(
  content: TextContent
): readonly NormalizedTextBlock[] {
  let blocks: readonly NormalizedTextBlock[];
  if (typeof content === "string") {
    blocks = [
      { type: "normal" as const, text: [{ text: content, styles: [] }] },
    ];
  } else if (Array.isArray(content)) {
    blocks = parseBlocks(content);
  } else {
    invalid("content must be a string or an array of blocks");
  }

  const joined = blocks
    .map((block) => block.text.map((run) => run.text).join(""))
    .join("\n");

  rejectInvalid(joined.trim() !== "", "content must not be blank", "content");

  return blocks;
}

function parseBlocks(
  blocks: readonly TextBlock[]
): readonly NormalizedTextBlock[] {
  rejectInvalid(
    blocks.length > 0,
    "content must contain at least one block",
    "content"
  );

  return blocks.map((block, index) => {
    const blockPath = `content[${index}]`;
    rejectInvalid(
      isPlainObject(block),
      `${blockPath} must be a block object`,
      blockPath
    );

    rejectUnknownKeys(block, ["type", "text"], blockPath);

    const type = block.type ?? "normal";
    rejectInvalid(
      blockTypes.has(type),
      `${blockPath}.type is not supported`,
      `${blockPath}.type`
    );

    return {
      type,
      text:
        typeof block.text === "string"
          ? [parsePlainBlockText(block.text, `${blockPath}.text`)]
          : parseRuns(block.text, `${blockPath}.text`),
    };
  });
}

function parsePlainBlockText(text: string, path: string): NormalizedTextRun {
  rejectInvalid(text.length > 0, `${path} must not be empty`, path);

  return { text, styles: [] };
}

function parseRuns(
  runs: readonly TextRun[],
  path: string
): readonly NormalizedTextRun[] {
  rejectInvalid(
    Array.isArray(runs),
    `${path} must be a string or an array of runs`,
    path
  );

  rejectInvalid(runs.length > 0, `${path} must contain at least one run`, path);

  return runs.map((run, index) => parseRun(run, `${path}[${index}]`));
}

function parseRun(run: TextRun, path: string): NormalizedTextRun {
  rejectInvalid(isPlainObject(run), `${path} must be a run object`, path);

  rejectUnknownKeys(run, ["text", "styles"], path);

  rejectInvalid(
    typeof run.text === "string",
    `${path}.text must be a string`,
    `${path}.text`
  );

  rejectInvalid(
    run.text.length > 0,
    `${path}.text must not be empty`,
    `${path}.text`
  );

  return {
    text: run.text,
    styles: normalizeStyles(run.styles, `${path}.styles`),
  };
}

function normalizeStyles(
  styles: readonly TextStyle[] | undefined,
  path: string
): readonly TextStyle[] {
  if (styles === undefined) {
    return [];
  }

  rejectInvalid(Array.isArray(styles), `${path} must be an array`, path);

  if (styles.length === 0) {
    return [];
  }

  const normalized: TextStyle[] = [];
  const seen = new Set<TextStyle>();
  for (const style of styles) {
    rejectInvalid(
      textStyles.has(style),
      `${path} contains unsupported style`,
      path
    );
    if (!seen.has(style)) {
      seen.add(style);
      normalized.push(style);
    }
  }

  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    rejectInvalid(
      allowed.has(key),
      `${path}.${key} is not supported`,
      `${path}.${key}`
    );
  }
}

function invalid(message: string, field = "content"): never {
  throw validationError(message, { field });
}

function rejectInvalid(
  condition: boolean,
  message: string,
  field: string
): asserts condition {
  if (!condition) {
    throw validationError(message, { field });
  }
}

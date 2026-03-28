/**
 * LinkedIn Unicode Text Formatter
 *
 * LinkedIn posts are plain text — no HTML/Markdown support.
 * Bold/italic/strikethrough use Unicode Mathematical Alphanumeric Symbols.
 * This is the same technique used by Taplio, AuthoredUp, etc.
 */

type Style = "bold" | "italic" | "boldItalic";

const OFFSETS: Record<Style, Array<{ range: [number, number]; offset: number }>> = {
  bold: [
    { range: [48, 57], offset: 120764 },   // 0-9 → sans-serif bold digits
    { range: [65, 90], offset: 120211 },    // A-Z → sans-serif bold uppercase
    { range: [97, 122], offset: 120205 },   // a-z → sans-serif bold lowercase
  ],
  italic: [
    { range: [65, 90], offset: 119795 },    // A-Z → serif italic uppercase
    { range: [97, 122], offset: 119789 },   // a-z → serif italic lowercase
  ],
  boldItalic: [
    { range: [65, 90], offset: 119847 },    // A-Z → serif bold italic uppercase
    { range: [97, 122], offset: 119841 },   // a-z → serif bold italic lowercase
  ],
};

function toUnicode(text: string, style: Style): string {
  return [...text]
    .map((char) => {
      const cp = char.codePointAt(0)!;
      for (const { range, offset } of OFFSETS[style]) {
        if (cp >= range[0] && cp <= range[1]) {
          return String.fromCodePoint(cp + offset);
        }
      }
      return char; // spaces, punctuation, emoji pass through
    })
    .join("");
}

function toStrikethrough(text: string): string {
  return [...text].map((c) => c + "\u0336").join("");
}

// ── TipTap JSON → LinkedIn Unicode ─────────────────────────

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
  attrs?: Record<string, unknown>;
}

/**
 * Convert TipTap editor JSON to LinkedIn-formatted plain text with Unicode formatting.
 */
export function tiptapToLinkedIn(doc: TipTapNode): string {
  if (!doc.content) return "";
  return doc.content.map((node) => convertNode(node)).join("");
}

function convertNode(node: TipTapNode): string {
  switch (node.type) {
    case "paragraph":
      return (node.content?.map(convertNode).join("") ?? "") + "\n\n";

    case "hardBreak":
      return "\n";

    case "text":
      return convertTextNode(node);

    case "bulletList":
      return (
        (node.content ?? [])
          .map((item) => "• " + (item.content?.map(convertNode).join("").trim() ?? ""))
          .join("\n") + "\n\n"
      );

    case "orderedList": {
      const start = (node.attrs?.start as number) ?? 1;
      return (
        (node.content ?? [])
          .map((item, i) => `${start + i}. ` + (item.content?.map(convertNode).join("").trim() ?? ""))
          .join("\n") + "\n\n"
      );
    }

    case "listItem":
      return node.content?.map(convertNode).join("") ?? "";

    case "blockquote":
      return (
        (node.content ?? [])
          .map((child) => "│ " + convertNode(child).trim())
          .join("\n") + "\n\n"
      );

    default:
      // Unknown node — recurse into children
      return node.content?.map(convertNode).join("") ?? "";
  }
}

function convertTextNode(node: TipTapNode): string {
  let text = node.text ?? "";
  if (!node.marks || node.marks.length === 0) return text;

  const markTypes = new Set(node.marks.map((m) => m.type));
  const isBold = markTypes.has("bold");
  const isItalic = markTypes.has("italic");
  const isStrike = markTypes.has("strike");

  if (isBold && isItalic) {
    text = toUnicode(text, "boldItalic");
  } else if (isBold) {
    text = toUnicode(text, "bold");
  } else if (isItalic) {
    text = toUnicode(text, "italic");
  }

  if (isStrike) {
    text = toStrikethrough(text);
  }

  return text;
}

/**
 * Convert plain text with Unicode formatting back to regular text.
 * Used to get the raw character count (Unicode chars count as multiple codepoints).
 */
export function linkedInPlainLength(text: string): number {
  // Count actual visible characters, not codepoints
  // Each Unicode-formatted letter is 1 visible char but may be 2 UTF-16 code units
  return [...text].filter((c) => c !== "\u0336" && c !== "\u0332").length;
}

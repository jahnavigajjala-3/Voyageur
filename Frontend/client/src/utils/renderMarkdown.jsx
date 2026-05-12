/**
 * Lightweight markdown → JSX renderer for AI chat messages.
 * Handles: **bold**, *italic*, `code`, numbered lists, bullet lists, line breaks.
 * No external dependencies.
 */

function parseLine(line, key) {
  // Split on **bold**, *italic*, `code`
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(line.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} style={{
          background: "rgba(0,0,0,0.08)",
          borderRadius: "3px",
          padding: "1px 4px",
          fontFamily: "monospace",
          fontSize: "0.9em",
        }}>{match[4]}</code>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < line.length) {
    parts.push(line.slice(last));
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

export function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list item: "1. " or "1) "
    if (/^\d+[\.\)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[\.\)]\s/.test(lines[i])) {
        const content = lines[i].replace(/^\d+[\.\)]\s/, "");
        items.push(<li key={i} style={{ marginBottom: "2px" }}>{parseLine(content, i)}</li>);
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>
          {items}
        </ol>
      );
      continue;
    }

    // Bullet list item: "- " or "* " or "• "
    if (/^[-*•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        const content = lines[i].replace(/^[-*•]\s/, "");
        items.push(<li key={i} style={{ marginBottom: "2px" }}>{parseLine(content, i)}</li>);
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: "16px", margin: "4px 0", listStyleType: "disc" }}>
          {items}
        </ul>
      );
      continue;
    }

    // Empty line → small gap
    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Normal line
    elements.push(
      <span key={i} style={{ display: "block" }}>
        {parseLine(line, i)}
      </span>
    );
    i++;
  }

  return <>{elements}</>;
}

import React from "react";

interface HighlightTextProps {
  text: string;
  keywords?: string[];
  className?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  keywords = [],
  className = "",
}) => {
  if (!text) return null;

  // Step 1: Split by markdown bold markers (**concept**)
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

  // Helper to highlight keywords within plain text slices
  const highlightKeywordsInPlain = (plainStr: string, keyPrefix: string) => {
    if (!keywords || keywords.length === 0 || !plainStr.trim()) {
      return plainStr;
    }

    // Filter out very short keywords and build regex
    const validKw = keywords
      .map((k) => k.trim())
      .filter((k) => k.length > 2)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (validKw.length === 0) return plainStr;

    const regex = new RegExp(`(${validKw.join("|")})`, "gi");
    const subParts = plainStr.split(regex);

    return subParts.map((sub, i) => {
      const isMatch = validKw.some(
        (kw) => sub.toLowerCase() === kw.toLowerCase()
      );
      if (isMatch) {
        return (
          <span
            key={`${keyPrefix}-kw-${i}`}
            className="text-amber-300 font-semibold bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/30"
          >
            {sub}
          </span>
        );
      }
      return sub;
    });
  };

  return (
    <span className={className}>
      {boldParts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          const content = part.slice(2, -2);
          return (
            <mark
              key={`bold-${idx}`}
              className="bg-indigo-500/25 text-indigo-200 font-bold px-1.5 py-0.5 rounded border border-indigo-500/40 not-italic inline-block my-0.5"
            >
              {content}
            </mark>
          );
        }
        return (
          <React.Fragment key={`plain-${idx}`}>
            {highlightKeywordsInPlain(part, `p-${idx}`)}
          </React.Fragment>
        );
      })}
    </span>
  );
};

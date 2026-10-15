"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
  /** When true (user bubble), applies white text styling */
  isUser?: boolean;
}

/**
 * Renders AI markdown responses cleanly:
 * - Strips ** bold syntax (renders as <strong>)
 * - Renders lists, headings, inline code, and paragraphs
 * - Applies context-aware colour classes (user bubble vs assistant bubble)
 */
export function MarkdownContent({ content, isUser = false }: MarkdownContentProps) {
  const base = isUser ? "text-white" : "text-[#172B4D]";

  return (
    <ReactMarkdown
      components={{
        // Paragraphs — preserve spacing
        p: ({ children }) => (
          <p className={`mb-1.5 last:mb-0 leading-relaxed ${base}`}>{children}</p>
        ),
        // Bold — rendered visually without showing **
        strong: ({ children }) => (
          <strong className={`font-semibold ${isUser ? "text-white" : "text-slate-900"}`}>
            {children}
          </strong>
        ),
        // Italic
        em: ({ children }) => <em className="italic">{children}</em>,
        // Unordered list
        ul: ({ children }) => (
          <ul className={`list-disc pl-4 space-y-0.5 mb-1.5 ${base}`}>{children}</ul>
        ),
        // Ordered list
        ol: ({ children }) => (
          <ol className={`list-decimal pl-4 space-y-0.5 mb-1.5 ${base}`}>{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // Headings
        h1: ({ children }) => (
          <h1 className={`text-sm font-bold mb-1 mt-2 first:mt-0 ${base}`}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className={`text-xs font-bold mb-1 mt-2 first:mt-0 ${base}`}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className={`text-xs font-semibold mb-0.5 mt-1.5 first:mt-0 ${base}`}>{children}</h3>
        ),
        // Inline code
        code: ({ children }) => (
          <code
            className={`rounded px-1 py-0.5 font-mono text-[11px] ${
              isUser
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-indigo-700"
            }`}
          >
            {children}
          </code>
        ),
        // Code block
        pre: ({ children }) => (
          <pre
            className={`rounded-lg p-2.5 font-mono text-[11px] overflow-x-auto mb-1.5 ${
              isUser ? "bg-white/15 text-white" : "bg-slate-50 border border-slate-200 text-slate-800"
            }`}
          >
            {children}
          </pre>
        ),
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote
            className={`border-l-2 pl-3 italic my-1 ${
              isUser ? "border-white/40 text-white/80" : "border-indigo-300 text-slate-600"
            }`}
          >
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => (
          <hr className={`my-2 ${isUser ? "border-white/30" : "border-slate-200"}`} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ 
  children, 
  className = "" 
}: MarkdownRendererProps) {
  if (!children) {
    return null;
  }

  return (
    <div className={`prose prose-sm max-w-none prose-slate dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom styling for code blocks
          pre: ({ children }) => (
            <pre className="bg-muted p-3 rounded-md my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          // Custom styling for inline code
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            // Block code (inside pre)
            return (
              <code className={`text-sm font-mono ${className || ''}`}>
                {children}
              </code>
            );
          },
          // Custom styling for links
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Custom styling for headings
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-3 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-2 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium mt-4 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium mt-3 mb-1 first:mt-0">
              {children}
            </h4>
          ),
          // Custom styling for paragraphs
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed">
              {children}
            </p>
          ),
          // Custom styling for lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          // Custom styling for blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Custom styling for tables (from remarkGfm)
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-border">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 bg-muted font-semibold text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

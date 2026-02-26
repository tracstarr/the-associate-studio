import Markdown from "react-markdown";
import type { SessionTab } from "@/stores/sessionStore";
import { parseFrontmatter, FrontmatterBlock } from "@/lib/frontmatter";

interface ExtensionViewProps {
  tab: SessionTab;
}

export function ExtensionView({ tab }: ExtensionViewProps) {
  const { fm, body } = parseFrontmatter(tab.markdownContent ?? "");

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg-base)]">
      <div className="max-w-3xl mx-auto px-8 py-6 prose prose-invert prose-sm">
        {fm && <FrontmatterBlock fm={fm} />}
        <Markdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 pb-2 border-b border-[var(--color-border-muted)]">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mt-6 mb-2">
                {children}
              </h2>
            ),
            p: ({ children }) => (
              <p className="text-xs text-[var(--color-text-secondary)] mb-3 leading-relaxed">
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="text-[var(--color-text-primary)] font-semibold">
                {children}
              </strong>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <code className="block bg-[var(--color-bg-raised)] text-[var(--color-text-secondary)] p-3 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre">
                    {children}
                  </code>
                );
              }
              return (
                <code className="bg-[var(--color-bg-raised)] text-[var(--color-accent-secondary)] px-1.5 py-0.5 rounded text-xs font-mono">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="bg-[var(--color-bg-raised)] rounded-lg p-0 mb-3 overflow-x-auto">
                {children}
              </pre>
            ),
            hr: () => (
              <hr className="border-[var(--color-border-muted)] my-4" />
            ),
            ul: ({ children }) => (
              <ul className="text-xs text-[var(--color-text-secondary)] mb-3 pl-4 list-disc">
                {children}
              </ul>
            ),
            li: ({ children }) => (
              <li className="mb-1">{children}</li>
            ),
          }}
        >
          {body}
        </Markdown>
      </div>
    </div>
  );
}

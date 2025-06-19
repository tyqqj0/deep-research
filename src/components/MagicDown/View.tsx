import dynamic from "next/dynamic";
import { useMemo, useId, memo } from "react";
import { marked } from "marked";
import ReactMarkdown, { type Options, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
// import { useSettingStore } from "@/store/setting";
import { clsx } from "clsx";
// import { animateText } from "@/utils/animate-text";
import { omit } from "radash";

import "katex/dist/katex.min.css";
import "./style.css";

const Code = dynamic(() => import("./Code"));
const Mermaid = dynamic(() => import("./Mermaid"));

export type MarkdownProps = {
  id?: string;
  className?: string;
  children: string;
  components?: Partial<Components>;
};

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}

function MarkdownBlock({ children: content, ...rest }: Options) {
  // const { language } = useSettingStore();

  const remarkPlugins = useMemo(
    () => rest.remarkPlugins ?? [],
    [rest.remarkPlugins]
  );
  const rehypePlugins = useMemo(
    () => rest.rehypePlugins ?? [],
    [rest.rehypePlugins]
  );
  const components = useMemo(() => rest.components ?? {}, [rest.components]);

  return (
    <ReactMarkdown
      {...rest}
      remarkPlugins={[remarkGfm, remarkMath, remarkBreaks, ...remarkPlugins]}
      rehypePlugins={[
        [rehypeHighlight, { detect: true, ignoreMissing: true }],
        rehypeKatex,
        // animateText(language),
        ...rehypePlugins,
      ]}
      components={{
        pre: (props) => {
          const { children, className, ...rest } = props;
          return (
            <pre
              {...omit(rest, ["node"])}
              className={clsx("my-4 not-prose", className)}
            >
              {children}
            </pre>
          );
        },
        code: (props) => {
          const { children, className, ...rest } = props;
          const isInline =
            !props.node?.position?.start.line ||
            props.node?.position?.start.line === props.node?.position?.end.line;

          if (isInline) {
            return (
              <span
                className={clsx(
                  "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
                  className
                )}
                {...props}
              >
                {children}
              </span>
            );
          }

          if (className?.includes("hljs")) {
            const lang = /language-(\w+)/.exec(className || "");
            if (lang && lang[1] === "mermaid") {
              return <Mermaid>{children}</Mermaid>;
            }
            return (
              <Code lang={lang ? lang[1] : "plaintext"}>
                <code
                  {...omit(rest, ["node"])}
                  className={clsx("break-all", className)}
                >
                  {children}
                </code>
              </Code>
            );
          } else {
            return (
              <code
                {...omit(rest, ["node"])}
                className={clsx("break-all", className)}
              >
                {children}
              </code>
            );
          }
        },
        a: (props) => {
          const { children, className, href = "", target, ...rest } = props;
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure>
                <audio controls src={href}></audio>
              </figure>
            );
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video controls width="99.9%">
                <source src={href} />
              </video>
            );
          }
          const isInternal = /^\/#/i.test(href);
          const isReferenceLink = /^[0-9]*$/.test(children?.toString() || "");
          return (
            <a
              {...omit(rest, ["node"])}
              className={clsx("break-all", className, {
                reference: isReferenceLink,
              })}
              href={href}
              target={isInternal ? "_self" : target ?? "_blank"}
            >
              {children}
            </a>
          );
        },
        img: (props) => {
          const { className, src, alt, ...rest } = props;
          return (
            <picture
              className={clsx(
                "my-2 flex justify-center items-center w-4/5 max-sm:w-full h-[50vw] max-sm:h-80 m-auto",
                className
              )}
            >
              <img
                className="size-full object-cover rounded transition-all duration-200 ease-out"
                {...omit(rest, ["node"])}
                src={src}
                alt={alt}
                title={alt}
                referrerPolicy="no-referrer"
                rel="noopener noreferrer"
              />
            </picture>
          );
        },
        ...components,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const MemoizedMarkdownBlock = memo(
  ({ children }: MarkdownProps) => {
    return <MarkdownBlock>{children}</MarkdownBlock>;
  },
  (prevProps, nextProps) => {
    if (prevProps.children !== nextProps.children) return false;
    return true;
  }
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

function MarkdownView({ children, id, className, components }: MarkdownProps) {
  const generatedId = useId();
  const blockId = id ?? generatedId;
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children]);

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          components={components}
        >
          {block}
        </MemoizedMarkdownBlock>
      ))}
    </div>
  );
}

MarkdownView.displayName = "MarkdownView";

export default memo(MarkdownView);

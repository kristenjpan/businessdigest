import type { DigestItem, StoryType } from "../../pipeline/types";
import { hostOf, publishedLabel, STORY_TYPE_LABEL, storyTypeOf } from "../lib/format";

const TYPE_ICON: Record<StoryType, React.ReactNode> = {
  news: <path d="M3 3.5h8v9H4a1 1 0 0 1-1-1v-8Zm8 2h2v6a1 1 0 0 1-2 0M5 6h4M5 8.5h4M5 11h2.5" />,
  quote: <path d="M3 9.5c0-2.5 1-4 3-5M3 9.5h2.5V12H3Zm6 0c0-2.5 1-4 3-5M9 9.5h2.5V12H9Z" />,
  podcast: <path d="M8 2.5a2 2 0 0 1 2 2V8a2 2 0 0 1-4 0V4.5a2 2 0 0 1 2-2ZM4.5 7.5a3.5 3.5 0 0 0 7 0M8 11v2.5" />,
  filing: <path d="M4 2.5h5l3 3v8H4Zm5 0v3h3M6 9h4M6 11h4" />,
  letter: <path d="M2.5 4h11v8h-11Zm0 0L8 8.5 13.5 4" />,
};

/** "News", "Direct Quote", "Podcast", "Filing" or "Letter", so readers know what kind of source this is. */
export function StoryTypeBadge({ item }: { item: DigestItem }) {
  const type = storyTypeOf(item);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {TYPE_ICON[type]}
      </svg>
      {STORY_TYPE_LABEL[type]}
    </span>
  );
}

export function Importance({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Importance ${level} of 5`} aria-label={`Importance ${level} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden className={`h-1.5 w-1.5 rounded-full ${i < level ? "sec-bg" : "bg-rule-strong"}`} />
      ))}
    </span>
  );
}

function Block({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[18px_1fr] gap-x-2.5">
      <span aria-hidden className="mt-[3px] text-muted">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-0.5 text-[15px] leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

const icons = {
  takeaway: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  why: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5v4M8 5v.01" strokeLinecap="round" />
    </svg>
  ),
  market: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12.5 6 8l3 2.5 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

interface Props {
  item: DigestItem;
  onFirm?: (firm: string) => void;
}

export function DigestCard({ item, onFirm }: Props) {
  return (
    <article data-section={item.section} className="relative rounded-xl border border-rule bg-surface p-5 sm:p-6">
      <span aria-hidden className="sec-bg absolute top-5 bottom-5 left-0 w-[3px] rounded-r sm:top-6 sm:bottom-6" />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
        <span className="sec-text sec-tint rounded-full px-2 py-0.5 font-semibold">{item.theme.label}</span>
        <Importance level={item.importance} />
        <StoryTypeBadge item={item} />
      </div>

      <h3 className="font-display mt-3 text-[21px] leading-snug font-semibold text-ink sm:text-[23px]">
        <a href={item.url} target="_blank" rel="noreferrer" className="decoration-rule-strong underline-offset-4 hover:underline">
          {item.title}
        </a>
      </h3>
      <p className="mt-1.5 text-[13px] text-muted">
        <a href={item.source.homepage} target="_blank" rel="noreferrer" className="font-medium text-ink-soft hover:underline">
          {item.source.name}
        </a>
        <span aria-hidden> · </span>
        <time dateTime={item.publishedAt}>{publishedLabel(item.publishedAt)}</time>
      </p>

      <div className="mt-4 space-y-3.5">
        <Block label="Key takeaway" icon={icons.takeaway}>
          <span className="text-ink">{item.takeaway}</span>
        </Block>
        <Block label="Why it matters" icon={icons.why}>
          {item.whyItMatters}
        </Block>
        <Block label="Market context" icon={icons.market}>
          {item.marketContext}
        </Block>
      </div>

      {item.beginnerNote && (
        <details className="group mt-4 rounded-lg bg-brass-soft px-3.5 py-2.5">
          <summary className="flex items-center gap-2 text-[13px] font-semibold text-brass">
            <svg aria-hidden viewBox="0 0 16 16" className="chev h-3 w-3 transition-transform" fill="currentColor">
              <path d="M5 3l6 5-6 5z" />
            </svg>
            New to this? <span className="font-normal text-ink-soft">{item.beginnerNote.term}</span>
          </summary>
          <p className="mt-1.5 pl-5 text-[14px] leading-relaxed text-ink-soft">{item.beginnerNote.explanation}</p>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
        <div className="flex flex-wrap gap-1.5">
          {item.firms.map((f) =>
            onFirm ? (
              <button
                key={f}
                type="button"
                onClick={() => onFirm(f)}
                className="rounded-md border border-rule px-2 py-0.5 text-[12px] font-medium text-ink-soft hover:border-rule-strong hover:bg-surface-muted"
                title={`Show only stories mentioning ${f}`}
              >
                {f}
              </button>
            ) : (
              <span key={f} className="rounded-md border border-rule px-2 py-0.5 text-[12px] font-medium text-ink-soft">
                {f}
              </span>
            ),
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted"
          title={item.aiSummarized ? "The takeaway was written by AI from the publisher's headline and excerpt" : "The takeaway is taken from the publisher's own excerpt"}
        >
          <span>{item.aiSummarized ? "AI-summarized" : "Summary from the source's excerpt"}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent group-hover:underline">
            Read the original at {hostOf(item.url)}
            <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 11 11 5M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </a>
      </div>
    </article>
  );
}

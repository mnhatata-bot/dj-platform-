export type ContentBlock = {
  id: string;
  type: "hero" | "text" | "image" | "cta" | "faq" | "feature-grid";
  heading: string;
  body: string;
  url: string;
  alt: string;
};
export function safeLink(url: string) {
  return /^\/(?!\/)/.test(url) || /^https:\/\//i.test(url) ? url : undefined;
}
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="cms-blocks">
      {blocks.map((b, index) => {
        const link = safeLink(b.url || "");
        if (b.type === "image")
          return (
            <figure key={b.id || index}>
              {link && <img src={link} alt={b.alt || ""} loading="lazy" />}
              <figcaption>{b.body}</figcaption>
            </figure>
          );
        if (b.type === "faq")
          return (
            <details key={b.id || index}>
              <summary>{b.heading}</summary>
              <p>{b.body}</p>
            </details>
          );
        if (b.type === "cta")
          return (
            <section key={b.id || index}>
              <h2>{b.heading}</h2>
              <p>{b.body}</p>
              {link && (
                <a className="button primary" href={link}>
                  {b.alt || b.heading}
                </a>
              )}
            </section>
          );
        return (
          <section className={`cms-${b.type}`} key={b.id || index}>
            {b.type === "hero" ? <h1>{b.heading}</h1> : <h2>{b.heading}</h2>}
            <p>{b.body}</p>
          </section>
        );
      })}
    </div>
  );
}

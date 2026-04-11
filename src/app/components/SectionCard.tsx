import { PropsWithChildren } from "react";

type SectionCardProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  accent?: "blue" | "amber" | "slate";
}>;

export function SectionCard({
  eyebrow,
  title,
  description,
  accent = "slate",
  children,
}: SectionCardProps) {
  return (
    <section className={`section-card section-card--${accent}`}>
      {eyebrow ? <p className="section-card__eyebrow">{eyebrow}</p> : null}
      <div className="section-card__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

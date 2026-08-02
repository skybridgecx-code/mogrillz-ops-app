import type { HTMLAttributes, ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3";

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headingLevel?: HeadingLevel;
  title: ReactNode;
}

export function SectionHeader({
  action,
  className,
  description,
  eyebrow,
  headingLevel = "h2",
  title,
  ...props
}: SectionHeaderProps) {
  const HeadingTag = headingLevel;
  const classes = ["section-header", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      <div className="section-header__content">
        {eyebrow ? <p className="section-header__eyebrow">{eyebrow}</p> : null}
        <HeadingTag className="section-header__title">{title}</HeadingTag>
        {description ? <p className="section-header__description">{description}</p> : null}
      </div>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  );
}

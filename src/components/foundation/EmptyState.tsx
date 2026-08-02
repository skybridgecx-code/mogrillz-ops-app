import type { HTMLAttributes, ReactNode } from "react";

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "title"> {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
}

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  const classes = ["empty-state", className].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      <div className="empty-state__content">
        {icon ? (
          <div aria-hidden="true" className="empty-state__icon">
            {icon}
          </div>
        ) : null}
        <h3 className="empty-state__title">{title}</h3>
        {description ? <p className="empty-state__description">{description}</p> : null}
        {action ? <div className="empty-state__action">{action}</div> : null}
      </div>
    </div>
  );
}

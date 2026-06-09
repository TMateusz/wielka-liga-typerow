import { getTeamFlagClass } from "@shared/team-flags";

type Props = {
  name: string;
  className?: string;
  nameClassName?: string;
  flagWidth?: number;
  showName?: boolean;
  layout?: "inline" | "stack";
};

export function TeamWithFlag({
  name,
  className = "",
  nameClassName = "",
  flagWidth = 24,
  showName = true,
  layout = "inline",
}: Props) {
  const flagClass = getTeamFlagClass(name);
  const height = Math.round(flagWidth * 0.72);

  if (!flagClass) {
    return showName ? <span className={className}>{name}</span> : null;
  }

  const flag = (
    <span
      className={`${flagClass} shrink-0 rounded-sm shadow-sm ring-1 ring-white/10`}
      style={{ width: flagWidth, height }}
      role="img"
      aria-label={name}
    />
  );

  if (!showName) return <span className={className}>{flag}</span>;

  if (layout === "stack") {
    return (
      <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
        {flag}
        <span className={nameClassName}>{name}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {flag}
      <span className={nameClassName}>{name}</span>
    </span>
  );
}

import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "left",
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className="mb-4 font-mono text-[13px] tracking-[0.1em] text-amber">{eyebrow}</p>
      <h2 id={id} className="text-[2rem] font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem]">
        {title}
      </h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

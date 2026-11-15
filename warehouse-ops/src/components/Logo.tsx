export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#10294a" />
        <path d="M7 14 16 8l9 6v10H7z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 24v-6h8v6" fill="none" stroke="#f59e0b" strokeWidth="2" />
      </svg>
      Warehouse Ops
    </span>
  );
}

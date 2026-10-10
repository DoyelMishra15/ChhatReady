export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0B6B4F" />
      <path d="M10 38 32 20l22 18" fill="none" stroke="#FAF8F3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="42" r="8" fill="#F5A524" />
    </svg>
  );
}

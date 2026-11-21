export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="aiva-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4DA3FF" />
          <stop offset="1" stopColor="#1F6BFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0B1A3A" />
      <path
        d="M8 23 15 9h2l7 14h-3.2l-1.6-3.4h-6.4L11.2 23Z"
        fill="url(#aiva-mark)"
      />
      <path d="M13.9 17h4.2L16 12.4Z" fill="#0B1A3A" />
      <circle cx="24" cy="9" r="2" fill="#C9D1DC" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="aiva-silver-text text-[15px] font-semibold tracking-[0.18em]">
          AIVA
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-electric">
          Motion Studio
        </span>
      </span>
    </span>
  );
}

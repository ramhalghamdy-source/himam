type IconProps = { size?: number; className?: string };

export function FlameIcon({ size = 22, active = true, className }: IconProps & { active?: boolean }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="himam-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f08a24" />
          <stop offset="1" stopColor="#f6c453" />
        </linearGradient>
      </defs>
      <path
        d="M12.4 2.2c.5 3.3-1.3 5-2.9 6.7C7.8 10.6 6.2 12.3 6.2 15a5.9 5.9 0 0 0 5.9 6 5.9 5.9 0 0 0 5.9-6.2c0-2.3-1-3.8-2.1-5-.3 1.3-1 2.1-1.9 2.5.5-3.6-.7-7.4-1.6-10.1z"
        fill={active ? 'url(#himam-flame)' : '#b8c9c5'}
      />
      <path
        d="M12.1 21c-1.9 0-3.2-1.3-3.2-3.1 0-1.7 1.1-2.6 2.1-3.7.4 1 1 1.4 1.6 1.7 0-.9.3-1.7.8-2.4.9 1 1.9 2 1.9 3.9 0 2-1.5 3.6-3.2 3.6z"
        fill={active ? '#fff3c9' : '#dbe6e3'}
        opacity=".85"
      />
    </svg>
  );
}

export function BellIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function GlobeIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19" />
      <path d="M12 2.5c2.7 2.7 4 6 4 9.5s-1.3 6.8-4 9.5c-2.7-2.7-4-6-4-9.5s1.3-6.8 4-9.5z" />
    </svg>
  );
}

export function CheckIcon({ size = 12, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

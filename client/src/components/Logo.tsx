// Custom geometric "warped perspective grid" logo mark.
export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Projeksiyon Mapper logosu"
      role="img"
    >
      {/* warped quad outline */}
      <path
        d="M4 9 L28 4 L26 27 L6 24 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* perspective grid lines */}
      <path d="M4 9 L26 27 M28 4 L6 24" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      <path
        d="M16 6.5 L16 25.5 M5 16.5 L27 15.5"
        stroke="currentColor"
        strokeWidth="0.9"
        opacity="0.5"
      />
    </svg>
  );
}

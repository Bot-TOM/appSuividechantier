interface LogoProps {
  size?: number
  className?: string
}

export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>

      {/* Fond arrondi */}
      <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />

      {/* Rayons */}
      <g stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" opacity="0.9">
        {/* Haut */}
        <line x1="16" y1="4.5" x2="16" y2="7" />
        {/* Bas */}
        <line x1="16" y1="25" x2="16" y2="27.5" />
        {/* Gauche */}
        <line x1="4.5" y1="16" x2="7" y2="16" />
        {/* Droite */}
        <line x1="25" y1="16" x2="27.5" y2="16" />
        {/* Diagonales */}
        <line x1="7.8" y1="7.8" x2="9.6" y2="9.6" />
        <line x1="22.4" y1="22.4" x2="24.2" y2="24.2" />
        <line x1="24.2" y1="7.8" x2="22.4" y2="9.6" />
        <line x1="9.6" y1="22.4" x2="7.8" y2="24.2" />
      </g>

      {/* Cercle central soleil */}
      <circle cx="16" cy="16" r="5.5" fill="url(#coreGrad)" />

      {/* Reflet */}
      <circle cx="14.2" cy="14.2" r="1.5" fill="white" opacity="0.35" />
    </svg>
  )
}

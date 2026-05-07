import { useState } from 'react'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean   // undefined = pas de badge, true = en ligne, false = hors ligne
  className?: string
}

const SIZES = {
  sm:  'w-7 h-7 text-[11px]',
  md:  'w-9 h-9 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-16 h-16 text-2xl',
}

const DOTS = {
  sm:  'w-2 h-2 border',
  md:  'w-2.5 h-2.5 border',
  lg:  'w-3 h-3 border-2',
  xl:  'w-3.5 h-3.5 border-2',
}

export default function Avatar({ name, avatarUrl, size = 'md', online, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = SIZES[size]
  const initials  = name?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {avatarUrl && !imgError
        ? <img
            src={avatarUrl}
            alt={name}
            onError={() => setImgError(true)}
            className={`${sizeClass} rounded-full object-cover`}
          />
        : <div
            className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white`}
            style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
          >
            {initials}
          </div>
      }
      {online === true && (
        <span className={`absolute bottom-0 right-0 ${DOTS[size]} rounded-full bg-green-400 border-white`} />
      )}
    </div>
  )
}

import { useState } from 'react'

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm:  'w-7 h-7 text-[11px]',
  md:  'w-9 h-9 text-sm',
  lg:  'w-12 h-12 text-base',
  xl:  'w-16 h-16 text-2xl',
}

export default function Avatar({ name, avatarUrl, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const initials = name?.charAt(0).toUpperCase() ?? '?'
  const sizeClass = SIZES[size]

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ background: 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)' }}
    >
      {initials}
    </div>
  )
}

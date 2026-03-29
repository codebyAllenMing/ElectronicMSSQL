import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

const variants: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40',
  ghost:
    'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
}

export default function Button({ variant = 'ghost', className = '', ...props }: Props): JSX.Element {
  return (
    <button
      {...props}
      className={`px-3 py-1.5 text-sm rounded transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  )
}

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/format'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onDown = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onDown, true)
    }
  }, [onClose])

  const width = 196
  const height = items.length * 32 + 10
  const left = Math.min(x, window.innerWidth - width - 8)
  const top = Math.min(y, window.innerHeight - height - 8)

  return createPortal(
    <div
      className="fade fixed z-[70] border border-line bg-paper py-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
      style={{ left, top, width }}
      onMouseDown={(event) => event.stopPropagation()}
      role="menu"
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.separatorBefore && <div className="my-1 h-px bg-line" />}
          <button
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={cx(
              'flex h-8 w-full items-center gap-2.5 px-3 text-left text-[12px] transition-colors disabled:opacity-40',
              item.danger
                ? 'text-alert hover:bg-alert hover:text-paper'
                : 'text-muted hover:bg-ink hover:text-paper',
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

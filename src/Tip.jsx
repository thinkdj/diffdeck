// Tooltip on hover or keyboard focus.  <Tip text="What this means">trigger</Tip>
import { useId } from 'react'

export function Tip({ text, children }) {
  const id = useId()
  return (
    <span className="tip" tabIndex={0} aria-describedby={id}>
      {children}
      <span className="tip__bubble" role="tooltip" id={id}>{text}</span>
    </span>
  )
}

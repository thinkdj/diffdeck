// Tooltips.
//   <Tip text="What this means">trigger</Tip>  shows at once on hover or keyboard focus (the status dot).
//   <TitleTips />, rendered once, turns every title="" on the page into the same styled bubble after DELAY.
//   The title moves to data-title while hovered so the browser's own tooltip never shows, and comes back after.
//   The bubble is a manual popover, so it sits in the top layer, above open dialogs too.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

const DELAY = 1500
const GAP = 8 // px between the element and the bubble, and from the screen's edges

export function Tip({ text, children }) {
  const id = useId()
  return (
    <span className="tip" tabIndex={0} aria-describedby={id}>
      {children}
      <span className="tip__bubble" role="tooltip" id={id}>{text}</span>
    </span>
  )
}

export function TitleTips() {
  const [tip, setTip] = useState(null) // { text, rect } of the element being hovered, once DELAY has passed
  const ref = useRef(null)

  useEffect(() => {
    let el = null
    let timer
    const hide = () => {
      clearTimeout(timer)
      if (el) {
        if (el.dataset.title != null) el.setAttribute('title', el.dataset.title)
        delete el.dataset.title
        el = null
      }
      setTip(null)
    }
    const over = (e) => {
      const t = e.target.closest?.('[title], [data-title]')
      if (t === el) return // moving between the children of the hovered element
      hide()
      const text = t?.getAttribute('title') || t?.dataset.title
      if (!text) return
      el = t
      t.dataset.title = text
      t.removeAttribute('title')
      timer = setTimeout(() => setTip({ text, rect: t.getBoundingClientRect() }), DELAY)
    }
    const out = (e) => el && !el.contains(e.relatedTarget) && hide()
    addEventListener('pointerover', over)
    addEventListener('pointerout', out)
    addEventListener('pointerdown', hide, true) // a click, a scroll or a key ends it
    addEventListener('scroll', hide, true)
    addEventListener('keydown', hide)
    return () => {
      hide()
      removeEventListener('pointerover', over)
      removeEventListener('pointerout', out)
      removeEventListener('pointerdown', hide, true)
      removeEventListener('scroll', hide, true)
      removeEventListener('keydown', hide)
    }
  }, [])

  // Below the element, centred on it, kept on screen; above it when there's no room below.
  useLayoutEffect(() => {
    const b = ref.current
    if (!tip || !b) return
    b.showPopover?.()
    const { rect } = tip
    const { width, height } = b.getBoundingClientRect()
    const below = rect.bottom + GAP
    b.style.left = Math.max(GAP, Math.min(innerWidth - width - GAP, rect.left + rect.width / 2 - width / 2)) + 'px'
    b.style.top = (below + height > innerHeight - GAP ? rect.top - height - GAP : below) + 'px'
  }, [tip])

  return tip && <div ref={ref} className="ttip" popover="manual" role="tooltip">{tip.text}</div>
}

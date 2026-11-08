// Confirm before anything destructive. Native <dialog>: focus trap, Esc and backdrop come free.
//   const [confirm, confirmUI] = useConfirm()
//   if (await confirm({ title, body, action: 'Remove' })) ...   and render {confirmUI} once.
import { useEffect, useRef, useState } from 'react'

export function useConfirm() {
  const [ask, setAsk] = useState(null)
  const confirm = (opts) => new Promise((resolve) => setAsk({ ...opts, resolve }))
  const done = (ok) => {
    ask.resolve(ok)
    setAsk(null)
  }
  return [confirm, ask && <ConfirmDialog {...ask} onDone={done} />]
}

function ConfirmDialog({ title, body, action = 'Delete', onDone }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => { e.preventDefault(); onDone(false) }} // Esc
      onClick={(e) => e.target === ref.current && onDone(false)} // backdrop
    >
      <div>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="modal__actions">
          <button className="btn btn--outline" onClick={() => onDone(false)} autoFocus>Cancel</button>
          <button className="btn btn--danger" onClick={() => onDone(true)}>{action}</button>
        </div>
      </div>
    </dialog>
  )
}

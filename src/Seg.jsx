// Segmented control: radio buttons styled as one pill bar. options: [key, text, Icon?, count?]
export function Seg({ label, value, options, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([key, text, Icon, count]) => (
        <label key={key}>
          <input type="radio" name={label} checked={value === key} onChange={() => onChange(key)} />
          <span>{Icon && <Icon size={14} />}{text}{count !== undefined && <small>{count}</small>}</span>
        </label>
      ))}
    </div>
  )
}

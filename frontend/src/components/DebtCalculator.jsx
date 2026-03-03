import { useState, useEffect } from 'react'
import { useDraggable } from '../hooks/useDraggable'
import BlockSlider from './BlockSlider'

const WINDOW_W = 360

function computeLoan(principal, rate, termYears) {
  const n = Math.round(termYears * 12)
  if (principal === 0 || n === 0) return null

  let monthly
  if (rate === 0) {
    monthly = principal / n
  } else {
    const r = rate / 12
    const factor = Math.pow(1 + r, n)
    monthly = principal * r * factor / (factor - 1)
  }

  const totalRepaid = monthly * n
  const interestPaid = totalRepaid - principal
  const annual = monthly * 12
  const weekly = monthly * 12 / 52
  const daily = monthly * 365.25 / 12

  return { monthly, annual, weekly, daily, totalRepaid, interestPaid }
}

function fmt(value) {
  return '\u20bd\u00a0' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ResultRow({ label, value }) {
  return (
    <tr>
      <td style={{ padding: '2px 8px' }}>{label}</td>
      <td className="debt-calc-amount">{value != null ? fmt(value) : '\u2014'}</td>
    </tr>
  )
}

function DebtCalculator({ onClose }) {
  const [principal, setPrincipal] = useState(100000)
  const [rate, setRate] = useState(3.0)   // 0.0–5.0 %
  const [term, setTerm] = useState(4.0)   // 0.0–5.0 yr

  const { pos, setPos, onMouseDown, isDragging } = useDraggable(() => {
    try {
      const saved = localStorage.getItem('debt-calc-pos')
      if (saved) return JSON.parse(saved)
    } catch (e) { void e }
    return { x: window.innerWidth - WINDOW_W - 16, y: 48 }
  })

  useEffect(() => {
    localStorage.setItem('debt-calc-pos', JSON.stringify(pos))
  }, [pos])

  // Prevent stale closure warning — setPos is stable
  void setPos

  const result = computeLoan(principal, rate / 100, term)

  function rateLabel(v) { return `${v.toFixed(1)}%` }
  function termLabel(v) {
    if (v === 0) return '0 yr'
    return v % 1 === 0 ? `${v} yr` : `${v.toFixed(1)} yr`
  }

  const hrStyle = {
    border: 'none',
    borderTop: '1px solid #808080',
    borderBottom: '1px solid #ffffff',
    margin: '4px 0',
  }

  return (
    <div
      className="win95-window win95-draggable-window"
      style={{ left: pos.x, top: pos.y, width: WINDOW_W, display: 'flex', flexDirection: 'column' }}
    >
      <div
        className={`win95-titlebar${isDragging ? ' dragging' : ''}`}
        onMouseDown={onMouseDown}
      >
        <span>Loan Calculator</span>
        <div className="win95-titlebar-buttons">
          <button className="win95-titlebar-btn" onClick={onClose}>X</button>
        </div>
      </div>

      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor="debt-principal" style={{ width: 64, flexShrink: 0 }}>Principal</label>
          <input
            id="debt-principal"
            type="number"
            className="win95-input"
            style={{ flex: 1, minWidth: 0 }}
            min={0}
            step={1000}
            value={principal}
            onChange={e => setPrincipal(Math.max(0, Number(e.target.value) || 0))}
          />
          <span>&#8381;</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 64, flexShrink: 0 }}>Rate</span>
          <BlockSlider min={0} max={5} step={0.1} value={rate} onChange={setRate} label={rateLabel} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 64, flexShrink: 0 }}>Term</span>
          <BlockSlider min={0} max={5} step={0.1} value={term} onChange={setTerm} label={termLabel} />
        </div>
      </div>

      <hr style={hrStyle} />

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <ResultRow label="Daily payment" value={result?.daily} />
          <ResultRow label="Weekly payment" value={result?.weekly} />
          <ResultRow label="Monthly payment" value={result?.monthly} />
          <ResultRow label="Annual payment" value={result?.annual} />
        </tbody>
      </table>

      <hr style={hrStyle} />

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
        <tbody>
          <ResultRow label="Total repaid" value={result?.totalRepaid} />
          <ResultRow label="Interest paid" value={result?.interestPaid} />
        </tbody>
      </table>
    </div>
  )
}

export default DebtCalculator

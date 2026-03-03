import { useState, useEffect, useRef } from 'react'
import { useDraggable } from '../hooks/useDraggable'

const WINDOW_W = 360

// Win95-style block slider — generic version of ProductivitySlider
// steps: number of blocks; value: current step index (0..steps); onChange(index)
function BlockSlider({ steps, value, onChange, label }) {
  const containerRef = useRef(null)
  const isDragging = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    function computeStep(clientX) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return 0
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(fraction * steps)
    }
    function onMove(e) {
      if (!isDragging.current) return
      onChangeRef.current(computeStep(e.clientX))
    }
    function onUp() { isDragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [steps])

  function handleMouseDown(e) {
    isDragging.current = true
    const rect = containerRef.current.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChangeRef.current(Math.round(fraction * steps))
    e.preventDefault()
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div
        ref={containerRef}
        className="win95-block-slider"
        onMouseDown={handleMouseDown}
        title={label(value)}
      >
        {Array.from({ length: steps }, (_, i) => (
          <div
            key={i}
            className={`win95-block-slider-block${i < value ? ' filled' : ''}`}
          />
        ))}
      </div>
      <span style={{ minWidth: 52, fontSize: '0.9em' }}>{label(value)}</span>
    </div>
  )
}

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
  const [rateIdx, setRateIdx] = useState(6)   // 6 × 0.5% = 3%
  const [termIdx, setTermIdx] = useState(8)   // 8 × 0.5yr = 4yr

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

  const rate = rateIdx * 0.005      // 0.0 – 0.05
  const termYears = termIdx * 0.5   // 0 – 5

  const result = computeLoan(principal, rate, termYears)

  function rateLabel(v) { return `${(v * 0.5).toFixed(1)}%` }
  function termLabel(v) {
    const yrs = v * 0.5
    if (yrs === 0) return '0 yr'
    return yrs % 1 === 0 ? `${yrs} yr` : `${yrs.toFixed(1)} yr`
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
          <BlockSlider steps={10} value={rateIdx} onChange={setRateIdx} label={rateLabel} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 64, flexShrink: 0 }}>Term</span>
          <BlockSlider steps={10} value={termIdx} onChange={setTermIdx} label={termLabel} />
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

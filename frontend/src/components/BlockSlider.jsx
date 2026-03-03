import { useEffect, useRef } from 'react'

// Unified Win95-style block slider with sub-block partial fill.
// Props:
//   min, max, step     — numeric range and rounding precision
//   value              — current value (at fine step precision)
//   onChange(value)    — called with value rounded to step
//   blockCount         — number of visible divisions (default 10)
//   label              — string or (v) => string — displayed beside slider
//   hasOverride        — if true, renders a × clear button
//   onClear            — called when × is clicked
function BlockSlider({ min, max, step, value, onChange, blockCount = 10, label, hasOverride, onClear }) {
  const containerRef = useRef(null)
  const isDragging = useRef(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    function computeValue(clientX) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return min
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const raw = min + fraction * (max - min)
      return Math.min(max, Math.max(min, Math.round(raw / step) * step))
    }
    function onMove(e) {
      if (!isDragging.current) return
      onChangeRef.current(computeValue(e.clientX))
    }
    function onUp() { isDragging.current = false }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [min, max, step])

  function handleMouseDown(e) {
    isDragging.current = true
    const rect = containerRef.current.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const raw = min + fraction * (max - min)
    const snapped = Math.min(max, Math.max(min, Math.round(raw / step) * step))
    onChangeRef.current(snapped)
    e.preventDefault()
  }

  const blockRange = (max - min) / blockCount
  const displayLabel = typeof label === 'function' ? label(value) : label

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <div
        ref={containerRef}
        className="win95-block-slider"
        onMouseDown={handleMouseDown}
        title={displayLabel}
      >
        {Array.from({ length: blockCount }, (_, i) => {
          const blockStart = min + i * blockRange
          const fill = Math.min(1, Math.max(0, (value - blockStart) / blockRange))
          return (
            <div key={i} className="win95-block-slider-block">
              {fill > 0 && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${fill * 100}%`,
                  background: '#000080',
                }} />
              )}
            </div>
          )
        })}
      </div>
      <span style={{
        minWidth: 40,
        fontSize: '0.85em',
        color: hasOverride ? '#000080' : undefined,
        fontWeight: hasOverride ? 'bold' : undefined,
      }}>
        {displayLabel}
      </span>
      {hasOverride && onClear && (
        <button
          className="win95-btn"
          style={{ fontSize: '0.75em', padding: '0 3px' }}
          onClick={onClear}
          title="Clear override — revert to project default"
        >×</button>
      )}
    </div>
  )
}

export default BlockSlider

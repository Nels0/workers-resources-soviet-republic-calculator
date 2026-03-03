import { useState, useEffect, useRef } from 'react'
import { fetchBuilding } from '../api'

const W = 520
const MIN_H = 120

function BuildingInfoWindow({ buildingId, onClose }) {
  const [building, setBuilding] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizing = useRef(false)
  const resizeStart = useRef({ y: 0, h: 0 })

  const [pos, setPos] = useState(() => ({
    x: Math.max(0, (window.innerWidth - W) / 2),
    y: Math.max(0, (window.innerHeight - 400) / 4),
  }))
  const [height, setHeight] = useState(400)

  useEffect(() => {
    let cancelled = false
    fetchBuilding(buildingId)
      .then(data => { if (!cancelled) { setBuilding(data); setError(null) } })
      .catch(err => { if (!cancelled) { setError(err.message); setBuilding(null) } })
    return () => { cancelled = true }
  }, [buildingId])

  useEffect(() => {
    function onMove(e) {
      if (dragging.current) {
        setPos({
          x: Math.max(0, e.clientX - dragOffset.current.x),
          y: Math.max(0, e.clientY - dragOffset.current.y),
        })
      }
      if (resizing.current) {
        const delta = e.clientY - resizeStart.current.y
        setHeight(Math.max(MIN_H, resizeStart.current.h + delta))
      }
    }
    function onUp() {
      if (dragging.current) { dragging.current = false; setIsDragging(false) }
      resizing.current = false
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function handleTitlebarMouseDown(e) {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    setIsDragging(true)
    e.preventDefault()
  }

  function handleResizeMouseDown(e) {
    resizing.current = true
    resizeStart.current = { y: e.clientY, h: height }
    e.preventDefault()
    e.stopPropagation()
  }

  const constructionCosts = building?.costs?.filter(c => c.phase === 'construction') || []
  const operationCosts    = building?.costs?.filter(c => c.phase === 'operation') || []
  const producesFlows     = building?.flows?.filter(f => f.direction === 'produces') || []
  const consumesFlows     = building?.flows?.filter(f => f.direction === 'consumes') || []
  const hasOperationData  = operationCosts.length > 0 || producesFlows.length > 0 || consumesFlows.length > 0

  return (
    <div
      className="win95-window win95-draggable-window"
      style={{ left: pos.x, top: pos.y, width: W, height, display: 'flex', flexDirection: 'column' }}
    >
      <div
        className={`win95-titlebar${isDragging ? ' dragging' : ''}`}
        onMouseDown={handleTitlebarMouseDown}
      >
        <span>{building ? building.name : 'Building Info'}</span>
        <div className="win95-titlebar-buttons">
          <button className="win95-titlebar-btn" onClick={onClose}>X</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {error && <p style={{ padding: 4, color: 'red', margin: 0 }}>Error: {error}</p>}
        {!building && !error && <div className="win95-statusbar">Loading...</div>}

        {building && (
          <>
            <div style={{ padding: 4 }}>
              <span className="win95-field-label">Category: </span>
              <span className="win95-badge">{building.category}</span>
              {'  '}
              <span className="win95-field-label">Workers: </span>
              {building.workers_needed}
              {'  '}
              <span className="win95-field-label">Days: </span>
              {building.construction_days}
              <div style={{ marginTop: 2 }}>
                <span className="win95-field-label">Source: </span>
                <span className="win95-muted">{building.source_file}</span>
              </div>
            </div>

            {constructionCosts.length > 0 && (
              <div className="win95-groupbox">
                <div className="win95-groupbox-title">Construction Costs</div>
                <div className="win95-inset">
                  <table className="win95-table win95-table-static">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {constructionCosts.map(c => (
                        <tr key={c.id}>
                          <td>{c.resource?.name}</td>
                          <td className="num">{c.quantity}</td>
                          <td>{c.resource?.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hasOperationData ? (
              <div className="win95-groupbox">
                <div className="win95-groupbox-title">Operation</div>
                {operationCosts.length > 0 && (
                  <>
                    <div className="win95-groupbox-title">Operation Costs</div>
                    <div className="win95-inset">
                      <table className="win95-table win95-table-static">
                        <thead>
                          <tr>
                            <th>Resource</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operationCosts.map(c => (
                            <tr key={c.id}>
                              <td>{c.resource?.name}</td>
                              <td className="num">{c.quantity}</td>
                              <td>{c.resource?.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {(producesFlows.length > 0 || consumesFlows.length > 0) && (
                  <>
                    <div className="win95-groupbox-title">Production</div>
                    <div className="win95-inset">
                      <table className="win95-table win95-table-static">
                        <thead>
                          <tr>
                            <th>Direction</th>
                            <th>Resource</th>
                            <th>Quantity</th>
                            <th>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...producesFlows, ...consumesFlows].map(f => (
                            <tr key={f.id}>
                              <td>{f.direction === 'produces' ? '\u2191 Produces' : '\u2193 Consumes'}</td>
                              <td>{f.resource?.name}</td>
                              <td className="num">{f.quantity}</td>
                              <td>{f.resource?.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="win95-muted" style={{ padding: 4 }}>No operation data.</p>
            )}
          </>
        )}
      </div>

      <div className="win95-resize-s" onMouseDown={handleResizeMouseDown} />
    </div>
  )
}

export default BuildingInfoWindow

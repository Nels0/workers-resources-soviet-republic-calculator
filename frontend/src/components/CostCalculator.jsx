import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchBuildingsList } from '../api'

function BuildingSearch({ buildings, onAdd }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const filtered = query
    ? buildings.filter(b => {
        const q = query.toLowerCase()
        return b.name.toLowerCase().includes(q) || (b.source_file || '').toLowerCase().includes(q)
      })
    : buildings

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(id) {
    onAdd(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        className="win95-input"
        style={{ width: '100%' }}
        placeholder="Search buildings to add..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && query && (
        <div className="win95-dropdown">
          {filtered.slice(0, 50).map(b => (
            <div
              key={b.id}
              className="win95-dropdown-item"
              onClick={() => handleSelect(b.id)}
            >
              {b.name} <span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="win95-dropdown-item disabled">No matches</div>
          )}
        </div>
      )}
    </div>
  )
}

function CostCalculator({ projectBuildings, onUpdateQty, onRemove, onAdd }) {
  const [allBuildings, setAllBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBuildingsList()
      .then(data => {
        setResources(data.resources)
        setAllBuildings(data.buildings)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const buildingMap = useMemo(() => {
    const map = {}
    for (const b of allBuildings) map[b.id] = b
    return map
  }, [allBuildings])

  const activeResources = useMemo(() => {
    return resources.filter(r =>
      projectBuildings.some(pb => {
        const b = buildingMap[pb.buildingId]
        return b && (b.resource_costs[String(r.id)] || 0) > 0
      })
    )
  }, [resources, projectBuildings, buildingMap])

  const totals = useMemo(() => {
    const sums = {}
    for (const r of activeResources) sums[r.id] = 0
    for (const pb of projectBuildings) {
      const b = buildingMap[pb.buildingId]
      if (!b) continue
      for (const r of activeResources) {
        const cost = b.resource_costs[String(r.id)] || 0
        sums[r.id] += cost * pb.quantity
      }
    }
    return sums
  }, [projectBuildings, buildingMap, activeResources])

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BuildingSearch buildings={allBuildings} onAdd={onAdd} />
      </div>

      {projectBuildings.length === 0 ? (
        <div className="win95-statusbar">No buildings added. Use the search bar above to add buildings.</div>
      ) : (
        <div className="win95-inset win95-table-wrap">
          <table className="win95-table win95-table-static">
            <thead>
              <tr>
                <th>Building</th>
                <th>Qty</th>
                {activeResources.map(r => (
                  <th key={r.id}>{r.name} ({r.unit})</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projectBuildings.map((pb, i) => {
                const b = buildingMap[pb.buildingId]
                if (!b) return null
                return (
                  <tr key={i}>
                    <td>
                      <Link to={`/buildings/${b.id}`}>{b.name}</Link>
                      {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="win95-input"
                        style={{ width: 60 }}
                        min="1"
                        value={pb.quantity}
                        onChange={e => onUpdateQty(pb.position, Math.max(1, Number(e.target.value) || 1))}
                      />
                    </td>
                    {activeResources.map(r => {
                      const cost = (b.resource_costs[String(r.id)] || 0) * pb.quantity
                      return (
                        <td key={r.id} className="num">
                          {cost ? Math.round(cost * 100) / 100 : ''}
                        </td>
                      )
                    })}
                    <td>
                      <button className="win95-btn" onClick={() => onRemove(pb.position)}>X</button>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ fontWeight: 'bold' }}>
                <td>Total</td>
                <td></td>
                {activeResources.map(r => (
                  <td key={r.id} className="num">
                    {totals[r.id] ? Math.round(totals[r.id] * 100) / 100 : ''}
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default CostCalculator

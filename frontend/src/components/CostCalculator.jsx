import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchBuildingsList } from '../api'
import BuildingConstructionTable from './BuildingConstructionTable'

function BuildingSearch({ buildings, resources, onAdd }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const tbodyRef = useRef(null)

  const filtered = useMemo(() => {
    const arr = query
      ? buildings.filter(b => {
          const q = query.toLowerCase()
          return b.name.toLowerCase().includes(q) || (b.source_file || '').toLowerCase().includes(q)
        })
      : buildings
    return arr.slice(0, 10)
  }, [query, buildings])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected row into view on keyboard navigation
  useEffect(() => {
    if (!tbodyRef.current) return
    const row = tbodyRef.current.children[selectedIndex]
    if (row?.scrollIntoView) row.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  function handleSelect(id) {
    onAdd(id)
    setQuery('')
    setSelectedIndex(0)
  }

  function tabComplete() {
    const result = filtered[selectedIndex] || filtered[0]
    if (!result) return
    const name = result.name
    const q = query.toLowerCase()
    if (name.toLowerCase().startsWith(q)) {
      const nextSpace = name.indexOf(' ', q.length)
      setQuery(nextSpace >= 0 ? name.slice(0, nextSpace + 1) : name)
    } else {
      setQuery(name)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex].id)
    } else if (e.key === 'Tab') {
      if (filtered.length > 0) {
        e.preventDefault()
        tabComplete()
      }
    }
  }

  return (
    <div>
      <input
        type="text"
        className="win95-input"
        style={{ width: '100%' }}
        placeholder="Search buildings to add..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="win95-search-results">
        {filtered.length === 0 ? (
          <div className="win95-statusbar">No matches</div>
        ) : (
          <BuildingConstructionTable
            buildings={filtered}
            resources={resources}
            selectedIndex={selectedIndex}
            onSelect={handleSelect}
            onRowHover={setSelectedIndex}
            tbodyRef={tbodyRef}
          />
        )}
      </div>
    </div>
  )
}

function CostCalculator({ projectBuildings, prices, onUpdateQty, onRemove, onAdd, onBuildingClick }) {
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

  const pricedResourceIds = useMemo(() => {
    if (!prices) return new Set()
    return new Set(activeResources.filter(r => parseFloat(prices[String(r.id)]?.import) > 0).map(r => r.id))
  }, [activeResources, prices])

  const hasAnyPrice = pricedResourceIds.size > 0

  const totalCost = useMemo(() => {
    if (!hasAnyPrice) return 0
    let sum = 0
    for (const r of activeResources) {
      const price = parseFloat(prices[String(r.id)]?.import) || 0
      if (price > 0) {
        sum += totals[r.id] * price
      }
    }
    return sum
  }, [hasAnyPrice, prices, activeResources, totals])

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BuildingSearch buildings={allBuildings} resources={resources} onAdd={onAdd} />
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
                {hasAnyPrice && <th>₽ Total</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {projectBuildings.map((pb, i) => {
                const b = buildingMap[pb.buildingId]
                if (!b) return null
                const rowRubleTotal = hasAnyPrice
                  ? activeResources.reduce((sum, r) => {
                      const price = parseFloat(prices?.[String(r.id)]?.import) || 0
                      const amt = (b.resource_costs[String(r.id)] || 0) * pb.quantity
                      return sum + (price > 0 ? amt * price : 0)
                    }, 0)
                  : 0
                return (
                  <tr key={i}>
                    <td>
                      {onBuildingClick
                        ? <button className="win95-link-btn" onClick={() => onBuildingClick(b.id)}>{b.name}</button>
                        : <Link to={`/buildings/${b.id}`}>{b.name}</Link>
                      }
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
                      const amt = (b.resource_costs[String(r.id)] || 0) * pb.quantity
                      const price = parseFloat(prices?.[String(r.id)]?.import) || 0
                      return (
                        <td key={r.id} className="num">
                          {amt ? Math.round(amt) : ''}
                          {hasAnyPrice && (
                            <div style={{ color: '#000080', fontSize: '0.85em' }}>
                              {price > 0 && amt > 0 ? Math.round(amt * price) : '—'}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    {hasAnyPrice && (
                      <td className="num" style={{ color: '#000080', fontWeight: 'bold' }}>
                        {rowRubleTotal > 0 ? Math.round(rowRubleTotal) : '—'}
                      </td>
                    )}
                    <td>
                      <button className="win95-btn" onClick={() => onRemove(pb.position)}>X</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#c0c0c0', fontWeight: 'bold' }}>
                <td>Total</td>
                <td></td>
                {activeResources.map(r => (
                  <td key={r.id} className="num">
                    {totals[r.id] ? Math.round(totals[r.id]) : ''}
                  </td>
                ))}
                {hasAnyPrice && <td></td>}
                <td></td>
              </tr>
              {hasAnyPrice && (
                <tr style={{ background: '#c0c0c0', fontWeight: 'bold' }}>
                  <td>₽</td>
                  <td></td>
                  {activeResources.map(r => {
                    const price = parseFloat(prices?.[String(r.id)]?.import) || 0
                    const rubleTotal = price > 0 ? totals[r.id] * price : null
                    return (
                      <td key={r.id} className="num" style={{ color: '#000080' }}>
                        {rubleTotal != null ? Math.round(rubleTotal) : '—'}
                      </td>
                    )
                  })}
                  <td></td>
                  <td></td>
                </tr>
              )}
              {hasAnyPrice && (
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan={2 + activeResources.length}>Total ₽</td>
                  <td className="num">{totalCost ? Math.round(totalCost) : ''}</td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default CostCalculator

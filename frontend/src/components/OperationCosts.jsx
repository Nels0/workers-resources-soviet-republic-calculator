import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchBuildingsList } from '../api'

function OperationCosts({ projectBuildings, prices }) {
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
        return b && (b.operation_costs?.[String(r.id)] || 0) > 0
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
        const cost = b.operation_costs?.[String(r.id)] || 0
        sums[r.id] += cost * pb.quantity
      }
    }
    return sums
  }, [projectBuildings, buildingMap, activeResources])

  const hasAnyPrice = useMemo(() => {
    if (!prices) return false
    return activeResources.some(r => parseFloat(prices[String(r.id)]) > 0)
  }, [prices, activeResources])

  const totalCost = useMemo(() => {
    if (!hasAnyPrice) return 0
    let sum = 0
    for (const r of activeResources) {
      const price = parseFloat(prices[String(r.id)]) || 0
      if (price > 0) {
        sum += totals[r.id] * price
      }
    }
    return sum
  }, [hasAnyPrice, prices, activeResources, totals])

  // --- Resource Flows ---

  const allFlowResourceIds = useMemo(() => {
    const ids = new Set()
    for (const pb of projectBuildings) {
      const b = buildingMap[pb.buildingId]
      if (!b) continue
      for (const id of Object.keys(b.produces || {})) ids.add(id)
      for (const id of Object.keys(b.consumes || {})) ids.add(id)
    }
    return ids
  }, [projectBuildings, buildingMap])

  const sortedFlowBuildings = useMemo(() => {
    return [...projectBuildings].sort((pbA, pbB) => {
      const bA = buildingMap[pbA.buildingId], bB = buildingMap[pbB.buildingId]
      if (!bA && !bB) return 0; if (!bA) return 1; if (!bB) return -1
      const score = b => Object.keys(b.produces || {}).filter(r => allFlowResourceIds.has(r)).length
                       - Object.keys(b.consumes || {}).filter(r => allFlowResourceIds.has(r)).length
      const diff = score(bB) - score(bA)
      return diff !== 0 ? diff : (bA.name || '').localeCompare(bB.name || '')
    })
  }, [projectBuildings, buildingMap, allFlowResourceIds])

  const flowResourceList = useMemo(() => {
    const resourceMap = {}
    for (const r of resources) resourceMap[r.id] = r
    return [...allFlowResourceIds]
      .map(id => resourceMap[id]).filter(Boolean)
      .sort((rA, rB) => {
        const firstRow = r => sortedFlowBuildings.findIndex(pb => {
          const b = buildingMap[pb.buildingId]
          return b && ((b.produces?.[r.id] || 0) > 0 || (b.consumes?.[r.id] || 0) > 0)
        })
        const fA = firstRow(rA), fB = firstRow(rB)
        if (fA !== fB) return fA - fB
        const firstPb = sortedFlowBuildings[fA]
        const bFirst = firstPb ? buildingMap[firstPb.buildingId] : null
        if (bFirst) {
          const aCons = (bFirst.consumes?.[rA.id] || 0) > 0
          const bCons = (bFirst.consumes?.[rB.id] || 0) > 0
          if (aCons !== bCons) return aCons ? -1 : 1
        }
        return rA.name.localeCompare(rB.name)
      })
  }, [allFlowResourceIds, resources, sortedFlowBuildings, buildingMap])

  const flowTotals = useMemo(() => {
    const t = {}
    for (const r of flowResourceList) {
      let produced = 0, consumed = 0
      for (const pb of projectBuildings) {
        const b = buildingMap[pb.buildingId]; if (!b) continue
        produced += (b.produces?.[String(r.id)] || 0) * pb.quantity
        consumed += (b.consumes?.[String(r.id)] || 0) * pb.quantity
      }
      t[r.id] = { produced, consumed, net: produced - consumed }
    }
    return t
  }, [flowResourceList, projectBuildings, buildingMap])

  function renderFlowCell(net) {
    if (net === 0) return null
    if (net > 0) return <span>+{Math.round(net * 100) / 100} ↑</span>
    return <span style={{ color: '#c00000' }}>{Math.round(net * 100) / 100} ↓</span>
  }

  function renderFlowTotal(net) {
    if (net > 0) return <span>+{Math.round(net * 100) / 100} net</span>
    if (net < 0) return <span style={{ color: '#c00000' }}>{Math.round(net * 100) / 100} net</span>
    return <span>0 net</span>
  }

  function renderResourceFlows() {
    return (
      <div className="win95-groupbox" style={{ marginTop: '8px' }}>
        <div className="win95-groupbox-title">Resource Flows</div>
        {allFlowResourceIds.size === 0
          ? <div className="win95-statusbar">No production flows for the buildings in this project.</div>
          : (
            <div className="win95-inset win95-table-wrap">
              <table className="win95-table win95-table-static">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Qty</th>
                    {flowResourceList.map(r => (
                      <th key={r.id}>{r.name} ({r.unit})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedFlowBuildings.map((pb, i) => {
                    const b = buildingMap[pb.buildingId]
                    if (!b) return null
                    const hasFlow = flowResourceList.some(r => {
                      const net = ((b.produces?.[String(r.id)] || 0) - (b.consumes?.[String(r.id)] || 0)) * pb.quantity
                      return net !== 0
                    })
                    if (!hasFlow) return null
                    return (
                      <tr key={i}>
                        <td>
                          <Link to={`/buildings/${b.id}`}>{b.name}</Link>
                          {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
                        </td>
                        <td className="num">{pb.quantity}</td>
                        {flowResourceList.map(r => {
                          const produced = (b.produces?.[String(r.id)] || 0) * pb.quantity
                          const consumed = (b.consumes?.[String(r.id)] || 0) * pb.quantity
                          const net = produced - consumed
                          return (
                            <td key={r.id} className="num">
                              {renderFlowCell(net)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 'bold' }}>
                    <td>Net</td>
                    <td></td>
                    {flowResourceList.map(r => (
                      <td key={r.id} className="num">
                        {renderFlowTotal(flowTotals[r.id]?.net ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        }
      </div>
    )
  }

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in project. Add buildings in the Construction Costs tab.</div>
  }

  return (
    <div>
      <div className="win95-groupbox">
        <div className="win95-groupbox-title">Operation Costs</div>
        {activeResources.length === 0
          ? <div className="win95-statusbar">No operation costs for the buildings in this project.</div>
          : (
            <div className="win95-inset win95-table-wrap">
              <table className="win95-table win95-table-static">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Qty</th>
                    {activeResources.map(r => (
                      <th key={r.id}>{r.name} ({r.unit})</th>
                    ))}
                    {hasAnyPrice && <th>Total Cost</th>}
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
                        <td className="num">{pb.quantity}</td>
                        {activeResources.map(r => {
                          const cost = (b.operation_costs?.[String(r.id)] || 0) * pb.quantity
                          return (
                            <td key={r.id} className="num">
                              {cost ? Math.round(cost * 100) / 100 : ''}
                            </td>
                          )
                        })}
                        {hasAnyPrice && (() => {
                          let rowCost = 0
                          let hasAnyCost = false
                          for (const r of activeResources) {
                            const price = parseFloat(prices[String(r.id)]) || 0
                            const qty = (b.operation_costs?.[String(r.id)] || 0) * pb.quantity
                            if (price > 0 && qty > 0) {
                              rowCost += qty * price
                              hasAnyCost = true
                            }
                          }
                          return (
                            <td className="num">
                              {hasAnyCost ? Math.round(rowCost * 100) / 100 : <span className="win95-muted">--</span>}
                            </td>
                          )
                        })()}
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
                    {hasAnyPrice && (
                      <td className="num">
                        {totalCost ? Math.round(totalCost * 100) / 100 : ''}
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          )
        }
      </div>
      {renderResourceFlows()}
    </div>
  )
}

export default OperationCosts

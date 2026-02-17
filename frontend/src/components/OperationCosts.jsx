import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchBuildingsList } from '../api'

function OperationCosts({ projectBuildings }) {
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

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in project. Add buildings in the Construction Costs tab.</div>
  }

  if (activeResources.length === 0) {
    return <div className="win95-statusbar">No operation costs for the buildings in this project.</div>
  }

  return (
    <div className="win95-inset win95-table-wrap">
      <table className="win95-table win95-table-static">
        <thead>
          <tr>
            <th>Building</th>
            <th>Qty</th>
            {activeResources.map(r => (
              <th key={r.id}>{r.name} ({r.unit})</th>
            ))}
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
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default OperationCosts

import { useState, useEffect, useMemo } from 'react'
import { fetchBuildingsList } from '../api'

function ResourcePrices({ projectBuildings, prices, onUpdatePrices }) {
  const [allBuildings, setAllBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [localPrices, setLocalPrices] = useState({})

  useEffect(() => {
    fetchBuildingsList()
      .then(data => {
        setResources(data.resources)
        setAllBuildings(data.buildings)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Sync local prices from prop when project changes
  useEffect(() => {
    setLocalPrices(prices || {})
  }, [prices])

  const buildingMap = useMemo(() => {
    const map = {}
    for (const b of allBuildings) map[b.id] = b
    return map
  }, [allBuildings])

  const usedResources = useMemo(() => {
    return resources.filter(r =>
      projectBuildings.some(pb => {
        const b = buildingMap[pb.buildingId]
        if (!b) return false
        return (b.resource_costs?.[String(r.id)] || 0) > 0 ||
               (b.operation_costs?.[String(r.id)] || 0) > 0
      })
    )
  }, [resources, projectBuildings, buildingMap])

  const isDirty = useMemo(() => {
    const source = prices || {}
    for (const r of usedResources) {
      const key = String(r.id)
      const localVal = parseFloat(localPrices[key]) || 0
      const savedVal = parseFloat(source[key]) || 0
      if (localVal !== savedVal) return true
    }
    return false
  }, [localPrices, prices, usedResources])

  function handlePriceChange(resourceId, value) {
    setLocalPrices(prev => ({ ...prev, [String(resourceId)]: value }))
  }

  function handleSave() {
    // Build prices dict with only non-zero values
    const cleaned = {}
    for (const r of usedResources) {
      const key = String(r.id)
      const val = parseFloat(localPrices[key])
      if (val && val > 0) {
        cleaned[key] = val
      }
    }
    onUpdatePrices(cleaned)
  }

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in project. Add buildings in the Construction Costs tab.</div>
  }

  if (usedResources.length === 0) {
    return <div className="win95-statusbar">No resources used by buildings in this project.</div>
  }

  return (
    <div>
      <div className="win95-inset win95-table-wrap">
        <table className="win95-table win95-table-static">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {usedResources.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.type}</td>
                <td>{r.unit}</td>
                <td>
                  <input
                    type="number"
                    className="win95-input"
                    style={{ width: 100 }}
                    min="0"
                    step="any"
                    value={localPrices[String(r.id)] ?? ''}
                    onChange={e => handlePriceChange(r.id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <button
          className="win95-btn win95-btn-default"
          disabled={!isDirty}
          onClick={handleSave}
        >
          Save Prices
        </button>
      </div>
    </div>
  )
}

export default ResourcePrices

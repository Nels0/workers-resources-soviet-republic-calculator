import { useState, useEffect, useMemo, useRef } from 'react'
import { fetchBuildingsList } from '../api'
import { loadProjects } from '../projectStorage'

function ResourcePrices({ countryId, prices, onUpdatePrices }) {
  const [allBuildings, setAllBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [projectBuildings, setProjectBuildings] = useState([])
  const [localPrices, setLocalPrices] = useState({})
  const [savedFlash, setSavedFlash] = useState(false)

  const saveTimeoutRef = useRef(null)
  const flashTimeoutRef = useRef(null)
  // Refs to always have latest values inside the debounce callback
  const localPricesRef = useRef({})
  const usedResourcesRef = useRef([])
  const onUpdatePricesRef = useRef(onUpdatePrices)
  useEffect(() => { onUpdatePricesRef.current = onUpdatePrices }, [onUpdatePrices])

  useEffect(() => {
    fetchBuildingsList()
      .then(data => {
        setResources(data.resources)
        setAllBuildings(data.buildings)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Fetch projects for this country to derive which resources are used
  useEffect(() => {
    if (!countryId) {
      setProjectBuildings([])
      return
    }
    loadProjects(countryId)
      .then(projects => setProjectBuildings(projects.flatMap(p => p.buildings)))
      .catch(() => setProjectBuildings([]))
  }, [countryId])

  // Sync local prices from prop (country switch or initial load)
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

  // Keep refs in sync so the debounce callback always uses latest values
  localPricesRef.current = localPrices
  usedResourcesRef.current = usedResources

  function handlePriceChange(resourceId, value) {
    setLocalPrices(prev => ({ ...prev, [String(resourceId)]: value }))

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      const cleaned = {}
      for (const r of usedResourcesRef.current) {
        const key = String(r.id)
        const val = parseFloat(localPricesRef.current[key])
        if (val && val > 0) cleaned[key] = val
      }
      onUpdatePricesRef.current(cleaned)
      setSavedFlash(true)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = setTimeout(() => setSavedFlash(false), 2000)
    }, 600)
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    }
  }, [])

  if (loading) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (!countryId) {
    return <div className="win95-statusbar">Select a country to set prices.</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in any projects yet.</div>
  }

  if (usedResources.length === 0) {
    return <div className="win95-statusbar">No resources used by buildings in this country.</div>
  }

  return (
    <div>
      {savedFlash && (
        <div style={{ padding: '2px 4px', fontSize: '0.85em', color: 'var(--win95-blue)' }}>
          Saved
        </div>
      )}
      <div className="win95-inset win95-table-wrap">
        <table className="win95-table win95-table-static">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {usedResources.map(r => (
              <tr key={r.id}>
                <td>{r.name} <span className="win95-muted" style={{ fontSize: '0.85em' }}>({r.unit})</span></td>
                <td>{r.type}</td>
                <td>
                  <input
                    type="number"
                    className="win95-input"
                    style={{ width: 80 }}
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
    </div>
  )
}

export default ResourcePrices

import { useState, useRef, useCallback } from 'react'
import { updateProjectAPI, updateBuildingProductivityAPI } from '../api'

export const PERIODS = {
  day:   { label: 'Day',   suffix: '/day', materialFactor: 1,             elecFactor: 120 },
  week:  { label: 'Week',  suffix: '/wk',  materialFactor: 7,             elecFactor: 120 * 7 },
  month: { label: 'Month', suffix: '/mo',  materialFactor: 365.2425 / 12, elecFactor: 120 * 365.2425 / 12 },
  year:  { label: 'Year',  suffix: '/yr',  materialFactor: 365.2425,      elecFactor: 120 * 365.2425 },
}

export function useProductivity(projectId, defaultProductivity, projectBuildings) {
  const [projectProductivity, setProjectProductivityState] = useState(defaultProductivity ?? 1.0)
  const [buildingProductivityOverrides, setBuildingProductivityOverrides] = useState(() => {
    const overrides = {}
    for (const pb of projectBuildings) {
      if (pb.productivity != null) overrides[pb.position] = pb.productivity
    }
    return overrides
  })

  // Sync state when project changes (set during render pattern)
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId)
    setProjectProductivityState(defaultProductivity ?? 1.0)
    const overrides = {}
    for (const pb of projectBuildings) {
      if (pb.productivity != null) overrides[pb.position] = pb.productivity
    }
    setBuildingProductivityOverrides(overrides)
  }

  const projectProdDebounceRef = useRef(null)
  const buildingProdDebounceRef = useRef({})

  function setProjectProductivity(val) {
    const pct = parseInt(val, 10)
    if (isNaN(pct)) return
    const factor = Math.max(0, Math.min(200, pct)) / 100
    setProjectProductivityState(factor)
    if (projectProdDebounceRef.current) clearTimeout(projectProdDebounceRef.current)
    projectProdDebounceRef.current = setTimeout(() => {
      if (projectId) updateProjectAPI(projectId, { productivity: factor }).catch(console.error)
    }, 600)
  }

  function setBuildingProductivity(pos, val) {
    const factor = typeof val === 'number'
      ? Math.max(0, Math.min(1, val))
      : Math.max(0, Math.min(200, parseInt(val, 10) || 0)) / 100
    setBuildingProductivityOverrides(prev => ({ ...prev, [pos]: factor }))
    if (buildingProdDebounceRef.current[pos]) clearTimeout(buildingProdDebounceRef.current[pos])
    buildingProdDebounceRef.current[pos] = setTimeout(() => {
      if (projectId) updateBuildingProductivityAPI(projectId, pos, factor).catch(console.error)
    }, 600)
  }

  function clearBuildingProductivity(pos) {
    setBuildingProductivityOverrides(prev => {
      const updated = { ...prev }
      delete updated[pos]
      return updated
    })
    if (buildingProdDebounceRef.current[pos]) clearTimeout(buildingProdDebounceRef.current[pos])
    if (projectId) updateBuildingProductivityAPI(projectId, pos, null).catch(console.error)
  }

  // getNetFlow closes over productivity state; period is passed dynamically in opts
  const getNetFlow = useCallback((b, pb, r, { applyProductivity = true, applyNormalize = false, period = 'month' } = {}) => {
    const p = PERIODS[period] || PERIODS.month
    const mult = r.unit === 'MW' ? p.elecFactor : p.materialFactor * (b.workers_needed || 1)
    const raw = ((b.produces?.[String(r.id)] || 0) - (b.consumes?.[String(r.id)] || 0)) * pb.quantity
    let value = raw * mult
    if (applyProductivity) {
      const factor = buildingProductivityOverrides[pb.position] != null
        ? buildingProductivityOverrides[pb.position]
        : projectProductivity
      value *= factor
    }
    if (applyNormalize && b.workers_needed > 0) {
      value /= b.workers_needed
    }
    return value
  }, [buildingProductivityOverrides, projectProductivity])

  return {
    projectProductivity,
    setProjectProductivity,
    buildingProductivityOverrides,
    setBuildingProductivity,
    clearBuildingProductivity,
    getNetFlow,
  }
}

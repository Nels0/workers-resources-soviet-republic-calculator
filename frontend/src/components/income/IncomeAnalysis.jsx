import { useState, useEffect, useMemo } from 'react'
import { fetchBuildingsList } from '../../api'
import { useProductivity, PERIODS } from '../../hooks/useProductivity'
import { useChains } from '../../hooks/useChains'
import ResourceFlowsTable from './ResourceFlowsTable'
import ChainBuilder from './ChainBuilder'

function IncomeAnalysis({ projectId, projectBuildings, prices, onBuildingClick, onUpdateQty }) {
  const [allBuildings, setAllBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [loadingBuildings, setLoadingBuildings] = useState(true)
  const [period, setPeriod] = useState('month')
  const [included, setIncluded] = useState({})
  const [normalizeView, setNormalizeView] = useState(false)
  const [prevProjectId, setPrevProjectId] = useState(projectId)

  const {
    buildingProductivityOverrides, setBuildingProductivity, clearBuildingProductivity,
    getNetFlow,
  } = useProductivity(projectId, projectBuildings)

  const {
    chains, savingChains, chainError,
    autoDetectChains, clearChains, createChain,
    renameChain, commitChainName, reorderChain, dissolveChain, updateChainMembers,
  } = useChains(projectId)

  useEffect(() => {
    fetchBuildingsList()
      .then(data => {
        setResources(data.resources)
        setAllBuildings(data.buildings)
      })
      .catch(console.error)
      .finally(() => setLoadingBuildings(false))
  }, [])

  // Sync localStorage state when project changes (set during render pattern)
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId)
    if (projectId) {
      const storedNorm = localStorage.getItem(`normalize-view-${projectId}`)
      setNormalizeView(storedNorm === 'true')
      try {
        setIncluded(JSON.parse(localStorage.getItem(`chain-include-${projectId}`)) || {})
      } catch {
        setIncluded({})
      }
    }
  }

  const buildingMap = useMemo(() => {
    const map = {}
    for (const b of allBuildings) map[b.id] = b
    return map
  }, [allBuildings])

  const flowResourceList = useMemo(() => {
    const ids = new Set()
    for (const pb of projectBuildings) {
      const b = buildingMap[pb.buildingId]
      if (!b) continue
      for (const id of Object.keys(b.produces || {})) ids.add(id)
      for (const id of Object.keys(b.consumes || {})) ids.add(id)
    }
    const rmap = {}
    for (const r of resources) rmap[r.id] = r
    return [...ids].map(id => rmap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }, [resources, projectBuildings, buildingMap])

  const omittedCount = useMemo(() => {
    if (loadingBuildings) return 0
    return projectBuildings.filter(pb => {
      const b = buildingMap[pb.buildingId]
      return b && Object.keys(b.produces || {}).length + Object.keys(b.consumes || {}).length === 0
    }).length
  }, [projectBuildings, buildingMap, loadingBuildings])

  function toggleIncluded(rid) {
    setIncluded(prev => {
      const wasIncluded = prev[String(rid)] !== false
      const updated = { ...prev, [String(rid)]: !wasIncluded }
      if (projectId) localStorage.setItem(`chain-include-${projectId}`, JSON.stringify(updated))
      return updated
    })
  }

  function handleNormalizeChange(checked) {
    setNormalizeView(checked)
    if (projectId) localStorage.setItem(`normalize-view-${projectId}`, String(checked))
  }

  if (loadingBuildings) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in project. Add buildings in the Construction tab.</div>
  }

  if (flowResourceList.length === 0) {
    return <div className="win95-statusbar">No production flows for the buildings in this project.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85em' }}>Period:</span>
        {Object.entries(PERIODS).map(([key, p]) => (
          <button
            key={key}
            className="win95-btn"
            style={{
              fontSize: '0.85em',
              padding: '1px 6px',
              ...(period === key ? { boxShadow: 'inset 1px 1px #808080, inset -1px -1px #ffffff' } : {}),
            }}
            onClick={() => setPeriod(key)}
          >{p.label}</button>
        ))}
        <span style={{ margin: '0 2px', color: '#808080' }}>|</span>
        <label style={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: 3 }}>
          <input
            type="checkbox"
            checked={normalizeView}
            onChange={e => handleNormalizeChange(e.target.checked)}
          />
          Normalize/worker
        </label>
      </div>

      <div className="win95-groupbox">
        <div className="win95-groupbox-title">Resource Flows</div>
        <ResourceFlowsTable
          pbs={projectBuildings}
          buildingMap={buildingMap}
          flowResourceList={flowResourceList}
          getNetFlow={getNetFlow}
          prices={prices}
          period={period}
          normalizeView={normalizeView}
          showProductivityOverride
          buildingProductivityOverrides={buildingProductivityOverrides}
          onBuildingClick={onBuildingClick}
          onUpdateQty={onUpdateQty}
          chains={chains}
          onMoveBuilding={updateChainMembers}
          onBuildingProductivityChange={setBuildingProductivity}
          onBuildingProductivityClear={clearBuildingProductivity}
        />
        {omittedCount > 0 && (
          <div className="win95-statusbar">
            {omittedCount} building(s) not shown: no production flows.
          </div>
        )}
      </div>

      <ChainBuilder
        projectId={projectId}
        projectBuildings={projectBuildings}
        buildingMap={buildingMap}
        flowResourceList={flowResourceList}
        period={period}
        normalizeView={normalizeView}
        getNetFlow={getNetFlow}
        prices={prices}
        included={included}
        onToggleIncluded={toggleIncluded}
        buildingProductivityOverrides={buildingProductivityOverrides}
        onBuildingClick={onBuildingClick}
        onUpdateQty={onUpdateQty}
        chains={chains}
        savingChains={savingChains}
        chainError={chainError}
        onAutoDetect={autoDetectChains}
        onClearChains={clearChains}
        onCreateChain={createChain}
        onRenameChain={renameChain}
        onCommitChainName={commitChainName}
        onReorderChain={reorderChain}
        onDissolveChain={dissolveChain}
        onMoveBuilding={updateChainMembers}
        onBuildingProductivityChange={setBuildingProductivity}
        onBuildingProductivityClear={clearBuildingProductivity}
      />
    </div>
  )
}

export default IncomeAnalysis

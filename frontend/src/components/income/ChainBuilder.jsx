import { useState, useEffect } from 'react'
import { fetchChainEconomicsAPI } from '../../api'
import ResourceFlowsTable from './ResourceFlowsTable'
import ChainEconomicsPanel from './ChainEconomicsPanel'

// Module-level component (not nested) — manages its own economics fetch per chain
function ChainCard({
  chain, projectId, period, buildingProductivityOverrides,
  chainProd, projectBuildings, buildingMap, flowResourceList,
  getNetFlow, prices, included, onToggleIncluded, normalizeView,
  onBuildingClick, onUpdateQty, chains,
  onRename, onCommitName, onMoveUp, onMoveDown, onDissolve, onMoveBuilding,
  onBuildingProductivityChange, onBuildingProductivityClear, onToggleFactor,
}) {
  const [economics, setEconomics] = useState(null)
  const [economicsLoading, setEconomicsLoading] = useState(false)

  const membersKey = [...chain.members].sort().join(',')
  const effProductivity = 1.0
  const relevantOverrides = chainProd
    ? Object.fromEntries(
        chain.members
          .filter(pos => buildingProductivityOverrides?.[pos] != null)
          .map(pos => [pos, buildingProductivityOverrides[pos]])
      )
    : {}
  const overridesKey = chain.members.map(pos => `${pos}:${relevantOverrides[pos] ?? ''}`).join(',')

  useEffect(() => {
    if (chain.members.length === 0) {
      setEconomics(null)
      return
    }
    setEconomicsLoading(true)
    fetchChainEconomicsAPI(
      projectId, chain.members, period, effProductivity, relevantOverrides, normalizeView
    )
      .then(setEconomics)
      .catch(console.error)
      .finally(() => setEconomicsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.id, membersKey, period, overridesKey, normalizeView, projectId])

  const chainPbs = chain.members
    .map(pos => projectBuildings.find(pb => pb.position === pos))
    .filter(Boolean)

  return (
    <div className="win95-groupbox" style={{ marginBottom: 6 }}>
      <div className="win95-groupbox-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          className="win95-input"
          style={{ flex: 1, minWidth: 80, padding: '1px 4px' }}
          value={chain.name}
          onChange={e => onRename(chain.id, e.target.value)}
          onBlur={() => onCommitName(chain.id)}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
        />
        <label style={{ fontSize: '0.8em', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={chainProd}
            onChange={e => onToggleFactor(chain.id, 'productivity', e.target.checked)} />
          Prod.
        </label>
        <button className="win95-btn" style={{ fontSize: '0.85em', padding: '1px 4px' }}
          onClick={() => onMoveUp(chain.id)} title="Move up">▲</button>
        <button className="win95-btn" style={{ fontSize: '0.85em', padding: '1px 4px' }}
          onClick={() => onMoveDown(chain.id)} title="Move down">▼</button>
        <button className="win95-btn" style={{ fontSize: '0.85em', padding: '1px 6px' }}
          onClick={() => onDissolve(chain.id)}>Dissolve</button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ResourceFlowsTable
            pbs={chainPbs}
            buildingMap={buildingMap}
            flowResourceList={flowResourceList}
            getNetFlow={getNetFlow}
            prices={prices}
            period={period}
            normalizeView={normalizeView}
            showMove
            showProductivityOverride
            showRubles={false}
            buildingProductivityOverrides={buildingProductivityOverrides}
            onBuildingClick={onBuildingClick}
            onUpdateQty={onUpdateQty}
            chains={chains}
            onMoveBuilding={onMoveBuilding}
            onBuildingProductivityChange={onBuildingProductivityChange}
            onBuildingProductivityClear={onBuildingProductivityClear}
          />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {economicsLoading && <div className="win95-statusbar">Computing…</div>}
          <ChainEconomicsPanel
            economics={economics}
            period={period}
            prices={prices}
            included={included}
            onToggleIncluded={onToggleIncluded}
            chainPbs={chainPbs}
            buildingMap={buildingMap}
          />
        </div>
      </div>
    </div>
  )
}

function ChainBuilder({
  projectId,
  projectBuildings,
  buildingMap,
  flowResourceList,
  period,
  normalizeView,
  getNetFlow,
  prices,
  included,
  onToggleIncluded,
  buildingProductivityOverrides,
  onBuildingClick,
  onUpdateQty,
  chains,
  savingChains,
  chainError,
  onAutoDetect,
  onClearChains,
  onCreateChain,
  onRenameChain,
  onCommitChainName,
  onReorderChain,
  onDissolveChain,
  onMoveBuilding,
  onBuildingProductivityChange,
  onBuildingProductivityClear,
}) {
  const [showAutoDetectConfirm, setShowAutoDetectConfirm] = useState(false)
  const [chainFactors, setChainFactors] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`chain-factors-${projectId}`)) || {} }
    catch { return {} }
  })

  // Sync chainFactors when project changes
  const [prevProjectId, setPrevProjectId] = useState(projectId)
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId)
    try {
      setChainFactors(JSON.parse(localStorage.getItem(`chain-factors-${projectId}`)) || {})
    } catch {
      setChainFactors({})
    }
  }

  function getChainFactors(chainId) {
    return chainFactors[chainId] ?? { productivity: true }
  }

  function handleToggleFactor(chainId, key, value) {
    setChainFactors(prev => {
      const current = prev[chainId] ?? { productivity: true }
      const updated = { ...prev, [chainId]: { ...current, [key]: value } }
      if (projectId) localStorage.setItem(`chain-factors-${projectId}`, JSON.stringify(updated))
      return updated
    })
  }

  function handleAutoDetectClick() {
    if (chains.length > 0) {
      setShowAutoDetectConfirm(true)
    } else {
      onAutoDetect()
    }
  }

  const sortedChains = [...chains].sort((a, b) => a.position - b.position)
  const chainedPositions = new Set(chains.flatMap(c => c.members))
  const ungroupedPbs = projectBuildings.filter(pb => !chainedPositions.has(pb.position))

  return (
    <div className="win95-groupbox" style={{ marginTop: 8 }}>
      <div className="win95-groupbox-title">Chain Builder</div>
      <div style={{ padding: '4px 8px 6px', display: 'flex', gap: 4 }}>
        <button className="win95-btn" onClick={handleAutoDetectClick} disabled={savingChains}>
          Auto-detect chains
        </button>
        <button className="win95-btn" onClick={onClearChains} disabled={savingChains}>
          Clear chains
        </button>
        <button className="win95-btn" onClick={onCreateChain} disabled={savingChains}>
          New chain
        </button>
      </div>
      {savingChains && <div className="win95-statusbar">Saving chains…</div>}
      {chainError && <div className="win95-statusbar" style={{ color: '#c00000' }}>{chainError}</div>}

      {sortedChains.map(chain => {
        const factors = getChainFactors(chain.id)
        return (
          <ChainCard
            key={chain.id}
            chain={chain}
            projectId={projectId}
            period={period}
            buildingProductivityOverrides={buildingProductivityOverrides}
            chainProd={factors.productivity}
            projectBuildings={projectBuildings}
            buildingMap={buildingMap}
            flowResourceList={flowResourceList}
            getNetFlow={getNetFlow}
            prices={prices}
            included={included}
            onToggleIncluded={onToggleIncluded}
            normalizeView={normalizeView}
            onBuildingClick={onBuildingClick}
            onUpdateQty={onUpdateQty}
            chains={chains}
            onRename={onRenameChain}
            onCommitName={onCommitChainName}
            onMoveUp={id => onReorderChain(id, 'up')}
            onMoveDown={id => onReorderChain(id, 'down')}
            onDissolve={onDissolveChain}
            onMoveBuilding={onMoveBuilding}
            onBuildingProductivityChange={onBuildingProductivityChange}
            onBuildingProductivityClear={onBuildingProductivityClear}
            onToggleFactor={handleToggleFactor}
          />
        )
      })}

      {ungroupedPbs.length > 0 && (
        <div className="win95-groupbox">
          <div className="win95-groupbox-title">Ungrouped</div>
          <ResourceFlowsTable
            pbs={ungroupedPbs}
            buildingMap={buildingMap}
            flowResourceList={flowResourceList}
            getNetFlow={getNetFlow}
            prices={prices}
            period={period}
            normalizeView={normalizeView}
            showMove={chains.length > 0}
            showProductivityOverride
            buildingProductivityOverrides={buildingProductivityOverrides}
            onBuildingClick={onBuildingClick}
            onUpdateQty={onUpdateQty}
            chains={chains}
            onMoveBuilding={onMoveBuilding}
            onBuildingProductivityChange={onBuildingProductivityChange}
            onBuildingProductivityClear={onBuildingProductivityClear}
          />
        </div>
      )}

      {showAutoDetectConfirm && (
        <div className="win95-dialog-overlay" onClick={() => setShowAutoDetectConfirm(false)}>
          <div className="win95-dialog" onClick={e => e.stopPropagation()}>
            <div className="win95-titlebar">
              <span>Confirm</span>
              <div className="win95-titlebar-buttons">
                <button className="win95-titlebar-btn" onClick={() => setShowAutoDetectConfirm(false)}>X</button>
              </div>
            </div>
            <div className="win95-dialog-body">
              <p style={{ margin: 0 }}>This will replace your current chains. Continue?</p>
            </div>
            <div className="win95-dialog-buttons">
              <button
                className="win95-btn win95-btn-default"
                onClick={() => { setShowAutoDetectConfirm(false); onAutoDetect() }}
              >Yes</button>
              <button className="win95-btn" onClick={() => setShowAutoDetectConfirm(false)}>No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChainBuilder

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchBuildingsList,
  fetchProjectChains,
  bulkReplaceProjectChainsAPI,
  updateProjectChainAPI,
  deleteProjectChainAPI,
  updateChainMembersAPI,
  createProjectChainAPI,
} from '../api'

function IncomeAnalysis({ projectId, projectBuildings, prices }) {
  const [allBuildings, setAllBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [chains, setChains] = useState([])
  const [loadingBuildings, setLoadingBuildings] = useState(true)
  const [loadingChains, setLoadingChains] = useState(true)
  const [savingChains, setSavingChains] = useState(false)
  const [chainError, setChainError] = useState(null)
  const [showAutoDetectConfirm, setShowAutoDetectConfirm] = useState(false)

  useEffect(() => {
    fetchBuildingsList()
      .then(data => {
        setResources(data.resources)
        setAllBuildings(data.buildings)
      })
      .catch(console.error)
      .finally(() => setLoadingBuildings(false))
  }, [])

  useEffect(() => {
    if (!projectId) {
      setLoadingChains(false)
      return
    }
    setLoadingChains(true)
    fetchProjectChains(projectId)
      .then(setChains)
      .catch(console.error)
      .finally(() => setLoadingChains(false))
  }, [projectId])

  const buildingMap = useMemo(() => {
    const map = {}
    for (const b of allBuildings) map[b.id] = b
    return map
  }, [allBuildings])

  // Resources active in any project building (produces or consumes)
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

  const hasAnyPrice = useMemo(() => {
    if (!prices) return false
    return flowResourceList.some(r => parseFloat(prices[String(r.id)]) > 0)
  }, [prices, flowResourceList])

  // Count of project buildings with no flow data (for omitted-buildings note)
  const omittedCount = useMemo(() => {
    if (loadingBuildings) return 0
    return projectBuildings.filter(pb => {
      const b = buildingMap[pb.buildingId]
      return b && Object.keys(b.produces || {}).length + Object.keys(b.consumes || {}).length === 0
    }).length
  }, [projectBuildings, buildingMap, loadingBuildings])

  // Chains sorted by position for display
  const sortedChains = useMemo(
    () => [...chains].sort((a, b) => a.position - b.position),
    [chains]
  )

  // --- Helpers ---

  function getNetFlow(b, pb, r) {
    return ((b.produces?.[String(r.id)] || 0) - (b.consumes?.[String(r.id)] || 0)) * pb.quantity
  }

  function computeRubleNet(b, pb, activeResources) {
    let value = 0
    let hasUnpriced = false
    for (const r of activeResources) {
      const net = getNetFlow(b, pb, r)
      if (net === 0) continue
      const price = parseFloat(prices?.[String(r.id)]) || 0
      if (price > 0) value += net * price
      else hasUnpriced = true
    }
    return { value, hasUnpriced }
  }

  function renderNetCell(net) {
    if (net === 0) return null
    const val = Math.round(net * 100) / 100
    if (net > 0) return <span>{val} ↑</span>
    return <span style={{ color: '#c00000' }}>{val} ↓</span>
  }

  function renderRubleCell(value, hasUnpriced) {
    if (value === 0 && !hasUnpriced) return null
    const color = value > 0 ? '#000080' : value < 0 ? '#c00000' : undefined
    return (
      <span
        style={{ color }}
        title={hasUnpriced ? 'Some resources are unpriced; total is partial.' : undefined}
      >
        {value !== 0 ? Math.round(value * 100) / 100 : ''}
        {hasUnpriced && <span className="win95-muted"> (+?)</span>}
      </span>
    )
  }

  // Compute active resources for a subset of project buildings
  function getActiveResources(pbs) {
    const ids = new Set()
    for (const pb of pbs) {
      const b = buildingMap[pb.buildingId]
      if (!b) continue
      for (const id of Object.keys(b.produces || {})) ids.add(String(id))
      for (const id of Object.keys(b.consumes || {})) ids.add(String(id))
    }
    return flowResourceList.filter(r => ids.has(String(r.id)))
  }

  // Render the income table for a set of project buildings
  function renderIncomeTable(pbs, { showMove = false } = {}) {
    const activePbs = pbs.filter(pb => {
      const b = buildingMap[pb.buildingId]
      if (!b) return false
      return Object.keys(b.produces || {}).length + Object.keys(b.consumes || {}).length > 0
    })
    if (activePbs.length === 0) {
      return <div className="win95-statusbar">No buildings with data in this group.</div>
    }

    const activeResources = getActiveResources(activePbs)
    if (activeResources.length === 0) {
      return <div className="win95-statusbar">No production flows for buildings in this group.</div>
    }

    // Per-resource totals
    const totals = {}
    for (const r of activeResources) {
      totals[r.id] = activePbs.reduce((sum, pb) => {
        const b = buildingMap[pb.buildingId]
        return b ? sum + getNetFlow(b, pb, r) : sum
      }, 0)
    }

    // Ruble total
    let totalRubles = 0
    let totalHasUnpriced = false
    for (const r of activeResources) {
      const net = totals[r.id]
      if (net === 0) continue
      const price = parseFloat(prices?.[String(r.id)]) || 0
      if (price > 0) totalRubles += net * price
      else totalHasUnpriced = true
    }

    return (
      <div className="win95-inset win95-table-wrap">
        <table className="win95-table win95-table-static">
          <thead>
            <tr>
              <th>Building</th>
              <th>Qty</th>
              {activeResources.map(r => <th key={r.id}>{r.name} ({r.unit})</th>)}
              {hasAnyPrice && <th>₽ Net</th>}
              {showMove && <th></th>}
            </tr>
          </thead>
          <tbody>
            {activePbs.map((pb, i) => {
              const b = buildingMap[pb.buildingId]
              if (!b) return null
              const { value: rubles, hasUnpriced } = computeRubleNet(b, pb, activeResources)
              return (
                <tr key={i}>
                  <td>
                    <Link to={`/buildings/${b.id}`}>{b.name}</Link>
                    {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
                  </td>
                  <td className="num">{pb.quantity}</td>
                  {activeResources.map(r => (
                    <td key={r.id} className="num">{renderNetCell(getNetFlow(b, pb, r))}</td>
                  ))}
                  {hasAnyPrice && (
                    <td className="num">{renderRubleCell(rubles, hasUnpriced)}</td>
                  )}
                  {showMove && (
                    <td>
                      {renderMoveDropdown(pb)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#e8e8e8' }}>
              <td style={{ fontWeight: 'bold' }}>Net</td>
              <td></td>
              {activeResources.map(r => (
                <td key={r.id} className="num">{renderNetCell(totals[r.id])}</td>
              ))}
              {hasAnyPrice && (
                <td className="num">{renderRubleCell(totalRubles, totalHasUnpriced)}</td>
              )}
              {showMove && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  // --- Chain helpers ---

  function getChainedPositions() {
    const s = new Set()
    for (const c of chains) for (const pos of c.members) s.add(pos)
    return s
  }

  function getBuildingChainId(buildingPos) {
    for (const c of chains) {
      if (c.members.includes(buildingPos)) return c.id
    }
    return 'ungrouped'
  }

  function renderMoveDropdown(pb) {
    const currentChainId = getBuildingChainId(pb.position)
    const availableChains = [...chains]
      .sort((a, b) => a.position - b.position)
      .filter(c => c.id !== currentChainId)
    return (
      <select
        className="win95-select"
        style={{ fontSize: '0.85em' }}
        value={currentChainId}
        onChange={e => handleMoveBuilding(pb.position, e.target.value)}
        title="Move to chain"
      >
        <option value="ungrouped">Ungrouped</option>
        {availableChains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    )
  }

  function renderChainStatusLine(pbs) {
    const activePbs = pbs.filter(pb => buildingMap[pb.buildingId])
    const activeResources = getActiveResources(activePbs)

    const totals = {}
    for (const r of activeResources) {
      totals[r.id] = activePbs.reduce((sum, pb) => {
        const b = buildingMap[pb.buildingId]
        return b ? sum + getNetFlow(b, pb, r) : sum
      }, 0)
    }

    const nonZero = activeResources.filter(r => totals[r.id] !== 0)
    if (nonZero.length === 0) return null

    let totalRubles = 0
    let anyPriced = false
    for (const r of nonZero) {
      const price = parseFloat(prices?.[String(r.id)]) || 0
      if (price > 0) { totalRubles += totals[r.id] * price; anyPriced = true }
    }

    return (
      <div className="win95-statusbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nonZero.map(r => {
          const net = totals[r.id]
          const val = Math.round(net * 100) / 100
          return (
            <span key={r.id} style={{ color: net > 0 ? undefined : '#c00000' }}>
              {net > 0 ? '↑' : '↓'} {r.name}: {Math.abs(val)}{r.unit}
            </span>
          )
        })}
        {hasAnyPrice && anyPriced && (
          <span style={{ color: totalRubles > 0 ? '#000080' : '#c00000', fontWeight: 'bold' }}>
            | ₽ {Math.round(totalRubles * 100) / 100}
          </span>
        )}
      </div>
    )
  }

  // --- Chain operations ---

  async function runAutoDetect() {
    const flowBuildings = projectBuildings.filter(pb => {
      const b = buildingMap[pb.buildingId]
      if (!b) return false
      return Object.keys(b.produces || {}).length + Object.keys(b.consumes || {}).length > 0
    })

    if (flowBuildings.length === 0) return

    const parent = {}
    for (const pb of flowBuildings) parent[pb.position] = pb.position

    function find(x) {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
      return x
    }
    function union(x, y) { parent[find(x)] = find(y) }

    const resourceToPositions = {}
    for (const pb of flowBuildings) {
      const b = buildingMap[pb.buildingId]
      if (!b) continue
      for (const rid of [...Object.keys(b.produces || {}), ...Object.keys(b.consumes || {})]) {
        if (!resourceToPositions[rid]) resourceToPositions[rid] = []
        resourceToPositions[rid].push(pb.position)
      }
    }
    for (const poss of Object.values(resourceToPositions)) {
      for (let i = 1; i < poss.length; i++) union(poss[0], poss[i])
    }

    const components = {}
    for (const pb of flowBuildings) {
      const root = find(pb.position)
      if (!components[root]) components[root] = []
      components[root].push(pb.position)
    }

    const rmap = {}
    for (const r of resources) rmap[r.id] = r

    const newChains = Object.values(components).map((members, i) => {
      const produced = {}
      for (const pos of members) {
        const pb = projectBuildings.find(p => p.position === pos)
        if (!pb) continue
        const b = buildingMap[pb.buildingId]
        if (!b) continue
        for (const [rid, qty] of Object.entries(b.produces || {})) {
          produced[rid] = (produced[rid] || 0) + qty * pb.quantity
        }
      }
      let bestName = null
      let bestQty = 0
      for (const [rid, qty] of Object.entries(produced)) {
        if (qty > bestQty) { bestQty = qty; bestName = rmap[rid]?.name }
      }
      return { name: bestName || `Chain ${i + 1}`, members }
    })

    setSavingChains(true)
    setChainError(null)
    try {
      const saved = await bulkReplaceProjectChainsAPI(projectId, newChains)
      setChains(saved)
    } catch (e) {
      console.error(e)
      setChainError('Failed to save chains. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  function handleAutoDetectClick() {
    if (chains.length > 0) {
      setShowAutoDetectConfirm(true)
    } else {
      runAutoDetect()
    }
  }

  async function handleClearChains() {
    setSavingChains(true)
    setChainError(null)
    try {
      await bulkReplaceProjectChainsAPI(projectId, [])
      setChains([])
    } catch (e) {
      console.error(e)
      setChainError('Failed to save chains. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  function handleChainNameChange(chainId, value) {
    setChains(prev => prev.map(c => c.id === chainId ? { ...c, name: value } : c))
  }

  function handleChainNameCommit(chainId) {
    const chain = chains.find(c => c.id === chainId)
    if (chain && chain.name.trim()) {
      updateProjectChainAPI(projectId, chainId, chain.name.trim()).catch(console.error)
    }
  }

  async function handleDissolveChain(chainId) {
    try {
      await deleteProjectChainAPI(projectId, chainId)
      setChains(prev => prev.filter(c => c.id !== chainId))
    } catch (e) {
      console.error(e)
    }
  }

  async function handleNewChain() {
    const nextNum = chains.length + 1
    const name = `Chain ${nextNum}`
    setSavingChains(true)
    setChainError(null)
    try {
      const created = await createProjectChainAPI(projectId, name)
      setChains(prev => [...prev, created])
    } catch (e) {
      console.error(e)
      setChainError('Failed to create chain. Try again.')
    } finally {
      setSavingChains(false)
    }
  }

  async function handleMoveChainUp(chainId) {
    const sorted = [...chains].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(c => c.id === chainId)
    if (idx <= 0) return
    const chainA = sorted[idx - 1]
    const chainB = sorted[idx]
    setChains(prev => prev.map(c => {
      if (c.id === chainA.id) return { ...c, position: chainB.position }
      if (c.id === chainB.id) return { ...c, position: chainA.position }
      return c
    }))
    try {
      await Promise.all([
        updateProjectChainAPI(projectId, chainA.id, chainA.name, chainB.position),
        updateProjectChainAPI(projectId, chainB.id, chainB.name, chainA.position),
      ])
    } catch (e) {
      console.error(e)
      fetchProjectChains(projectId).then(setChains).catch(console.error)
    }
  }

  async function handleMoveChainDown(chainId) {
    const sorted = [...chains].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(c => c.id === chainId)
    if (idx >= sorted.length - 1) return
    const chainA = sorted[idx]
    const chainB = sorted[idx + 1]
    setChains(prev => prev.map(c => {
      if (c.id === chainA.id) return { ...c, position: chainB.position }
      if (c.id === chainB.id) return { ...c, position: chainA.position }
      return c
    }))
    try {
      await Promise.all([
        updateProjectChainAPI(projectId, chainA.id, chainA.name, chainB.position),
        updateProjectChainAPI(projectId, chainB.id, chainB.name, chainA.position),
      ])
    } catch (e) {
      console.error(e)
      fetchProjectChains(projectId).then(setChains).catch(console.error)
    }
  }

  async function handleMoveBuilding(buildingPos, targetChainId) {
    const currentChainId = chains.find(c => c.members.includes(buildingPos))?.id || 'ungrouped'
    if (currentChainId === targetChainId) return

    const currentChain = chains.find(c => c.id === currentChainId)
    const targetChain = chains.find(c => c.id === targetChainId)

    // Optimistic update
    setChains(prev => prev.map(c => {
      if (c.id === currentChainId) return { ...c, members: c.members.filter(p => p !== buildingPos) }
      if (c.id === targetChainId) return { ...c, members: [...c.members, buildingPos] }
      return c
    }))

    try {
      if (targetChainId === 'ungrouped') {
        if (currentChain) {
          const newMembers = currentChain.members.filter(p => p !== buildingPos)
          await updateChainMembersAPI(projectId, currentChainId, newMembers)
        }
      } else if (targetChain) {
        const newMembers = [...targetChain.members.filter(p => p !== buildingPos), buildingPos]
        const updated = await updateChainMembersAPI(projectId, targetChainId, newMembers)
        setChains(prev => prev.map(c => c.id === targetChainId ? updated : c))
      }
    } catch (e) {
      console.error(e)
      fetchProjectChains(projectId).then(setChains).catch(console.error)
    }
  }

  // --- Render chain groupbox ---

  function renderChain(chain) {
    const chainPbs = chain.members
      .map(pos => projectBuildings.find(pb => pb.position === pos))
      .filter(Boolean)

    return (
      <div key={chain.id} className="win95-groupbox" style={{ marginBottom: 6 }}>
        <div className="win95-groupbox-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            className="win95-input"
            style={{ flex: 1, minWidth: 80, padding: '1px 4px' }}
            value={chain.name}
            onChange={e => handleChainNameChange(chain.id, e.target.value)}
            onBlur={() => handleChainNameCommit(chain.id)}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          />
          <button
            className="win95-btn"
            style={{ fontSize: '0.85em', padding: '1px 4px' }}
            onClick={() => handleMoveChainUp(chain.id)}
            title="Move up"
          >▲</button>
          <button
            className="win95-btn"
            style={{ fontSize: '0.85em', padding: '1px 4px' }}
            onClick={() => handleMoveChainDown(chain.id)}
            title="Move down"
          >▼</button>
          <button
            className="win95-btn"
            style={{ fontSize: '0.85em', padding: '1px 6px' }}
            onClick={() => handleDissolveChain(chain.id)}
          >
            Dissolve
          </button>
        </div>
        {renderIncomeTable(chainPbs, { showMove: true })}
        {renderChainStatusLine(chainPbs)}
      </div>
    )
  }

  function renderAutoDetectConfirmDialog() {
    if (!showAutoDetectConfirm) return null
    return (
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
              onClick={() => { setShowAutoDetectConfirm(false); runAutoDetect() }}
            >Yes</button>
            <button
              className="win95-btn"
              onClick={() => setShowAutoDetectConfirm(false)}
            >No</button>
          </div>
        </div>
      </div>
    )
  }

  function renderChainBuilder() {
    const chainedPositions = getChainedPositions()
    const ungroupedPbs = projectBuildings.filter(pb => !chainedPositions.has(pb.position))

    return (
      <div className="win95-groupbox" style={{ marginTop: 8 }}>
        <div className="win95-groupbox-title">Chain Builder</div>
        <div style={{ padding: '4px 8px 6px', display: 'flex', gap: 4 }}>
          <button className="win95-btn" onClick={handleAutoDetectClick} disabled={savingChains}>
            Auto-detect chains
          </button>
          <button className="win95-btn" onClick={handleClearChains} disabled={savingChains}>
            Clear chains
          </button>
          <button className="win95-btn" onClick={handleNewChain} disabled={savingChains}>
            New chain
          </button>
        </div>
        {savingChains && <div className="win95-statusbar">Saving chains…</div>}
        {chainError && <div className="win95-statusbar" style={{ color: '#c00000' }}>{chainError}</div>}
        {sortedChains.map(renderChain)}
        {ungroupedPbs.length > 0 && (
          <div className="win95-groupbox">
            <div className="win95-groupbox-title">Ungrouped</div>
            {renderIncomeTable(ungroupedPbs, { showMove: chains.length > 0 })}
          </div>
        )}
        {renderAutoDetectConfirmDialog()}
      </div>
    )
  }

  // --- Main render ---

  if (loadingBuildings) {
    return <div className="win95-statusbar">Loading...</div>
  }

  if (projectBuildings.length === 0) {
    return <div className="win95-statusbar">No buildings in project. Add buildings in the Construction Costs tab.</div>
  }

  if (flowResourceList.length === 0) {
    return <div className="win95-statusbar">No production flows for the buildings in this project.</div>
  }

  return (
    <div>
      <div className="win95-groupbox">
        <div className="win95-groupbox-title">Resource Income</div>
        {renderIncomeTable(projectBuildings)}
        {omittedCount > 0 && (
          <div className="win95-statusbar">
            {omittedCount} building(s) not shown: no production flows.
          </div>
        )}
      </div>
      {!loadingChains && renderChainBuilder()}
    </div>
  )
}

export default IncomeAnalysis

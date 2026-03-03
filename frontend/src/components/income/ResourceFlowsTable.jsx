import BlockSlider from '../BlockSlider'
import { PERIODS } from '../../hooks/useProductivity'

function ResourceFlowsTable({
  pbs,
  buildingMap,
  flowResourceList,
  getNetFlow,
  prices,
  period,
  normalizeView,
  showMove = false,
  showProductivityOverride = false,
  showRubles = true,
  buildingProductivityOverrides,
  onBuildingClick,
  onUpdateQty,
  chains,
  onMoveBuilding,
  onBuildingProductivityChange,
  onBuildingProductivityClear,
}) {
  const activePbs = pbs.filter(pb => {
    const b = buildingMap[pb.buildingId]
    if (!b) return false
    return Object.keys(b.produces || {}).length + Object.keys(b.consumes || {}).length > 0
  })

  if (activePbs.length === 0) {
    return <div className="win95-statusbar">No buildings with data in this group.</div>
  }

  // Resources active in this subset of buildings
  const activeIds = new Set()
  for (const pb of activePbs) {
    const b = buildingMap[pb.buildingId]
    if (!b) continue
    for (const id of Object.keys(b.produces || {})) activeIds.add(String(id))
    for (const id of Object.keys(b.consumes || {})) activeIds.add(String(id))
  }
  const activeResources = flowResourceList.filter(r => activeIds.has(String(r.id)))

  if (activeResources.length === 0) {
    return <div className="win95-statusbar">No production flows for buildings in this group.</div>
  }

  const flowOpts = { applyProductivity: true, applyNormalize: normalizeView, period }
  const suffix = PERIODS[period]?.suffix || '/mo'

  function importPrice(r) { return parseFloat(prices?.[String(r.id)]?.import) || 0 }
  function exportPrice(r) { return parseFloat(prices?.[String(r.id)]?.export) || 0 }
  const hasAnyPrice = showRubles && activeResources.some(r => importPrice(r) > 0 || exportPrice(r) > 0)

  function periodUnit(r) {
    const base = r.unit === 'MW' ? 'MWh' : r.unit
    const workerPart = normalizeView ? '/worker' : ''
    return base + workerPart + suffix
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
      <span style={{ color }}
        title={hasUnpriced ? 'Some resources are unpriced; total is partial.' : undefined}>
        {value !== 0 ? Math.round(value * 100) / 100 : ''}
        {hasUnpriced && <span className="win95-muted"> (+?)</span>}
      </span>
    )
  }

  function getChainIdForPos(pos) {
    if (!chains) return 'ungrouped'
    return chains.find(c => c.members.includes(pos))?.id || 'ungrouped'
  }

  function renderMoveDropdown(pb) {
    const currentChainId = getChainIdForPos(pb.position)
    const availableChains = [...(chains || [])]
      .sort((a, b) => a.position - b.position)
      .filter(c => c.id !== currentChainId)
    return (
      <select
        className="win95-select"
        style={{ fontSize: '0.85em' }}
        value={currentChainId}
        onChange={e => onMoveBuilding(pb.position, e.target.value)}
        title="Move to chain"
      >
        <option value="ungrouped">-</option>
        {availableChains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    )
  }

  // Per-resource totals
  const totals = {}
  for (const r of activeResources) {
    totals[r.id] = activePbs.reduce((sum, pb) => {
      const b = buildingMap[pb.buildingId]
      return b ? sum + getNetFlow(b, pb, r, flowOpts) : sum
    }, 0)
  }

  let totalRubles = 0
  let totalHasUnpriced = false
  for (const r of activeResources) {
    const net = totals[r.id]
    if (net === 0) continue
    const price = net > 0 ? exportPrice(r) : importPrice(r)
    if (price > 0) totalRubles += net * price
    else totalHasUnpriced = true
  }

  return (
    <div className="win95-inset win95-table-wrap">
      <table className="win95-table win95-table-static">
        <thead>
          <tr>
            <th style={{ width: '100%', textAlign: 'left' }}>Building</th>
            {showMove && <th></th>}
            <th>Qty</th>
            {activeResources.map(r => <th key={r.id}>{r.name} ({periodUnit(r)})</th>)}
            {hasAnyPrice && <th>₽ Net</th>}
          </tr>
        </thead>
        <tbody>
          {activePbs.map((pb, i) => {
            const b = buildingMap[pb.buildingId]
            if (!b) return null

            let rubles = 0
            let hasUnpriced = false
            for (const r of activeResources) {
              const net = getNetFlow(b, pb, r, flowOpts)
              if (net === 0) continue
              const price = net > 0 ? exportPrice(r) : importPrice(r)
              if (price > 0) rubles += net * price
              else hasUnpriced = true
            }

            const hasOverride = buildingProductivityOverrides?.[pb.position] != null

            return (
              <tr key={i}>
                <td>
                  {onBuildingClick
                    ? <button className="win95-link-btn" onClick={() => onBuildingClick(b.id)}>{b.name}</button>
                    : b.name
                  }
                  {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
                  {showProductivityOverride && (
                    <div style={{ marginTop: 2 }}>
                      <BlockSlider
                        min={0} max={1} step={0.01}
                        value={Math.min(1, buildingProductivityOverrides?.[pb.position] ?? 1.0)}
                        onChange={factor => onBuildingProductivityChange(pb.position, factor)}
                        label={v => `${Math.round(v * 100)}%`}
                        hasOverride={hasOverride}
                        onClear={() => onBuildingProductivityClear(pb.position)}
                      />
                    </div>
                  )}
                </td>
                {showMove && <td>{renderMoveDropdown(pb)}</td>}
                <td className="num">
                  {onUpdateQty
                    ? (
                      <input
                        type="number"
                        className="win95-input"
                        style={{ width: '3.5em' }}
                        min="1"
                        value={pb.quantity}
                        onChange={e => onUpdateQty(pb.position, Math.max(1, Number(e.target.value) || 1))}
                      />
                    )
                    : pb.quantity
                  }
                </td>
                {activeResources.map(r => (
                  <td key={r.id} className="num">{renderNetCell(getNetFlow(b, pb, r, flowOpts))}</td>
                ))}
                {hasAnyPrice && (
                  <td className="num">{renderRubleCell(rubles, hasUnpriced)}</td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e8e8e8' }}>
            <td style={{ fontWeight: 'bold' }}>Net</td>
            <td></td>
            {showMove && <td></td>}
            {activeResources.map(r => (
              <td key={r.id} className="num">{renderNetCell(totals[r.id])}</td>
            ))}
            {hasAnyPrice && (
              <td className="num">{renderRubleCell(totalRubles, totalHasUnpriced)}</td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default ResourceFlowsTable

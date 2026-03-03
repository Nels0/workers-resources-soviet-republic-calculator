import { PERIODS } from '../../hooks/useProductivity'

function ChainEconomicsPanel({ economics, period, prices, included, onToggleIncluded, chainPbs, buildingMap, buildingProductivityOverrides }) {
  if (!economics) return null

  const { resources, produced, consumed, net, coverage, buildingUtilization, buildingLimitedBy } = economics
  if (!resources || resources.length === 0) return null

  const nonZero = resources.filter(r => produced[r.id] !== 0 || consumed[r.id] !== 0)
  if (nonZero.length === 0) return null

  const suffix = PERIODS[period]?.suffix || '/mo'
  const periodChar = PERIODS[period]?.char || 'M'
  function unitBase(r) { return r.unit === 'MW' ? 'MWh' : r.unit }
  const hasCoverage = nonZero.some(r => coverage[String(r.id)] != null)

  function importPrice(r) { return parseFloat(prices?.[String(r.id)]?.import) || 0 }
  function exportPrice(r) { return parseFloat(prices?.[String(r.id)]?.export) || 0 }

  const hasAnyPrice = resources.some(r => importPrice(r) > 0 || exportPrice(r) > 0)

  let importRubles = 0
  let exportRubles = 0
  let hasMissingPrice = false
  for (const r of nonZero) {
    if (included[String(r.id)] === false) continue
    const n = net[String(r.id)] || 0
    if (n < 0) {
      importRubles += Math.abs(n) * importPrice(r)
      if (importPrice(r) === 0) hasMissingPrice = true
    } else if (n > 0) {
      exportRubles += n * exportPrice(r)
      if (exportPrice(r) === 0) hasMissingPrice = true
    }
  }
  const netRubles = exportRubles - importRubles
  const netRubleColor = netRubles > 0 ? '#000080' : netRubles < 0 ? '#c00000' : undefined

  let totalEffectiveWorkers = 0
  if (chainPbs && buildingMap) {
    for (const pb of chainPbs) {
      const b = buildingMap[pb.buildingId]
      if (!b || !b.workers_needed) continue
      const cfactor = parseFloat(buildingUtilization?.[String(pb.position)] ?? 1.0)
      const staffing = buildingProductivityOverrides?.[pb.position] ?? 1.0
      totalEffectiveWorkers += b.workers_needed * pb.quantity * cfactor * staffing
    }
  }
  const netRublesPerWorker = totalEffectiveWorkers > 0 ? netRubles / totalEffectiveWorkers : null

  const bottleneckedBuildings = Object.entries(buildingUtilization || {})

  return (
    <div className="win95-groupbox" style={{ marginTop: 0 }}>
      <div className="win95-groupbox-title">Chain Economics</div>
      <div className="win95-inset win95-table-wrap" style={{ marginTop: 4 }}>
        <table className="win95-table win95-table-static" style={{ tableLayout: 'fixed', width: 'auto' }}>
          <thead>
            <tr>
              <th style={{ width: '9em' }}>Resource</th>
              <th style={{ width: '6em' }}>Produced</th>
              <th style={{ width: '6em' }}>Consumed</th>
              <th style={{ width: '8em' }}>Net</th>
              {hasCoverage && (
                <th style={{ width: '4.5em' }} title="Internal supply / internal demand for resources traded within this chain">Internal %</th>
              )}
              {hasAnyPrice && <th style={{ width: '2em' }} title="Include in ₽ totals">☐</th>}
            </tr>
          </thead>
          <tbody>
            {nonZero.map(r => {
              const rid = String(r.id)
              const n = net[rid] || 0
              const cov = coverage[rid]
              const netColor = n < 0 ? '#c00000' : undefined
              const netLabel = n > 0 ? `+${Math.round(n * 100) / 100} ↑`
                : n < 0 ? `${Math.round(n * 100) / 100} ↓` : '0'
              const missingPrice = n !== 0 && (n > 0 ? exportPrice(r) === 0 : importPrice(r) === 0)

              let coverageCell = null
              if (cov != null) {
                const pct = Math.round(cov * 100)
                if (cov > 1.005) {
                  const surplus = Math.round(n * 100) / 100
                  coverageCell = (
                    <span style={{ color: '#000080' }}
                      title={`${pct - 100}% excess — ${surplus} ${unitBase(r)}/${periodChar} exported from chain`}>
                      +{pct - 100}%
                    </span>
                  )
                } else {
                  coverageCell = (
                    <span className="win95-muted"
                      title="Fully consumed internally — downstream buildings scale to available supply">
                      =100%
                    </span>
                  )
                }
              }

              return (
                <tr key={rid}>
                  <td style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {r.name}
                    <span className="win95-muted" style={{ fontSize: '0.85em' }}> {unitBase(r)}/{periodChar}</span>
                  </td>
                  <td className="num">{produced[rid] ? Math.round(produced[rid] * 100) / 100 : ''}</td>
                  <td className="num">{consumed[rid] ? Math.round(consumed[rid] * 100) / 100 : ''}</td>
                  <td className="num" style={{ color: netColor }}>
                    {netLabel}
                    {missingPrice && <span className="win95-muted"> (+?)</span>}
                  </td>
                  {hasCoverage && <td className="num">{coverageCell}</td>}
                  {hasAnyPrice && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={included[rid] !== false}
                        onChange={() => onToggleIncluded(rid)}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {bottleneckedBuildings.length > 0 && (
        <div className="win95-inset" style={{ marginTop: 4, padding: '3px 6px', fontSize: '0.85em' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Idle capacity:</div>
          {bottleneckedBuildings.map(([pos, util]) => {
            const limitRid = buildingLimitedBy?.[pos]
            const limitResource = resources.find(r => String(r.id) === String(limitRid))
            const usedPct = Math.round(parseFloat(util) * 100)
            const unusedPct = 100 - usedPct
            const pb = chainPbs?.find(p => String(p.position) === String(pos))
            const b = pb && buildingMap?.[pb.buildingId]
            const label = b ? `${b.name}${pb.quantity > 1 ? ` ×${pb.quantity}` : ''}` : `pos ${pos}`
            return (
              <div key={pos} style={{ color: '#c00000' }}>
                {label}: {unusedPct}% idle — waiting for {limitResource?.name ?? '?'}
              </div>
            )
          })}
        </div>
      )}

      {hasAnyPrice && (
        <div className="win95-statusbar" style={{ display: 'flex', gap: 12 }}>
          <span>Import: ₽{Math.round(importRubles * 100) / 100}{suffix}</span>
          <span>Export: ₽{Math.round(exportRubles * 100) / 100}{suffix}</span>
          <span style={{ color: netRubleColor, fontWeight: 'bold' }}>
            Net: ₽{netRubles >= 0 ? '+' : ''}{Math.round(netRubles * 100) / 100}{suffix}
            {hasMissingPrice && <span className="win95-muted"> (+?)</span>}
          </span>
          {netRublesPerWorker !== null && (
            <span className="win95-muted">
              ₽{netRublesPerWorker >= 0 ? '+' : ''}{Math.round(netRublesPerWorker * 100) / 100}/w/{periodChar}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default ChainEconomicsPanel

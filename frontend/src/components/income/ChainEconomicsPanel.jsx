import { PERIODS } from '../../hooks/useProductivity'

function ChainEconomicsPanel({ economics, period, prices, included, onToggleIncluded }) {
  if (!economics) return null

  const { resources, produced, consumed, net, coverage, buildingUtilization, buildingLimitedBy } = economics
  if (!resources || resources.length === 0) return null

  const nonZero = resources.filter(r => produced[r.id] !== 0 || consumed[r.id] !== 0)
  if (nonZero.length === 0) return null

  const suffix = PERIODS[period]?.suffix || '/mo'
  const hasCoverage = nonZero.some(r => coverage[String(r.id)] != null)

  function importPrice(r) { return parseFloat(prices?.[String(r.id)]?.import) || 0 }
  function exportPrice(r) { return parseFloat(prices?.[String(r.id)]?.export) || 0 }

  const hasAnyPrice = resources.some(r => importPrice(r) > 0 || exportPrice(r) > 0)

  let importRubles = 0
  let exportRubles = 0
  for (const r of nonZero) {
    if (included[String(r.id)] === false) continue
    const n = net[String(r.id)] || 0
    if (n < 0) importRubles += Math.abs(n) * importPrice(r)
    else if (n > 0) exportRubles += n * exportPrice(r)
  }
  const netRubles = exportRubles - importRubles
  const netRubleColor = netRubles > 0 ? '#000080' : netRubles < 0 ? '#c00000' : undefined

  const bottleneckedBuildings = Object.entries(buildingUtilization || {})

  return (
    <div>
      <div className="win95-inset win95-table-wrap" style={{ marginTop: 4 }}>
        <table className="win95-table win95-table-static">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Produced</th>
              <th>Consumed</th>
              <th>Net</th>
              {hasCoverage && (
                <th title="Internal supply coverage">Coverage</th>
              )}
              {hasAnyPrice && <th title="Include in ₽ totals">☐</th>}
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

              let coverageCell = null
              if (cov != null) {
                const pct = Math.round(cov * 100)
                if (cov > 1.005) {
                  const surplus = Math.round(n * 100) / 100
                  coverageCell = (
                    <span style={{ color: '#000080' }}
                      title={`${surplus} ${r.unit}${suffix} surplus — ${pct - 100}% excess production`}>
                      {pct}%
                    </span>
                  )
                } else {
                  coverageCell = (
                    <span className="win95-muted"
                      title="Internally balanced — consuming buildings scaled to available supply">
                      ~100%
                    </span>
                  )
                }
              }

              return (
                <tr key={rid}>
                  <td>{r.name} <span className="win95-muted" style={{ fontSize: '0.85em' }}>({r.unit}{suffix})</span></td>
                  <td className="num">{produced[rid] ? Math.round(produced[rid] * 100) / 100 : ''}</td>
                  <td className="num">{consumed[rid] ? Math.round(consumed[rid] * 100) / 100 : ''}</td>
                  <td className="num" style={{ color: netColor }}>{netLabel}</td>
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
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Unused capacity:</div>
          {bottleneckedBuildings.map(([pos, util]) => {
            const limitRid = buildingLimitedBy?.[pos]
            const limitResource = resources.find(r => String(r.id) === String(limitRid))
            const usedPct = Math.round(parseFloat(util) * 100)
            const unusedPct = 100 - usedPct
            return (
              <div key={pos} style={{ color: '#c00000' }}>
                pos {pos} ×: {unusedPct}% unused — limited by {limitResource?.name ?? '?'}
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
          </span>
        </div>
      )}
    </div>
  )
}

export default ChainEconomicsPanel

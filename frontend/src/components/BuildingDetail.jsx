import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchBuilding } from '../api'

function BuildingDetail() {
  const { id } = useParams()
  const [building, setBuilding] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBuilding(id)
      .then(setBuilding)
      .catch(err => setError(err.message))
  }, [id])

  if (error) return <p className="win95-error">Error: {error}</p>
  if (!building) return <div className="win95-statusbar">Loading...</div>

  const constructionCosts = building.costs?.filter(c => c.phase === 'construction') || []
  const operationCosts    = building.costs?.filter(c => c.phase === 'operation') || []
  const producesFlows     = building.flows?.filter(f => f.direction === 'produces') || []
  const consumesFlows     = building.flows?.filter(f => f.direction === 'consumes') || []
  const hasOperationData  = operationCosts.length > 0 || producesFlows.length > 0 || consumesFlows.length > 0

  function renderConstructionCosts() {
    if (constructionCosts.length === 0) return null
    return (
      <div className="win95-groupbox">
        <div className="win95-groupbox-title">Construction Costs</div>
        <div className="win95-inset">
          <table className="win95-table win95-table-static">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {constructionCosts.map(c => (
                <tr key={c.id}>
                  <td>{c.resource?.name}</td>
                  <td className="num">{c.quantity}</td>
                  <td>{c.resource?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderOperationCosts() {
    if (operationCosts.length === 0) return null
    return (
      <>
        <div className="win95-groupbox-title">Operation Costs</div>
        <div className="win95-inset">
          <table className="win95-table win95-table-static">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {operationCosts.map(c => (
                <tr key={c.id}>
                  <td>{c.resource?.name}</td>
                  <td className="num">{c.quantity}</td>
                  <td>{c.resource?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderProductionFlows() {
    if (producesFlows.length === 0 && consumesFlows.length === 0) return null
    const allFlows = [...producesFlows, ...consumesFlows]
    return (
      <>
        <div className="win95-groupbox-title">Production</div>
        <div className="win95-inset">
          <table className="win95-table win95-table-static">
            <thead>
              <tr>
                <th>Direction</th>
                <th>Resource</th>
                <th>Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {allFlows.map(f => (
                <tr key={f.id}>
                  <td>{f.direction === 'produces' ? '\u2191 Produces' : '\u2193 Consumes'}</td>
                  <td>{f.resource?.name}</td>
                  <td className="num">{f.quantity}</td>
                  <td>{f.resource?.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  function renderOperationGroupbox() {
    if (!hasOperationData) {
      return <p className="win95-muted" style={{ padding: 4 }}>No operation data.</p>
    }
    return (
      <div className="win95-groupbox">
        <div className="win95-groupbox-title">Operation</div>
        {renderOperationCosts()}
        {renderProductionFlows()}
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Link to="/">&larr; Back to list</Link>
      </div>
      <div className="win95-window">
        <div className="win95-titlebar">
          <span>{building.name}</span>
          <div className="win95-titlebar-buttons">
            <button className="win95-titlebar-btn">_</button>
            <button className="win95-titlebar-btn">&square;</button>
            <button className="win95-titlebar-btn">X</button>
          </div>
        </div>

        <div style={{ padding: 4 }}>
          <span className="win95-field-label">Category: </span>
          <span className="win95-badge">{building.category}</span>
          {'  '}
          <span className="win95-field-label">Workers: </span>
          {building.workers_needed}
          {'  '}
          <span className="win95-field-label">Days: </span>
          {building.construction_days}
          <div style={{ marginTop: 2 }}>
            <span className="win95-field-label">Source: </span>
            <span className="win95-muted">{building.source_file}</span>
          </div>
        </div>

        {renderConstructionCosts()}
        {renderOperationGroupbox()}
      </div>
    </>
  )
}

export default BuildingDetail

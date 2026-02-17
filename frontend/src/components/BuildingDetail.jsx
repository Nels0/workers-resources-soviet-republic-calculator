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
  const operationCosts = building.costs?.filter(c => c.phase === 'operation') || []

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
          <div className="win95-field">
            <span className="win95-field-label">Source file: </span>
            <span className="win95-muted">{building.source_file}</span>
          </div>
          <div className="win95-field">
            <span className="win95-field-label">Category: </span>
            <span className="win95-badge">{building.category}</span>
          </div>
          <div className="win95-field">
            <span className="win95-field-label">Workers: </span>
            {building.workers_needed}
          </div>
          <div className="win95-field">
            <span className="win95-field-label">Construction days: </span>
            {building.construction_days}
          </div>
        </div>

        {constructionCosts.length > 0 && (
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
        )}

        {operationCosts.length > 0 && (
          <div className="win95-groupbox">
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
          </div>
        )}

        {constructionCosts.length === 0 && operationCosts.length === 0 && (
          <p className="win95-muted" style={{ padding: 4 }}>No cost data available.</p>
        )}
      </div>
    </>
  )
}

export default BuildingDetail

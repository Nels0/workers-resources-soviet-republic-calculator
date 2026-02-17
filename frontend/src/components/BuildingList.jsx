import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { fetchBuildingsList } from '../api'
import '../win95.css'

function BuildingList() {
  const [buildings, setBuildings] = useState([])
  const [resources, setResources] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      fetchBuildingsList(search, category)
        .then(data => {
          setResources(data.resources)
          setBuildings(data.buildings)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [search, category])

  const categories = useMemo(() => {
    const cats = new Set(buildings.map(b => b.category).filter(Boolean))
    return [...cats].sort()
  }, [buildings])

  const sorted = useMemo(() => {
    const arr = [...buildings]
    arr.sort((a, b) => {
      let av, bv
      if (sortKey.startsWith('res_')) {
        const rid = sortKey.slice(4)
        av = a.resource_costs[rid] || 0
        bv = b.resource_costs[rid] || 0
      } else {
        av = a[sortKey] ?? ''
        bv = b[sortKey] ?? ''
      }
      if (typeof av === 'string') {
        av = av.toLowerCase()
        bv = bv.toLowerCase()
      }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return arr
  }, [buildings, sortKey, sortAsc])

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name' || key === 'category')
    }
  }

  function renderSortHeader(colKey, children) {
    return (
      <th key={colKey} onClick={() => handleSort(colKey)}>
        {children}
        {sortKey === colKey && (
          <span className="sort-arrow">{sortAsc ? '\u25B2' : '\u25BC'}</span>
        )}
      </th>
    )
  }

  return (
    <div className="win95">
      <div className="win95-window">
        <div className="win95-titlebar">
          <span>Buildings</span>
          <div className="win95-titlebar-buttons">
            <button className="win95-titlebar-btn">_</button>
            <button className="win95-titlebar-btn">□</button>
            <button className="win95-titlebar-btn">X</button>
          </div>
        </div>

        <div className="win95-toolbar">
          <label>Find:</label>
          <input
            type="text"
            className="win95-input"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <label>Category:</label>
          <select
            className="win95-select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="win95-statusbar">Loading...</div>
        ) : buildings.length === 0 ? (
          <div className="win95-statusbar">No buildings found. Import game data using the extractor.</div>
        ) : (
          <>
            <div className="win95-inset win95-table-wrap">
              <table className="win95-table">
                <thead>
                  <tr>
                    {renderSortHeader('name', 'Name')}
                    {renderSortHeader('category', 'Category')}
                    {renderSortHeader('workers_needed', 'Workers')}
                    {renderSortHeader('construction_days', 'Days')}
                    {resources.map(r => (
                      renderSortHeader(`res_${r.id}`, `${r.name} (${r.unit})`)
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(b => (
                    <tr key={b.id}>
                      <td>
                        <Link to={`/buildings/${b.id}`}>{b.name}</Link>
                        {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
                      </td>
                      <td>{b.category}</td>
                      <td className="num">{b.workers_needed || ''}</td>
                      <td className="num">{b.construction_days || ''}</td>
                      {resources.map(r => (
                        <td key={r.id} className="num">
                          {b.resource_costs[String(r.id)] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="win95-statusbar">
              {sorted.length} building{sorted.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default BuildingList

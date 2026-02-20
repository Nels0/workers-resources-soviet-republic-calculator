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
  const [activeTab, setActiveTab] = useState('construction')
  const [materialFilter, setMaterialFilter] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [flowResourceFilter, setFlowResourceFilter] = useState('')

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

  function handleTabChange(tab) {
    setActiveTab(tab)
    setMaterialFilter('')
    setDirectionFilter('all')
    setFlowResourceFilter('')
    setSortKey('name')
    setSortAsc(true)
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name' || key === 'category')
    }
  }

  // useMemo pipeline

  const textAndCategoryFiltered = useMemo(() => {
    return buildings.filter(b => {
      if (category && b.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          b.name?.toLowerCase().includes(q) ||
          b.source_file?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [buildings, search, category])

  const constructionMaterialOptions = useMemo(() => {
    return resources.filter(r =>
      textAndCategoryFiltered.some(b => (b.resource_costs[String(r.id)] || 0) > 0)
    )
  }, [resources, textAndCategoryFiltered])

  const flowResourceOptions = useMemo(() => {
    return resources.filter(r =>
      textAndCategoryFiltered.some(b =>
        (b.produces?.[String(r.id)] || 0) > 0 ||
        (b.consumes?.[String(r.id)] || 0) > 0
      )
    )
  }, [resources, textAndCategoryFiltered])

  const tabFiltered = useMemo(() => {
    if (activeTab === 'construction') {
      if (!materialFilter) return textAndCategoryFiltered
      return textAndCategoryFiltered.filter(b =>
        (b.resource_costs[materialFilter] || 0) > 0
      )
    } else {
      // production tab: only buildings with any flow data
      let result = textAndCategoryFiltered.filter(b => {
        const hasProd = b.produces && Object.values(b.produces).some(v => v > 0)
        const hasCons = b.consumes && Object.values(b.consumes).some(v => v > 0)
        return hasProd || hasCons
      })
      if (flowResourceFilter) {
        result = result.filter(b =>
          (b.produces?.[flowResourceFilter] || 0) > 0 ||
          (b.consumes?.[flowResourceFilter] || 0) > 0
        )
      }
      if (directionFilter === 'produces') {
        result = result.filter(b => {
          if (flowResourceFilter) return (b.produces?.[flowResourceFilter] || 0) > 0
          return b.produces && Object.values(b.produces).some(v => v > 0)
        })
      } else if (directionFilter === 'consumes') {
        result = result.filter(b => {
          if (flowResourceFilter) return (b.consumes?.[flowResourceFilter] || 0) > 0
          return b.consumes && Object.values(b.consumes).some(v => v > 0)
        })
      }
      return result
    }
  }, [textAndCategoryFiltered, activeTab, materialFilter, directionFilter, flowResourceFilter])

  const activeColumns = useMemo(() => {
    if (activeTab === 'construction') {
      return resources.filter(r =>
        tabFiltered.some(b => (b.resource_costs[String(r.id)] || 0) > 0)
      )
    } else {
      return resources
        .filter(r =>
          tabFiltered.some(b =>
            (b.produces?.[String(r.id)] || 0) > 0 ||
            (b.consumes?.[String(r.id)] || 0) > 0
          )
        )
        .map(r => ({
          resource: r,
          hasProduces: tabFiltered.some(b => (b.produces?.[String(r.id)] || 0) > 0),
          hasConsumes: tabFiltered.some(b => (b.consumes?.[String(r.id)] || 0) > 0),
        }))
    }
  }, [tabFiltered, resources, activeTab])

  const sorted = useMemo(() => {
    const arr = [...tabFiltered]
    arr.sort((a, b) => {
      let av, bv
      if (sortKey.startsWith('res_')) {
        const rid = sortKey.slice(4)
        if (activeTab === 'production') {
          av = (a.produces?.[rid] || 0) + (a.consumes?.[rid] || 0)
          bv = (b.produces?.[rid] || 0) + (b.consumes?.[rid] || 0)
        } else {
          av = a.resource_costs[rid] || 0
          bv = b.resource_costs[rid] || 0
        }
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
  }, [tabFiltered, sortKey, sortAsc, activeTab])

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

  function renderNameCell(b) {
    return (
      <td>
        <Link to={`/buildings/${b.id}`}>{b.name}</Link>
        {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
      </td>
    )
  }

  function renderConstructionTable() {
    if (sorted.length === 0) {
      if (materialFilter) {
        return <div className="win95-statusbar">No buildings use this material.</div>
      }
      return <div className="win95-statusbar">No buildings match filters.</div>
    }
    return (
      <table className="win95-table">
        <thead>
          <tr>
            {renderSortHeader('name', 'Name')}
            {renderSortHeader('category', 'Category')}
            {activeColumns.map(r =>
              renderSortHeader(`res_${r.id}`, `${r.name} (${r.unit})`)
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map(b => (
            <tr key={b.id}>
              {renderNameCell(b)}
              <td>{b.category}</td>
              {activeColumns.map(r => (
                <td key={r.id} className="num">
                  {b.resource_costs[String(r.id)] || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  function renderProductionTable() {
    if (sorted.length === 0) {
      if (textAndCategoryFiltered.every(b => {
        const hasProd = b.produces && Object.values(b.produces).some(v => v > 0)
        const hasCons = b.consumes && Object.values(b.consumes).some(v => v > 0)
        return !hasProd && !hasCons
      })) {
        return <div className="win95-statusbar">No buildings have production or consumption data.</div>
      }
      return <div className="win95-statusbar">No buildings match filters.</div>
    }
    return (
      <table className="win95-table">
        <thead>
          <tr>
            {renderSortHeader('name', 'Name')}
            {renderSortHeader('category', 'Category')}
            {activeColumns.map(({ resource: r, hasProduces, hasConsumes }) => {
              let arrow = ''
              if (hasProduces && hasConsumes) arrow = '\u2191\u2193 '
              else if (hasProduces) arrow = '\u2191 '
              else if (hasConsumes) arrow = '\u2193 '
              return renderSortHeader(`res_${r.id}`, `${arrow}${r.name} (${r.unit})`)
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(b => (
            <tr key={b.id}>
              {renderNameCell(b)}
              <td>{b.category}</td>
              {activeColumns.map(({ resource: r }) => {
                const rid = String(r.id)
                const prod = b.produces?.[rid] || 0
                const cons = b.consumes?.[rid] || 0
                if (!prod && !cons) return <td key={r.id} className="num"></td>
                return (
                  <td key={r.id} className="num">
                    {prod > 0 && <div>&#8593; {prod}</div>}
                    {cons > 0 && <div>&#8595; {cons}</div>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  function renderTabToolbar() {
    if (activeTab === 'construction') {
      return (
        <div className="win95-toolbar">
          <label htmlFor="material-filter">Material:</label>
          <select
            id="material-filter"
            className="win95-select"
            value={materialFilter}
            onChange={e => setMaterialFilter(e.target.value)}
          >
            <option value="">All</option>
            {constructionMaterialOptions.map(r => (
              <option key={r.id} value={String(r.id)}>{r.name} ({r.unit})</option>
            ))}
          </select>
        </div>
      )
    }
    if (activeTab === 'production') {
      return (
        <div className="win95-toolbar">
          <label htmlFor="direction-filter">Direction:</label>
          <select
            id="direction-filter"
            className="win95-select"
            value={directionFilter}
            onChange={e => setDirectionFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="produces">&#8593; Produces</option>
            <option value="consumes">&#8595; Consumes</option>
          </select>
          <label htmlFor="flow-resource-filter">Resource:</label>
          <select
            id="flow-resource-filter"
            className="win95-select"
            value={flowResourceFilter}
            onChange={e => setFlowResourceFilter(e.target.value)}
          >
            <option value="">All</option>
            {flowResourceOptions.map(r => (
              <option key={r.id} value={String(r.id)}>{r.name} ({r.unit})</option>
            ))}
          </select>
        </div>
      )
    }
    return null
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

        <div className="win95-tabs">
          <button
            className={`win95-tab${activeTab === 'construction' ? ' active' : ''}`}
            onClick={() => handleTabChange('construction')}
          >
            Construction
          </button>
          <button
            className={`win95-tab${activeTab === 'production' ? ' active' : ''}`}
            onClick={() => handleTabChange('production')}
          >
            Production
          </button>
        </div>

        {renderTabToolbar()}

        {loading ? (
          <div className="win95-statusbar">Loading...</div>
        ) : buildings.length === 0 ? (
          <div className="win95-statusbar">No buildings found. Import game data using the extractor.</div>
        ) : (
          <>
            <div className="win95-inset win95-table-wrap">
              {activeTab === 'construction' && renderConstructionTable()}
              {activeTab === 'production' && renderProductionTable()}
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

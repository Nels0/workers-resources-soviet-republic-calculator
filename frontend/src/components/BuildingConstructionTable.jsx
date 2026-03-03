import { useMemo } from 'react'
import { Link } from 'react-router-dom'

// Shared construction cost table used by BuildingList and BuildingSearch.
// - With onSort: sortable headers (BuildingList mode), name cells are Links or buttons.
// - With onSelect: static headers, name cells are plain text, rows are clickable (search mode).
function BuildingConstructionTable({
  buildings,
  resources,
  // Search / add mode
  selectedIndex = -1,
  onSelect,
  onRowHover,
  tbodyRef,
  // Sort mode (BuildingList)
  sortKey,
  sortAsc,
  onSort,
  // Building info popup
  onBuildingClick,
}) {
  const activeColumns = useMemo(
    () => resources.filter(r => buildings.some(b => (b.resource_costs?.[String(r.id)] || 0) > 0)),
    [buildings, resources]
  )

  function renderTh(colKey, label) {
    if (onSort) {
      return (
        <th key={colKey} onClick={() => onSort(colKey)}>
          {label}
          {sortKey === colKey && (
            <span className="sort-arrow">{sortAsc ? '\u25B2' : '\u25BC'}</span>
          )}
        </th>
      )
    }
    return <th key={colKey}>{label}</th>
  }

  return (
    <table className={`win95-table${onSort ? '' : ' win95-table-static'}`}>
      <thead>
        <tr>
          {renderTh('name', 'Name')}
          {renderTh('category', 'Category')}
          {activeColumns.map(r => renderTh(`res_${r.id}`, `${r.name} (${r.unit})`))}
        </tr>
      </thead>
      <tbody ref={tbodyRef}>
        {buildings.map((b, i) => (
          <tr
            key={b.id}
            className={i === selectedIndex ? 'selected' : ''}
            onClick={onSelect ? () => onSelect(b.id) : undefined}
            onMouseEnter={onRowHover ? () => onRowHover(i) : undefined}
          >
            <td>
              {onSelect
                ? b.name
                : onBuildingClick
                  ? <button className="win95-link-btn" onClick={() => onBuildingClick(b.id)}>{b.name}</button>
                  : <Link to={`/buildings/${b.id}`}>{b.name}</Link>
              }
              {' '}<span className="win95-muted" style={{ fontSize: '0.85em' }}>{b.source_file}</span>
            </td>
            <td>{b.category}</td>
            {activeColumns.map(r => (
              <td key={r.id} className="num">
                {b.resource_costs?.[String(r.id)] || ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default BuildingConstructionTable

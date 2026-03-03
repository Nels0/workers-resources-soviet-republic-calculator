import { useState, useEffect, useRef } from 'react'

// Win95-styled combo box with inline rename on double-click.
// Props:
//   items: [{ id, label }]
//   selectedId: string|null
//   onSelect: (id) => void
//   onRename: (id, newLabel) => void  — called on Enter or blur if value changed
//   placeholder: string
function WinComboBox({ items, selectedId, onSelect, onRename, placeholder = '-- Select --' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selectedItem = items.find(item => item.id === selectedId) || null

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        if (isEditing) commitEdit()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editValue, selectedId])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed && selectedId && trimmed !== selectedItem?.label) {
      onRename?.(selectedId, trimmed)
    }
    setIsEditing(false)
  }

  function handleDisplayClick() {
    if (isEditing) return
    setIsOpen(prev => !prev)
  }

  function handleDisplayDoubleClick() {
    if (!selectedId) return
    setIsEditing(true)
    setEditValue(selectedItem?.label ?? '')
    setIsOpen(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { commitEdit() }
    else if (e.key === 'Escape') { setIsEditing(false) }
  }

  function handleSelect(id) {
    onSelect(id)
    setIsOpen(false)
  }

  return (
    <div className="win95-combobox" ref={containerRef}>
      <div
        className="win95-combobox-display"
        onClick={handleDisplayClick}
        onDoubleClick={handleDisplayDoubleClick}
      >
        {isEditing
          ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitEdit}
              onClick={e => e.stopPropagation()}
            />
          )
          : (selectedItem ? selectedItem.label : <span style={{ color: '#808080' }}>{placeholder}</span>)
        }
      </div>
      <div
        className="win95-combobox-arrow"
        onClick={() => { if (!isEditing) setIsOpen(prev => !prev) }}
      >
        ▼
      </div>
      {isOpen && (
        <div className="win95-combobox-list">
          {items.map(item => (
            <div
              key={item.id}
              className={`win95-combobox-option${item.id === selectedId ? ' selected' : ''}`}
              onMouseDown={() => handleSelect(item.id)}
            >
              {item.label}
            </div>
          ))}
          {items.length === 0 && (
            <div className="win95-combobox-option" style={{ color: '#808080' }}>No items</div>
          )}
        </div>
      )}
    </div>
  )
}

export default WinComboBox

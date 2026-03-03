import { useState, useEffect, useRef } from 'react'

export function useDraggable(initial) {
  const [pos, setPos] = useState(initial)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, e.clientX - offset.current.x),
        y: Math.max(0, e.clientY - offset.current.y),
      })
    }
    function onUp() {
      if (dragging.current) { dragging.current = false; setIsDragging(false) }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  function onMouseDown(e) {
    dragging.current = true
    setIsDragging(true)
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  return { pos, setPos, onMouseDown, isDragging }
}

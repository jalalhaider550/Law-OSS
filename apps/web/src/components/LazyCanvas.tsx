'use client'
import { useRef, useState, useEffect } from 'react'

export default function LazyCanvas({ children, height = 500 }: { children: React.ReactNode; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {visible && !reduced ? children : null}
    </div>
  )
}

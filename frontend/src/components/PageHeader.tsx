import type { ReactNode } from 'react'

export function PageHeader({ icon, title, sub }: { icon: ReactNode; title: string; sub?: string }) {
  return (
    <div className="page-header">
      <h1>
        <span className="page-header__icon">{icon}</span>
        {title}
      </h1>
      {sub && <p className="sub">{sub}</p>}
    </div>
  )
}

import React from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-atmosphere">
      {/* Decorative circles */}
      <div
        style={{
          position: 'fixed',
          bottom: '60px',
          left: '-100px',
          width: '300px',
          height: '300px',
          border: '1px solid rgba(146, 64, 14, 0.07)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '30%',
          left: '5%',
          width: '6px',
          height: '6px',
          background: 'rgba(217, 119, 6, 0.3)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '35%',
          right: '8%',
          width: '4px',
          height: '4px',
          background: 'rgba(146, 64, 14, 0.2)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {children}

      <div className="auth-brand-mark">Jeffrey.AI</div>
    </div>
  )
}

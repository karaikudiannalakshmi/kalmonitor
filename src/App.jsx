// src/App.jsx
import { useAuth } from './hooks/useAuth'
import Login    from './pages/Login'
import AdminApp from './pages/AdminApp'
import StaffApp from './pages/StaffApp'

export default function App() {
  const { user, isAdmin, staffData, logout, setStaffSession } = useAuth()

  // Loading
  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#FDF5F5', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 36 }}>🍽️</div>
        <div style={{ fontSize: 14, color: '#C0392B', fontWeight: 600 }}>ஏற்றுகிறது…</div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Login onStaffLogin={setStaffSession} />
  }

  // Logged in as admin (Google)
  if (isAdmin) {
    return <AdminApp />
  }

  // Logged in as staff (PIN) — staffData has name, role, id etc.
  if (staffData) {
    return <StaffApp staffData={staffData} onLogout={logout} />
  }

  // Google login but not admin — show message
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#FDF5F5', flexDirection: 'column', gap: 16,
      fontFamily: 'Arial, sans-serif', padding: 24 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#C0392B' }}>அனுமதி இல்லை</div>
      <div style={{ color: '#666', fontSize: 14, textAlign: 'center' }}>
        இந்த Gmail கணக்கிற்கு admin அனுமதி இல்லை.
      </div>
      <button onClick={logout} style={{
        padding: '12px 28px', borderRadius: 12, border: 'none',
        background: '#C0392B', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>வெளியேறு</button>
    </div>
  )
}

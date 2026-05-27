// src/App.jsx
import { useState, useEffect } from 'react'
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase/config'
import AdminApp from './pages/AdminApp'
import StaffApp from './pages/StaffApp'

const RED = '#C0392B'

function LoginScreen({ onStaffLogin, onAdminLogin }) {
  const [mode,    setMode]    = useState('choice')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogle = async () => {
    setLoading(true); setError('')
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      onAdminLogin(result.user)
    } catch { setError('Google login failed.') }
    setLoading(false)
  }

  const handlePinKey = async (key) => {
    if (loading) return
    if (key === '⌫') { setPin(p => p.slice(0,-1)); return }
    const newPin = pin + key
    setPin(newPin)
    if (newPin.length === 4) {
      setLoading(true); setError('')
      try {
        const snap = await getDocs(query(collection(db,'staff'), where('pin','==',newPin)))
        if (snap.empty) { setError('தவறான PIN. மீண்டும் முயலவும்.'); setPin('') }
        else { onStaffLogin({ id: snap.docs[0].id, ...snap.docs[0].data() }) }
      } catch (e) { setError('பிழை: ' + e.message); setPin('') }
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FDF5F5', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24,
      fontFamily:'Arial,sans-serif' }}>
      <div style={{ fontSize:48, marginBottom:8 }}>🍽️</div>
      <div style={{ fontSize:22, fontWeight:900, color:RED, marginBottom:4 }}>KAL பணி கண்காணிப்பு</div>
      <div style={{ fontSize:13, color:'#777', marginBottom:28 }}>கரைக்குடி அண்ணாலட்சுமி சமையலறை</div>

      <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px',
        width:'100%', maxWidth:340, boxShadow:'0 4px 24px #0002' }}>

        {mode === 'choice' && <>
          <div style={{ fontWeight:700, fontSize:17, textAlign:'center', marginBottom:20 }}>உள்நுழைவு</div>
          <button onClick={() => { setMode('pin'); setError('') }} style={{
            width:'100%', padding:16, borderRadius:14, border:'none', background:RED,
            color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', marginBottom:14 }}>
            🔢 பணியாளர் PIN உள்ளிடு
          </button>
          <div style={{ textAlign:'center', color:'#aaa', fontSize:13, marginBottom:14 }}>— அல்லது —</div>
          <button onClick={handleGoogle} disabled={loading} style={{
            width:'100%', padding:14, borderRadius:14, border:'2px solid #ddd',
            background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', color:'#444' }}>
            🔑 நிர்வாகி (Gmail)
          </button>
          {error && <div style={{ marginTop:12, color:RED, textAlign:'center', fontSize:13 }}>{error}</div>}
        </>}

        {mode === 'pin' && <>
          <button onClick={() => { setMode('choice'); setPin(''); setError('') }}
            style={{ background:'transparent', border:'none', cursor:'pointer', color:'#888', fontSize:13, marginBottom:12 }}>
            ← திரும்பு
          </button>
          <div style={{ fontWeight:700, fontSize:16, textAlign:'center', marginBottom:6 }}>PIN உள்ளிடவும்</div>
          <div style={{ fontSize:12, color:'#999', textAlign:'center', marginBottom:20 }}>4 இலக்க PIN தட்டவும்</div>
          <div style={{ display:'flex', justifyContent:'center', gap:14, marginBottom:28 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width:18, height:18, borderRadius:'50%',
                background: i < pin.length ? RED : '#eee',
                border:`2px solid ${i < pin.length ? RED:'#ccc'}` }} />
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k,i) => (
              <button key={i} onClick={() => k && handlePinKey(k)} disabled={loading||!k} style={{
                padding:'18px 0', borderRadius:12, border:'none', cursor:k?'pointer':'default',
                background:k==='⌫'?'#FFE8E8':k===''?'transparent':'#F5F5F5',
                color:k==='⌫'?RED:'#222', fontSize:k==='⌫'?20:22, fontWeight:700 }}>
                {k}
              </button>
            ))}
          </div>
          {error && <div style={{ textAlign:'center', color:RED, fontSize:13,
            padding:'8px 12px', background:'#FFF0F0', borderRadius:8 }}>{error}</div>}
          {loading && <div style={{ textAlign:'center', color:'#888', fontSize:13, marginTop:8 }}>சரிபார்க்கிறது…</div>}
        </>}
      </div>
      <div style={{ marginTop:16, fontSize:11, color:'#bbb' }}>KAL Kitchen Monitor v2.0</div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState('login') // 'login' | 'admin' | 'staff'
  const [staffData, setStaffData] = useState(null)
  const [adminUser, setAdminUser] = useState(null)
  const [isAdmin,   setIsAdmin]   = useState(false)

  // Check for existing Google session on load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async u => {
      if (u && !u.isAnonymous) {
        try {
          const snap = await getDoc(doc(db,'admins',u.uid))
          if (snap.exists()) {
            setAdminUser(u); setIsAdmin(true); setScreen('admin')
          }
        } catch {}
      }
    })
    return unsub
  }, [])

  const handleStaffLogin = (data) => {
    setStaffData(data)
    setScreen('staff')
  }

  const handleAdminLogin = async (user) => {
    try {
      const snap = await getDoc(doc(db,'admins',user.uid))
      if (snap.exists()) {
        setAdminUser(user); setIsAdmin(true); setScreen('admin')
      } else {
        setScreen('login')
        alert('இந்த Gmail கணக்கிற்கு admin அனுமதி இல்லை.')
      }
    } catch { setScreen('login') }
  }

  const logout = async () => {
    try { await auth.signOut() } catch {}
    setStaffData(null); setAdminUser(null)
    setIsAdmin(false); setScreen('login')
  }

  if (screen === 'admin') return <AdminApp onLogout={logout} />
  if (screen === 'staff') return <StaffApp staffData={staffData} onLogout={logout} />

  return <LoginScreen onStaffLogin={handleStaffLogin} onAdminLogin={handleAdminLogin} />
}

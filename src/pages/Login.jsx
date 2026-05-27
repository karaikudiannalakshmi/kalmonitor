// src/pages/Login.jsx
import { useState } from 'react'
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const RED = '#C0392B'
const BG  = '#FDF5F5'

export default function Login({ onStaffLogin }) {
  const [mode,     setMode]     = useState('choice') // 'choice' | 'pin'
  const [pin,      setPin]      = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [staffName,setStaffName]= useState('')

  // ── Admin: Google Sign-In ─────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true); setError('')
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // useAuth hook handles redirect to AdminApp
    } catch (err) {
      setError('Google login failed. Try again.')
    }
    setLoading(false)
  }

  // ── Staff: PIN login ──────────────────────────────────────────────────────
  const handlePin = async () => {
    if (pin.length < 4) { setError('4 இலக்க PIN உள்ளிடவும்'); return }
    setLoading(true); setError('')
    try {
      // Find staff with matching PIN
      const snap = await getDocs(
        query(collection(db, 'staff'), where('pin', '==', pin))
      )
      if (snap.empty) {
        setError('தவறான PIN. மீண்டும் முயலவும்.')
        setLoading(false); return
      }

      const staffDoc = snap.docs[0]
      const staffData = { id: staffDoc.id, ...staffDoc.data() }

      // Sign in anonymously with Firebase (for Firestore auth rules)
      const cred = await signInAnonymously(auth)

      // Pass staff data up to App
      onStaffLogin({ ...staffData, uid: cred.user.uid })
    } catch (err) {
      setError('உள்நுழைவு தோல்வி: ' + err.message)
    }
    setLoading(false)
  }

  const handlePinKey = (digit) => {
    if (digit === '⌫') {
      setPin(p => p.slice(0, -1))
    } else if (pin.length < 4) {
      const newPin = pin + digit
      setPin(newPin)
      if (newPin.length === 4) {
        // Auto-submit when 4 digits entered
        setTimeout(() => handlePinWithValue(newPin), 200)
      }
    }
  }

  const handlePinWithValue = async (pinValue) => {
    setLoading(true); setError('')
    try {
      const snap = await getDocs(
        query(collection(db, 'staff'), where('pin', '==', pinValue))
      )
      if (snap.empty) {
        setError('தவறான PIN. மீண்டும் முயலவும்.')
        setPin('')
        setLoading(false); return
      }
      const staffDoc  = snap.docs[0]
      const staffData = { id: staffDoc.id, ...staffDoc.data() }
      const cred      = await signInAnonymously(auth)
      onStaffLogin({ ...staffData, uid: cred.user.uid })
    } catch (err) {
      setError('உள்நுழைவு தோல்வி: ' + err.message)
      setPin('')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'Arial, sans-serif' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🍽️</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: RED, letterSpacing: 1 }}>
          KAL பணி கண்காணிப்பு
        </div>
        <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>
          கரைக்குடி அண்ணாலட்சுமி சமையலறை
        </div>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 24px',
        width: '100%', maxWidth: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>

        {mode === 'choice' && (
          <>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 20, textAlign: 'center', color: '#222' }}>
              உள்நுழைவு
            </div>

            {/* Staff PIN button */}
            <button onClick={() => { setMode('pin'); setError('') }} style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: RED, color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 24 }}>🔢</span>
              <span>பணியாளர் PIN உள்ளிடு</span>
            </button>

            <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginBottom: 14 }}>
              — அல்லது —
            </div>

            {/* Admin Google button */}
            <button onClick={handleGoogle} disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: 14,
              border: '2px solid #ddd', background: '#fff',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>நிர்வாகி (Gmail)</span>
            </button>

            {error && <div style={{ marginTop: 14, color: RED, fontSize: 13, textAlign: 'center' }}>{error}</div>}
          </>
        )}

        {mode === 'pin' && (
          <>
            <button onClick={() => { setMode('choice'); setPin(''); setError('') }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#888', fontSize: 13, marginBottom: 12, padding: 0 }}>
              ← திரும்பு
            </button>

            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, textAlign: 'center', color: '#222' }}>
              உங்கள் PIN உள்ளிடவும்
            </div>
            <div style={{ fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 20 }}>
              4 இலக்க PIN தட்டவும்
            </div>

            {/* PIN dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 28 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: i < pin.length ? RED : '#eee',
                  border: `2px solid ${i < pin.length ? RED : '#ccc'}`,
                  transition: 'all 0.15s',
                }} />
              ))}
            </div>

            {/* Keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
                <button key={idx} onClick={() => key && handlePinKey(key)}
                  disabled={loading || !key}
                  style={{
                    padding: '18px 0', borderRadius: 12, border: 'none',
                    background: key === '⌫' ? '#FFE8E8' : key === '' ? 'transparent' : '#F5F5F5',
                    color: key === '⌫' ? RED : '#222',
                    fontSize: key === '⌫' ? 20 : 22, fontWeight: 700,
                    cursor: key ? 'pointer' : 'default',
                    boxShadow: key && key !== '⌫' ? '0 2px 4px #0001' : 'none',
                  }}>
                  {key}
                </button>
              ))}
            </div>

            {error && (
              <div style={{ textAlign: 'center', color: RED, fontSize: 13,
                padding: '8px 12px', background: '#FFF0F0', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', color: '#888', fontSize: 13, marginTop: 10 }}>
                சரிபார்க்கிறது…
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: '#bbb' }}>
        KAL Kitchen Monitor v2.0
      </div>
    </div>
  )
}

// src/hooks/useAuth.js
import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

export function useAuth() {
  const [user,      setUser]      = useState(undefined)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [staffData, setStaffData] = useState(null)

  useEffect(() => {
    // Check PIN session immediately — no Firebase needed
    const stored = sessionStorage.getItem('kal_staff_session')
    if (stored) {
      try {
        setStaffData(JSON.parse(stored))
        setUser({ pin: true })
        return // skip Firebase listener entirely
      } catch {
        sessionStorage.removeItem('kal_staff_session')
      }
    }

    // No PIN session — listen for Google auth
    // Set null immediately so spinner doesn't block
    setUser(null)

    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser || firebaseUser.isAnonymous) {
        setUser(null); setIsAdmin(false); setStaffData(null)
        return
      }
      setUser(firebaseUser)
      try {
        const snap = await getDoc(doc(db, 'admins', firebaseUser.uid))
        setIsAdmin(snap.exists())
      } catch {
        setIsAdmin(false)
      }
    })
    return unsub
  }, [])

  const setStaffSession = (data) => {
    sessionStorage.setItem('kal_staff_session', JSON.stringify(data))
    setStaffData(data)
    setUser({ pin: true })
  }

  const logout = async () => {
    sessionStorage.removeItem('kal_staff_session')
    setStaffData(null); setUser(null); setIsAdmin(false)
    try { await auth.signOut() } catch {}
  }

  return { user, isAdmin, staffData, logout, setStaffSession }
}

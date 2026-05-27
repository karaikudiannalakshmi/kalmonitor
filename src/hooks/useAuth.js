// src/hooks/useAuth.js
import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

export function useAuth() {
  const [user,      setUser]      = useState(undefined) // undefined = loading
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [staffData, setStaffData] = useState(null) // for PIN-logged-in staff

  useEffect(() => {
    // Check for PIN-based staff session in sessionStorage
    const stored = sessionStorage.getItem('kal_staff_session')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setStaffData(parsed)
        setUser({ uid: parsed.uid, isAnonymous: true })
        setIsAdmin(false)
        return
      } catch {}
    }

    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setUser(null); setIsAdmin(false); setStaffData(null)
        return
      }

      // Check if anonymous (PIN staff login via signInAnonymously)
      if (firebaseUser.isAnonymous) {
        // Already handled by sessionStorage above
        setUser(firebaseUser)
        return
      }

      // Google login — check if admin
      setUser(firebaseUser)
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid))
        setIsAdmin(adminSnap.exists())
        setStaffData(null)
      } catch {
        setIsAdmin(false)
      }
    })

    return unsub
  }, [])

  const setStaffSession = (data) => {
    sessionStorage.setItem('kal_staff_session', JSON.stringify(data))
    setStaffData(data)
    setUser({ uid: data.uid, isAnonymous: true })
    setIsAdmin(false)
  }

  const logout = async () => {
    sessionStorage.removeItem('kal_staff_session')
    setStaffData(null)
    setUser(null)
    setIsAdmin(false)
    try { await auth.signOut() } catch {}
  }

  return { user, isAdmin, staffData, logout, setStaffSession }
}

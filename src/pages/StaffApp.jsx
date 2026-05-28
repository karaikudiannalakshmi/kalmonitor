// src/pages/StaffApp.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot,
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLORS as C, TA, today, fmtDate, timeDiff, fmtDiff } from '../utils/constants'
import { Card, Btn, Badge, Spinner, ProgressBar } from '../components/UI'
import VoiceNote from '../components/VoiceNote'

const TABS = { TODAY: 'today', RECORD: 'record' }

function BottomNav({ tab, setTab, onLogout }) {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100,
      background:'#fff', borderTop:`2px solid ${C.border}`, display:'flex' }}>
      {[
        { id: TABS.TODAY,  icon: '📋', label: 'என் பணிகள்' },
        { id: TABS.RECORD, icon: '📊', label: 'என் பதிவு' },
      ].map(n => (
        <button key={n.id} onClick={() => setTab(n.id)} style={{
          flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
          background:'transparent', fontWeight:700, fontSize:11,
          color: tab===n.id ? C.primary : C.muted,
          borderTop: tab===n.id ? `3px solid ${C.primary}` : '3px solid transparent',
          display:'flex', flexDirection:'column', alignItems:'center', gap:2,
        }}>
          <span style={{ fontSize:20 }}>{n.icon}</span>
          <span>{n.label}</span>
        </button>
      ))}
      <button onClick={onLogout} style={{ flex:1, padding:'10px 4px', border:'none',
        cursor:'pointer', background:'transparent', fontSize:11, color:C.muted,
        display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
        <span style={{ fontSize:20 }}>🚪</span>
        <span>வெளியேறு</span>
      </button>
    </div>
  )
}

function TaskCard({ task, staffId, date, log, onToggle }) {
  const [showActual,  setShowActual]  = useState(false)
  const [actualStart, setActualStart] = useState(log?.actualStart || '')
  const [actualEnd,   setActualEnd]   = useState(log?.actualEnd   || '')

  const startDiff   = timeDiff(task.startTime, actualStart)
  const isLate      = startDiff != null && startDiff > 30
  const isMild      = startDiff != null && startDiff > 0 && startDiff <= 30
  const isDone      = log?.status === 'done'
  const isAbsent    = !!task.substitute
  const borderColor = isLate ? C.lateRed : isAbsent ? C.absent : task.type === 'critical' ? C.critical : C.normal

  const saveActual = async () => {
    const logId = `${staffId}_${date}_${task.id}`
    await setDoc(doc(db,'logs',logId), {
      staffId, date, taskId: task.id,
      actualStart, actualEnd,
      status: log?.status || 'pending',
      updatedAt: serverTimestamp(),
    }, { merge: true })
    setShowActual(false)
  }

  return (
    <Card style={{ padding:'14px 15px', marginBottom:10,
      background: isDone?'#F0FFF4':isAbsent?'#FFF6EE':isLate?'#FFF2F2':C.row,
      borderLeft:`5px solid ${borderColor}`,
      border:`1px solid ${isDone?C.green+'44':C.border}` }}>
      <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
        <button onClick={() => onToggle(task, log)} style={{
          width:28, height:28, borderRadius:8, flexShrink:0, marginTop:2,
          border:`2.5px solid ${isDone?C.green:C.border}`,
          background: isDone?C.green:'transparent',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isDone && <span style={{ color:'#fff', fontSize:15, fontWeight:900 }}>✓</span>}
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:700, color:isDone?C.muted:C.text,
            textDecoration:isDone?'line-through':'none', lineHeight:1.4,
            fontFamily:'Noto Sans Tamil, sans-serif' }}>{task.task}</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:6 }}>
            <span style={{ background:borderColor+'22', color:borderColor,
              borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
              {task.startTime}
            </span>
            <Badge color={task.type==='critical'?C.critical:C.normal} small>
              {task.type==='critical'?'⚡ முக்கியம்':'● சாதாரணம்'}
            </Badge>
            {isAbsent && <Badge color={C.absent} small>🔄 பதிலாள்</Badge>}
          </div>
        </div>
      </div>

      {(actualStart||actualEnd) && (
        <div style={{ background:isLate?'#FFE8E8':isMild?'#FFFBE6':'#EDFFF4',
          borderRadius:8, padding:'6px 10px', fontSize:12, marginBottom:6 }}>
          {actualStart && <span>தொடங்கியது: <b>{actualStart}</b>
            {startDiff!=null && <span style={{ marginLeft:6, fontWeight:700,
              color:isLate?C.lateRed:isMild?'#D68910':C.green }}>
              ({fmtDiff(startDiff)}{isLate?' ⚠️ தாமதம்':''})
            </span>}
          </span>}
          {actualEnd && <span style={{ marginLeft:12 }}>முடிந்தது: <b>{actualEnd}</b></span>}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:6 }}>
        <button onClick={() => setShowActual(s=>!s)} style={{
          flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${C.border}`,
          background:'transparent', cursor:'pointer', fontSize:12, fontWeight:600, color:C.text }}>
          ⏱ {actualStart ? 'நேரம் திருத்தவும்' : 'நேரம் பதிவு செய்யவும்'}
        </button>
      </div>

      {showActual && (
        <div style={{ marginTop:10, padding:'12px', background:'#F8F8F8', borderRadius:10 }}>
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600, marginBottom:4 }}>தொடக்க நேரம்</div>
              <input type="time" value={actualStart} onChange={e=>setActualStart(e.target.value)}
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8,
                  padding:'10px', fontSize:16, color:C.text, background:C.bg }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:C.muted, fontWeight:600, marginBottom:4 }}>முடிவு நேரம்</div>
              <input type="time" value={actualEnd} onChange={e=>setActualEnd(e.target.value)}
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8,
                  padding:'10px', fontSize:16, color:C.text, background:C.bg }} />
            </div>
          </div>
          <Btn full variant="green" onClick={saveActual}>✓ சேமி</Btn>
        </div>
      )}

      {(task.type==='critical' || isLate || actualStart) && (
        <VoiceNote staffId={staffId} date={date} taskId={task.id} />
      )}
    </Card>
  )
}

function TodayTab({ staffId, staffName }) {
  const [tasks,   setTasks]   = useState([])
  const [logs,    setLogs]    = useState({})
  const [loading, setLoading] = useState(true)
  const selDate = today()

  useEffect(() => {
    const q = query(collection(db,'tasks'),
      where('date','==',selDate), where('staffId','==',staffId))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d=>({id:d.id,...d.data()})))
      setLoading(false)
    })
  }, [staffId])

  useEffect(() => {
    const q = query(collection(db,'logs'),
      where('date','==',selDate), where('staffId','==',staffId))
    return onSnapshot(q, snap => {
      const m={}; snap.docs.forEach(d=>{m[d.data().taskId]={id:d.id,...d.data()}})
      setLogs(m)
    })
  }, [staffId])

  const toggleDone = async (task, log) => {
    const logId=`${staffId}_${selDate}_${task.id}`
    const newStatus = log?.status==='done'?'pending':'done'
    await setDoc(doc(db,'logs',logId), {
      staffId, date:selDate, taskId:task.id, status:newStatus,
      completedAt: newStatus==='done'?new Date().toLocaleTimeString('en-IN'):null,
      actualStart: log?.actualStart||'', actualEnd: log?.actualEnd||'',
      updatedAt: serverTimestamp(),
    }, { merge:true })
  }

  const sorted = [...tasks].sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''))
  const done   = sorted.filter(t=>logs[t.id]?.status==='done').length

  if (loading) return <Spinner />

  return (
    <div>
      <Card style={{ marginBottom:16, padding:'14px 16px' }}>
        <div style={{ fontWeight:700, color:C.text, marginBottom:10, fontSize:15,
          fontFamily:'Noto Sans Tamil, sans-serif' }}>
          📅 {fmtDate(selDate)} — {staffName}
        </div>
        <ProgressBar value={done} max={sorted.length} />
      </Card>

      {sorted.length===0 ? (
        <div style={{ textAlign:'center', padding:40 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div style={{ color:C.muted, fontSize:16, fontFamily:'Noto Sans Tamil, sans-serif' }}>
            இன்று பணிகள் இல்லை
          </div>
        </div>
      ) : sorted.map(t => (
        <TaskCard key={t.id} task={t} staffId={staffId} date={selDate}
          log={logs[t.id]} onToggle={toggleDone} />
      ))}
    </div>
  )
}

function RecordTab({ staffId }) {
  const [selDate, setSelDate] = useState(today())
  const [tasks,   setTasks]   = useState([])
  const [logs,    setLogs]    = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = query(collection(db,'tasks'),
      where('date','==',selDate), where('staffId','==',staffId))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false)
    })
  }, [staffId, selDate])

  useEffect(() => {
    const q = query(collection(db,'logs'),
      where('date','==',selDate), where('staffId','==',staffId))
    return onSnapshot(q, snap => {
      const m={}; snap.docs.forEach(d=>{m[d.data().taskId]={id:d.id,...d.data()}})
      setLogs(m)
    })
  }, [staffId, selDate])

  const done=tasks.filter(t=>logs[t.id]?.status==='done').length

  return (
    <div>
      <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)}
        style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:10,
          padding:'11px 14px', fontSize:15, color:C.text, background:C.bg, marginBottom:14 }} />

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {[
          { label:'மொத்தம்', val:tasks.length, color:C.text },
          { label:'முடிந்தவை', val:done, color:C.green },
          { label:'நிலுவை', val:tasks.length-done, color:C.primary },
        ].map(s=>(
          <Card key={s.label} style={{ flex:1, textAlign:'center', padding:14 }}>
            <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:3,
              fontFamily:'Noto Sans Tamil, sans-serif' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {loading ? <Spinner /> : tasks
        .sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''))
        .map(t => {
          const log=logs[t.id]; const isDone=log?.status==='done'
          const startDiff=timeDiff(t.startTime,log?.actualStart)
          const isLate=startDiff!=null&&startDiff>30
          return (
            <Card key={t.id} style={{ marginBottom:8, padding:'12px 14px',
              borderLeft:`4px solid ${isDone?C.green:isLate?C.lateRed:C.border}`,
              background:isDone?'#F0FFF4':isLate?'#FFF2F2':C.row }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>{isDone?'✅':'⏳'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:C.text,
                    fontFamily:'Noto Sans Tamil, sans-serif' }}>{t.task}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                    {t.startTime}{log?.actualStart?` → தொடங்கியது: ${log.actualStart}`:''}
                    {startDiff!=null&&<span style={{ marginLeft:6, fontWeight:700,
                      color:isLate?C.lateRed:C.green }}>({fmtDiff(startDiff)})</span>}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
    </div>
  )
}

// ── Staff App Shell — accepts staffData as prop ───────────────────────────────
export default function StaffApp({ staffData, onLogout }) {
  const [tab, setTab] = useState(TABS.TODAY)

  return (
    <div style={{ minHeight:'100vh', background:C.bg, paddingBottom:80 }}>
      <div style={{ background:C.primary, color:'#fff', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12,
        position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px #0004' }}>
        <span style={{ fontSize:24 }}>🍽️</span>
        <div>
          <div style={{ fontWeight:800, fontSize:16,
            fontFamily:'Noto Sans Tamil, sans-serif' }}>{staffData.name}</div>
          <div style={{ fontSize:11, opacity:0.8 }}>கரைக்குடி அண்ணாலட்சுமி சமையலறை</div>
        </div>
      </div>

      <div style={{ maxWidth:540, margin:'0 auto', padding:'16px 14px' }}>
        {tab===TABS.TODAY  && <TodayTab  staffId={staffData.id} staffName={staffData.name} />}
        {tab===TABS.RECORD && <RecordTab staffId={staffData.id} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} onLogout={onLogout} />
    </div>
  )
}

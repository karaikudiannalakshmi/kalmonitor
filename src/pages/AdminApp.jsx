// src/pages/AdminApp.jsx
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, onSnapshot,
  doc, setDoc, deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

import { COLORS as C, today, fmtDate, timeDiff, fmtDiff, uid } from '../utils/constants'
import { Card, Btn, Badge, Spinner, ProgressBar, SectionHead, Avatar, Inp } from '../components/UI'
import VoiceNote from '../components/VoiceNote'
import { parseExcel } from '../utils/excelImport'
import { downloadTemplateWithStaff } from '../utils/templateDownload'
import { parseMasterSchedule, generateDailyTasks } from '../utils/masterSchedule'

const TABS = { MONITOR: 'monitor', UPLOAD: 'upload', STAFF: 'staff' }
const AVATAR_COLORS = ['#8E44AD','#2980B9','#16A085','#C0392B','#D35400','#27AE60']

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMins = t => { if (!t) return null; const [h,m] = t.split(':').map(Number); return h*60+m }
const diffMins = (sched, actual) => { const s=toMins(sched),a=toMins(actual); return (s&&a)?a-s:null }
const fmtVariance = d => { if (d==null) return '—'; return (d>=0?'+':'')+d+'m' }

function varianceColor(d) {
  if (d==null) return C.muted
  if (d > 30)  return C.lateRed
  if (d > 0)   return '#D68910'
  return C.green
}

function statusLabel(task, log) {
  if (!log || log.status !== 'done') return { text: 'Pending', bg: '#F2F3F4', color: C.muted }
  const d = diffMins(task.startTime, log.actualStart)
  if (d == null || d <= 0) return { text: 'Done ✓',     bg: '#D5F5E3', color: '#0B5E2F' }
  if (d <= 30)             return { text: `Late +${d}m`, bg: '#FDEBD0', color: '#784212' }
  return                          { text: `Late +${d}m`, bg: '#FADBD8', color: '#7B241C' }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(tasks, logs, staffList, selDate) {
  const header = ['Time','Staff','Task','Type','Actual Start','Variance','Status','Voice Note']
  const rows = [...tasks]
    .sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''))
    .map(t => {
      const log   = logs[t.id] || {}
      const staff = staffList.find(s => s.id === t.staffId)
      const d     = diffMins(t.startTime, log.actualStart)
      const st    = statusLabel(t, log)
      return [
        t.startTime || '',
        staff?.name || t.staffName || '',
        t.task,
        t.type,
        log.actualStart || '',
        d != null ? fmtVariance(d) : '',
        st.text,
        log.hasVoice ? 'Yes' : '',
      ]
    })
  const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = `KAL_Compliance_${selDate}.csv`
  a.click()
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────
function TopNav({ tab, setTab, onLogout }) {
  const NAV = [
    { id: TABS.MONITOR, icon: '📊', label: 'Monitor' },
    { id: TABS.UPLOAD,  icon: '📤', label: 'Upload'  },
    { id: TABS.STAFF,   icon: '👥', label: 'Staff'   },
  ]
  return (
    <div style={{ background: C.primary, color: '#fff', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px #0004' }}>
      <span style={{ fontSize: 22 }}>🍽️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>KAL Kitchen Monitor</div>
        <div style={{ fontSize: 11, opacity: 0.8 }}>Admin</div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === n.id ? 'rgba(255,255,255,0.25)' : 'transparent',
            color: '#fff', fontWeight: 700, fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{n.icon}</span>
            <span style={{ display: window.innerWidth < 500 ? 'none' : 'inline' }}>{n.label}</span>
          </button>
        ))}
        <button onClick={onLogout} style={{ padding: '7px 10px', borderRadius: 8, border: 'none',
          cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 12 }}>
          🚪
        </button>
      </div>
    </div>
  )
}

// ─── MONITOR TAB ──────────────────────────────────────────────────────────────
function MonitorTab({ staffList }) {
  const [selDate,  setSelDate]  = useState(today())
  const [selStaff, setSelStaff] = useState('all')
  const [tasks,    setTasks]    = useState([])
  const [logs,     setLogs]     = useState({})
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState('table') // 'table' | 'summary'

  useEffect(() => {
    setLoading(true)
    const q = selStaff === 'all'
      ? query(collection(db,'tasks'), where('date','==',selDate))
      : query(collection(db,'tasks'), where('date','==',selDate), where('staffId','==',selStaff))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [selDate, selStaff])

  useEffect(() => {
    const q = selStaff === 'all'
      ? query(collection(db,'logs'), where('date','==',selDate))
      : query(collection(db,'logs'), where('date','==',selDate), where('staffId','==',selStaff))
    return onSnapshot(q, snap => {
      const m = {}
      snap.docs.forEach(d => { m[d.data().taskId] = { id: d.id, ...d.data() } })
      setLogs(m)
    })
  }, [selDate, selStaff])

  const sorted     = [...tasks].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''))
  const done       = sorted.filter(t => logs[t.id]?.status === 'done').length
  const lateCount  = sorted.filter(t => { const d = diffMins(t.startTime, logs[t.id]?.actualStart); return d != null && d > 0 }).length
  const pct        = sorted.length ? Math.round(done/sorted.length*100) : 0
  const filteredStaff = selStaff === 'all' ? staffList : staffList.filter(s => s.id === selStaff)

  return (
    <div>
      {/* Filters row */}
      <Card style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{
            border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: '9px 10px', fontSize: 14, color: C.text, background: C.bg }} />
          <select value={selStaff} onChange={e => setSelStaff(e.target.value)} style={{
            flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: '9px 10px', fontSize: 14, color: C.text, background: C.bg }}>
            <option value="all">All Staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {/* View toggles */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[['table','📋 Table'],['summary','📊 Summary']].map(([v,lbl]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: view === v ? C.primary : 'transparent',
                color: view === v ? '#fff' : C.text,
              }}>{lbl}</button>
            ))}
          </div>
          {/* Export */}
          <button onClick={() => exportCSV(sorted, logs, staffList, selDate)} style={{
            padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`,
            cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'transparent', color: C.text,
          }}>⬇ CSV</button>
        </div>
      </Card>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total',      value: sorted.length, color: C.text   },
          { label: 'Done',       value: done,           color: C.green  },
          { label: 'Pending',    value: sorted.length - done, color: C.primary },
          { label: 'Late starts',value: lateCount,      color: '#D68910' },
          { label: 'Compliance', value: pct + '%',      color: pct === 100 ? C.green : pct >= 80 ? '#D68910' : C.lateRed },
        ].map(s => (
          <Card key={s.label} style={{ padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {loading ? <Spinner /> : sorted.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
          <div style={{ color: C.muted }}>No tasks uploaded for {fmtDate(selDate)}</div>
        </Card>
      ) : view === 'table' ? (
        // ── TABLE VIEW ────────────────────────────────────────────────────────
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.primary }}>
                  {['Time','Staff','Task','Type','Actual','Variance','Status','🎙'].map(h => (
                    <th key={h} style={{
                      padding: '9px 10px', textAlign: 'left', fontWeight: 700,
                      fontSize: 11, color: '#fff', whiteSpace: 'nowrap',
                      borderBottom: `2px solid ${C.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const log   = logs[t.id] || {}
                  const staff = staffList.find(s => s.id === t.staffId)
                  const isDone = log.status === 'done'
                  const d     = diffMins(t.startTime, log.actualStart)
                  const isLate = d != null && d > 30
                  const st    = statusLabel(t, log)
                  const rowBg = isDone ? '#F8FFF8' : isLate ? '#FFF5F5' : i%2===0 ? C.bg : C.row

                  return (
                    <tr key={t.id} style={{ background: rowBg }}>
                      {/* Time */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: C.muted, fontWeight: 600 }}>
                        {t.startTime || '—'}
                      </td>
                      {/* Staff */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: staff?.color || C.primary, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 800, flexShrink: 0,
                          }}>{(staff?.name||'?')[0]}</div>
                          <span style={{ fontSize: 12 }}>{staff?.name || t.staffName}</span>
                        </div>
                      </td>
                      {/* Task */}
                      <td style={{ padding: '9px 10px', maxWidth: 220 }}>
                        <div style={{ fontFamily: 'Noto Sans Tamil, sans-serif', fontSize: 12, color: C.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.task}
                        </div>
                        {t.substitute && (
                          <span style={{ fontSize: 10, color: C.absent, fontWeight: 600 }}>🔄 Substitute</span>
                        )}
                      </td>
                      {/* Type */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: t.type==='critical' ? '#FADBD8' : '#D6EAF8',
                          color: t.type==='critical' ? '#7B241C' : '#154360',
                        }}>
                          {t.type==='critical' ? '⚡ Critical' : 'Normal'}
                        </span>
                      </td>
                      {/* Actual start */}
                      <td style={{ padding: '9px 10px', color: C.text, whiteSpace: 'nowrap' }}>
                        {log.actualStart || '—'}
                      </td>
                      {/* Variance */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap',
                        fontWeight: 700, color: varianceColor(d) }}>
                        {d != null ? fmtVariance(d) : '—'}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.color,
                        }}>{st.text}</span>
                      </td>
                      {/* Voice */}
                      <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                        {log.hasVoice && (
                          <VoiceNote staffId={t.staffId} date={selDate} taskId={t.id} readOnly />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${C.border}`,
            display: 'flex', gap: 16, flexWrap: 'wrap', background: C.bg }}>
            {[
              { color:'#D5F5E3', textColor:'#0B5E2F', label:'Done on time' },
              { color:'#FDEBD0', textColor:'#784212', label:'Late 1–30 min' },
              { color:'#FADBD8', textColor:'#7B241C', label:'Late >30 min'  },
              { color:'#F2F3F4', textColor:C.muted,   label:'Pending'       },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:l.color,
                  border:`1px solid ${C.border}`, display:'inline-block' }}/>
                <span style={{ color:C.muted }}>{l.label}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        // ── SUMMARY VIEW (per staff cards) ────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredStaff.map(s => {
            const sTasks = sorted.filter(t => t.staffId === s.id)
            const sDone  = sTasks.filter(t => logs[t.id]?.status === 'done').length
            const sPct   = sTasks.length ? Math.round(sDone/sTasks.length*100) : 0
            const sLate  = sTasks.filter(t => { const d=diffMins(t.startTime,logs[t.id]?.actualStart); return d!=null&&d>0 }).length
            return (
              <Card key={s.id} style={{ padding: '16px 18px' }}>
                {/* Staff header */}
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                  <Avatar name={s.name} color={s.color||C.primary} size={36}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:C.text }}>{s.name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>
                      {sDone}/{sTasks.length} done · {sLate} late start{sLate!==1?'s':''}
                    </div>
                  </div>
                  <div style={{ fontSize:22, fontWeight:800,
                    color: sPct===100?C.green:sPct>=80?'#D68910':C.primary }}>
                    {sPct}%
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height:7, borderRadius:4, background:C.border, overflow:'hidden', marginBottom:14 }}>
                  <div style={{ height:'100%', width:`${sPct}%`, borderRadius:4,
                    background: sPct===100?C.green:sPct>=80?'#D68910':C.primary,
                    transition:'width .4s' }}/>
                </div>

                {/* Task rows */}
                <div>
                  {sTasks.map((t,i) => {
                    const log  = logs[t.id] || {}
                    const isDone = log.status === 'done'
                    const d    = diffMins(t.startTime, log.actualStart)
                    const isLate = d != null && d > 30
                    const st   = statusLabel(t, log)
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                        borderBottom: i < sTasks.length-1 ? `1px solid ${C.border}` : 'none',
                        background: isDone?'transparent':isLate?'#FFF5F5':'transparent',
                      }}>
                        {/* Time */}
                        <span style={{ fontSize:11, color:C.muted, minWidth:38, fontWeight:600 }}>
                          {t.startTime}
                        </span>
                        {/* Type dot */}
                        <span style={{
                          width:7, height:7, borderRadius:'50%', flexShrink:0,
                          background: t.type==='critical'?C.critical:C.normal,
                        }}/>
                        {/* Task name */}
                        <span style={{ flex:1, fontSize:12, color:C.text,
                          fontFamily:'Noto Sans Tamil, sans-serif',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {t.task}
                        </span>
                        {/* Actual start */}
                        <span style={{ fontSize:11, color:C.muted, minWidth:38 }}>
                          {log.actualStart||''}
                        </span>
                        {/* Variance */}
                        {d != null && (
                          <span style={{ fontSize:11, fontWeight:700, color:varianceColor(d), minWidth:38 }}>
                            {fmtVariance(d)}
                          </span>
                        )}
                        {/* Status pill */}
                        <span style={{
                          padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600,
                          background:st.bg, color:st.color, flexShrink:0,
                        }}>{st.text}</span>
                        {/* Voice */}
                        {log.hasVoice && (
                          <VoiceNote staffId={t.staffId} date={selDate} taskId={t.id} readOnly />
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── UPLOAD TAB ───────────────────────────────────────────────────────────────
function UploadTab({ staffList }) {
  const fileRef   = useRef()
  const masterRef = useRef()

  const [selDate, setSelDate] = useState(today())
  const [dupDate, setDupDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10)
  })
  const [preview,   setPreview]   = useState([])
  const [errors,    setErrors]    = useState([])
  const [uploading, setUploading] = useState(false)
  const [success,   setSuccess]   = useState('')
  const [fileName,  setFileName]  = useState('')
  const [editRow,   setEditRow]   = useState(null)
  const [dupLoading,setDupLoading]= useState(false)
  const [dupResult, setDupResult] = useState('')

  const [masterTasks,    setMasterTasks]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('kal_master_v1') || '[]') } catch { return [] }
  })
  const [masterFileName, setMasterFileName] = useState('')
  const [masterErrors,   setMasterErrors]   = useState([])
  const [masterMsg,      setMasterMsg]      = useState('')
  const [showMaster,     setShowMaster]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [genMsg,         setGenMsg]         = useState('')

  const handleMasterFile = async e => {
    const file = e.target.files[0]; if (!file) return
    setMasterFileName(file.name); setMasterErrors([]); setMasterMsg('')
    try {
      const { tasks, errors: errs } = await parseMasterSchedule(file, staffList)
      setMasterTasks(tasks)
      localStorage.setItem('kal_master_v1', JSON.stringify(tasks))
      setMasterMsg(`✅ ${tasks.length} recurring tasks saved as Master Schedule`)
      setMasterErrors(errs)
    } catch (err) { setMasterErrors([err.message]) }
  }

  const handleGenerate = async () => {
    if (!masterTasks.length) { setGenMsg('❌ Master Schedule இல்லை. முதலில் பதிவேற்றவும்.'); return }
    setGenerating(true); setGenMsg(''); setErrors([]); setSuccess('')
    try {
      const daily = generateDailyTasks(masterTasks, selDate)
      setPreview(daily)
      setGenMsg(`✅ ${daily.length} tasks loaded — நேரத்தை திருத்தி Upload செய்யவும்`)
    } catch (err) { setGenMsg(`❌ ${err.message}`) }
    setGenerating(false)
  }

  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return
    setFileName(file.name); setSuccess(''); setErrors([]); setPreview([])
    try {
      const { tasks, errors: errs } = await parseExcel(file, selDate, staffList)
      setPreview(tasks); setErrors(errs)
    } catch (err) { setErrors([err.message]) }
  }

  const handleUpload = async () => {
    if (!preview.length) return
    setUploading(true); setSuccess('')
    try {
      const batch = writeBatch(db)
      preview.forEach(t => batch.set(doc(db,'tasks',t.id), t))
      await batch.commit()
      setSuccess(`✅ ${preview.length} tasks uploaded for ${fmtDate(selDate)}`)
      setPreview([]); setErrors([]); setFileName(''); setGenMsg('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) { setErrors([err.message]) }
    setUploading(false)
  }

  const handleDuplicate = async () => {
    if (!dupDate) return
    setDupLoading(true); setDupResult('')
    try {
      const snap = await getDocs(query(collection(db,'tasks'), where('date','==',selDate)))
      if (snap.empty) { setDupResult('❌ Source date has no tasks'); setDupLoading(false); return }
      const batch = writeBatch(db); let count = 0
      snap.docs.forEach(d => {
        const t = d.data()
        const safe = t.task.replace(/[^a-zA-Z0-9]/g,'').slice(0,14)
        const newTask = { ...t, date: dupDate, id: `${t.staffId}_${dupDate}_${safe}`, createdAt: new Date().toISOString() }
        batch.set(doc(db,'tasks',newTask.id), newTask); count++
      })
      await batch.commit()
      setDupResult(`✅ ${count} tasks copied to ${fmtDate(dupDate)}`)
    } catch (err) { setDupResult(`❌ ${err.message}`) }
    setDupLoading(false)
  }

  const clearDate = async () => {
    if (!confirm(`Delete ALL tasks for ${fmtDate(selDate)}?`)) return
    setUploading(true)
    const snap = await getDocs(query(collection(db,'tasks'), where('date','==',selDate)))
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    setSuccess(`🗑 All tasks for ${fmtDate(selDate)} deleted`)
    setUploading(false)
  }

  const updateRow   = (idx,field,val) => setPreview(prev => prev.map((t,i) => i===idx?{...t,[field]:val}:t))
  const removeRow   = idx => setPreview(prev => prev.filter((_,i) => i!==idx))
  const addBlankRow = () => setPreview(prev => [...prev, {
    id:uid(),staffId:'',staffName:'',date:selDate,task:'',startTime:'',type:'normal',substitute:false,remarks:'',createdAt:new Date().toISOString(),
  }])

  return (
    <div>
      <Card style={{ marginBottom:12, padding:'14px 16px' }}>
        <label style={{ fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:6 }}>WORKING DATE</label>
        <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{
          width:'100%',border:`1.5px solid ${C.border}`,borderRadius:10,padding:'11px 14px',fontSize:15,color:C.text,background:C.bg}}/>
      </Card>

      <Card style={{ marginBottom:12,padding:'16px',background:'#F0FFF4',border:`1.5px solid ${C.green}66` }}>
        <div style={{ fontWeight:800,fontSize:15,color:C.green,marginBottom:4 }}>⚡ இன்றைய பணிகள் உருவாக்கு</div>
        <div style={{ fontSize:12,color:C.muted,marginBottom:12 }}>
          Master Schedule-ல் இருந்து <b>{fmtDate(selDate)}</b>-க்கான பணிகளை தானாக உருவாக்கு.
          {masterTasks.length>0&&<span style={{ color:C.green,fontWeight:700 }}> ({masterTasks.length} recurring tasks ready)</span>}
        </div>
        <Btn variant="green" onClick={handleGenerate} disabled={generating||!masterTasks.length}>
          {generating?'உருவாக்குகிறது…':`📋 Generate ${masterTasks.length} Tasks for ${fmtDate(selDate)}`}
        </Btn>
        {masterTasks.length===0&&<div style={{ marginTop:8,fontSize:12,color:C.lateRed }}>⚠️ முதலில் கீழே Master Schedule பதிவேற்றவும்.</div>}
        {genMsg&&<div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,fontSize:13,fontWeight:600,
          background:genMsg.startsWith('✅')?'#D5F5E3':'#FADBD8',color:genMsg.startsWith('✅')?C.green:C.lateRed }}>{genMsg}</div>}
      </Card>

      {preview.length>0&&(
        <Card style={{ marginBottom:12 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
            <div style={{ fontWeight:700,fontSize:13 }}>Preview — {preview.length} tasks for {fmtDate(selDate)}</div>
            <Btn small variant="ghost" onClick={addBlankRow}>+ Add Row</Btn>
          </div>
          <div style={{ background:'#EEF6FF',borderRadius:8,padding:'7px 12px',marginBottom:10,fontSize:12,color:'#1565C0' }}>
            💡 நேரத்தை நேரடியாக திருத்தலாம். தேவையற்ற பணிகளை 🗑 நீக்கலாம்.
          </div>
          <div style={{ overflowX:'auto',marginBottom:12 }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
              <thead>
                <tr style={{ background:C.bg }}>
                  {['Staff','Task','Time','Type',''].map(h=>(
                    <th key={h} style={{ padding:'6px 8px',textAlign:'left',fontSize:11,color:C.muted,
                      fontWeight:600,borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((t,i)=>(
                  <tr key={i} style={{ background:editRow===i?'#FFFBE6':i%2===0?C.bg:C.row }}>
                    {editRow===i?(
                      <td colSpan={5} style={{ padding:'8px' }}>
                        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                          <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                            <select value={t.staffId} onChange={e=>{
                              const s=staffList.find(x=>x.id===e.target.value)
                              updateRow(i,'staffId',e.target.value); updateRow(i,'staffName',s?.name||'')
                            }} style={{ flex:1,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:12,background:C.bg }}>
                              <option value="">Select staff</option>
                              {staffList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input type="time" value={t.startTime} onChange={e=>updateRow(i,'startTime',e.target.value)}
                              style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:13,background:C.bg,width:100 }}/>
                            <select value={t.type} onChange={e=>updateRow(i,'type',e.target.value)}
                              style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:12,background:C.bg }}>
                              <option value="normal">normal</option>
                              <option value="critical">critical</option>
                            </select>
                          </div>
                          <div style={{ display:'flex',gap:8 }}>
                            <input value={t.task} onChange={e=>updateRow(i,'task',e.target.value)} placeholder="Task"
                              style={{ flex:1,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',fontSize:13,background:C.bg,boxSizing:'border-box' }}/>
                            <Btn small variant="green" onClick={()=>setEditRow(null)}>✓</Btn>
                            <Btn small variant="danger" onClick={()=>{removeRow(i);setEditRow(null)}}>🗑</Btn>
                          </div>
                        </div>
                      </td>
                    ):(
                      <>
                        <td style={{ padding:'7px 8px',whiteSpace:'nowrap' }}>
                          <span style={{ fontSize:12,fontWeight:600 }}>{t.staffName||'—'}</span>
                        </td>
                        <td style={{ padding:'7px 8px',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                          fontFamily:'Noto Sans Tamil, sans-serif',fontSize:12 }}>{t.task}</td>
                        <td style={{ padding:'7px 8px',whiteSpace:'nowrap' }}>
                          <input type="time" value={t.startTime} onChange={e=>updateRow(i,'startTime',e.target.value)}
                            style={{ border:`1px solid ${C.border}44`,borderRadius:6,padding:'2px 6px',fontSize:12,
                              color:C.text,background:'transparent',width:82 }}/>
                        </td>
                        <td style={{ padding:'7px 8px',whiteSpace:'nowrap' }}>
                          <span style={{ padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:700,
                            background:t.type==='critical'?'#FADBD8':'#D6EAF8',
                            color:t.type==='critical'?'#7B241C':'#154360' }}>
                            {t.type==='critical'?'⚡':'●'} {t.type}
                          </span>
                        </td>
                        <td style={{ padding:'7px 8px',whiteSpace:'nowrap' }}>
                          <button onClick={()=>setEditRow(i)} style={{ background:'transparent',border:`1px solid ${C.border}`,borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,marginRight:4 }}>✏️</button>
                          <button onClick={()=>removeRow(i)} style={{ background:'transparent',border:'none',cursor:'pointer',fontSize:14,color:C.muted }}>🗑</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.length>0&&<div style={{ background:'#FFF0F0',borderRadius:8,padding:10,marginBottom:10 }}>{errors.map((e,i)=><div key={i} style={{ fontSize:12,color:C.lateRed }}>• {e}</div>)}</div>}
          {success&&<div style={{ background:'#F0FFF4',borderRadius:8,padding:10,marginBottom:10,color:C.green,fontWeight:600 }}>{success}</div>}
          <Btn full variant="green" onClick={handleUpload} disabled={uploading}>
            {uploading?'Uploading…':`✅ Upload ${preview.length} Tasks to ${fmtDate(selDate)}`}
          </Btn>
        </Card>
      )}

      <Card style={{ marginBottom:12 }}>
        <button onClick={()=>setShowMaster(o=>!o)} style={{ width:'100%',background:'transparent',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',padding:0 }}>
          <div style={{ fontWeight:700,fontSize:14,color:C.text }}>
            📋 Master Schedule பதிவேற்றம்
            {masterTasks.length>0&&<span style={{ marginLeft:8,fontSize:12,color:C.green,fontWeight:600 }}>✓ {masterTasks.length} tasks loaded</span>}
          </div>
          <span style={{ color:C.muted,fontSize:18 }}>{showMaster?'▲':'▼'}</span>
        </button>
        {showMaster&&(
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:13,color:C.muted,marginBottom:10 }}>
              <b>KAL_Master_Schedule_Ready.xlsx</b> கோப்பை ஒரே ஒரு முறை பதிவேற்றவும்.
            </div>
            <input ref={masterRef} type="file" accept=".xlsx,.xls" onChange={handleMasterFile} style={{ display:'none' }} id="master-upload"/>
            <label htmlFor="master-upload" style={{ display:'block',border:`2px dashed ${C.green}66`,borderRadius:12,padding:'20px 16px',textAlign:'center',cursor:'pointer',background:'#F8FFF8',marginBottom:10 }}>
              <div style={{ fontSize:28,marginBottom:6 }}>📋</div>
              <div style={{ fontWeight:700,color:C.text }}>{masterFileName||'KAL_Master_Schedule_Ready.xlsx தேர்ந்தெடுக்கவும்'}</div>
              <div style={{ fontSize:11,color:C.muted,marginTop:4 }}>பணியாளர் பெயர் | பணி விவரம் | வழக்கமான நேரம் | வகை | செயல்படுத்து?</div>
            </label>
            {masterErrors.length>0&&<div style={{ background:'#FFF0F0',borderRadius:8,padding:10,marginBottom:8 }}>{masterErrors.map((e,i)=><div key={i} style={{ fontSize:12,color:C.lateRed }}>• {e}</div>)}</div>}
            {masterMsg&&<div style={{ background:'#F0FFF4',borderRadius:8,padding:10,color:C.green,fontWeight:600,fontSize:13 }}>{masterMsg}</div>}
            {masterTasks.length>0&&(
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:12,color:C.muted,marginBottom:6,fontWeight:600 }}>Loaded ({masterTasks.length} tasks):</div>
                <div style={{ maxHeight:160,overflowY:'auto' }}>
                  {masterTasks.map((t,i)=>(
                    <div key={i} style={{ fontSize:12,padding:'4px 0',borderBottom:`1px solid ${C.border}`,display:'flex',gap:8 }}>
                      <span style={{ color:t.type==='critical'?C.critical:C.normal,fontWeight:700,flexShrink:0 }}>{t.type==='critical'?'⚡':'●'}</span>
                      <span style={{ color:C.muted,flexShrink:0,minWidth:44 }}>{t.startTime}</span>
                      <span style={{ flex:1 }}><b>{t.staffName}</b> — {t.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom:12,padding:'14px 16px' }}>
        <div style={{ fontWeight:700,marginBottom:6 }}>📋 நாள் நகலெடு (Copy Day)</div>
        <div style={{ fontSize:12,color:C.muted,marginBottom:10 }}>{fmtDate(selDate)}-ல் upload செய்த tasks-ஐ வேறொரு நாளுக்கு நகலெடு</div>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end' }}>
          <div style={{ flex:1,minWidth:140 }}>
            <label style={{ fontSize:11,color:C.muted,fontWeight:600,display:'block',marginBottom:4 }}>COPY TO DATE</label>
            <input type="date" value={dupDate} onChange={e=>setDupDate(e.target.value)} style={{ width:'100%',border:`1.5px solid ${C.border}`,borderRadius:10,padding:'9px 10px',fontSize:14,color:C.text,background:C.bg }}/>
          </div>
          <Btn variant="accent" onClick={handleDuplicate} disabled={dupLoading||!dupDate}>
            {dupLoading?'Copying…':`Copy → ${dupDate?fmtDate(dupDate):'—'}`}
          </Btn>
        </div>
        {dupResult&&<div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,fontSize:13,fontWeight:600,
          background:dupResult.startsWith('✅')?'#D5F5E3':'#FADBD8',color:dupResult.startsWith('✅')?C.green:C.lateRed }}>{dupResult}</div>}
      </Card>

      <Card style={{ marginBottom:12,padding:'14px 16px',background:'#EEF6FF',border:`1px solid #1565C033` }}>
        <div style={{ fontWeight:700,marginBottom:6 }}>📥 Template Download</div>
        <div style={{ fontSize:12,color:C.muted,marginBottom:10 }}>{staffList.length} staff pre-loaded in dropdown.</div>
        <Btn variant="blue" small onClick={()=>downloadTemplateWithStaff(staffList)}>⬇ Download Template with Staff</Btn>
      </Card>

      <Card style={{ marginBottom:12 }}>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:8 }}>📤 Excel Upload (one-off)</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} id="excel-upload"/>
        <label htmlFor="excel-upload" style={{ display:'block',border:`2px dashed ${C.border}`,borderRadius:12,padding:'20px 16px',textAlign:'center',cursor:'pointer',background:C.row }}>
          <div style={{ fontSize:28,marginBottom:6 }}>📤</div>
          <div style={{ fontWeight:700,color:C.text }}>{fileName||'Click to select Excel file'}</div>
          <div style={{ fontSize:12,color:C.muted,marginTop:4 }}>.xlsx or .xls</div>
        </label>
      </Card>

      <Card style={{ border:`1px solid ${C.lateRed}33` }}>
        <div style={{ fontWeight:700,color:C.lateRed,marginBottom:6 }}>⚠️ Clear Day's Tasks</div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:10 }}>Delete all uploaded tasks for {fmtDate(selDate)}.</div>
        <Btn variant="danger" small onClick={clearDate} disabled={uploading}>🗑 Clear {fmtDate(selDate)}</Btn>
      </Card>
    </div>
  )
}

// ─── STAFF TAB ────────────────────────────────────────────────────────────────
function StaffTab({ staffList }) {
  const [name,setName]=useState(''); const [phone,setPhone]=useState('+91'); const [role,setRole]=useState('')
  const [saving,setSaving]=useState(false); const [editId,setEditId]=useState(null); const [ef,setEf]=useState({})

  const add = async () => {
    if (!name.trim()) return; setSaving(true)
    const id=uid(), color=AVATAR_COLORS[staffList.length%AVATAR_COLORS.length]
    await setDoc(doc(db,'staff',id),{ name:name.trim(),phone:phone.trim(),role:role.trim()||'Staff',color,active:true,createdAt:new Date().toISOString() })
    setName('');setPhone('+91');setRole('');setSaving(false)
  }
  const del = async id => { if(!confirm('Delete this staff member?'))return; await deleteDoc(doc(db,'staff',id)) }
  const saveEdit = async () => { await setDoc(doc(db,'staff',editId),ef,{merge:true}); setEditId(null) }

  return (
    <div>
      <SectionHead>Add Staff Member</SectionHead>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <Inp value={name} onChange={setName} placeholder="Full name (Tamil or English)"/>
          <Inp value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" inputMode="tel"/>
          <Inp value={role} onChange={setRole} placeholder="Role (e.g. Head Cook, Supervisor)"/>
          <Btn full onClick={add} disabled={saving||!name.trim()}>{saving?'Saving…':'+ Add Staff'}</Btn>
        </div>
      </Card>
      <SectionHead>Staff List ({staffList.length})</SectionHead>
      {staffList.length===0&&<p style={{ color:C.muted,textAlign:'center',marginTop:24 }}>No staff added.</p>}
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {staffList.map(s=>(
          <Card key={s.id} style={{ padding:'13px 16px' }}>
            {editId===s.id?(
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                <Inp value={ef.name||''} onChange={v=>setEf(f=>({...f,name:v}))} placeholder="Name"/>
                <Inp value={ef.phone||''} onChange={v=>setEf(f=>({...f,phone:v}))} placeholder="Phone"/>
                <Inp value={ef.role||''} onChange={v=>setEf(f=>({...f,role:v}))} placeholder="Role"/>
                <div style={{ display:'flex',gap:8 }}>
                  <Btn small variant="green" onClick={saveEdit}>Save</Btn>
                  <Btn small variant="ghost" onClick={()=>setEditId(null)}>Cancel</Btn>
                </div>
              </div>
            ):(
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <Avatar name={s.name} color={s.color||C.primary}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,color:C.text }}>{s.name}</div>
                  <div style={{ fontSize:12,color:C.muted }}>{s.role} · {s.phone}</div>
                </div>
                <div style={{ display:'flex',gap:6 }}>
                  <Btn small variant="ghost" onClick={()=>{setEditId(s.id);setEf({name:s.name,phone:s.phone,role:s.role})}}>✏️</Btn>
                  <Btn small variant="danger" onClick={()=>del(s.id)}>🗑</Btn>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Admin App Shell ──────────────────────────────────────────────────────────
export default function AdminApp({ onLogout }) {
  
  const [tab,setTab]=useState(TABS.MONITOR)
  const [staffList,setStaffList]=useState([])

  useEffect(()=>onSnapshot(collection(db,'staff'),snap=>{
    setStaffList(snap.docs.map(d=>({id:d.id,...d.data()})))
  }),[])

  return (
    <div style={{ minHeight:'100vh',background:C.bg,paddingBottom:70 }}>
      <TopNav tab={tab} setTab={setTab} onLogout={onLogout} />
      <div style={{ maxWidth:900,margin:'0 auto',padding:'18px 14px 40px' }}>
        {tab===TABS.MONITOR&&<MonitorTab staffList={staffList}/>}
        {tab===TABS.UPLOAD &&<UploadTab  staffList={staffList}/>}
        {tab===TABS.STAFF  &&<StaffTab   staffList={staffList}/>}
      </div>
      <div style={{ position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`2px solid ${C.border}`,display:'flex',zIndex:100 }}>
        {[{id:TABS.MONITOR,icon:'📊',label:'Monitor'},{id:TABS.UPLOAD,icon:'📤',label:'Upload'},{id:TABS.STAFF,icon:'👥',label:'Staff'}].map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1,padding:'10px 4px',border:'none',cursor:'pointer',background:'transparent',
            fontWeight:700,fontSize:11,color:tab===n.id?C.primary:C.muted,
            borderTop:tab===n.id?`3px solid ${C.primary}`:'3px solid transparent',
            display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
            <span style={{ fontSize:18 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <button onClick={onLogout} style={{ flex:1,padding:'10px 4px',border:'none',cursor:'pointer',background:'transparent',fontSize:11,color:C.muted,display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
          <span style={{ fontSize:18 }}>🚪</span><span>Logout</span>
        </button>
      </div>
    </div>
  )
}

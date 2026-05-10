// src/pages/AdminApp.jsx
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, onSnapshot,
  doc, setDoc, deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../hooks/useAuth'
import { COLORS as C, today, fmtDate, timeDiff, fmtDiff, uid } from '../utils/constants'
import { Card, Btn, Badge, Spinner, ProgressBar, SectionHead, Avatar, Inp } from '../components/UI'
import VoiceNote from '../components/VoiceNote'
import { parseExcel } from '../utils/excelImport'
import { downloadTemplateWithStaff } from '../utils/templateDownload'
import { parseMasterSchedule, generateDailyTasks } from '../utils/masterSchedule'

const TABS = { MONITOR: 'monitor', UPLOAD: 'upload', STAFF: 'staff' }
const AVATAR_COLORS = ['#8E44AD','#2980B9','#16A085','#C0392B','#D35400','#27AE60']

// ─── Top Nav ──────────────────────────────────────────────────────────────────
function TopNav({ tab, setTab, onLogout, user }) {
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
        <div style={{ fontSize: 11, opacity: 0.8 }}>Admin — {user?.email}</div>
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

  const sorted = [...tasks].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''))
  const done   = sorted.filter(t => logs[t.id]?.status === 'done').length
  const filteredStaff = selStaff === 'all' ? staffList : staffList.filter(s => s.id === selStaff)

  return (
    <div>
      <Card style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{
            flex: 1, minWidth: 130, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: '9px 10px', fontSize: 14, color: C.text, background: C.bg }} />
          <select value={selStaff} onChange={e => setSelStaff(e.target.value)} style={{
            flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10,
            padding: '9px 10px', fontSize: 14, color: C.text, background: C.bg }}>
            <option value="all">All Staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </Card>

      <Card style={{ marginBottom: 16, padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{fmtDate(selDate)} — Overall Progress</div>
        <ProgressBar value={done} max={sorted.length} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {[
            [C.critical,'⚡ Critical'],[C.normal,'● Normal'],[C.absent,'🔄 Substitute'],
            [C.lateRed,'⚠️ Late >30m'],['#1565C0','🎙 Voice'],
          ].map(([col,lbl]) => (
            <div key={lbl} style={{ display:'flex',alignItems:'center',gap:4,fontSize:11,color:C.muted }}>
              <span style={{ width:8,height:8,borderRadius:2,background:col,display:'inline-block' }} />{lbl}
            </div>
          ))}
        </div>
      </Card>

      {loading ? <Spinner /> : filteredStaff.map(s => {
        const sTasks = sorted.filter(t => t.staffId === s.id)
        const sDone  = sTasks.filter(t => logs[t.id]?.status === 'done').length
        return (
          <div key={s.id} style={{ marginBottom: 22 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap' }}>
              <Avatar name={s.name} color={s.color||C.primary} size={32} />
              <span style={{ fontWeight:700,color:s.color||C.primary,fontSize:14 }}>{s.name}</span>
              <Badge color={s.color||C.primary}>{sDone}/{sTasks.length} done</Badge>
            </div>
            {sTasks.length === 0 && <p style={{ color:C.muted,fontSize:13 }}>No tasks for this date.</p>}
            {sTasks.map(t => {
              const log    = logs[t.id]
              const isDone = log?.status === 'done'
              const sd     = timeDiff(t.startTime, log?.actualStart)
              const isLate = sd != null && sd > 30
              const isMild = sd != null && sd > 0 && sd <= 30
              const bc     = isLate ? C.lateRed : t.substitute ? C.absent : t.type === 'critical' ? C.critical : C.normal
              return (
                <Card key={t.id} style={{ padding:'12px 14px', marginBottom:8,
                  background: isDone?'#F0FFF4':isLate?'#FFF2F2':t.substitute?'#FFF6EE':C.row,
                  borderLeft: `5px solid ${bc}`,
                  border: `1px solid ${isDone?C.green+'44':C.border}` }}>
                  <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:4 }}>
                    <span style={{ fontWeight:700,fontSize:13,flex:1,color:C.text }}>{t.task}</span>
                    <span style={{ fontSize:11,color:C.muted }}>{t.startTime}</span>
                  </div>
                  <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:4 }}>
                    <Badge color={t.type==='critical'?C.critical:C.normal} small>
                      {t.type==='critical'?'⚡ Critical':'● Normal'}
                    </Badge>
                    {t.substitute && <Badge color={C.absent} small>🔄 Substitute</Badge>}
                    <Badge color={isDone?C.green:C.muted} small>{isDone?'✅ Done':'⏳ Pending'}</Badge>
                  </div>
                  {(log?.actualStart||log?.actualEnd) && (
                    <div style={{ background:isLate?'#FFE8E8':isMild?'#FFFBE6':'#EDFFF4',
                      borderRadius:6,padding:'4px 8px',fontSize:12,marginBottom:4 }}>
                      {log.actualStart && (
                        <span>Start: <b>{log.actualStart}</b>
                          {sd!=null && <span style={{ marginLeft:5,fontWeight:700,
                            color:isLate?C.lateRed:isMild?'#D68910':C.green }}>
                            ({fmtDiff(sd)}{isLate?' ⚠️ LATE':''})
                          </span>}
                        </span>
                      )}
                      {log.actualEnd && <span style={{ marginLeft:10 }}>End: <b>{log.actualEnd}</b></span>}
                    </div>
                  )}
                  {isDone && log?.completedAt && (
                    <div style={{ fontSize:11,color:C.green }}>✔ Completed at {log.completedAt}</div>
                  )}
                  <VoiceNote staffId={t.staffId} date={selDate} taskId={t.id} readOnly />
                </Card>
              )
            })}
          </div>
        )
      })}
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

  const [dupLoading, setDupLoading] = useState(false)
  const [dupResult,  setDupResult]  = useState('')

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

  const updateRow   = (idx,field,val) => setPreview(prev => prev.map((t,i) => i===idx ? {...t,[field]:val} : t))
  const removeRow   = idx => setPreview(prev => prev.filter((_,i) => i!==idx))
  const addBlankRow = () => setPreview(prev => [...prev, {
    id: uid(), staffId: '', staffName: '', date: selDate,
    task: '', startTime: '', type: 'normal', substitute: false, remarks: '',
    createdAt: new Date().toISOString(),
  }])

  return (
    <div>

      {/* DATE */}
      <Card style={{ marginBottom:12, padding:'14px 16px' }}>
        <label style={{ fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:6 }}>
          WORKING DATE
        </label>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{
          width:'100%', border:`1.5px solid ${C.border}`, borderRadius:10,
          padding:'11px 14px', fontSize:15, color:C.text, background:C.bg }} />
      </Card>

      {/* GENERATE FROM MASTER */}
      <Card style={{ marginBottom:12, padding:'16px', background:'#F0FFF4', border:`1.5px solid ${C.green}66` }}>
        <div style={{ fontWeight:800, fontSize:15, color:C.green, marginBottom:4 }}>
          ⚡ இன்றைய பணிகள் உருவாக்கு
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
          Master Schedule-ல் இருந்து <b>{fmtDate(selDate)}</b>-க்கான பணிகளை தானாக உருவாக்கு.
          நேரத்தை மட்டும் தேவையெனில் திருத்தலாம்.
          {masterTasks.length > 0 && (
            <span style={{ color:C.green, fontWeight:700 }}> ({masterTasks.length} recurring tasks ready)</span>
          )}
        </div>
        <Btn variant="green" onClick={handleGenerate} disabled={generating||!masterTasks.length}>
          {generating ? 'உருவாக்குகிறது…' : `📋 Generate ${masterTasks.length} Tasks for ${fmtDate(selDate)}`}
        </Btn>
        {masterTasks.length === 0 && (
          <div style={{ marginTop:8, fontSize:12, color:C.lateRed }}>
            ⚠️ முதலில் கீழே உள்ள "Master Schedule பதிவேற்றம்" திறந்து கோப்பை பதிவேற்றவும்.
          </div>
        )}
        {genMsg && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:600,
            background:genMsg.startsWith('✅')?'#D5F5E3':'#FADBD8',
            color:genMsg.startsWith('✅')?C.green:C.lateRed }}>
            {genMsg}
          </div>
        )}
      </Card>

      {/* EDITABLE PREVIEW */}
      {preview.length > 0 && (
        <Card style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontWeight:700, fontSize:13 }}>
              Preview — {preview.length} tasks for {fmtDate(selDate)}
            </div>
            <Btn small variant="ghost" onClick={addBlankRow}>+ Add Row</Btn>
          </div>
          <div style={{ background:'#EEF6FF', borderRadius:8, padding:'7px 12px',
            marginBottom:10, fontSize:12, color:'#1565C0' }}>
            💡 நேரத்தை நேரடியாக திருத்தலாம். தேவையற்ற பணிகளை 🗑 நீக்கலாம்.
          </div>
          <div style={{ maxHeight:380, overflowY:'auto', marginBottom:12 }}>
            {preview.map((t,i) => (
              <div key={i} style={{ padding:'8px 6px', borderBottom:`1px solid ${C.border}`,
                background: editRow===i ? '#FFFBE6' : i%2===0 ? C.bg : C.row }}>
                {editRow === i ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <select value={t.staffId}
                        onChange={e => {
                          const s = staffList.find(x => x.id===e.target.value)
                          updateRow(i,'staffId',e.target.value)
                          updateRow(i,'staffName',s?.name||'')
                        }}
                        style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:8,
                          padding:'6px 8px', fontSize:12, background:C.bg }}>
                        <option value="">Select staff</option>
                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <input type="time" value={t.startTime}
                        onChange={e => updateRow(i,'startTime',e.target.value)}
                        style={{ border:`1px solid ${C.border}`, borderRadius:8,
                          padding:'6px 8px', fontSize:13, background:C.bg, width:100 }} />
                      <select value={t.type} onChange={e => updateRow(i,'type',e.target.value)}
                        style={{ border:`1px solid ${C.border}`, borderRadius:8,
                          padding:'6px 8px', fontSize:12, background:C.bg }}>
                        <option value="normal">normal</option>
                        <option value="critical">critical</option>
                      </select>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input value={t.task} onChange={e => updateRow(i,'task',e.target.value)}
                        placeholder="Task description"
                        style={{ flex:1, border:`1px solid ${C.border}`, borderRadius:8,
                          padding:'7px 10px', fontSize:13, background:C.bg, boxSizing:'border-box' }} />
                      <Btn small variant="green" onClick={() => setEditRow(null)}>✓</Btn>
                      <Btn small variant="danger" onClick={() => { removeRow(i); setEditRow(null) }}>🗑</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{
                      background:(t.type==='critical'?C.critical:C.normal)+'22',
                      color:t.type==='critical'?C.critical:C.normal,
                      borderRadius:5, padding:'1px 6px', fontSize:10, fontWeight:700, flexShrink:0 }}>
                      {t.type==='critical'?'⚡':'●'}
                    </span>
                    <input type="time" value={t.startTime}
                      onChange={e => updateRow(i,'startTime',e.target.value)}
                      style={{ border:`1px solid ${C.border}44`, borderRadius:6, padding:'2px 6px',
                        fontSize:12, color:C.text, background:'transparent', width:82, flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:13 }}>
                      <b>{t.staffName||'—'}</b> — {t.task}
                    </span>
                    {t.substitute && <Badge color={C.absent} small>sub</Badge>}
                    <button onClick={() => setEditRow(i)}
                      style={{ background:'transparent', border:`1px solid ${C.border}`,
                        borderRadius:6, padding:'2px 8px', cursor:'pointer', fontSize:11 }}>✏️</button>
                    <button onClick={() => removeRow(i)}
                      style={{ background:'transparent', border:'none',
                        cursor:'pointer', fontSize:15, color:C.muted, padding:'0 2px' }}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {errors.length > 0 && (
            <div style={{ background:'#FFF0F0', borderRadius:8, padding:10, marginBottom:10 }}>
              {errors.map((e,i) => <div key={i} style={{ fontSize:12, color:C.lateRed }}>• {e}</div>)}
            </div>
          )}
          {success && (
            <div style={{ background:'#F0FFF4', borderRadius:8, padding:10, marginBottom:10,
              color:C.green, fontWeight:600 }}>{success}</div>
          )}
          <Btn full variant="green" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : `✅ Upload ${preview.length} Tasks to ${fmtDate(selDate)}`}
          </Btn>
        </Card>
      )}

      {/* MASTER SCHEDULE (collapsible) */}
      <Card style={{ marginBottom:12 }}>
        <button onClick={() => setShowMaster(o => !o)} style={{
          width:'100%', background:'transparent', border:'none', cursor:'pointer',
          display:'flex', justifyContent:'space-between', alignItems:'center', padding:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:C.text }}>
            📋 Master Schedule பதிவேற்றம்
            {masterTasks.length > 0 && (
              <span style={{ marginLeft:8, fontSize:12, color:C.green, fontWeight:600 }}>
                ✓ {masterTasks.length} tasks loaded
              </span>
            )}
          </div>
          <span style={{ color:C.muted, fontSize:18 }}>{showMaster?'▲':'▼'}</span>
        </button>

        {showMaster && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>
              <b>KAL_Master_Schedule.xlsx</b> கோப்பை ஒரே ஒரு முறை பதிவேற்றவும்.
              பணி அட்டவணை மாறும்போது மட்டும் மீண்டும் பதிவேற்றவும்.
            </div>
            <input ref={masterRef} type="file" accept=".xlsx,.xls"
              onChange={handleMasterFile} style={{ display:'none' }} id="master-upload" />
            <label htmlFor="master-upload" style={{
              display:'block', border:`2px dashed ${C.green}66`, borderRadius:12,
              padding:'20px 16px', textAlign:'center', cursor:'pointer',
              background:'#F8FFF8', marginBottom:10 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📋</div>
              <div style={{ fontWeight:700, color:C.text }}>
                {masterFileName || 'KAL_Master_Schedule.xlsx தேர்ந்தெடுக்கவும்'}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                பணியாளர் பெயர் | பணி விவரம் | வழக்கமான நேரம் | வகை | செயல்படுத்து?
              </div>
            </label>
            {masterErrors.length > 0 && (
              <div style={{ background:'#FFF0F0', borderRadius:8, padding:10, marginBottom:8 }}>
                {masterErrors.map((e,i) => <div key={i} style={{ fontSize:12, color:C.lateRed }}>• {e}</div>)}
              </div>
            )}
            {masterMsg && (
              <div style={{ background:'#F0FFF4', borderRadius:8, padding:10,
                color:C.green, fontWeight:600, fontSize:13 }}>{masterMsg}</div>
            )}
            {masterTasks.length > 0 && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:6, fontWeight:600 }}>
                  Loaded tasks ({masterTasks.length}):
                </div>
                <div style={{ maxHeight:160, overflowY:'auto' }}>
                  {masterTasks.map((t,i) => (
                    <div key={i} style={{ fontSize:12, padding:'4px 0',
                      borderBottom:`1px solid ${C.border}`, display:'flex', gap:8 }}>
                      <span style={{ color:t.type==='critical'?C.critical:C.normal,
                        fontWeight:700, flexShrink:0 }}>
                        {t.type==='critical'?'⚡':'●'}
                      </span>
                      <span style={{ color:C.muted, flexShrink:0, minWidth:44 }}>{t.startTime}</span>
                      <span style={{ flex:1 }}><b>{t.staffName}</b> — {t.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* DUPLICATE DAY */}
      <Card style={{ marginBottom:12, padding:'14px 16px' }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>📋 நாள் நகலெடு (Copy Day)</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
          {fmtDate(selDate)}-ல் upload செய்த tasks-ஐ வேறொரு நாளுக்கு நகலெடு
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:140 }}>
            <label style={{ fontSize:11, color:C.muted, fontWeight:600, display:'block', marginBottom:4 }}>
              COPY TO DATE
            </label>
            <input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} style={{
              width:'100%', border:`1.5px solid ${C.border}`, borderRadius:10,
              padding:'9px 10px', fontSize:14, color:C.text, background:C.bg }} />
          </div>
          <Btn variant="accent" onClick={handleDuplicate} disabled={dupLoading||!dupDate}>
            {dupLoading ? 'Copying…' : `Copy → ${dupDate ? fmtDate(dupDate) : '—'}`}
          </Btn>
        </div>
        {dupResult && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:600,
            background:dupResult.startsWith('✅')?'#D5F5E3':'#FADBD8',
            color:dupResult.startsWith('✅')?C.green:C.lateRed }}>
            {dupResult}
          </div>
        )}
      </Card>

      {/* DOWNLOAD TEMPLATE */}
      <Card style={{ marginBottom:12, padding:'14px 16px', background:'#EEF6FF', border:`1px solid #1565C033` }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>📥 Template Download</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
          {staffList.length} staff pre-loaded in dropdown.
          Use for one-off uploads or to fill the Master Schedule.
        </div>
        <Btn variant="blue" small onClick={() => downloadTemplateWithStaff(staffList)}>
          ⬇ Download Template with Staff
        </Btn>
      </Card>

      {/* ONE-OFF EXCEL UPLOAD */}
      <Card style={{ marginBottom:12 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>
          📤 Excel Upload (one-off / exceptional tasks)
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls"
          onChange={handleFile} style={{ display:'none' }} id="excel-upload" />
        <label htmlFor="excel-upload" style={{
          display:'block', border:`2px dashed ${C.border}`, borderRadius:12,
          padding:'20px 16px', textAlign:'center', cursor:'pointer', background:C.row }}>
          <div style={{ fontSize:28, marginBottom:6 }}>📤</div>
          <div style={{ fontWeight:700, color:C.text }}>{fileName || 'Click to select Excel file'}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>.xlsx or .xls</div>
        </label>
      </Card>

      {/* CLEAR DAY */}
      <Card style={{ border:`1px solid ${C.lateRed}33` }}>
        <div style={{ fontWeight:700, color:C.lateRed, marginBottom:6 }}>⚠️ Clear Day's Tasks</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>
          Delete all uploaded tasks for {fmtDate(selDate)}. Staff logs are preserved.
        </div>
        <Btn variant="danger" small onClick={clearDate} disabled={uploading}>
          🗑 Clear {fmtDate(selDate)}
        </Btn>
      </Card>

    </div>
  )
}

// ─── STAFF TAB ────────────────────────────────────────────────────────────────
function StaffTab({ staffList }) {
  const [name,   setName]   = useState('')
  const [phone,  setPhone]  = useState('+91')
  const [role,   setRole]   = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [ef,     setEf]     = useState({})

  const add = async () => {
    if (!name.trim()) return; setSaving(true)
    const id = uid(), color = AVATAR_COLORS[staffList.length % AVATAR_COLORS.length]
    await setDoc(doc(db,'staff',id), {
      name: name.trim(), phone: phone.trim(), role: role.trim()||'Staff',
      color, active: true, createdAt: new Date().toISOString(),
    })
    setName(''); setPhone('+91'); setRole(''); setSaving(false)
  }
  const del = async id => {
    if (!confirm('Delete this staff member?')) return
    await deleteDoc(doc(db,'staff',id))
  }
  const saveEdit = async () => {
    await setDoc(doc(db,'staff',editId), ef, { merge: true })
    setEditId(null)
  }

  return (
    <div>
      <SectionHead>Add Staff Member</SectionHead>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <Inp value={name}  onChange={setName}  placeholder="Full name (Tamil or English)" />
          <Inp value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" inputMode="tel" />
          <Inp value={role}  onChange={setRole}  placeholder="Role (e.g. Head Cook, Supervisor)" />
          <Btn full onClick={add} disabled={saving||!name.trim()}>
            {saving ? 'Saving…' : '+ Add Staff'}
          </Btn>
        </div>
      </Card>

      <SectionHead>Staff List ({staffList.length})</SectionHead>
      {staffList.length === 0 && (
        <p style={{ color:C.muted, textAlign:'center', marginTop:24 }}>No staff added.</p>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {staffList.map(s => (
          <Card key={s.id} style={{ padding:'13px 16px' }}>
            {editId === s.id ? (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <Inp value={ef.name||''}  onChange={v => setEf(f=>({...f,name:v}))}  placeholder="Name" />
                <Inp value={ef.phone||''} onChange={v => setEf(f=>({...f,phone:v}))} placeholder="Phone" />
                <Inp value={ef.role||''}  onChange={v => setEf(f=>({...f,role:v}))}  placeholder="Role" />
                <div style={{ display:'flex', gap:8 }}>
                  <Btn small variant="green" onClick={saveEdit}>Save</Btn>
                  <Btn small variant="ghost" onClick={() => setEditId(null)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Avatar name={s.name} color={s.color||C.primary} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:C.text }}>{s.name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>{s.role} · {s.phone}</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <Btn small variant="ghost"
                    onClick={() => { setEditId(s.id); setEf({name:s.name,phone:s.phone,role:s.role}) }}>✏️</Btn>
                  <Btn small variant="danger" onClick={() => del(s.id)}>🗑</Btn>
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
export default function AdminApp() {
  const { user, logout } = useAuth()
  const [tab,       setTab]       = useState(TABS.UPLOAD)
  const [staffList, setStaffList] = useState([])

  useEffect(() => onSnapshot(collection(db,'staff'), snap => {
    setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }), [])

  return (
    <div style={{ minHeight:'100vh', background:C.bg, paddingBottom:70 }}>
      <TopNav tab={tab} setTab={setTab} onLogout={logout} user={user} />
      <div style={{ maxWidth:780, margin:'0 auto', padding:'18px 14px 40px' }}>
        {tab === TABS.MONITOR && <MonitorTab staffList={staffList} />}
        {tab === TABS.UPLOAD  && <UploadTab  staffList={staffList} />}
        {tab === TABS.STAFF   && <StaffTab   staffList={staffList} />}
      </div>
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff',
        borderTop:`2px solid ${C.border}`, display:'flex', zIndex:100 }}>
        {[
          {id:TABS.MONITOR,icon:'📊',label:'Monitor'},
          {id:TABS.UPLOAD, icon:'📤',label:'Upload' },
          {id:TABS.STAFF,  icon:'👥',label:'Staff'  },
        ].map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex:1, padding:'10px 4px', border:'none', cursor:'pointer', background:'transparent',
            fontWeight:700, fontSize:11, color:tab===n.id?C.primary:C.muted,
            borderTop: tab===n.id?`3px solid ${C.primary}`:'3px solid transparent',
            display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:18 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <button onClick={logout} style={{ flex:1, padding:'10px 4px', border:'none', cursor:'pointer',
          background:'transparent', fontSize:11, color:C.muted,
          display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <span style={{ fontSize:18 }}>🚪</span><span>Logout</span>
        </button>
      </div>
    </div>
  )
}

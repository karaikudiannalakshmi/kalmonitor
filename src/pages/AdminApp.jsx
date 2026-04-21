// src/pages/AdminApp.jsx
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, where, onSnapshot,
  doc, setDoc, deleteDoc, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../hooks/useAuth'
import { COLORS as C, today, fmtDate, timeDiff, fmtDiff, uid } from '../utils/constants'
import { Card, Btn, Badge, Spinner, ProgressBar, SectionHead, Avatar, Inp } from '../components/UI'
import VoiceNote from '../components/VoiceNote'
import { parseExcel } from '../utils/excelImport'
import * as XLSX from 'xlsx'
import { downloadTemplateWithStaff } from '../utils/templateDownload'

const TABS = { MONITOR: 'monitor', UPLOAD: 'upload', STAFF: 'staff' }
const AVATAR_COLORS = ['#8E44AD','#2980B9','#16A085','#C0392B','#D35400','#27AE60']

// ─── Download template with real staff names injected ─────────────────────────
function downloadTemplateWithStaff(staffList) {
  const TASKS_TAMIL = [
    ["normal","சமையலுக்கு தண்ணீர் சூடேற்றுதல்","தயாரிப்பு"],
    ["normal","சுண்டல் குக்கரில் வைத்தல்","தயாரிப்பு"],
    ["normal","பருப்பு குக்கரில் வைத்தல்","தயாரிப்பு"],
    ["normal","காய்கறி நறுக்குதல் & தயாரிப்பு","தயாரிப்பு"],
    ["critical","தொடக்க பணி – தண்ணீர், சுண்டல், பருப்பு, காய்கறி","தயாரிப்பு"],
    ["normal","அரிசி / பருப்பு ஊற வைத்தல்","தயாரிப்பு"],
    ["normal","மாவு அரைத்தல்","தயாரிப்பு"],
    ["critical","ரசம் சுவை பார்த்தல் & பாத்திரங்கள் சரிபார்த்தல்","சமையல்"],
    ["normal","தேவையெனில் மசாலா சேர்த்தல்","சமையல்"],
    ["critical","சாம்பார் சமைத்தல்","சமையல்"],
    ["critical","ரசம் சமைத்தல்","சமையல்"],
    ["normal","சோறு வடித்தல்","சமையல்"],
    ["normal","கூட்டு / பொரியல் சமைத்தல்","சமையல்"],
    ["normal","ஒரு புதிய உணவு சமைத்தல்","சமையல்"],
    ["normal","சட்னி தயாரித்தல்","சமையல்"],
    ["normal","ஊறுகாய் / தொட்டுக்கொள்ளி தயாரித்தல்","சமையல்"],
    ["normal","அப்பளம் தயாரித்தல்","சமையல்"],
    ["normal","இனிப்பு / பாயசம் தயாரித்தல்","சமையல்"],
    ["normal","சிற்றுண்டி தயாரித்தல்","சமையல்"],
    ["normal","வடை / பஜ்ஜி வறுத்தல்","சமையல்"],
    ["critical","அன்னதானம் – காலை உணவு பரிமாறுதல்","பரிமாறுதல்"],
    ["critical","அன்னதானம் – மதிய உணவு பரிமாறுதல்","பரிமாறுதல்"],
    ["normal","காலை சிற்றுண்டி பரிமாறுதல்","பரிமாறுதல்"],
    ["normal","பரிமாறும் இடம் தயார் செய்தல்","பரிமாறுதல்"],
    ["normal","பரிமாறும் பாத்திரங்கள் நிரப்புதல்","பரிமாறுதல்"],
    ["critical","ஆன்லைன் பார்சல் – ஆர்டர் பெறுதல் & பேக் செய்தல்","பார்சல்"],
    ["normal","டின்னர் சீட் பிரிண்ட் எடுத்தல்","பார்சல்"],
    ["normal","டின்னர் கவர் – பேக்கிங் கண்காணித்தல்","பார்சல்"],
    ["critical","பார்சல் பேக்கிங் – கண்காணிப்பு","பார்சல்"],
    ["normal","டின்னர் பார்சலில் உதவுதல்","பார்சல்"],
    ["normal","மதிய உணவு பார்சல் பேக் செய்தல்","பார்சல்"],
    ["normal","காலை உணவு பார்சல் பேக் செய்தல்","பார்சல்"],
    ["normal","டெலிவரிக்கு பார்சல் லேபல் & வரிசைப்படுத்துதல்","பார்சல்"],
    ["critical","தினசரி பதிவு – ஆஜர், மீதமுள்ள தனிஷ்க்","பதிவுகள்"],
    ["critical","ஆஜர் பதிவு","பதிவுகள்"],
    ["normal","மாவு சீட் எடுத்தல்","பதிவுகள்"],
    ["critical","லஞ்ச் சீட் பதிவு","பதிவுகள்"],
    ["normal","காலை சீட் பதிவு","பதிவுகள்"],
    ["normal","அடுத்த நாள் பதிவு திருத்தம்","பதிவுகள்"],
    ["critical","தனிஷ்க் திரும்பப் பெறுதல் சரிபார்த்தல்","பதிவுகள்"],
    ["normal","மீதம் பதிவு செய்தல்","பதிவுகள்"],
    ["normal","தினசரி விற்பனை பதிவு","பதிவுகள்"],
    ["normal","சமையல் பாத்திரங்கள் சுத்தம் செய்தல்","சுத்தம்"],
    ["normal","வேலை மேடை & கவுண்டர் சுத்தம் செய்தல்","சுத்தம்"],
    ["normal","பரிமாறிய பின் இடம் சுத்தம் செய்தல்","சுத்தம்"],
    ["normal","சமையலறை தரை துடைத்தல் & மொப்பிடுதல்","சுத்தம்"],
    ["normal","தட்டுகள் & பாத்திரங்கள் கழுவுதல்","சுத்தம்"],
    ["normal","சமையலறை கழிவு அகற்றுதல்","சுத்தம்"],
    ["normal","மீதம் உணவை சரியாக பாதுகாத்தல்","சுத்தம்"],
    ["normal","கேஸ் & உபகரணங்கள் அணைத்தல்","சுத்தம்"],
    ["normal","நாள் இறுதி சமையலறை சரிபார்ப்பு","சுத்தம்"],
    ["critical","சமையல் குழுவை கண்காணித்தல்","நிர்வாகம்"],
    ["normal","மூலப்பொருள் டெலிவரி பெறுதல்","நிர்வாகம்"],
    ["normal","மூலப்பொருள் தரம் சரிபார்த்தல்","நிர்வாகம்"],
    ["normal","இருப்பு பதிவேட்டை புதுப்பித்தல்","நிர்வாகம்"],
    ["normal","அடுத்த நாள் மெனு திட்டமிடுதல்","நிர்வாகம்"],
    ["normal","பணியாளர் அறிவுரை / வழிகாட்டுதல்","நிர்வாகம்"],
    ["normal","பிரச்சனைகளை மேலாளரிடம் தெரிவித்தல்","நிர்வாகம்"],
  ]

  const wb = XLSX.utils.book_new()

  // Sheet 1: Daily Upload
  const uploadHeaders = ['பணியாளர் பெயர்','பணி விவரம்','தொடக்க நேரம்','வகை','பதிலாள் பணி','குறிப்பு']
  const uploadRows = [uploadHeaders, ...Array(50).fill(['','','','normal','',''])]
  const ws1 = XLSX.utils.aoa_to_sheet(uploadRows)
  ws1['!cols'] = [{wch:22},{wch:46},{wch:16},{wch:12},{wch:14},{wch:28}]
  // Staff dropdown validation
  const staffValidation = {
    type: 'list',
    formula1: `'பணியாளர்கள்'!$A$2:$A${staffList.length + 1}`,
    showErrorMessage: false,
    sqref: 'A2:A51',
  }
  ws1['!dataValidation'] = [staffValidation]
  XLSX.utils.book_append_sheet(wb, ws1, 'Daily Upload')

  // Sheet 2: Staff list — real names from Firestore
  const staffHeaders = ['பணியாளர் பெயர் (Staff Name)','பதவி (Role)']
  const staffRows = [staffHeaders, ...staffList.map(s => [s.name, s.role || 'Staff'])]
  const ws2 = XLSX.utils.aoa_to_sheet(staffRows)
  ws2['!cols'] = [{wch:28},{wch:20}]
  XLSX.utils.book_append_sheet(wb, ws2, 'பணியாளர்கள்')

  // Sheet 3: Task Master (Tamil)
  const taskHeaders = ['வகை','பணி விவரம் (Tamil)','பிரிவு']
  const taskRows = [taskHeaders, ...TASKS_TAMIL]
  const ws3 = XLSX.utils.aoa_to_sheet(taskRows)
  ws3['!cols'] = [{wch:12},{wch:52},{wch:14}]
  XLSX.utils.book_append_sheet(wb, ws3, 'Task Master')

  XLSX.writeFile(wb, `KAL_Tasks_${new Date().toISOString().slice(0,10)}.xlsx`)
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────
function TopNav({ tab, setTab, onLogout, user }) {
  const NAV = [
    { id: TABS.MONITOR, icon: '📊', label: 'Monitor' },
    { id: TABS.UPLOAD,  icon: '📤', label: 'Upload' },
    { id: TABS.STAFF,   icon: '👥', label: 'Staff' },
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
            <span>{n.icon}</span><span style={{ display: window.innerWidth < 500 ? 'none' : 'inline' }}>{n.label}</span>
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
  const [selDate, setSelDate] = useState(today())
  const [selStaff, setSelStaff] = useState('all')
  const [tasks, setTasks]   = useState([])
  const [logs, setLogs]     = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = selStaff === 'all'
      ? query(collection(db,'tasks'), where('date','==',selDate))
      : query(collection(db,'tasks'), where('date','==',selDate), where('staffId','==',selStaff))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({id:d.id,...d.data()})))
      setLoading(false)
    })
  }, [selDate, selStaff])

  useEffect(() => {
    const q = selStaff === 'all'
      ? query(collection(db,'logs'), where('date','==',selDate))
      : query(collection(db,'logs'), where('date','==',selDate), where('staffId','==',selStaff))
    return onSnapshot(q, snap => {
      const m = {}
      snap.docs.forEach(d => { m[d.data().taskId] = {id:d.id,...d.data()} })
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
          {[[C.critical,'⚡ Critical'],[C.normal,'● Normal'],[C.absent,'🔄 Substitute'],
            [C.lateRed,'⚠️ Late >30m'],[C.voice,'🎙 Voice']].map(([col,lbl]) => (
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
              const log = logs[t.id]; const isDone = log?.status === 'done'
              const sd = timeDiff(t.startTime, log?.actualStart)
              const isLate = sd != null && sd > 30; const isMild = sd != null && sd > 0 && sd <= 30
              const bc = isLate ? C.lateRed : t.substitute ? C.absent : t.type === 'critical' ? C.critical : C.normal
              return (
                <Card key={t.id} style={{ padding:'12px 14px',marginBottom:8,
                  background:isDone?'#F0FFF4':isLate?'#FFF2F2':t.substitute?'#FFF6EE':C.row,
                  borderLeft:`5px solid ${bc}`,border:`1px solid ${isDone?C.green+'44':C.border}` }}>
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
                      {log.actualStart && <span>Start: <b>{log.actualStart}</b>
                        {sd!=null && <span style={{ marginLeft:5,fontWeight:700,
                          color:isLate?C.lateRed:isMild?'#D68910':C.green }}>
                          ({fmtDiff(sd)}{isLate?' ⚠️ LATE':''})
                        </span>}
                      </span>}
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
  const fileRef = useRef()
  const [selDate,   setSelDate]   = useState(today())
  const [dupDate,   setDupDate]   = useState(() => {
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
      setPreview([]); setErrors([]); setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) { setErrors([err.message]) }
    setUploading(false)
  }

  // Duplicate today's tasks to another date
  const handleDuplicate = async () => {
    if (!dupDate) return
    setDupLoading(true); setDupResult('')
    try {
      const snap = await getDocs(query(collection(db,'tasks'), where('date','==',selDate)))
      if (snap.empty) { setDupResult('❌ No tasks found for source date'); setDupLoading(false); return }
      const batch = writeBatch(db)
      let count = 0
      snap.docs.forEach(d => {
        const t = d.data()
        const makeId = (staffId, date, taskText) => {
          const safe = taskText.replace(/[^a-zA-Z0-9]/g,'').slice(0,14) || Math.random().toString(36).slice(2,10)
          return `${staffId}_${date}_${safe}`
        }
        const newTask = { ...t, date: dupDate, id: makeId(t.staffId, dupDate, t.task), createdAt: new Date().toISOString() }
        batch.set(doc(db,'tasks', newTask.id), newTask)
        count++
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

  const updatePreviewRow = (idx, field, val) => {
    setPreview(prev => prev.map((t,i) => i===idx ? {...t,[field]:val} : t))
  }

  const removePreviewRow = idx => setPreview(prev => prev.filter((_,i) => i!==idx))

  const addBlankRow = () => {
    setPreview(prev => [...prev, {
      id: uid(), staffId: '', staffName: '', date: selDate,
      task: '', startTime: '', type: 'normal', substitute: false, remarks: '', createdAt: new Date().toISOString()
    }])
  }

  return (
    <div>
      {/* Source date */}
      <Card style={{ marginBottom: 12, padding: '14px 16px' }}>
        <label style={{ fontSize:12,color:C.muted,fontWeight:600,display:'block',marginBottom:6 }}>SOURCE / UPLOAD DATE</label>
        <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{
          width:'100%',border:`1.5px solid ${C.border}`,borderRadius:10,
          padding:'11px 14px',fontSize:15,color:C.text,background:C.bg }} />
      </Card>

      {/* ── DUPLICATE DAY ── */}
      <Card style={{ marginBottom: 12, padding:'14px 16px', background:'#F0FFF4', border:`1px solid ${C.green}44` }}>
        <div style={{ fontWeight:700,marginBottom:6,color:C.green }}>📋 நாள் நகலெடு (Duplicate Day's Tasks)</div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:10 }}>
          Copy all tasks from <b>{fmtDate(selDate)}</b> to another date. Staff assignments and task types are preserved.
        </div>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end' }}>
          <div style={{ flex:1,minWidth:140 }}>
            <label style={{ fontSize:11,color:C.muted,fontWeight:600,display:'block',marginBottom:4 }}>COPY TO DATE</label>
            <input type="date" value={dupDate} onChange={e=>setDupDate(e.target.value)} style={{
              width:'100%',border:`1.5px solid ${C.border}`,borderRadius:10,
              padding:'9px 10px',fontSize:14,color:C.text,background:C.bg }} />
          </div>
          <Btn variant="green" onClick={handleDuplicate} disabled={dupLoading||!dupDate}>
            {dupLoading ? 'Copying…' : `📋 Copy to ${dupDate ? fmtDate(dupDate) : '—'}`}
          </Btn>
        </div>
        {dupResult && (
          <div style={{ marginTop:10,padding:'8px 12px',borderRadius:8,
            background: dupResult.startsWith('✅')?'#D5F5E3':'#FADBD8',
            color: dupResult.startsWith('✅')?C.green:C.lateRed,fontWeight:600,fontSize:13 }}>
            {dupResult}
          </div>
        )}
      </Card>

      {/* ── DOWNLOAD TEMPLATE ── */}
      <Card style={{ marginBottom: 12, padding:'14px 16px', background:'#EEF6FF', border:`1px solid ${C.voice}33` }}>
        <div style={{ fontWeight:700,marginBottom:6 }}>📥 Excel Template (with your staff names)</div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:10 }}>
          Downloads template with <b>{staffList.length} staff</b> pre-loaded in dropdown. Task Master has 57 Tamil tasks.
        </div>
        <Btn variant="blue" small onClick={() => downloadTemplateWithStaff(staffList)}>
          ⬇ Download Template with Staff
        </Btn>
      </Card>

      {/* ── FILE UPLOAD ── */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontWeight:700,fontSize:13,marginBottom:10 }}>📤 Upload Excel for {fmtDate(selDate)}</div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} id="excel-upload" />
        <label htmlFor="excel-upload" style={{
          display:'block',border:`2px dashed ${C.border}`,borderRadius:12,
          padding:'24px 16px',textAlign:'center',cursor:'pointer',background:C.row,marginBottom:12 }}>
          <div style={{ fontSize:32,marginBottom:6 }}>📤</div>
          <div style={{ fontWeight:700,color:C.text }}>{fileName || 'Click to select Excel file'}</div>
          <div style={{ fontSize:12,color:C.muted,marginTop:4 }}>.xlsx or .xls</div>
        </label>

        {errors.length > 0 && (
          <div style={{ background:'#FFF0F0',borderRadius:8,padding:12,marginBottom:10 }}>
            <div style={{ fontWeight:700,color:C.lateRed,marginBottom:4 }}>Errors:</div>
            {errors.map((e,i) => <div key={i} style={{ fontSize:12,color:C.lateRed }}>• {e}</div>)}
          </div>
        )}

        {success && (
          <div style={{ background:'#F0FFF4',borderRadius:8,padding:12,marginBottom:10,
            color:C.green,fontWeight:600 }}>{success}</div>
        )}

        {/* Editable preview */}
        {preview.length > 0 && (
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <div style={{ fontWeight:700,fontSize:13 }}>Preview — {preview.length} tasks for {fmtDate(selDate)}</div>
              <Btn small variant="ghost" onClick={addBlankRow}>+ Add Row</Btn>
            </div>
            <div style={{ maxHeight:340,overflowY:'auto',marginBottom:12 }}>
              {preview.map((t,i) => (
                <div key={i} style={{ padding:'8px 6px',borderBottom:`1px solid ${C.border}`,
                  background: editRow===i ? '#FFFBE6' : i%2===0?C.bg:C.row }}>
                  {editRow === i ? (
                    // Edit mode
                    <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                      <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                        <select value={t.staffId} onChange={e=>{
                          const s=staffList.find(x=>x.id===e.target.value)
                          updatePreviewRow(i,'staffId',e.target.value)
                          updatePreviewRow(i,'staffName',s?.name||'')
                        }} style={{ flex:1,border:`1px solid ${C.border}`,borderRadius:8,
                          padding:'6px 8px',fontSize:12,background:C.bg }}>
                          <option value="">Select staff</option>
                          {staffList.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="time" value={t.startTime}
                          onChange={e=>updatePreviewRow(i,'startTime',e.target.value)}
                          style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:12,background:C.bg }} />
                        <select value={t.type} onChange={e=>updatePreviewRow(i,'type',e.target.value)}
                          style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:12,background:C.bg }}>
                          <option value="normal">normal</option>
                          <option value="critical">critical</option>
                        </select>
                      </div>
                      <input value={t.task} onChange={e=>updatePreviewRow(i,'task',e.target.value)}
                        placeholder="Task description"
                        style={{ border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',
                          fontSize:13,background:C.bg,width:'100%',boxSizing:'border-box' }} />
                      <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                        <label style={{ fontSize:12,display:'flex',alignItems:'center',gap:4 }}>
                          <input type="checkbox" checked={t.substitute}
                            onChange={e=>updatePreviewRow(i,'substitute',e.target.checked)} />
                          Substitute
                        </label>
                        <input value={t.remarks||''} onChange={e=>updatePreviewRow(i,'remarks',e.target.value)}
                          placeholder="Remarks"
                          style={{ flex:1,border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 8px',fontSize:12,background:C.bg }} />
                        <Btn small variant="green" onClick={()=>setEditRow(null)}>✓</Btn>
                        <Btn small variant="danger" onClick={()=>{removePreviewRow(i);setEditRow(null)}}>🗑</Btn>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                      <span style={{
                        background:(t.type==='critical'?C.critical:C.normal)+'22',
                        color:t.type==='critical'?C.critical:C.normal,
                        borderRadius:5,padding:'1px 6px',fontSize:10,fontWeight:700,flexShrink:0 }}>
                        {t.type==='critical'?'⚡':'●'}
                      </span>
                      <span style={{ flex:1,fontSize:13 }}>
                        <b>{t.staffName||'—'}</b> — {t.task||<i style={{color:C.muted}}>no task</i>}
                      </span>
                      <span style={{ color:C.muted,fontSize:11,flexShrink:0 }}>{t.startTime}</span>
                      {t.substitute && <Badge color={C.absent} small>sub</Badge>}
                      <button onClick={()=>setEditRow(i)} style={{
                        background:'transparent',border:`1px solid ${C.border}`,
                        borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11 }}>✏️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <Btn full variant="green" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading…' : `✅ Upload ${preview.length} Tasks to ${fmtDate(selDate)}`}
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Clear day */}
      <Card style={{ border:`1px solid ${C.lateRed}33` }}>
        <div style={{ fontWeight:700,color:C.lateRed,marginBottom:6 }}>⚠️ Clear Day's Tasks</div>
        <div style={{ fontSize:13,color:C.muted,marginBottom:10 }}>
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
  const [name,setName]=useState(''); const [phone,setPhone]=useState('+91'); const [role,setRole]=useState('')
  const [saving,setSaving]=useState(false); const [editId,setEditId]=useState(null); const [ef,setEf]=useState({})

  const add = async () => {
    if (!name.trim()) return; setSaving(true)
    const id=uid(), color=AVATAR_COLORS[staffList.length%AVATAR_COLORS.length]
    await setDoc(doc(db,'staff',id),{ name:name.trim(),phone:phone.trim(),role:role.trim()||'Staff',
      color,active:true,createdAt:new Date().toISOString() })
    setName(''); setPhone('+91'); setRole(''); setSaving(false)
  }
  const del = async id => { if(!confirm('Delete this staff member?'))return; await deleteDoc(doc(db,'staff',id)) }
  const saveEdit = async () => { await setDoc(doc(db,'staff',editId),ef,{merge:true}); setEditId(null) }

  return (
    <div>
      <SectionHead>Add Staff Member</SectionHead>
      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <Inp value={name} onChange={setName} placeholder="Full name (Tamil or English)" />
          <Inp value={phone} onChange={setPhone} placeholder="+91 98765 43210" type="tel" inputMode="tel" />
          <Inp value={role} onChange={setRole} placeholder="Role (e.g. Head Cook, Supervisor)" />
          <Btn full onClick={add} disabled={saving||!name.trim()}>{saving?'Saving…':'+ Add Staff'}</Btn>
        </div>
      </Card>

      <SectionHead>Staff List ({staffList.length})</SectionHead>
      {staffList.length===0 && <p style={{ color:C.muted,textAlign:'center',marginTop:24 }}>No staff added.</p>}
      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {staffList.map(s => (
          <Card key={s.id} style={{ padding:'13px 16px' }}>
            {editId===s.id ? (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                <Inp value={ef.name||''} onChange={v=>setEf(f=>({...f,name:v}))} placeholder="Name" />
                <Inp value={ef.phone||''} onChange={v=>setEf(f=>({...f,phone:v}))} placeholder="Phone" />
                <Inp value={ef.role||''} onChange={v=>setEf(f=>({...f,role:v}))} placeholder="Role" />
                <div style={{ display:'flex',gap:8 }}>
                  <Btn small variant="green" onClick={saveEdit}>Save</Btn>
                  <Btn small variant="ghost" onClick={()=>setEditId(null)}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <Avatar name={s.name} color={s.color||C.primary} />
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
export default function AdminApp() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState(TABS.UPLOAD)
  const [staffList, setStaffList] = useState([])

  useEffect(() => onSnapshot(collection(db,'staff'), snap => {
    setStaffList(snap.docs.map(d=>({id:d.id,...d.data()})))
  }), [])

  return (
    <div style={{ minHeight:'100vh',background:C.bg,paddingBottom:70 }}>
      <TopNav tab={tab} setTab={setTab} onLogout={logout} user={user} />
      <div style={{ maxWidth:780,margin:'0 auto',padding:'18px 14px 40px' }}>
        {tab===TABS.MONITOR && <MonitorTab staffList={staffList} />}
        {tab===TABS.UPLOAD  && <UploadTab  staffList={staffList} />}
        {tab===TABS.STAFF   && <StaffTab   staffList={staffList} />}
      </div>

      {/* Mobile bottom nav */}
      <div style={{ position:'fixed',bottom:0,left:0,right:0,background:'#fff',
        borderTop:`2px solid ${C.border}`,display:'flex',zIndex:100 }}>
        {[{id:TABS.MONITOR,icon:'📊',label:'Monitor'},{id:TABS.UPLOAD,icon:'📤',label:'Upload'},{id:TABS.STAFF,icon:'👥',label:'Staff'}].map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1,padding:'10px 4px',border:'none',cursor:'pointer',background:'transparent',
            fontWeight:700,fontSize:11,color:tab===n.id?C.primary:C.muted,
            borderTop:tab===n.id?`3px solid ${C.primary}`:'3px solid transparent',
            display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
            <span style={{ fontSize:18 }}>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <button onClick={logout} style={{ flex:1,padding:'10px 4px',border:'none',cursor:'pointer',
          background:'transparent',fontSize:11,color:C.muted,
          display:'flex',flexDirection:'column',alignItems:'center',gap:2 }}>
          <span style={{ fontSize:18 }}>🚪</span><span>Logout</span>
        </button>
      </div>
    </div>
  )
}

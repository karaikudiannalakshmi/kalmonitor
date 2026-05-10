// src/utils/masterSchedule.js
import * as XLSX from 'xlsx'

const norm = s => (s || '').toString().trim().toLowerCase()

const makeId = (staffId, date, taskText) => {
  const safe = taskText.replace(/[^a-zA-Z0-9]/g,'').slice(0,14) || Math.random().toString(36).slice(2,10)
  return `${staffId}_${date}_${safe}`
}

function parseTime(val) {
  if (!val) return ''
  if (typeof val === 'number') {
    const totalMins = Math.round(val * 24 * 60)
    const h = Math.floor(totalMins / 60), m = totalMins % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }
  const s = val.toString().trim()
  if (/^\d{1,2}:\d{2}/.test(s)) return s.slice(0,5).padStart(5,'0')
  return s
}

export async function parseMasterSchedule(file, staffList) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        let headerIdx = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const j = rows[i].join(' ').toLowerCase()
          if (j.includes('staff') || j.includes('பணியாளர்') || j.includes('பணி')) { headerIdx = i; break }
        }

        const headers = rows[headerIdx]
        const findCol = (matchers) => {
          for (let i = 0; i < headers.length; i++) {
            const h = norm(headers[i])
            if (matchers.some(m => h.includes(m) || m.includes(h))) return i
          }
          return -1
        }

        const cStaff  = findCol(['பணியாளர்','staff name','name'])
        const cTask   = findCol(['பணி விவரம்','task','பணி'])
        const cTime   = findCol(['நேரம்','time','start','தொடக்க','usual'])
        const cType   = findCol(['வகை','type'])
        const cActive = findCol(['செயல்','active'])

        const nameMap = {}
        staffList.forEach(s => { nameMap[norm(s.name)] = s })

        const tasks = [], errors = []

        rows.slice(headerIdx + 1).forEach((row, idx) => {
          if (row.every(c => !c)) return
          const staffName = (row[cStaff] || '').toString().trim()
          const staffObj  = nameMap[norm(staffName)]
          if (!staffName) return
          if (!staffObj) { errors.push(`வரி ${idx+headerIdx+2}: "${staffName}" கிடைக்கவில்லை`); return }

          const taskText = (row[cTask] || '').toString().trim()
          if (!taskText) return

          const activeVal = cActive >= 0 ? norm(row[cActive]) : 'yes'
          if (activeVal === 'no') return

          const typeRaw = cType >= 0 ? norm(row[cType]) : 'normal'
          const ttype   = typeRaw.includes('critical') ? 'critical' : 'normal'
          const time    = cTime >= 0 ? parseTime(row[cTime]) : ''

          tasks.push({ staffId: staffObj.id, staffName: staffObj.name, task: taskText, startTime: time, type: ttype, substitute: false, remarks: '' })
        })

        resolve({ tasks, errors })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('கோப்பை படிக்க முடியவில்லை'))
    reader.readAsArrayBuffer(file)
  })
}

export function generateDailyTasks(masterTasks, date) {
  return masterTasks.map(t => ({
    ...t, id: makeId(t.staffId, date, t.task), date, createdAt: new Date().toISOString(),
  }))
}

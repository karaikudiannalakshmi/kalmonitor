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

        // Build name map from Firestore staff list
        const nameMap = {}
        staffList.forEach(s => { nameMap[norm(s.name)] = s })

        const tasks = [], errors = []

        // Scan every row — if col A matches a staff name, treat it as a task row
        // This skips ALL header/title rows automatically regardless of structure
        rows.forEach((row, idx) => {
          const staffName = (row[0] || '').toString().trim()
          if (!staffName) return

          const staffObj = nameMap[norm(staffName)]
          if (!staffObj) return // silently skip non-staff rows (headers, titles)

          // Fixed column positions: A=staff, B=task, C=time, D=type, E=active
          const taskText  = (row[1] || '').toString().trim()
          const timeVal   = row[2]
          const typeRaw   = norm(row[3] || 'normal')
          const activeRaw = norm(row[4] || 'yes')

          if (!taskText) return
          if (activeRaw === 'no') return

          const ttype = typeRaw.includes('critical') ? 'critical' : 'normal'
          const time  = parseTime(timeVal)

          tasks.push({
            staffId:    staffObj.id,
            staffName:  staffObj.name,
            task:       taskText,
            startTime:  time,
            type:       ttype,
            substitute: false,
            remarks:    '',
          })
        })

        if (tasks.length === 0) {
          errors.push(
            `No tasks found. Make sure column A has staff names exactly matching: ` +
            staffList.map(s => s.name).join(', ')
          )
        }

        resolve({ tasks, errors })
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('கோப்பை படிக்க முடியவில்லை'))
    reader.readAsArrayBuffer(file)
  })
}

export function generateDailyTasks(masterTasks, date) {
  return masterTasks.map(t => ({
    ...t,
    id:        makeId(t.staffId, date, t.task),
    date,
    createdAt: new Date().toISOString(),
  }))
}

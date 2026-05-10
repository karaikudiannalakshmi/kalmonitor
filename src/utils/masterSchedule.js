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
        staffList.forEach(s => {
          nameMap[norm(s.name)] = s
        })

        const tasks = [], errors = []

        // Find the actual data start row — look for first row where
        // col A matches a known staff name
        let dataStart = -1
        for (let i = 0; i < rows.length; i++) {
          const cellA = norm(rows[i][0] || '')
          if (nameMap[cellA]) { dataStart = i; break }
        }

        if (dataStart === -1) {
          // No staff name found — report which names were tried
          const tried = rows.slice(0,8).map(r => `"${r[0]}"`)
          reject(new Error(
            `Staff names not found. File column A has: ${tried.join(', ')}. ` +
            `App staff are: ${staffList.map(s=>s.name).join(', ')}`
          ))
          return
        }

        // Find column positions from header row just above data
        // Or use fixed positions: A=staff, B=task, C=time, D=type, E=active
        const headerRow = dataStart > 0 ? rows[dataStart - 1] : []
        const findCol = (matchers) => {
          for (let i = 0; i < headerRow.length; i++) {
            const h = norm(headerRow[i])
            if (matchers.some(m => h.includes(m))) return i
          }
          return -1
        }

        // Try to detect columns from header, fall back to fixed positions
        const cStaff  = Math.max(0, findCol(['staff','பணியாளர்']))
        const cTask   = findCol(['task','பணி விவரம்','பணி']) !== -1
                        ? findCol(['task','பணி விவரம்','பணி']) : 1
        const cTime   = findCol(['நேரம்','time','start','usual']) !== -1
                        ? findCol(['நேரம்','time','start','usual']) : 2
        const cType   = findCol(['வகை','type']) !== -1
                        ? findCol(['வகை','type']) : 3
        const cActive = findCol(['செயல்','active']) !== -1
                        ? findCol(['செயல்','active']) : 4

        rows.slice(dataStart).forEach((row, idx) => {
          if (row.every(c => !c)) return

          const staffName = (row[cStaff] || '').toString().trim()
          const staffObj  = nameMap[norm(staffName)]

          if (!staffName) return
          if (!staffObj) {
            errors.push(`வரி ${idx + dataStart + 1}: "${staffName}" — app-ல் இல்லை`)
            return
          }

          const taskText = (row[cTask] || '').toString().trim()
          if (!taskText) return

          const activeVal = cActive >= 0 ? norm(row[cActive]) : 'yes'
          if (activeVal === 'no') return

          const typeRaw = norm(row[cType] || 'normal')
          const ttype   = typeRaw.includes('critical') ? 'critical' : 'normal'
          const time    = parseTime(row[cTime])

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

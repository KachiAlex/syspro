# Smart Attendance System - Comprehensive Guide

## Overview

The Smart Attendance System replaces traditional binary "present/absent" tracking with an intelligent, multi-signal approach that measures:

1. **Presence** - Actual work time via check-in/out and activity
2. **Mode of Work** - How employee is working (ONSITE, REMOTE, HYBRID, FIELD, LEAVE, TRAINING)
3. **Contribution Confidence** - Weighted score based on multiple signals (0-100)
4. **Compliance** - Payroll-ready attendance metrics for HR/Finance

## Core Concepts

### Work Modes

Each employee has one work mode per day:

| Mode | Description | Use Case |
|------|-------------|----------|
| ONSITE | Working from office | Traditional office work |
| REMOTE | Working from home | Fully distributed teams |
| HYBRID | Mix of office and remote | Flexible arrangements |
| FIELD | On-site client work, fieldwork | Sales, support, operations |
| LEAVE | Approved time off | PTO, sick leave |
| TRAINING | LMS/professional development | Courses, certifications |

### Attendance Confidence Score (ACS)

Instead of binary present/absent, the system calculates a 0-100 score based on weighted signals:

```
ACS = (
  (checkIn ? 30 : 0) +
  (taskActivityScore * 25) +
  (timeLoggedScore * 25) +
  (communicationScore * 10) +
  (trainingScore * 10)
)
```

**Thresholds (configurable per tenant):**
- **>= 70** → **PRESENT** (confident)
- **40-69** → **PRESENT (Low Confidence)** (needs review)
- **< 40** → **ABSENT** (insufficient signals)

### Attendance Signal Types

#### Explicit Signals (User-Driven)
- Daily check-in (web/mobile) - 30 points
- Daily check-out
- Weekly availability confirmation
- Shift confirmation
- Manager override

#### Implicit Signals (System-Driven)
- **Task Updates** (Project Module) - 25 points
  - Task completion, status changes
  - Number of tasks worked on
  
- **Time Logs** (Project Module) - 25 points
  - Hours logged against tasks
  - Compared against 8-hour workday
  
- **Meetings Attended** - 10 points
  - Calendar events attended
  - Communication indicator
  
- **LMS Activity** (Training Module) - 10 points
  - Course participation
  - Training day verification

## Data Models

### AttendanceRecord
```typescript
{
  id: UUID
  tenantId: UUID              // Multi-tenant safety
  employeeId: UUID
  departmentId: UUID
  branchId: UUID
  workDate: DATE              // YYYY-MM-DD
  workMode: WorkMode          // ONSITE | REMOTE | HYBRID | FIELD | LEAVE | TRAINING
  
  confidenceScore: 0-100      // Calculated ACS
  attendanceStatus: Status    // PRESENT | PRESENT_LOW_CONFIDENCE | ABSENT | ON_LEAVE | TRAINING
  
  checkInTime: TIMESTAMP
  checkOutTime: TIMESTAMP
  shiftConfirmed: BOOLEAN
  
  // Activity metrics from implicit signals
  taskActivityCount: INTEGER
  timeLoggedHours: DECIMAL
  meetingsAttended: INTEGER
  lmsActivityScore: 0-100
  
  // Manager corrections
  isOverride: BOOLEAN
  overrideReason: TEXT
  overrideByUserId: UUID
  managerNotes: TEXT
}
```

### AttendancePolicy
```typescript
{
  id: UUID
  tenantId: UUID
  name: STRING
  
  // Configurable thresholds
  presentThreshold: 70        // >= this = PRESENT
  lowConfidenceThreshold: 40  // >= this = PRESENT_LOW_CONFIDENCE
  
  // Configurable scoring weights (sum = 100)
  checkInWeight: 30
  taskActivityWeight: 25
  timeLoggedWeight: 25
  meetingsWeight: 10
  trainingWeight: 10
  
  // Configuration flags
  requiresCheckIn: BOOLEAN
  allowsLateCheckIn: BOOLEAN
  lateCheckInWindowMinutes: 30
  requiresShiftConfirmation: BOOLEAN
  requiresWeeklyAvailabilityConfirmation: BOOLEAN
}
```

### AttendanceOverrideLog (Audit Trail)
```typescript
{
  id: UUID
  tenantId: UUID
  attendanceRecordId: UUID
  
  overriddenByUserId: UUID
  overrideTimestamp: TIMESTAMP
  
  previousStatus: AttendanceStatus
  newStatus: AttendanceStatus
  previousConfidenceScore: DECIMAL
  newConfidenceScore: DECIMAL
  
  reason: TEXT
  notes: TEXT
}
```

## API Endpoints

### Attendance Records

#### GET /api/attendance
**Query Parameters:**
- `action`: 'today' | 'weekly' | 'monthly' | 'anomalies'
- `tenantSlug`: Required
- `employeeId`: Optional
- `workDate`: For single day queries
- `startDate`, `endDate`: For range queries
- `departmentId`: Optional

**Examples:**
```bash
# Today's attendance
GET /api/attendance?action=today&tenantSlug=acme&employeeId=emp123

# Weekly summary
GET /api/attendance?action=weekly&tenantSlug=acme&startDate=2026-02-01&endDate=2026-02-07&employeeId=emp123

# Monthly compliance (for payroll)
GET /api/attendance?action=monthly&tenantSlug=acme&startDate=2026-02-01&endDate=2026-02-28

# Anomaly detection
GET /api/attendance?action=anomalies&tenantSlug=acme&employeeId=emp123
```

#### POST /api/attendance
**Actions:**
- `check-in` - Record check-in time and initialize record
- `check-out` - Record check-out time
- `set-mode` - Update work mode
- `override` - Manual correction by manager

**Example (Check-in):**
```json
{
  "action": "check-in",
  "tenantSlug": "acme",
  "employeeId": "emp123",
  "workDate": "2026-02-05",
  "workMode": "REMOTE"
}
```

#### PUT /api/attendance
**Update attendance signals:** task activity, time logs, meetings, LMS activity

```json
{
  "tenantSlug": "acme",
  "employeeId": "emp123",
  "workDate": "2026-02-05",
  "signalType": "TASK_UPDATE",
  "signalData": { "count": 5 }
}
```

### Policies

#### GET /api/attendance/policies
**Query Parameters:**
- `tenantSlug`: Required
- `policyId`: Optional

#### POST /api/attendance/policies
Create new attendance policy for tenant

#### PUT /api/attendance/policies
Update policy thresholds and weights

#### DELETE /api/attendance/policies
Remove policy

## UI Components

### Employee Dashboard
**Features:**
- One-click check-in / check-out buttons
- Work mode selector
- Real-time confidence meter (0-100%)
- Activity summary:
  - Tasks completed today
  - Hours logged
  - Meetings attended
- Attendance flags (alerts)
- Last 7 days history table
- Personal attendance trends

**Location:** `src/components/employee-attendance-dashboard.tsx`

### Manager Dashboard
**Features:**
- Team attendance overview metrics
  - Team size, present/absent count
  - Average confidence score
- Work mode distribution chart
- Team attendance table with filtering:
  - By work mode
  - By confidence level
  - By date range
- Confidence progress bars (visual)
- Anomaly alerts (high-priority)
  - Hybrid abuse detection
  - Low contribution trends
  - Excessive absences
  - Irregular patterns
- Team insights
  - Hybrid attendance ratio
  - Low confidence count
  - Flagged anomalies

**Location:** `src/components/manager-attendance-dashboard.tsx`

### HR Dashboard (Coming Next)
**Features:**
- Global attendance analytics
- Hybrid vs onsite distribution
- Compliance reporting
- Payroll export (CSV/Excel)
- Policy configuration
- Department/branch comparisons

## Anomaly Detection

System automatically detects:

1. **Hybrid Abuse** (Medium Severity)
   - Claiming hybrid mode but < 40 confidence
   - Indicates minimal work on hybrid days
   - Manager review required

2. **Low Contribution** (High Severity)
   - Average ACS < threshold over period
   - Indicates productivity or engagement issues
   - May be legit (medical, personal issues)

3. **Excessive Absences** (High Severity)
   - > 20% absent days in period
   - Requires HR follow-up
   - Exclude leave/training days from calculation

4. **Irregular Patterns** (Low Severity)
   - Sudden drops in confidence score
   - May indicate illness, change in schedule
   - Monitor for trends

## Integration Points

### Projects Module
- **Task Updates** → Feed to ACS calculation
- **Time Logs** → Record hours for confidence score
- **Task Completion** → Activity signal

**Implementation:**
When task activity or time log occurs in projects module:
```typescript
// Update attendance record
PUT /api/attendance {
  tenantSlug,
  employeeId,
  workDate,
  signalType: 'TASK_UPDATE' | 'TIME_LOG',
  signalData: { count: 5, hours: 6.5 }
}
```

### Payroll Module
- **Monthly Compliance Data** → Import to payroll calculation
- **Leave Days** → Exclude from presence calculation
- **Payroll-Ready Status** → Flag records ready for processing

**Export Format:**
```json
{
  "month": "2026-02",
  "employeeId": "emp123",
  "totalWorkDays": 20,
  "presentDays": 19,
  "absentDays": 1,
  "leaveDays": 0,
  "trainingDays": 0,
  "compliancePercentage": 95.0,
  "averageConfidence": 75.5,
  "payrollReady": true
}
```

## Configuration Per Tenant

Each tenant can customize:

1. **Confidence Thresholds**
   - Present threshold (default 70)
   - Low confidence threshold (default 40)

2. **Scoring Weights**
   - Check-in weight (default 30%)
   - Task activity weight (default 25%)
   - Time logged weight (default 25%)
   - Meetings weight (default 10%)
   - Training weight (default 10%)

3. **Policies**
   - Check-in requirement
   - Late check-in window (minutes)
   - Shift confirmation requirement
   - Weekly availability confirmation

**Example:**
```json
POST /api/attendance/policies {
  "tenantSlug": "acme",
  "name": "Manufacturing Floor",
  "presentThreshold": 75,
  "lowConfidenceThreshold": 50,
  "checkInWeight": 40,
  "taskActivityWeight": 20,
  "timeLoggedWeight": 20,
  "meetingsWeight": 10,
  "trainingWeight": 10,
  "requiresCheckIn": true,
  "allowsLateCheckIn": false
}
```

## Multi-Tenant Safety

All queries include `tenantId` filtering:

```typescript
// Safe: Only returns records for specific tenant
SELECT * FROM attendance_records 
WHERE tenant_id = $1 AND work_date = $2

// Safe: Department scoped to tenant
SELECT * FROM attendance_records 
WHERE tenant_id = $1 AND department_id = $2
```

## Calculation Algorithm Details

### Task Activity Score (0-100)
```
Assumes 5+ tasks/day = 100 points
Linear scaling: each task = 20 points
Example: 3 tasks = 60 points
```

### Time Logged Score (0-100)
```
Assumes 8-hour workday = 100 points
< 2 hours = 0 points (insufficient work)
Linear scaling between 2-8 hours
Example: 6 hours = 75 points
```

### Meeting Score (0-100)
```
Assumes 3+ meetings = 100 points
Indicates communication and collaboration
Example: 2 meetings = 66 points
```

### Training Score (0-100)
```
Direct input from LMS
0-100 scale for course progress
```

## Development Status

✅ **Completed (Phase 1):**
- Database schema
- Core calculation engine
- API endpoints
- Employee dashboard
- Manager dashboard
- Anomaly detection

🚧 **In Progress:**
- HR dashboard
- CSV/Excel export
- LMS integration
- Calendar integration

📋 **Planned:**
- Notification system
- Approval workflows
- Historical trend analysis
- Predictive analytics
- Mobile app

## Testing the System

### 1. Employee Check-in
```bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check-in",
    "tenantSlug": "acme",
    "employeeId": "emp123",
    "workDate": "2026-02-05",
    "workMode": "REMOTE"
  }'
```

### 2. Update Task Activity
```bash
curl -X PUT http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "acme",
    "employeeId": "emp123",
    "workDate": "2026-02-05",
    "signalType": "TASK_UPDATE",
    "signalData": { "count": 5 }
  }'
```

### 3. Get Today's Attendance
```bash
curl http://localhost:3000/api/attendance?action=today&tenantSlug=acme
```

### 4. Detect Anomalies
```bash
curl http://localhost:3000/api/attendance?action=anomalies&tenantSlug=acme&employeeId=emp123
```

## Benefits Over Traditional Systems

| Feature | Traditional | Smart System |
|---------|------------|--------------|
| Tracking | Binary (in/out) | Multi-signal, confidence-based |
| Fairness | Rigid | Flexible, rewards contribution |
| Remote Work | Poor visibility | Strong signals (tasks, time logs) |
| Hybrid Abuse | No detection | Automatic anomaly detection |
| Payroll | Manual | Automated compliance export |
| Manager Insight | Limited | Team heatmaps, anomalies |
| Integration | Standalone | Projects, LMS, Calendar, Payroll |
| Customization | Fixed | Configurable per tenant |

## Next Steps

1. **HR Dashboard** - Global analytics, exports
2. **LMS Integration** - Training day verification
3. **Calendar Integration** - Meeting attendance auto-sync
4. **Payroll Integration** - Auto-import compliance data
5. **Mobile App** - Check-in from phone
6. **Notifications** - Attendance alerts
7. **Analytics** - Trends, predictions

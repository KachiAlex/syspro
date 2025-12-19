import { useState } from 'react'
import { useMeteringUsage, useRecordMeterEvent } from '../hooks/useMetering'

export function MeteringConsole() {
  const { data: usage, isLoading } = useMeteringUsage()
  const recordEvent = useRecordMeterEvent()
  const [eventType, setEventType] = useState('sms.sent')
  const [value, setValue] = useState(1)

  const handleRecordEvent = async () => {
    await recordEvent.mutateAsync({
      eventType,
      value,
    })
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Metering Console</h1>
        <p className="text-gray-600 mt-1">View and manage usage metrics</p>
      </div>

      {/* Manual Event Recording (Dev) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Event (Dev)</h2>
        <div className="flex items-end space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(parseInt(e.target.value) || 1)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleRecordEvent}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Record
          </button>
        </div>
      </div>

      {/* Usage Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Period Usage</h2>
        <div className="space-y-4">
          {usage?.map((item: any) => (
            <div
              key={item.eventType}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-md"
            >
              <div>
                <p className="font-medium text-gray-900">{item.eventType}</p>
                <p className="text-sm text-gray-600">
                  {item.count} events • Total: {item.totalValue}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">{item.totalValue}</p>
                <p className="text-xs text-gray-600">units</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


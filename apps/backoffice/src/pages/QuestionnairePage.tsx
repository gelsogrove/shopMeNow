import { useEffect, useState } from 'react'
import { api } from '@/services/api'

interface QuestionnaireRecord {
  id: string
  createdAt: string
  // Contact (optional)
  fullName: string | null
  email: string | null
  phone: string | null
  company: string | null
  wantsContact: boolean
  // v2 fields
  stepHumanSupport: string | null
  stepPushMarketing: string | null
  stepWidget: string | null
  stepSalesAgents: string | null
  stepEcommerce: string | null
  stepEcommercePlatform: string | null
  stepPrivacy: string | null
  stepHelpful: string | null
  stepOther: string | null
  // v1 legacy fields
  stepChannel: string | null
  stepTimeSaving: string | null
  stepDocuments: string | null
  stepIntegration: string | null
  stepHandoff: string | null
  stepMarketing: string | null
  status: string
  adminNotes: string | null
}

const V2_STEP_LABELS: Record<string, string> = {
  stepHumanSupport: 'Human support',
  stepPushMarketing: 'Push marketing',
  stepWidget: 'Widget',
  stepSalesAgents: 'Sales agents',
  stepEcommerce: 'E-commerce',
  stepEcommercePlatform: 'Platform',
  stepPrivacy: 'Privacy',
  stepHelpful: 'Will it help?',
  stepOther: 'Other notes',
}

const V1_STEP_LABELS: Record<string, string> = {
  stepChannel: 'Channel preference (v1)',
  stepTimeSaving: 'Time saving goal (v1)',
  stepDocuments: 'Document management (v1)',
  stepIntegration: 'Live integrations (v1)',
  stepHandoff: 'Human handoff (v1)',
  stepMarketing: 'AI marketing (v1)',
}

type Filter = 'ALL' | 'NEW' | 'VIEWED'

export default function QuestionnairePage() {
  const [records, setRecords] = useState<QuestionnaireRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadRecords()
  }, [])

  async function loadRecords() {
    setLoading(true)
    setError('')
    const res = await api.questionnaire.getAll()
    if (res.success && res.data) {
      setRecords(res.data as QuestionnaireRecord[])
    } else {
      setError(res.error || 'Failed to load records')
    }
    setLoading(false)
  }

  async function handleMarkViewed(id: string) {
    const res = await api.questionnaire.markViewed(id)
    if (res.success) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'VIEWED' } : r))
      )
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this questionnaire response? This cannot be undone.')) return
    setDeletingId(id)
    const res = await api.questionnaire.delete(id)
    setDeletingId(null)
    if (res.success) {
      setRecords((prev) => prev.filter((r) => r.id !== id))
      if (expanded === id) setExpanded(null)
    }
  }

  const filtered = records.filter((r) => filter === 'ALL' || r.status === filter)
  const newCount = records.filter((r) => r.status === 'NEW').length

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Questionnaire Responses</h1>
          {newCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {newCount} NEW
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['ALL', 'NEW', 'VIEWED'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-16 text-gray-500">Loading…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No questionnaire responses found.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Row */}
              <div
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === record.id ? null : record.id)}
              >
                {/* Status badge */}
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full self-start sm:self-auto ${
                    record.status === 'NEW'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {record.status}
                </span>

                {/* Contact consent indicator */}
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full self-start sm:self-auto ${
                    record.wantsContact
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {record.wantsContact ? '📞 Contact' : '🙏 No contact'}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {record.fullName || <span className="text-gray-400 italic">Anonymous</span>}
                  </div>
                  <div className="text-sm text-gray-500 truncate">{record.email || '—'}</div>
                </div>

                <div className="hidden md:block text-sm text-gray-500 shrink-0">
                  {record.phone || '—'}
                </div>

                <div className="hidden lg:block text-sm text-gray-500 shrink-0 max-w-[160px] truncate">
                  {record.company || '—'}
                </div>

                <div className="text-xs text-gray-400 shrink-0">
                  {new Date(record.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>

                {/* Expand indicator */}
                <span className="text-gray-400 text-sm shrink-0">
                  {expanded === record.id ? '▲' : '▼'}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded === record.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
                  {/* Contact info (only if wantsContact) */}
                  {record.wantsContact && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5">
                      <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
                        📞 Contact Information
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Name:</span> <span className="font-medium">{record.fullName || '—'}</span></div>
                        <div><span className="text-gray-500">Email:</span> <span className="font-medium">{record.email || '—'}</span></div>
                        <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{record.phone || '—'}</span></div>
                        <div><span className="text-gray-500">Company:</span> <span className="font-medium">{record.company || '—'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* v2 Step answers */}
                  {Object.entries(V2_STEP_LABELS).some(([key]) => record[key as keyof QuestionnaireRecord]) && (
                    <>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Questionnaire Answers
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-5">
                        {Object.entries(V2_STEP_LABELS).map(([key, label]) => {
                          const val = record[key as keyof QuestionnaireRecord] as string | null
                          if (!val) return null
                          return (
                            <div key={key}>
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                {label}
                              </span>
                              <p className="text-sm text-gray-800 mt-0.5">{val}</p>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* v1 legacy answers (if any) */}
                  {Object.entries(V1_STEP_LABELS).some(([key]) => record[key as keyof QuestionnaireRecord]) && (
                    <details className="mb-4">
                      <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer">
                        Legacy answers (v1)
                      </summary>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mt-3">
                        {Object.entries(V1_STEP_LABELS).map(([key, label]) => {
                          const val = record[key as keyof QuestionnaireRecord] as string | null
                          if (!val) return null
                          return (
                            <div key={key}>
                              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                {label}
                              </span>
                              <p className="text-sm text-gray-800 mt-0.5">{val}</p>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 flex-wrap mt-2">
                    {record.status === 'NEW' && (
                      <button
                        onClick={() => handleMarkViewed(record.id)}
                        className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                      >
                        ✓ Mark as Viewed
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(record.id) }}
                      disabled={deletingId === record.id}
                      className="bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {deletingId === record.id ? 'Deleting…' : '🗑 Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

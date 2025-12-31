/**
 * Schedulers Page - Manage Cron Jobs
 * 
 * Displays scheduler jobs with:
 * - Job name and status
 * - Last run time and duration
 * - Last status (SUCCESS, FAILED, RUNNING, NEVER_RUN, SKIPPED)
 * - Toggle to enable/disable for maintenance
 */

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { 
  Clock, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  LogOut,
  Timer,
  Calendar,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  XCircle
} from 'lucide-react'

interface SchedulerJob {
  id: string
  jobName: string
  isActive: boolean
  lastRunAt: string | null
  lastStatus: string
  lastError: string | null
  lastDuration: number | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

// Status badge colors and icons
const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  'SUCCESS': { 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: <CheckCircle className="h-3 w-3" />,
    label: 'Success'
  },
  'FAILED': { 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: <XCircle className="h-3 w-3" />,
    label: 'Failed'
  },
  'RUNNING': { 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: 'Running'
  },
  'NEVER_RUN': { 
    color: 'bg-gray-100 text-gray-600 border-gray-200', 
    icon: <Clock className="h-3 w-3" />,
    label: 'Never Run'
  },
  'SKIPPED': { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'Skipped'
  },
}

// Job name to friendly name mapping with schedule and detailed description
const jobNames: Record<string, { name: string; description: string; schedule: string; details: string; sortOrder: number }> = {
  'whatsapp-channel-queue': {
    name: 'WhatsApp Channel Queue',
    schedule: 'Every 5 seconds',
    description: 'Elabora la coda e invia i messaggi WhatsApp in attesa',
    details: 'Valida e invia i messaggi pendenti per i canali attivi. Applica controlli di sicurezza e aggiorna lo stato della coda.',
    sortOrder: 1
  },
  'short-urls-cleanup': {
    name: 'Short URLs Cleanup',
    schedule: 'Daily at 23:00',
    description: 'Rimuove i short link scaduti dal database',
    details: 'Cancella tutte le short URL con scadenza passata.',
    sortOrder: 3
  },
  'blocked-customers-cleanup': {
    name: 'Blocked Customers Cleanup',
    schedule: 'Every 3 days at 23:01',
    description: 'Sblocca clienti dopo la scadenza del blocco',
    details: 'Controlla periodicamente i clienti bloccati e rimuove il blocco quando scade.',
    sortOrder: 9
  },
  'unused-images-cleanup': {
    name: 'Storage Cleanup',
    schedule: 'Daily at 23:05',
    description: 'Pulisce immagini orfane, file temporanei e fatture annullate',
    details: 'Scansiona uploads per immagini non referenziate (prodotti/servizi/utenti/canali), elimina i temp >24h e rimuove fatture di ordini cancellati (local).',
    sortOrder: 4
  },
  'monthly-billing': {
    name: 'Monthly Billing',
    schedule: '1st of month at 23:30',
    description: 'Elabora il billing mensile per gli owner attivi',
    details: 'Calcola canone e debiti, prova il pagamento e aggiorna lo stato di subscription.',
    sortOrder: 8
  },
  'messages-archive': {
    name: 'Messages Archive',
    schedule: 'Daily at 23:10',
    description: 'Archivia i messaggi più vecchi di 6 mesi',
    details: '🗄️ Sposta i messaggi vecchi nella tabella di archivio per mantenere il DB snello.',
    sortOrder: 6
  },
  'whatsapp-queue-cleanup': {
    name: 'WhatsApp Queue Cleanup',
    schedule: 'Daily at 23:15',
    description: 'Pulisce la coda WhatsApp da errori e inviati vecchi',
    details: 'Elimina messaggi in coda con stato error/sent più vecchi di 7 giorni.',
    sortOrder: 5
  },
  'soft-delete-cleanup': {
    name: 'Soft Delete Cleanup',
    schedule: 'Daily at 23:20',
    description: 'Hard-delete dei record soft-deleted dopo retention',
    details: 'Cancella definitivamente i record soft-deleted dopo la retention (default 90 giorni).',
    sortOrder: 7
  },
  'campaign-send': {
    name: 'Campaign Send',
    schedule: 'Daily at 10:00',
    description: 'Invia campagne programmate ai clienti',
    details: 'Controlla le campagne attive e mette in coda i messaggi WhatsApp.',
    sortOrder: 2
  },
}

export function SchedulersPage() {
  const { logout } = useAuth()
  const [jobs, setJobs] = useState<SchedulerJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.schedulers.getAll()
      if (response.success && response.data) {
        setJobs(response.data)
      } else {
        setError(response.error || 'Failed to load scheduler jobs')
      }
    } catch (err) {
      setError('Failed to load scheduler jobs')
      console.error('Error loading jobs:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (jobName: string, currentValue: boolean) => {
    setUpdating(jobName)
    setError(null)
    setSuccessMessage(null)
    
    try {
      const response = await api.schedulers.update(jobName, { isActive: !currentValue })
      
      if (response.success) {
        setJobs(prev => prev.map(job => 
          job.jobName === jobName 
            ? { ...job, isActive: !currentValue }
            : job
        ))
        setSuccessMessage(`Job '${jobName}' ${!currentValue ? 'enabled' : 'disabled'}`)
        setTimeout(() => setSuccessMessage(null), 3000)
      } else {
        setError(response.error || 'Failed to update job')
      }
    } catch (err) {
      setError('Failed to update job')
      console.error('Error updating job:', err)
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const getJobInfo = (jobName: string) => {
    return jobNames[jobName] || { 
      name: jobName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: 'No description available',
      schedule: 'Unknown',
      details: 'No additional details available',
      sortOrder: 99
    }
  }

  // Sort jobs by sortOrder
  const sortedJobs = [...jobs].sort((a, b) => {
    const orderA = getJobInfo(a.jobName).sortOrder
    const orderB = getJobInfo(b.jobName).sortOrder
    return orderA - orderB
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Schedulers</h1>
                <p className="text-sm text-gray-500">Manage cron jobs and scheduled tasks</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadJobs}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={logout}
                className="text-gray-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-500">Loading scheduler jobs...</p>
          </div>
        ) : sortedJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No scheduler jobs found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sortedJobs.map((job) => {
              const jobInfo = getJobInfo(job.jobName)
              const status = statusConfig[job.lastStatus] || statusConfig['NEVER_RUN']
              
              return (
                <Card key={job.id} className={`transition-all ${!job.isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      {/* Left: Job info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {job.isActive ? (
                            <PlayCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <PauseCircle className="h-5 w-5 text-gray-400" />
                          )}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {jobInfo.name}
                          </h3>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Clock className="h-3 w-3 mr-1" />
                            {jobInfo.schedule}
                          </Badge>
                          <Badge variant="outline" className={status.color}>
                            <span className="flex items-center gap-1">
                              {status.icon}
                              {status.label}
                            </span>
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2 ml-8 font-medium">
                          {jobInfo.description}
                        </p>
                        
                        <p className="text-sm text-gray-500 mb-4 ml-8 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          📋 {jobInfo.details}
                        </p>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-8">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-gray-500">Last Run</p>
                              <p className="font-medium">{formatDate(job.lastRunAt)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <Timer className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-gray-500">Duration</p>
                              <p className="font-medium">{formatDuration(job.lastDuration)}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                              {job.jobName}
                            </code>
                          </div>
                        </div>
                        
                        {/* Error message if failed */}
                        {job.lastStatus === 'FAILED' && job.lastError && (
                          <div className="mt-4 ml-8 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-sm text-red-700 font-medium">Error:</p>
                            <p className="text-sm text-red-600 font-mono">{job.lastError}</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Right: Toggle */}
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {job.isActive ? 'Enabled' : 'Disabled'}
                          </span>
                          <Switch
                            checked={job.isActive}
                            onCheckedChange={() => handleToggle(job.jobName, job.isActive)}
                            disabled={updating === job.jobName}
                          />
                        </div>
                        {updating === job.jobName && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default SchedulersPage

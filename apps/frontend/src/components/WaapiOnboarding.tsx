/**
 * WaapiOnboarding - WhatsApp Self-Registration via QR Code
 * Allows users to connect WhatsApp without Meta Business API
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import { initializeWaapiInstance, regenerateWaapiQr } from '@/services/waapiApi';
import { api } from '@/services/api';

interface WaapiOnboardingProps {
  onComplete: () => void;
}

type WaapiStatus = 'idle' | 'pending' | 'authenticated' | 'ready' | 'disconnected' | 'failed';

export function WaapiOnboarding({ onComplete }: WaapiOnboardingProps) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Onboarding state
  const [isInitializing, setIsInitializing] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [status, setStatus] = useState<WaapiStatus>('idle');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Poll status after initialization
  useEffect(() => {
    if (status === 'pending' || status === 'authenticated') {
      const interval = setInterval(async () => {
        await checkStatus();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [status]);

  // Check instance status from workspace data
  const checkStatus = async () => {
    try {
      await refreshWorkspaces();

      // Get updated workspace
      const workspace = await api.get(`/workspaces/${currentWorkspace?.id}`);

      if (workspace.data.waapiInstanceStatus) {
        setStatus(workspace.data.waapiInstanceStatus as WaapiStatus);

        if (workspace.data.waapiInstanceStatus === 'ready') {
          toast.success('WhatsApp connected successfully!');
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  // Initialize WaAPI instance
  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!phoneNumber.startsWith('+')) {
      toast.error('Phone number must start with + (e.g., +393331234567)');
      return;
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    try {
      setIsInitializing(true);

      const response = await initializeWaapiInstance(currentWorkspace.id, {
        phoneNumber,
        displayName: displayName || undefined
      });

      // Set QR code and status
      setQrCodeData(response.waapiQrCodeData);
      setStatus((response.waapiInstanceStatus as WaapiStatus) || 'pending');

      toast.success('QR code generated! Please scan with WhatsApp.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initialize WaAPI');
      console.error('WaAPI initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // Regenerate QR code
  const handleRegenerateQr = async () => {
    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    try {
      setIsRegenerating(true);

      const newQrCodeData = await regenerateWaapiQr(currentWorkspace.id);

      setQrCodeData(newQrCodeData);
      toast.success('QR code regenerated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to regenerate QR');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Render status message
  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <Alert>
            <AlertTitle>Waiting for scan</AlertTitle>
            <AlertDescription>
              Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device,
              and scan the QR code above.
            </AlertDescription>
          </Alert>
        );
      case 'authenticated':
        return (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            <AlertTitle>Authenticated</AlertTitle>
            <AlertDescription>
              WhatsApp is connecting... This may take a few seconds.
            </AlertDescription>
          </Alert>
        );
      case 'ready':
        return (
          <Alert className="border-green-200 bg-green-50">
            <AlertTitle>Connected!</AlertTitle>
            <AlertDescription>
              Your WhatsApp is ready to receive messages.
            </AlertDescription>
          </Alert>
        );
      case 'disconnected':
        return (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTitle>Disconnected</AlertTitle>
            <AlertDescription>
              Your WhatsApp session ended. Please reconnect.
            </AlertDescription>
          </Alert>
        );
      case 'failed':
        return (
          <Alert className="border-red-200 bg-red-50">
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription>
              QR scan failed. Please try again.
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Connect WhatsApp</h2>
      <p className="text-gray-600 mb-6">
        Connect your WhatsApp number to start chatting with customers.
      </p>

      {/* STEP 1: Phone Number Form */}
      {!qrCodeData && status === 'idle' && (
        <form onSubmit={handleInitialize} className="space-y-4">
          <div>
            <Label htmlFor="phoneNumber">WhatsApp Phone Number *</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+393331234567"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Use international format with country code (e.g., +39 for Italy)
            </p>
          </div>

          <div>
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Shop Bot"
            />
          </div>

          <Button type="submit" disabled={isInitializing} className="w-full">
            {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate QR Code
          </Button>
        </form>
      )}

      {/* STEP 2: QR Code Display */}
      {qrCodeData && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6 flex flex-col items-center">
            <img
              src={qrCodeData}
              alt="WhatsApp QR Code"
              className="w-64 h-64 mb-4"
            />

            <Button
              onClick={handleRegenerateQr}
              disabled={isRegenerating}
              variant="outline"
              size="sm"
            >
              {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate QR Code
            </Button>
          </div>

          {/* Status Messages */}
          {renderStatus()}
        </div>
      )}
    </div>
  );
}

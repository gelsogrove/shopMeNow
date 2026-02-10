/**
 * WaapiSettings - Manage Connected WhatsApp Instance
 * Allows disconnect/reconnect operations with critical confirmation
 */
import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { disconnectWaapiInstance } from '@/services/waapiApi';

interface WaapiSettingsProps {
  onReconnect?: () => void;
}

export function WaapiSettings({ onReconnect }: WaapiSettingsProps) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isWaapiActive = currentWorkspace?.whatsappProvider === 'waapi';
  const instanceStatus = currentWorkspace?.waapiInstanceStatus;
  const phoneNumber = currentWorkspace?.waapiPhoneNumber;

  // Disconnect WaAPI instance (CRITICAL CONFIRMATION)
  const handleDisconnect = async () => {
    if (confirmText !== 'CONFIRM') {
      toast.error('Please type CONFIRM to proceed');
      return;
    }

    if (!currentWorkspace?.id) {
      toast.error('No workspace selected');
      return;
    }

    try {
      setIsDisconnecting(true);

      await disconnectWaapiInstance(currentWorkspace.id);

      toast.success('WhatsApp disconnected successfully');
      setShowDisconnectModal(false);
      setConfirmText('');
      await refreshWorkspaces();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to disconnect');
      console.error('Disconnect error:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Render status badge
  const renderStatusBadge = () => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      idle: { variant: 'secondary', label: 'Idle' },
      pending: { variant: 'outline', label: 'Pending' },
      authenticated: { variant: 'outline', label: 'Authenticated' },
      ready: { variant: 'default', label: 'Ready' },
      disconnected: { variant: 'destructive', label: 'Disconnected' },
      failed: { variant: 'destructive', label: 'Failed' },
    };

    const config = statusConfig[instanceStatus || 'idle'] || statusConfig.idle;

    return (
      <Badge variant={config.variant} className="capitalize">
        {config.label}
      </Badge>
    );
  };

  if (!isWaapiActive) {
    return (
      <Alert>
        <AlertTitle>Not using WaAPI</AlertTitle>
        <AlertDescription>
          This workspace is not using WaAPI provider.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">WhatsApp Connection (WaAPI)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage your WhatsApp connection settings.
        </p>

        {/* Status Display */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <div className="mt-1">
                {renderStatusBadge()}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">Phone Number</p>
              <p className="text-lg font-semibold mt-1">
                {phoneNumber || 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {instanceStatus === 'disconnected' && (
            <Button
              onClick={onReconnect}
              variant="default"
              className="w-full"
            >
              Reconnect WhatsApp
            </Button>
          )}

          {instanceStatus === 'ready' && (
            <Button
              onClick={() => setShowDisconnectModal(true)}
              variant="destructive"
              className="w-full"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Disconnect WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* CRITICAL: Disconnect Confirmation Modal */}
      <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Action: Disconnect WhatsApp
            </DialogTitle>
            <DialogDescription className="text-base">
              <div className="space-y-3 mt-4">
                <Alert variant="destructive">
                  <AlertTitle>This action is irreversible!</AlertTitle>
                  <AlertDescription>
                    • Your WaAPI instance will be permanently deleted<br />
                    • You cannot recover this session<br />
                    • To use WhatsApp again, you will need to create a new instance
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="confirmText">
                    Type <span className="font-bold">CONFIRM</span> to continue
                  </Label>
                  <Input
                    id="confirmText"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRM"
                    autoComplete="off"
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowDisconnectModal(false);
                setConfirmText('');
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisconnect}
              disabled={confirmText !== 'CONFIRM' || isDisconnecting}
              variant="destructive"
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

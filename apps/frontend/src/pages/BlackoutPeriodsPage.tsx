/**
 * Blackout Periods Page
 * 
 * Manage closure periods (holidays, vacations, special closures)
 */

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  blackoutPeriodApi,
  BlackoutPeriod,
  CreateBlackoutPeriodDto,
} from '@/services/appointmentApi';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function BlackoutPeriodsPage() {
  const { workspace: currentWorkspace } = useWorkspace();
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<BlackoutPeriod | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateBlackoutPeriodDto>({
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    if (currentWorkspace) {
      loadBlackoutPeriods();
    }
  }, [currentWorkspace]);

  const loadBlackoutPeriods = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const periods = await blackoutPeriodApi.getBlackoutPeriods(currentWorkspace.id, false);
      setBlackoutPeriods(periods);
    } catch (error) {
      console.error('Failed to load blackout periods:', error);
      toast.error('Failed to load blackout periods');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentWorkspace) return;

    try {
      // Convert date input (YYYY-MM-DD) to ISO timestamp
      const startDate = new Date(formData.startDate + 'T00:00:00Z');
      const endDate = new Date(formData.endDate + 'T23:59:59Z');

      const dto: CreateBlackoutPeriodDto = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        reason: formData.reason,
      };

      await blackoutPeriodApi.createBlackoutPeriod(currentWorkspace.id, dto);
      toast.success('Blackout period created successfully');
      setIsCreateSheetOpen(false);
      resetForm();
      loadBlackoutPeriods();
    } catch (error: any) {
      console.error('Failed to create blackout period:', error);
      toast.error(error.response?.data?.message || 'Failed to create blackout period');
    }
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !periodToDelete) return;

    try {
      await blackoutPeriodApi.deleteBlackoutPeriod(currentWorkspace.id, periodToDelete.id);
      toast.success('Blackout period deleted successfully');
      setDeleteDialogOpen(false);
      setPeriodToDelete(null);
      loadBlackoutPeriods();
    } catch (error: any) {
      console.error('Failed to delete blackout period:', error);
      toast.error(error.response?.data?.message || 'Failed to delete blackout period');
    }
  };

  const resetForm = () => {
    setFormData({
      startDate: '',
      endDate: '',
      reason: '',
    });
  };

  const openDeleteDialog = (period: BlackoutPeriod) => {
    setPeriodToDelete(period);
    setDeleteDialogOpen(true);
  };

  const formatDate = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), 'MMM dd, yyyy');
    } catch {
      return isoDate;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading blackout periods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Blackout Periods</CardTitle>
            <CardDescription>
              Block off dates when appointments cannot be booked (holidays, vacations)
            </CardDescription>
          </div>
          <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                New Blackout Period
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[600px]">
              <SheetHeader>
                <SheetTitle>New Blackout Period</SheetTitle>
                <SheetDescription>
                  Create a date range when appointments cannot be booked
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="e.g., Summer holidays, Conference attendance"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateSheetOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Create</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </CardHeader>

        <CardContent>
          {blackoutPeriods.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No blackout periods configured</p>
              <Button onClick={() => setIsCreateSheetOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Blackout Period
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blackoutPeriods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {formatDate(period.startDate)}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(period.endDate)}</TableCell>
                    <TableCell>
                      {period.reason || <span className="text-gray-400 italic">No reason provided</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteDialog(period)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blackout Period</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this blackout period?
              {periodToDelete && (
                <div className="mt-2 p-2 bg-gray-100 rounded">
                  <strong>
                    {formatDate(periodToDelete.startDate)} - {formatDate(periodToDelete.endDate)}
                  </strong>
                  {periodToDelete.reason && (
                    <div className="text-sm mt-1">{periodToDelete.reason}</div>
                  )}
                </div>
              )}
              This action cannot be undone. Appointments may become available during this period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPeriodToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

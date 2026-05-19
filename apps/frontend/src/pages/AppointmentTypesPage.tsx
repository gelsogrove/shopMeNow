/**
 * Appointment Types Page
 * 
 * Manage appointment types (services) for booking system
 */

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  appointmentApi,
  AppointmentType,
  CreateAppointmentTypeDto,
  UpdateAppointmentTypeDto,
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
import { Badge } from '@/components/ui/badge';
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
import { Plus, Edit, Trash2, Clock, Euro } from 'lucide-react';

export function AppointmentTypesPage() {
  const { workspace: currentWorkspace } = useWorkspace();
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingType, setEditingType] = useState<AppointmentType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<AppointmentType | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateAppointmentTypeDto>({
    name: '',
    description: '',
    duration: 60,
    bufferTime: 0,
    price: 0,
    color: '#3b82f6',
  });

  useEffect(() => {
    if (currentWorkspace) {
      loadAppointmentTypes();
    }
  }, [currentWorkspace]);

  const loadAppointmentTypes = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const types = await appointmentApi.getAppointmentTypes(currentWorkspace.id, false);
      setAppointmentTypes(types);
    } catch (error) {
      console.error('Failed to load appointment types:', error);
      toast.error('Failed to load appointment types');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentWorkspace) return;

    try {
      await appointmentApi.createAppointmentType(currentWorkspace.id, formData);
      toast.success('Appointment type created successfully');
      setIsEditSheetOpen(false);
      resetForm();
      loadAppointmentTypes();
    } catch (error: any) {
      console.error('Failed to create appointment type:', error);
      toast.error(error.response?.data?.message || 'Failed to create appointment type');
    }
  };

  const handleUpdate = async () => {
    if (!currentWorkspace || !editingType) return;

    try {
      const updateDto: UpdateAppointmentTypeDto = {
        name: formData.name,
        description: formData.description,
        duration: formData.duration,
        bufferTime: formData.bufferTime,
        price: formData.price,
        color: formData.color,
      };

      await appointmentApi.updateAppointmentType(
        currentWorkspace.id,
        editingType.id,
        updateDto
      );
      toast.success('Appointment type updated successfully');
      setIsEditSheetOpen(false);
      resetForm();
      loadAppointmentTypes();
    } catch (error: any) {
      console.error('Failed to update appointment type:', error);
      toast.error(error.response?.data?.message || 'Failed to update appointment type');
    }
  };

  const handleDelete = async () => {
    if (!currentWorkspace || !typeToDelete) return;

    try {
      await appointmentApi.deleteAppointmentType(currentWorkspace.id, typeToDelete.id);
      toast.success('Appointment type deleted successfully');
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
      loadAppointmentTypes();
    } catch (error: any) {
      console.error('Failed to delete appointment type:', error);
      toast.error(error.response?.data?.message || 'Failed to delete appointment type');
    }
  };

  const openEditSheet = (type?: AppointmentType) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        duration: type.duration,
        bufferTime: type.bufferTime || 0,
        price: type.price || 0,
        color: type.color || '#3b82f6',
      });
    } else {
      setEditingType(null);
      resetForm();
    }
    setIsEditSheetOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration: 60,
      bufferTime: 0,
      price: 0,
      color: '#3b82f6',
    });
    setEditingType(null);
  };

  const openDeleteDialog = (type: AppointmentType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading appointment types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Appointment Types</CardTitle>
            <CardDescription>
              Manage your bookable services (consultations, therapies, check-ups)
            </CardDescription>
          </div>
          <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={() => openEditSheet()}>
                <Plus className="mr-2 h-4 w-4" />
                New Appointment Type
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[600px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingType ? 'Edit Appointment Type' : 'New Appointment Type'}
                </SheetTitle>
                <SheetDescription>
                  {editingType
                    ? 'Modify the appointment type details'
                    : 'Create a new bookable service'}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Legal Consultation, Physiotherapy Session"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Brief description of the service"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="duration">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={15}
                      max={480}
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({ ...formData, duration: parseInt(e.target.value) })
                      }
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">15-480 minutes</p>
                  </div>

                  <div>
                    <Label htmlFor="bufferTime">Buffer Time (minutes)</Label>
                    <Input
                      id="bufferTime"
                      type="number"
                      min={0}
                      max={120}
                      value={formData.bufferTime}
                      onChange={(e) =>
                        setFormData({ ...formData, bufferTime: parseInt(e.target.value) })
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">Cleanup time after appointment</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price (€)</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: parseFloat(e.target.value) })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="color">Calendar Color</Label>
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditSheetOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={editingType ? handleUpdate : handleCreate}>
                    {editingType ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </CardHeader>

        <CardContent>
          {appointmentTypes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No appointment types yet</p>
              <Button onClick={() => openEditSheet()}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Appointment Type
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Buffer</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointmentTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color || '#3b82f6' }}
                        />
                        <div>
                          <div className="font-medium">{type.name}</div>
                          {type.description && (
                            <div className="text-sm text-gray-500">
                              {type.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {type.duration} min
                      </div>
                    </TableCell>
                    <TableCell>
                      {type.bufferTime ? `${type.bufferTime} min` : '-'}
                    </TableCell>
                    <TableCell>
                      {type.price ? (
                        <div className="flex items-center gap-1">
                          <Euro className="h-4 w-4 text-gray-400" />
                          {type.price.toFixed(2)}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={type.isActive ? 'default' : 'secondary'}>
                        {type.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(type)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(type)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
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
            <AlertDialogTitle>Delete Appointment Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{typeToDelete?.name}</strong>?
              This action will deactivate the appointment type. It can be reactivated
              later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTypeToDelete(null)}>
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

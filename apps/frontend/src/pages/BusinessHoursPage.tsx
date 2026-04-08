/**
 * Business Hours Page
 * 
 * Weekly schedule editor for appointment availability
 */

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  businessHoursApi,
  BusinessHours,
  UpdateBusinessHoursDto,
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
import { Switch } from '@/components/ui/switch';
import { Save, Clock } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface DaySchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export function BusinessHoursPage() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map((day) => ({
      dayOfWeek: day.value,
      startTime: '09:00',
      endTime: '17:00',
      isActive: day.value >= 1 && day.value <= 5, // Default: Mon-Fri active
    }))
  );

  useEffect(() => {
    if (currentWorkspace) {
      loadBusinessHours();
    }
  }, [currentWorkspace]);

  const loadBusinessHours = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const hours = await businessHoursApi.getBusinessHours(currentWorkspace.id);

      // Merge DB hours with default schedule
      const scheduleMap = new Map(
        schedule.map((day) => [day.dayOfWeek, day])
      );

      hours.forEach((hour) => {
        scheduleMap.set(hour.dayOfWeek, {
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime,
          isActive: hour.isActive,
        });
      });

      setSchedule(Array.from(scheduleMap.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    } catch (error) {
      console.error('Failed to load business hours:', error);
      toast.error('Failed to load business hours');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentWorkspace) return;

    try {
      setSaving(true);

      const dto: UpdateBusinessHoursDto = {
        hours: schedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          isActive: day.isActive,
        })),
      };

      await businessHoursApi.updateBusinessHours(currentWorkspace.id, dto);
      toast.success('Business hours saved successfully');
      loadBusinessHours(); // Reload to get server state
    } catch (error: any) {
      console.error('Failed to save business hours:', error);
      toast.error(error.response?.data?.message || 'Failed to save business hours');
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (dayOfWeek: number, field: keyof DaySchedule, value: any) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading business hours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>
              Set your weekly availability for appointments
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const daySchedule = schedule.find((s) => s.dayOfWeek === day.value);
              if (!daySchedule) return null;

              return (
                <Card key={day.value} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Day Name + Active Switch */}
                      <div className="flex items-center gap-3 w-32">
                        <Switch
                          checked={daySchedule.isActive}
                          onCheckedChange={(checked) =>
                            updateDay(day.value, 'isActive', checked)
                          }
                        />
                        <Label className="font-medium text-base">
                          {day.label}
                        </Label>
                      </div>

                      {/* Time Inputs */}
                      {daySchedule.isActive ? (
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <Input
                              type="time"
                              value={daySchedule.startTime}
                              onChange={(e) =>
                                updateDay(day.value, 'startTime', e.target.value)
                              }
                              className="w-32"
                            />
                          </div>
                          <span className="text-gray-500">to</span>
                          <Input
                            type="time"
                            value={daySchedule.endTime}
                            onChange={(e) =>
                              updateDay(day.value, 'endTime', e.target.value)
                            }
                            className="w-32"
                          />
                        </div>
                      ) : (
                        <div className="text-gray-400 italic">Closed</div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Appointments can only be booked during active
              business hours. Toggle each day on/off and set your preferred time ranges.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

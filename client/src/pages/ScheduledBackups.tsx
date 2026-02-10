import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Database, Clock, Calendar, CheckCircle2 } from "lucide-react";


export default function ScheduledBackups() {
  const { data: schedules, refetch } = trpc.backup.getScheduleConfig.useQuery();
  const updateSchedule = trpc.backup.updateSchedule.useMutation({
    onSuccess: () => {
      alert("ڕێکخستنەکان نوێکرانەوە");
      refetch();
    },
    onError: (error) => {
      alert("هەڵە: " + error.message);
    },
  });

  const handleToggle = (schedule: "daily" | "weekly" | "monthly", enabled: boolean) => {
    updateSchedule.mutate({ schedule, enabled });
  };

  const getIcon = (schedule: string) => {
    switch (schedule) {
      case "daily":
        return <Clock className="h-6 w-6" />;
      case "weekly":
        return <Calendar className="h-6 w-6" />;
      case "monthly":
        return <Database className="h-6 w-6" />;
      default:
        return <Clock className="h-6 w-6" />;
    }
  };

  return (
    <div className="container py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8" />
          بەکاپی خۆکار
        </h1>
        <p className="text-muted-foreground mt-2">
          ڕێکخستنی بەکاپی خۆکار بۆ داتابەیس
        </p>
      </div>

      <div className="grid gap-6">
        {schedules?.map((schedule) => (
          <Card key={schedule.schedule} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  schedule.enabled 
                    ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  {getIcon(schedule.schedule)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {schedule.schedule === "daily" && "بەکاپی ڕۆژانە"}
                    {schedule.schedule === "weekly" && "بەکاپی هەفتانە"}
                    {schedule.schedule === "monthly" && "بەکاپی مانگانە"}
                    {schedule.enabled && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {schedule.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cron: {schedule.cronExpression}
                  </p>
                </div>
              </div>
              <Switch
                checked={schedule.enabled}
                onCheckedChange={(checked) =>
                  handleToggle(schedule.schedule as "daily" | "weekly" | "monthly", checked)
                }
                disabled={updateSchedule.isPending}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          تێبینی
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• بەکاپەکان بە خۆکاری دروست دەکرێن لە کاتە دیاریکراوەکاندا</li>
          <li>• هەموو بەکاپەکان لە S3 هەڵدەگیرێن</li>
          <li>• دەتوانیت بەکاپەکان لە پەڕەی "بەڕێوەبردنی بەکاپ" ببینیت</li>
          <li>• بەکاپەکانی کۆنتر لە 30 ڕۆژ بە خۆکاری دەسڕێنەوە</li>
        </ul>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Database, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";


export default function ScheduledBackups() {
  const { language } = useTranslation();
  const { data: schedules, refetch } = trpc.backup.getScheduleConfig.useQuery();
  const updateSchedule = trpc.backup.updateSchedule.useMutation({
    onSuccess: () => {
      alert(pickLang(language, { ku: "ڕێکخستنەکان نوێکرانەوە", en: "Settings updated", ar: "تم تحديث الإعدادات", zh: "设置已更新" }));
      refetch();
    },
    onError: (error) => {
      alert(pickLang(language, { ku: "هەڵە: ", en: "Error: ", ar: "خطأ: ", zh: "错误：" }) + error.message);
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
          {pickLang(language, { ku: "بەکاپی خۆکار", en: "Automatic Backup", ar: "النسخ الاحتياطي التلقائي", zh: "自动备份" })}
        </h1>
        <p className="text-muted-foreground mt-2">
          {pickLang(language, { ku: "ڕێکخستنی بەکاپی خۆکار بۆ داتابەیس", en: "Configure automatic database backups", ar: "إعداد النسخ الاحتياطي التلقائي لقاعدة البيانات", zh: "配置数据库自动备份" })}
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
                    {schedule.schedule === "daily" && pickLang(language, { ku: "بەکاپی ڕۆژانە", en: "Daily Backup", ar: "نسخ احتياطي يومي", zh: "每日备份" })}
                    {schedule.schedule === "weekly" && pickLang(language, { ku: "بەکاپی هەفتانە", en: "Weekly Backup", ar: "نسخ احتياطي أسبوعي", zh: "每周备份" })}
                    {schedule.schedule === "monthly" && pickLang(language, { ku: "بەکاپی مانگانە", en: "Monthly Backup", ar: "نسخ احتياطي شهري", zh: "每月备份" })}
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
          {pickLang(language, { ku: "تێبینی", en: "Note", ar: "ملاحظة", zh: "注意" })}
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• {pickLang(language, { ku: "بەکاپەکان بە خۆکاری دروست دەکرێن لە کاتە دیاریکراوەکاندا", en: "Backups are created automatically at the scheduled times", ar: "يتم إنشاء النسخ الاحتياطية تلقائيًا في الأوقات المحددة", zh: "备份将在指定时间自动创建" })}</li>
          <li>• {pickLang(language, { ku: "هەموو بەکاپەکان لە S3 هەڵدەگیرێن", en: "All backups are stored in S3", ar: "يتم تخزين جميع النسخ الاحتياطية في S3", zh: "所有备份均存储在 S3 中" })}</li>
          <li>• {pickLang(language, { ku: 'دەتوانیت بەکاپەکان لە پەڕەی "بەڕێوەبردنی بەکاپ" ببینیت', en: 'You can view backups on the "Backup Management" page', ar: 'يمكنك عرض النسخ الاحتياطية في صفحة "إدارة النسخ الاحتياطي"', zh: '您可以在"备份管理"页面查看备份' })}</li>
          <li>• {pickLang(language, { ku: "بەکاپەکانی کۆنتر لە 30 ڕۆژ بە خۆکاری دەسڕێنەوە", en: "Backups older than 30 days are deleted automatically", ar: "يتم حذف النسخ الاحتياطية الأقدم من 30 يومًا تلقائيًا", zh: "超过 30 天的备份将自动删除" })}</li>
        </ul>
      </Card>
    </div>
  );
}

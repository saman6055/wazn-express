import { useState } from "react";
import { Bot, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The WeCom (企业微信) group robot (owner, 2026-10-26): the group is told by
 * itself when a batch leaves China. The main admin pastes the robot's
 * webhook; a test message must reach the group before it is kept. The key
 * never comes back to the page - only "connected" or not.
 */
export function WecomRobotCard() {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const status = trpc.settings.wecomStatus.useQuery(undefined, { enabled: isMainAdmin });
  const [webhook, setWebhook] = useState("");
  const save = trpc.settings.setWecom.useMutation({
    onSuccess: (r) => {
      setWebhook("");
      void status.refetch();
      toast.success(r.configured
        ? L({ ku: "ڕۆبۆت پەیوەست کرا — پەیامی تاقیکردنەوە لە گرووپەکەدا دەبینیت", en: "Robot connected — the test message is in the group", ar: "تم ربط الروبوت — رسالة الاختبار في المجموعة", zh: "机器人已连接 — 测试消息已发到群里" })
        : L({ ku: "ڕۆبۆت لابرا", en: "Robot removed", ar: "تمت إزالة الروبوت", zh: "已移除机器人" }));
    },
    onError: (e) => toast.error(e.message),
  });
  if (!isMainAdmin) return null;
  const on = status.data?.configured;

  return (
    <Card data-testid="wecom-robot">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          {L({ ku: "ڕۆبۆتی گرووپی WeCom", en: "WeCom group robot", ar: "روبوت مجموعة WeCom", zh: "企业微信群机器人" })}
          {/* WeCom's own name, as its menus show it - the same in every language. */}
          <span className="text-sm font-normal text-muted-foreground" lang="zh">企业微信</span>
          {on && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        </CardTitle>
        <CardDescription>
          {L({
            ku: "کە پشکنینی ناردن لە چین تەواو بوو، گرووپەکە خۆکار ئاگادار دەکرێتەوە. لە گرووپەکەدا ڕۆبۆتێک زیاد بکە، ناونیشانی Webhook ـەکەی کۆپی بکە و لێرە دایبنێ:",
            en: "When a dispatch check is finished in China, the group is told by itself. Add a robot in the group, copy its Webhook address and paste it here:",
            ar: "عند انتهاء فحص الإرسال في الصين تُبلَّغ المجموعة تلقائياً. أضف روبوتاً في المجموعة وانسخ عنوان Webhook والصقه هنا:",
            zh: "中国发货核对完成后自动通知群。在群里添加机器人，复制 Webhook 地址粘贴到这里：",
          })}
          {/* The steps as WeCom's own menus name them. */}
          <span className="mt-1 block font-mono text-xs" dir="ltr" lang="zh">⋯ → 群机器人 → 添加机器人 → Webhook</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">
          {on
            ? L({ ku: "✅ پەیوەستە", en: "✅ Connected", ar: "✅ متصل", zh: "✅ 已连接" })
            : L({ ku: "پەیوەست نییە", en: "Not connected", ar: "غير متصل", zh: "未连接" })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input dir="ltr" value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…" data-testid="wecom-webhook" />
          <Button disabled={!webhook.trim() || save.isPending} onClick={() => save.mutate({ webhook })} data-testid="wecom-save">
            {L({ ku: "تاقیکردنەوە و پاشەکەوت", en: "Test and save", ar: "اختبار وحفظ", zh: "测试并保存" })}
          </Button>
          {on && (
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ webhook: "" })}>
              {L({ ku: "لابردن", en: "Remove", ar: "إزالة", zh: "移除" })}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function IpWhitelistManagement() {
  const { language } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    ipAddress: "",
    description: "",
  });

  // Queries
  const { data: whitelist, refetch } = trpc.advancedSettings.getAllIpWhitelist.useQuery();

  // Mutations
  const addMutation = trpc.advancedSettings.addIpToWhitelist.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "IP زیادکرا بۆ لیستی سپی", en: "IP added to whitelist", ar: "تمت إضافة عنوان IP إلى القائمة البيضاء", zh: "IP 已加入白名单" }));
      refetch();
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMutation = trpc.advancedSettings.removeIpFromWhitelist.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "IP سڕایەوە لە لیستی سپی", en: "IP removed from whitelist", ar: "تمت إزالة عنوان IP من القائمة البيضاء", zh: "IP 已从白名单移除" }));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      ipAddress: "",
      description: "",
    });
  };

  const handleAdd = () => {
    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    
    if (!ipRegex.test(formData.ipAddress)) {
      toast.error(pickLang(language, { ku: "تکایە ناونیشانێکی IP ی دروست بنووسە", en: "Please enter a valid IP address", ar: "يرجى إدخال عنوان IP صالح", zh: "请输入有效的 IP 地址" }));
      return;
    }

    addMutation.mutate(formData);
  };

  const handleRemove = (id: number) => {
    if (confirm(pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم IP لە لیستی سپی؟", en: "Are you sure you want to remove this IP from the whitelist?", ar: "هل أنت متأكد من إزالة عنوان IP هذا من القائمة البيضاء؟", zh: "确定要将此 IP 从白名单中移除吗？" }))) {
      removeMutation.mutate({ id });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{pickLang(language, { ku: "بەڕێوەبردنی لیستی سپی IP", en: "IP Whitelist Management", ar: "إدارة القائمة البيضاء لعناوين IP", zh: "IP 白名单管理" })}</CardTitle>
                <CardDescription>
                  {pickLang(language, { ku: "بەڕێوەبردنی ناونیشانەکانی IP کە ڕێگەیان پێدراوە", en: "Manage the IP addresses that are allowed access", ar: "إدارة عناوين IP المسموح لها بالوصول", zh: "管理已授权访问的 IP 地址" })}
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 ms-2" />
              {pickLang(language, { ku: "IP زیاد بکە", en: "Add IP", ar: "إضافة عنوان IP", zh: "添加 IP" })}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {pickLang(language, { ku: "زانیاری", en: "Information", ar: "معلومات", zh: "信息" })}
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {pickLang(language, { ku: "لیستی سپی IP ڕێگە بە ناونیشانەکانی IP ی دیاریکراو دەدات بۆ دەستگەیشتن بە سیستەم. تەنها IP ـەکانی ئەم لیستە دەتوانن بچنە ژوورەوە.", en: "The IP whitelist allows only specified IP addresses to access the system. Only IPs on this list can log in.", ar: "تسمح القائمة البيضاء لعناوين IP المحددة فقط بالوصول إلى النظام. يمكن لعناوين IP المدرجة في هذه القائمة فقط تسجيل الدخول.", zh: "IP 白名单仅允许指定的 IP 地址访问系统。只有此列表中的 IP 才能登录。" })}
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{pickLang(language, { ku: "ناونیشانی IP", en: "IP Address", ar: "عنوان IP", zh: "IP 地址" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "زیادکرا لەلایەن", en: "Added by", ar: "أُضيف بواسطة", zh: "添加者" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                <TableHead>{pickLang(language, { ku: "کردارەکان", en: "Actions", ar: "الإجراءات", zh: "操作" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whitelist?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono font-semibold">
                    {entry.ipAddress}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {entry.description || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.createdByName || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.createdAt ? format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm") : "-"}
                  </TableCell>
                  <TableCell>
                    {entry.isActive ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        {pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(!whitelist || whitelist.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>{pickLang(language, { ku: "هیچ IP ـێک لە لیستی سپی نییە", en: "No IPs in the whitelist", ar: "لا توجد عناوين IP في القائمة البيضاء", zh: "白名单中没有 IP" })}</p>
              <p className="text-sm mt-2">
                {pickLang(language, { ku: "IP زیاد بکە بۆ ڕێگەدان بە دەستگەیشتنی دڵنیا", en: "Add an IP to allow secure access", ar: "أضف عنوان IP للسماح بالوصول الآمن", zh: "添加 IP 以允许安全访问" })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pickLang(language, { ku: "IP زیاد بکە بۆ لیستی سپی", en: "Add IP to whitelist", ar: "إضافة عنوان IP إلى القائمة البيضاء", zh: "将 IP 添加到白名单" })}</DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "ناونیشانی IP و وەسفی بنووسە", en: "Enter the IP address and a description", ar: "أدخل عنوان IP والوصف", zh: "输入 IP 地址和描述" })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ipAddress">{pickLang(language, { ku: "ناونیشانی IP", en: "IP Address", ar: "عنوان IP", zh: "IP 地址" })}</Label>
              <Input
                id="ipAddress"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder={pickLang(language, { ku: "192.168.1.1 یان 2001:0db8:85a3::8a2e:0370:7334", en: "192.168.1.1 or 2001:0db8:85a3::8a2e:0370:7334", ar: "192.168.1.1 أو 2001:0db8:85a3::8a2e:0370:7334", zh: "192.168.1.1 或 2001:0db8:85a3::8a2e:0370:7334" })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {pickLang(language, { ku: "IPv4 یان IPv6 پشتگیری دەکرێت", en: "IPv4 or IPv6 is supported", ar: "يُدعم IPv4 أو IPv6", zh: "支持 IPv4 或 IPv6" })}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{pickLang(language, { ku: "وەسف (ئیختیاری)", en: "Description (optional)", ar: "الوصف (اختياري)", zh: "描述（可选）" })}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={pickLang(language, { ku: "نموونە: ئۆفیسی سەرەکی، VPN، هتد", en: "e.g. Head office, VPN, etc.", ar: "مثال: المكتب الرئيسي، VPN، إلخ", zh: "例如：总部、VPN 等" })}
              />
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{pickLang(language, { ku: "ئاگاداری:", en: "Warning:", ar: "تحذير:", zh: "警告：" })}</strong>{" "}
                {pickLang(language, { ku: "دوای زیادکردنی IP، تەنها ئەم ناونیشانانە دەتوانن بچنە ژوورەوە. دڵنیابە لە ڕاستی IP پێش زیادکردن.", en: "After adding an IP, only these addresses can log in. Make sure the IP is correct before adding.", ar: "بعد إضافة عنوان IP، يمكن لهذه العناوين فقط تسجيل الدخول. تأكد من صحة العنوان قبل الإضافة.", zh: "添加 IP 后，只有这些地址才能登录。添加前请确认 IP 正确。" })}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? pickLang(language, { ku: "چاوەڕێ بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候……" }) : pickLang(language, { ku: "زیادکردن", en: "Add", ar: "إضافة", zh: "添加" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

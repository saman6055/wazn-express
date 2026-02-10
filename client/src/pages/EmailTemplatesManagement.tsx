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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

export default function EmailTemplatesManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    variables: "",
    category: "notification" as "notification" | "invoice" | "report" | "alert",
    isActive: true,
  });

  // Queries
  const { data: templates, refetch } = trpc.advancedSettings.getAllEmailTemplates.useQuery();

  // Mutations
  const createMutation = trpc.advancedSettings.createEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("قاڵبی ئیمەیڵ زیادکرا");
      refetch();
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.advancedSettings.updateEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("قاڵبی ئیمەیڵ نوێکرایەوە");
      refetch();
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.advancedSettings.deleteEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("قاڵبی ئیمەیڵ سڕایەوە");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      body: "",
      variables: "",
      category: "notification",
      isActive: true,
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      variables: template.variables || "",
      category: template.category,
      isActive: template.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate.id,
      subject: formData.subject,
      body: formData.body,
      variables: formData.variables,
      isActive: formData.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("ئایا دڵنیایت لە سڕینەوەی ئەم قاڵبە؟")) {
      deleteMutation.mutate({ id });
    }
  };

  const handlePreview = (template: any) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      notification: { label: "ئاگادارکردنەوە", variant: "default" },
      invoice: { label: "وەسڵ", variant: "secondary" },
      report: { label: "ڕاپۆرت", variant: "outline" },
      alert: { label: "ئاگاداری", variant: "destructive" },
    };
    const badge = badges[category] || { label: category, variant: "default" };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">بەڕێوەبردنی قاڵبی ئیمەیڵ</CardTitle>
                <CardDescription>
                  بەڕێوەبردنی قاڵبەکانی ئیمەیڵ و ئۆتۆماتیکی
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              قاڵبی نوێ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ناو</TableHead>
                <TableHead>بابەت</TableHead>
                <TableHead>جۆر</TableHead>
                <TableHead>دۆخ</TableHead>
                <TableHead>کردارەکان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates?.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-semibold font-mono">
                    {template.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {template.subject}
                  </TableCell>
                  <TableCell>
                    {getCategoryBadge(template.category)}
                  </TableCell>
                  <TableCell>
                    {template.isActive ? (
                      <Badge variant="default">چالاک</Badge>
                    ) : (
                      <Badge variant="secondary">ناچالاک</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!templates || templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              هیچ قاڵبێکی ئیمەیڵ نییە
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>قاڵبی ئیمەیڵی نوێ زیاد بکە</DialogTitle>
            <DialogDescription>
              زانیاریەکانی قاڵبە نوێیەکە پڕ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ناوی قاڵب (کۆد)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="low_stock_alert"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">جۆر</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">ئاگادارکردنەوە</SelectItem>
                  <SelectItem value="invoice">وەسڵ</SelectItem>
                  <SelectItem value="report">ڕاپۆرت</SelectItem>
                  <SelectItem value="alert">ئاگاداری</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">بابەت</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="{{customerName}} - ئاگاداری کەمی کاڵا"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">ناوەڕۆک (HTML)</Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="<p>بەڕێز {{customerName}},</p><p>کاڵای {{productName}} کەم بووەتەوە.</p>"
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variables">گۆڕاوەکان (JSON)</Label>
              <Textarea
                id="variables"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                placeholder='["customerName", "productName", "quantity"]'
                rows={3}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                لیستی گۆڕاوەکان بە فۆرماتی JSON بنووسە
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">چالاک</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              پاشگەزبوونەوە
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "چاوەڕێ بە..." : "زیادکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>دەستکاری قاڵبی ئیمەیڵ</DialogTitle>
            <DialogDescription>
              زانیاریەکانی قاڵبەکە نوێ بکەرەوە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>ناوی قاڵب</Label>
              <Input value={formData.name} disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-subject">بابەت</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-body">ناوەڕۆک (HTML)</Label>
              <Textarea
                id="edit-body"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-variables">گۆڕاوەکان (JSON)</Label>
              <Textarea
                id="edit-variables"
                value={formData.variables}
                onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                rows={3}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isActive">چالاک</Label>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              پاشگەزبوونەوە
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "چاوەڕێ بە..." : "نوێکردنەوە"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>پێشبینینی قاڵب: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {getCategoryBadge(selectedTemplate?.category)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">بابەت:</Label>
              <p className="mt-1 p-3 bg-muted rounded-md">{selectedTemplate?.subject}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">ناوەڕۆک:</Label>
              <div
                className="mt-1 p-4 bg-muted rounded-md prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: selectedTemplate?.body || "" }}
              />
            </div>
            {selectedTemplate?.variables && (
              <div>
                <Label className="text-sm font-semibold">گۆڕاوەکان:</Label>
                <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                  {selectedTemplate.variables}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewDialogOpen(false)}>
              داخستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

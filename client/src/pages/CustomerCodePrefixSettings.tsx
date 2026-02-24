import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, Code } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function CustomerCodePrefixSettings() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPrefix, setSelectedPrefix] = useState<any>(null);
  const [formData, setFormData] = useState({ code: "", label: "" });

  const { data: prefixes, refetch } = trpc.customerCodePrefixes.list.useQuery();

  const createMutation = trpc.customerCodePrefixes.create.useMutation({
    onSuccess: () => {
      toast.success(t("settings.prefixCreated") || "Code prefix created");
      refetch();
      setIsCreateOpen(false);
      setFormData({ code: "", label: "" });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.customerCodePrefixes.update.useMutation({
    onSuccess: () => {
      toast.success(t("settings.prefixUpdated") || "Code prefix updated");
      refetch();
      setIsEditOpen(false);
      setSelectedPrefix(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.customerCodePrefixes.delete.useMutation({
    onSuccess: () => {
      toast.success(t("settings.prefixDeleted") || "Code prefix deleted");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      code: formData.code.toUpperCase(),
      label: formData.label,
      isActive: true,
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrefix) return;
    updateMutation.mutate({
      id: selectedPrefix.id,
      code: formData.code.toUpperCase(),
      label: formData.label,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm(t("settings.confirmDeletePrefix") || "Are you sure you want to delete this prefix?")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEdit = (prefix: any) => {
    setSelectedPrefix(prefix);
    setFormData({ code: prefix.code, label: prefix.label });
    setIsEditOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Code className="h-8 w-8 text-primary" />
              {t("settings.customerCodePrefixes") || "Customer Code Prefixes"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t("settings.customerCodePrefixesDescription") || "Manage customer code prefixes (AZ, WZ, TR, etc.)"}
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t("settings.addPrefix") || "Add Prefix"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.codePrefixes") || "Code Prefixes"}</CardTitle>
            <CardDescription>
              {t("settings.codePrefixesDescription") || "These prefixes are used when generating customer codes"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {prefixes?.map((prefix) => (
                <div
                  key={prefix.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{prefix.code}</span>
                    </div>
                    <div>
                      <p className="font-medium">{prefix.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.example")}: {prefix.code}0001(Name)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(prefix)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(prefix.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings.addPrefix") || "Add Code Prefix"}</DialogTitle>
              <DialogDescription>
                {t("settings.addPrefixDescription") || "Create a new customer code prefix"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">{t("settings.prefixCode") || "Prefix Code"}</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="AZ, WZ, TR..."
                  maxLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">{t("settings.prefixLabel") || "Label"}</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Azerbaijan, Wazn, Turkey..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {t("forms.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("forms.creating") : t("forms.create")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings.editPrefix") || "Edit Code Prefix"}</DialogTitle>
              <DialogDescription>
                {t("settings.editPrefixDescription") || "Update customer code prefix"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">{t("settings.prefixCode") || "Prefix Code"}</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="AZ, WZ, TR..."
                  maxLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-label">{t("settings.prefixLabel") || "Label"}</Label>
                <Input
                  id="edit-label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Azerbaijan, Wazn, Turkey..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  {t("forms.cancel")}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t("forms.updating") : t("forms.update")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Countries() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<any>(null);
  const [createIsOrigin, setCreateIsOrigin] = useState(false);
  const [createIsDestination, setCreateIsDestination] = useState(false);
  const [editIsOrigin, setEditIsOrigin] = useState(false);
  const [editIsDestination, setEditIsDestination] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  const { data: countries, refetch } = trpc.countries.list.useQuery();
  const createMutation = trpc.countries.create.useMutation({
    onSuccess: () => {
      toast.success("Country created successfully");
      setIsCreateOpen(false);
      setCreateIsOrigin(false);
      setCreateIsDestination(false);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });
  const updateMutation = trpc.countries.update.useMutation({
    onSuccess: () => {
      toast.success("Country updated successfully");
      setEditingCountry(null);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      nameEn: formData.get("nameEn") as string,
      nameAr: (formData.get("nameAr") as string) || undefined,
      nameKu: (formData.get("nameKu") as string) || undefined,
      nameZh: (formData.get("nameZh") as string) || undefined,
      isoCode: formData.get("isoCode") as string,
      defaultCurrency: (formData.get("defaultCurrency") as string) || undefined,
      isOrigin: createIsOrigin,
      isDestination: createIsDestination,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCountry) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingCountry.id,
      nameEn: formData.get("nameEn") as string,
      nameAr: (formData.get("nameAr") as string) || undefined,
      nameKu: (formData.get("nameKu") as string) || undefined,
      nameZh: (formData.get("nameZh") as string) || undefined,
      defaultCurrency: (formData.get("defaultCurrency") as string) || undefined,
      isOrigin: editIsOrigin,
      isDestination: editIsDestination,
      isActive: editIsActive,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Countries</h1>
            <p className="text-muted-foreground">Manage origin and destination countries</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Country</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Country</DialogTitle>
                <DialogDescription>Configure a new country for shipping operations.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nameEn">Name (English) *</Label>
                      <Input id="nameEn" name="nameEn" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="isoCode">ISO Code *</Label>
                      <Input id="isoCode" name="isoCode" maxLength={3} required placeholder="e.g., CN, AE, IQ" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nameAr">Name (Arabic)</Label>
                      <Input id="nameAr" name="nameAr" dir="rtl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nameKu">Name (Kurdish)</Label>
                      <Input id="nameKu" name="nameKu" dir="rtl" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nameZh">Name (Chinese)</Label>
                      <Input id="nameZh" name="nameZh" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="defaultCurrency">Default Currency</Label>
                      <Input id="defaultCurrency" name="defaultCurrency" placeholder="e.g., USD, CNY" />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="isOrigin" checked={createIsOrigin} onCheckedChange={setCreateIsOrigin} />
                      <Label htmlFor="isOrigin">Origin Country</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="isDestination" checked={createIsDestination} onCheckedChange={setCreateIsDestination} />
                      <Label htmlFor="isDestination">Destination Country</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Country"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ISO</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries?.map((country) => (
                  <TableRow key={country.id}>
                    <TableCell className="font-mono">{country.isoCode}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{country.nameEn}</p>
                        {country.nameAr && <p className="text-xs text-muted-foreground" dir="rtl">{country.nameAr}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{country.defaultCurrency || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {country.isOrigin && <Badge variant="outline">Origin</Badge>}
                        {country.isDestination && <Badge variant="outline">Destination</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={country.isActive ? "default" : "secondary"}>
                        {country.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingCountry(country);
                        setEditIsOrigin(country.isOrigin);
                        setEditIsDestination(country.isDestination);
                        setEditIsActive(country.isActive);
                      }}
                    >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!countries || countries.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No countries configured
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingCountry} onOpenChange={(open) => !open && setEditingCountry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Country</DialogTitle>
            </DialogHeader>
            {editingCountry && (
              <form onSubmit={handleUpdate}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameEn">Name (English)</Label>
                      <Input id="edit-nameEn" name="nameEn" defaultValue={editingCountry.nameEn} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-defaultCurrency">Currency</Label>
                      <Input id="edit-defaultCurrency" name="defaultCurrency" defaultValue={editingCountry.defaultCurrency || ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameAr">Name (Arabic)</Label>
                      <Input id="edit-nameAr" name="nameAr" dir="rtl" defaultValue={editingCountry.nameAr || ""} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameKu">Name (Kurdish)</Label>
                      <Input id="edit-nameKu" name="nameKu" dir="rtl" defaultValue={editingCountry.nameKu || ""} />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Switch id="edit-isOrigin" checked={editIsOrigin} onCheckedChange={setEditIsOrigin} />
                      <Label htmlFor="edit-isOrigin">Origin</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="edit-isDestination" checked={editIsDestination} onCheckedChange={setEditIsDestination} />
                      <Label htmlFor="edit-isDestination">Destination</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="edit-isActive" checked={editIsActive} onCheckedChange={setEditIsActive} />
                      <Label htmlFor="edit-isActive">Active</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingCountry(null)}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

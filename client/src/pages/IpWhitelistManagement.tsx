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

export default function IpWhitelistManagement() {
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
      toast.success("IP زیادکرا بۆ لیستی سپی");
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
      toast.success("IP سڕایەوە لە لیستی سپی");
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
      toast.error("تکایە ناونیشانێکی IP ی دروست بنووسە");
      return;
    }

    addMutation.mutate(formData);
  };

  const handleRemove = (id: number) => {
    if (confirm("ئایا دڵنیایت لە سڕینەوەی ئەم IP لە لیستی سپی؟")) {
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
                <CardTitle className="text-2xl">بەڕێوەبردنی لیستی سپی IP</CardTitle>
                <CardDescription>
                  بەڕێوەبردنی ناونیشانەکانی IP کە ڕێگەیان پێدراوە
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              IP زیاد بکە
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              زانیاری
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              لیستی سپی IP ڕێگە بە ناونیشانەکانی IP ی دیاریکراو دەدات بۆ دەستگەیشتن بە سیستەم.
              تەنها IP ـەکانی ئەم لیستە دەتوانن بچنە ژوورەوە.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ناونیشانی IP</TableHead>
                <TableHead>وەسف</TableHead>
                <TableHead>زیادکرا لەلایەن</TableHead>
                <TableHead>بەروار</TableHead>
                <TableHead>دۆخ</TableHead>
                <TableHead>کردارەکان</TableHead>
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
                        چالاک
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        ناچالاک
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

          {!whitelist || whitelist.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>هیچ IP ـێک لە لیستی سپی نییە</p>
              <p className="text-sm mt-2">
                IP زیاد بکە بۆ ڕێگەدان بە دەستگەیشتنی دڵنیا
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>IP زیاد بکە بۆ لیستی سپی</DialogTitle>
            <DialogDescription>
              ناونیشانی IP و وەسفی بنووسە
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ipAddress">ناونیشانی IP</Label>
              <Input
                id="ipAddress"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="192.168.1.1 یان 2001:0db8:85a3::8a2e:0370:7334"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                IPv4 یان IPv6 پشتگیری دەکرێت
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">وەسف (ئیختیاری)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="نموونە: ئۆفیسی سەرەکی، VPN، هتد"
              />
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>ئاگاداری:</strong> دوای زیادکردنی IP، تەنها ئەم ناونیشانانە دەتوانن بچنە ژوورەوە.
                دڵنیابە لە ڕاستی IP پێش زیادکردن.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              پاشگەزبوونەوە
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? "چاوەڕێ بە..." : "زیادکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

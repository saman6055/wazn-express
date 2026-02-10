import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, GripVertical, Sparkles, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

// Common emoji icons for product categories
const EMOJI_OPTIONS = [
  "👔", "👟", "👜", "📱", "💊", "💄", "🏠", "🎮", "📚", "🔧", "🍔", "📦",
  "💻", "⌚", "🎧", "📷", "🧸", "🎁", "🛒", "🧴", "👗", "👠", "🎒", "💍"
];

// Color palette for categories
const COLOR_OPTIONS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#EF4444", "#F472B6",
  "#F59E0B", "#6366F1", "#84CC16", "#64748B", "#F97316", "#94A3B8",
  "#06B6D4", "#14B8A6", "#A855F7", "#D946EF"
];

export default function ProductCategories() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [selectedIcon, setSelectedIcon] = useState("📦");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  
  const { data: categories, refetch } = trpc.productCategories.list.useQuery();
  
  const createMutation = trpc.productCategories.create.useMutation({
    onSuccess: () => {
      toast.success("Category created successfully");
      setIsCreateOpen(false);
      setSelectedIcon("📦");
      setSelectedColor("#3B82F6");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const updateMutation = trpc.productCategories.update.useMutation({
    onSuccess: () => {
      toast.success("Category updated successfully");
      setIsEditOpen(false);
      setEditingCategory(null);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const deleteMutation = trpc.productCategories.delete.useMutation({
    onSuccess: () => {
      toast.success("Category deleted");
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const seedMutation = trpc.productCategories.seedDefaults.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} default categories created`);
      refetch();
    },
    onError: (error) => toast.error(error.message)
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createMutation.mutate({
      nameEn: formData.get("nameEn") as string,
      nameAr: formData.get("nameAr") as string || undefined,
      nameKu: formData.get("nameKu") as string || undefined,
      icon: selectedIcon,
      color: selectedColor,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    });
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    const formData = new FormData(e.currentTarget);
    
    updateMutation.mutate({
      id: editingCategory.id,
      nameEn: formData.get("nameEn") as string || undefined,
      nameAr: formData.get("nameAr") as string || undefined,
      nameKu: formData.get("nameKu") as string || undefined,
      icon: selectedIcon,
      color: selectedColor,
      sortOrder: parseInt(formData.get("sortOrder") as string) || undefined,
    });
  };

  const openEditDialog = (category: any) => {
    setEditingCategory(category);
    setSelectedIcon(category.icon || "📦");
    setSelectedColor(category.color || "#3B82F6");
    setIsEditOpen(true);
  };

  const toggleActive = (category: any) => {
    updateMutation.mutate({
      id: category.id,
      isActive: !category.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this category?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Product Categories</h1>
            <p className="text-muted-foreground">Manage product categories for package classification</p>
          </div>
          <div className="flex gap-2">
            {(!categories || categories.length === 0) && (
              <Button 
                variant="outline" 
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {seedMutation.isPending ? "Creating..." : "Seed Defaults"}
              </Button>
            )}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Category</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Product Category</DialogTitle>
                  <DialogDescription>Create a new category for classifying packages.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="grid gap-4 py-4">
                    {/* Icon Selection */}
                    <div className="grid gap-2">
                      <Label>Icon</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setSelectedIcon(emoji)}
                            className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                              selectedIcon === emoji 
                                ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color Selection */}
                    <div className="grid gap-2">
                      <Label>Color</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                        {COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`w-8 h-8 rounded-full transition-all ${
                              selectedColor === color 
                                ? "ring-2 ring-primary ring-offset-2 scale-110" 
                                : "hover:scale-105"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                      >
                        {selectedIcon}
                      </div>
                      <div>
                        <p className="font-medium">Preview</p>
                        <p className="text-sm text-muted-foreground">How the category will appear</p>
                      </div>
                    </div>

                    {/* Names */}
                    <div className="grid gap-2">
                      <Label htmlFor="nameEn">English Name *</Label>
                      <Input id="nameEn" name="nameEn" required placeholder="e.g., Clothing" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="nameAr">Arabic Name</Label>
                        <Input id="nameAr" name="nameAr" placeholder={t("auto.text_e5445a")} dir="rtl" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="nameKu">Kurdish Name</Label>
                        <Input id="nameKu" name="nameKu" placeholder={t("auto.text_fae488")} dir="rtl" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sortOrder">Sort Order</Label>
                      <Input id="sortOrder" name="sortOrder" type="number" defaultValue="0" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Category"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Category Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories?.map((category) => (
            <Card key={category.id} className={`relative ${!category.isActive ? "opacity-60" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl"
                    style={{ 
                      backgroundColor: `${category.color || "#3B82F6"}20`, 
                      color: category.color || "#3B82F6" 
                    }}
                  >
                    {category.icon || "📦"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={category.isActive}
                      onCheckedChange={() => toggleActive(category)}
                    />
                  </div>
                </div>
                <CardTitle className="text-lg mt-3">{category.nameEn}</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  {category.nameKu && <span dir="rtl">{category.nameKu}</span>}
                  {category.nameAr && <span dir="rtl">{category.nameAr}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Order: {category.sortOrder}</Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(category.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!categories || categories.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No categories yet</p>
                <p className="text-muted-foreground mb-4">Create categories to classify packages</p>
                <Button 
                  variant="outline" 
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Default Categories
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
              <DialogDescription>Update category details</DialogDescription>
            </DialogHeader>
            {editingCategory && (
              <form onSubmit={handleEdit}>
                <div className="grid gap-4 py-4">
                  {/* Icon Selection */}
                  <div className="grid gap-2">
                    <Label>Icon</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedIcon(emoji)}
                          className={`w-10 h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                            selectedIcon === emoji 
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" 
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Selection */}
                  <div className="grid gap-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-muted/30">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`w-8 h-8 rounded-full transition-all ${
                            selectedColor === color 
                              ? "ring-2 ring-primary ring-offset-2 scale-110" 
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                    >
                      {selectedIcon}
                    </div>
                    <div>
                      <p className="font-medium">Preview</p>
                      <p className="text-sm text-muted-foreground">How the category will appear</p>
                    </div>
                  </div>

                  {/* Names */}
                  <div className="grid gap-2">
                    <Label htmlFor="edit-nameEn">English Name *</Label>
                    <Input 
                      id="edit-nameEn" 
                      name="nameEn" 
                      required 
                      defaultValue={editingCategory.nameEn}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameAr">Arabic Name</Label>
                      <Input 
                        id="edit-nameAr" 
                        name="nameAr" 
                        defaultValue={editingCategory.nameAr || ""}
                        dir="rtl" 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nameKu">Kurdish Name</Label>
                      <Input 
                        id="edit-nameKu" 
                        name="nameKu" 
                        defaultValue={editingCategory.nameKu || ""}
                        dir="rtl" 
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-sortOrder">Sort Order</Label>
                    <Input 
                      id="edit-sortOrder" 
                      name="sortOrder" 
                      type="number" 
                      defaultValue={editingCategory.sortOrder}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingCategory(null); }}>Cancel</Button>
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

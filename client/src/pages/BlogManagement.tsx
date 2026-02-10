import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  FileText, 
  Image as ImageIcon,
  Calendar,
  Star,
  Globe,
  Send,
  Archive,
  Search,
  Megaphone,
  Newspaper,
  Gift,
  RefreshCw,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { compressImage } from "@/lib/imageCompression";


export default function BlogManagement() {
    const { t } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Form state
  const [formData, setFormData] = useState({
    titleEn: "",
    titleKu: "",
    titleAr: "",
    contentEn: "",
    contentKu: "",
    contentAr: "",
    summaryEn: "",
    summaryKu: "",
    summaryAr: "",
    coverImageUrl: "",
    category: "announcement" as const,
    status: "draft" as const,
    isFeatured: false,
  });
  
  const [uploading, setUploading] = useState(false);
  
  const { data: posts, isLoading, refetch } = trpc.blog.list.useQuery();
  const createMutation = trpc.blog.create.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_87af55"));
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const updateMutation = trpc.blog.update.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_2c4f62"));
      setIsEditOpen(false);
      setSelectedPost(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const deleteMutation = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success(t("auto.text_fa3dbe"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const resetForm = () => {
    setFormData({
      titleEn: "",
      titleKu: "",
      titleAr: "",
      contentEn: "",
      contentKu: "",
      contentAr: "",
      summaryEn: "",
      summaryKu: "",
      summaryAr: "",
      coverImageUrl: "",
      category: "announcement",
      status: "draft",
      isFeatured: false,
    });
  };
  
  const uploadImageMutation = trpc.blog.uploadCoverImage.useMutation({
    onSuccess: (data) => {
      setFormData({ ...formData, coverImageUrl: data.url });
      toast.success(t("auto.text_399743"));
      setUploading(false);
    },
    onError: (error) => {
      toast.error(t("auto.text_f2efc8") + ": " + error.message);
      setUploading(false);
    },
  });
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("auto.text_5f69df"));
      return;
    }
    
    setUploading(true);
    try {
      // Compress image first for faster upload and loading
      const compressedFile = await compressImage(file, {
        maxWidth: 1200,
        maxHeight: 800,
        quality: 0.8,
      });
      
      const arrayBuffer = await compressedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Convert to base64
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      uploadImageMutation.mutate({
        fileData: base64Data,
        fileName: compressedFile.name,
        mimeType: compressedFile.type,
      });
    } catch (error) {
      toast.error(t("auto.text_c6b8a1"));
      setUploading(false);
    }
  };
  
  const handleCreate = () => {
    createMutation.mutate(formData);
  };
  
  const handleUpdate = () => {
    if (!selectedPost) return;
    updateMutation.mutate({
      id: selectedPost.id,
      ...formData,
    });
  };
  
  const handleEdit = (post: any) => {
    setSelectedPost(post);
    setFormData({
      titleEn: post.titleEn || "",
      titleKu: post.titleKu || "",
      titleAr: post.titleAr || "",
      contentEn: post.contentEn || "",
      contentKu: post.contentKu || "",
      contentAr: post.contentAr || "",
      summaryEn: post.summaryEn || "",
      summaryKu: post.summaryKu || "",
      summaryAr: post.summaryAr || "",
      coverImageUrl: post.coverImageUrl || "",
      category: post.category || "announcement",
      status: post.status || "draft",
      isFeatured: post.isFeatured || false,
    });
    setIsEditOpen(true);
  };
  
  const handleDelete = (id: number) => {
    if (confirm(t('blog.confirmDelete'))) {
      deleteMutation.mutate({ id });
    }
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "announcement": return <Megaphone className="h-4 w-4" />;
      case "news": return <Newspaper className="h-4 w-4" />;
      case "promotion": return <Gift className="h-4 w-4" />;
      case "update": return <RefreshCw className="h-4 w-4" />;
      case "guide": return <BookOpen className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };
  
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "announcement": return t('blog.categories.announcement');
      case "news": return t('blog.categories.news');
      case "promotion": return t('blog.categories.promotion');
      case "update": return t('blog.categories.update');
      case "guide": return t('blog.categories.guide');
      default: return category;
    }
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-500">{t("auto.text_9d5d27")} </Badge>;
      case "draft":
        return <Badge variant="secondary">{t("status.draft")}</Badge>;
      case "archived":
        return <Badge variant="outline">{t("status.archived")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Filter posts
  const filteredPosts = posts?.filter((post) => {
    const matchesSearch = 
      post.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.titleKu?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.contentEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || post.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });
  
  const BlogForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-6">
      {/* Cover Image */}
      <div className="space-y-2">
        <Label>{t("blog.coverImage")}</Label>
        <div className="flex items-center gap-4">
          {formData.coverImageUrl ? (
            <div className="relative w-32 h-20 rounded-lg overflow-hidden border">
              <img 
                src={formData.coverImageUrl} 
                alt="Cover" 
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setFormData({ ...formData, coverImageUrl: "" })}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-1">
                {uploading ? t("auto.text_fed701") : t("common.upload")}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </div>
      
      {/* Category & Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("common.type")}</Label>
          <Select
            value={formData.category}
            onValueChange={(value: any) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="announcement">{t("blog.announcement")}</SelectItem>
              <SelectItem value="news">{t("blog.news")}</SelectItem>
              <SelectItem value="promotion">{t("invoices.discount")}</SelectItem>
              <SelectItem value="update">{t("common.update")}</SelectItem>
              <SelectItem value="guide">{t("blog.guide")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>{t("common.status")}</Label>
          <Select
            value={formData.status}
            onValueChange={(value: any) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="published">{t("blog.publish")}</SelectItem>
              <SelectItem value="archived">{t("auto.text_144380")} </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Featured Toggle */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <Label>{t("blog.featured")}</Label>
        </div>
        <Switch
          checked={formData.isFeatured}
          onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
        />
      </div>
      
      {/* Title & Content Tabs */}
      <Tabs defaultValue="ku" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ku">{t("auto.text_16ce6e")} </TabsTrigger>
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="ar">{t("auto.text_26b1b2")} </TabsTrigger>
        </TabsList>
        
        <TabsContent value="ku" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>{t("auto.text_abaac2")} </Label>
            <Input
              value={formData.titleKu}
              onChange={(e) => setFormData({ ...formData, titleKu: e.target.value })}
              placeholder={t("auto.text_30cac7")}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("auto.text_821997")} </Label>
            <Textarea
              value={formData.summaryKu}
              onChange={(e) => setFormData({ ...formData, summaryKu: e.target.value })}
              placeholder={t("auto.text_9b9590")}
              rows={2}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("auto.text_1660f8")} </Label>
            <RichTextEditor
              content={formData.contentKu}
              onChange={(content) => setFormData({ ...formData, contentKu: content })}
              placeholder={t("auto.text_9563e8")}
              dir="rtl"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="en" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Title (English) *</Label>
            <Input
              value={formData.titleEn}
              onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
              placeholder="Blog title in English..."
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Summary (English)</Label>
            <Textarea
              value={formData.summaryEn}
              onChange={(e) => setFormData({ ...formData, summaryEn: e.target.value })}
              placeholder="Short summary..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Content (English)</Label>
            <RichTextEditor
              content={formData.contentEn}
              onChange={(content) => setFormData({ ...formData, contentEn: content })}
              placeholder="Blog content in English..."
              dir="ltr"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="ar" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>{t("auto.text_1bf7d0")} </Label>
            <Input
              value={formData.titleAr}
              onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
              placeholder={t("auto.text_66496a")}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("auto.text_8cde5a")} </Label>
            <Textarea
              value={formData.summaryAr}
              onChange={(e) => setFormData({ ...formData, summaryAr: e.target.value })}
              placeholder={t("auto.text_1249b2")}
              rows={2}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("auto.text_832517")} </Label>
            <RichTextEditor
              content={formData.contentAr}
              onChange={(content) => setFormData({ ...formData, contentAr: content })}
              placeholder={t("auto.text_99103b")}
              dir="rtl"
            />
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => {
            if (isEdit) {
              setIsEditOpen(false);
              setSelectedPost(null);
            } else {
              setIsCreateOpen(false);
            }
            resetForm();
          }}
        >{t("forms.cancel")}</Button>
        <Button
          onClick={isEdit ? handleUpdate : handleCreate}
          disabled={(!formData.titleEn && !formData.titleKu && !formData.titleAr) || (!formData.contentEn && !formData.contentKu && !formData.contentAr) || createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending ? (
            t("auto.text_0f35f8") + "..."
          ) : isEdit ? (
            t("common.refresh")
          ) : (
            t("common.create")
          )}
        </Button>
      </div>
    </div>
  );
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />{t("settings.blogManagement")}</h1>
            <p className="text-muted-foreground">
              {t("auto.text_5f652a")}
            </p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t("auto.text_4fd0ef")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  {t("auto.text_dcea02")}
                </DialogTitle>
              </DialogHeader>
              <BlogForm />
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("invoices.grandTotal")}</p>
                <p className="text-xl font-bold">{posts?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("auto.text_9d5d27")} </p>
                <p className="text-xl font-bold">
                  {posts?.filter(p => p.status === "published").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("blog.featured")}</p>
                <p className="text-xl font-bold">
                  {posts?.filter(p => p.isFeatured).length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                <Archive className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("status.draft")}</p>
                <p className="text-xl font-bold">
                  {posts?.filter(p => p.status === "draft").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("tables.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t("common.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="published">{t("auto.text_9d5d27")} </SelectItem>
              <SelectItem value="draft">{t("status.draft")}</SelectItem>
              <SelectItem value="archived">{t("status.archived")}</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t("common.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="announcement">{t("blog.announcement")}</SelectItem>
              <SelectItem value="news">{t("blog.news")}</SelectItem>
              <SelectItem value="promotion">{t("invoices.discount")}</SelectItem>
              <SelectItem value="update">{t("common.update")}</SelectItem>
              <SelectItem value="guide">{t("blog.guide")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Blog Posts Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground mt-2">{t("auto.text_a56385")} </p>
          </div>
        ) : filteredPosts?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">{t("auto.text_7b43a6")} </h3>
              <p className="text-muted-foreground">
                {t("auto.text_342b7f")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts?.map((post) => (
              <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Cover Image */}
                {post.coverImageUrl ? (
                  <div className="relative h-40 bg-muted">
                    <img
                      src={post.coverImageUrl}
                      alt={post.titleKu || post.titleEn}
                      className="w-full h-full object-cover"
                    />
                    {post.isFeatured && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-yellow-500 gap-1">
                          <Star className="h-3 w-3" />{t("blog.featured")}</Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    {getCategoryIcon(post.category)}
                    {post.isFeatured && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-yellow-500 gap-1">
                          <Star className="h-3 w-3" />{t("blog.featured")}</Badge>
                      </div>
                    )}
                  </div>
                )}
                
                <CardContent className="p-4 space-y-3">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="gap-1">
                      {getCategoryIcon(post.category)}
                      {getCategoryLabel(post.category)}
                    </Badge>
                    {getStatusBadge(post.status)}
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-semibold line-clamp-2" dir="rtl">
                    {post.titleKu || post.titleEn}
                  </h3>
                  
                  {/* Summary */}
                  {(post.summaryKu || post.summaryEn) && (
                    <p className="text-sm text-muted-foreground line-clamp-2" dir="rtl">
                      {post.summaryKu || post.summaryEn}
                    </p>
                  )}
                  
                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString("ku")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {post.viewCount} {t("auto.text_e6ccdb")}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handleEdit(post)}
                    >
                      <Pencil className="h-3 w-3" />{t("forms.edit")}</Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                {t("auto.text_83dc7c")}
              </DialogTitle>
            </DialogHeader>
            <BlogForm isEdit />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

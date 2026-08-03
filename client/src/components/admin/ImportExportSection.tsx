import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Eye, Database, RotateCcw, FileSpreadsheet } from "lucide-react";
import type { DataCategory } from "@/hooks/useDataManagement";

interface ImportExportSectionProps {
  dataCategories: DataCategory[];
  isExporting: boolean;
  importFile: File | null;
  importPreview: Record<string, unknown[]> | null;
  importOverwrite: boolean;
  setImportOverwrite: (v: boolean) => void;
  isImportPending: boolean;
  getCount: (categoryId: string) => number;
  handleExportCategory: (categoryId: string) => void;
  handleExportAll: () => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImport: () => void;
  handleCategoryFileUpload: (categoryId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownloadTemplate: (categoryId: string) => void;
  t: (key: string) => string;
}

export function ImportExportSection({
  dataCategories,
  isExporting,
  importFile,
  importPreview,
  importOverwrite,
  setImportOverwrite,
  isImportPending,
  getCount,
  handleExportCategory,
  handleExportAll,
  handleFileUpload,
  handleImport,
  handleCategoryFileUpload,
  handleDownloadTemplate,
  t,
}: ImportExportSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.exportData")}</CardTitle>
              <CardDescription>{t("dataManagement.exportDataDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleExportAll}
            disabled={isExporting}
          >
            {isExporting ? (
              <RotateCcw className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 me-2" />
            )}
            {t("dataManagement.exportAll")}
          </Button>
          <Separator />
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {dataCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span className={category.color}>{category.icon}</span>
                  <span className="text-sm font-medium">{t(category.titleKey)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {getCount(category.id)}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleExportCategory(category.id)}
                  disabled={isExporting}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* RIGHT: Import */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 dark:bg-green-950/40 rounded-lg">
              <Upload className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.importData")}</CardTitle>
              <CardDescription>{t("dataManagement.importDataDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-200 dark:border-gray-800/60 rounded-xl p-6 text-center hover:border-green-300 transition-colors cursor-pointer"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add("border-green-400", "bg-green-50 dark:bg-green-950/40");
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove("border-green-400", "bg-green-50 dark:bg-green-950/40");
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-green-400", "bg-green-50 dark:bg-green-950/40");
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFileUpload(fakeEvent);
              }
            }}
            onClick={() => document.getElementById("import-file-merged")?.click()}
          >
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="import-file-merged"
            />
            <Upload className="h-10 w-10 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground">
              {importFile ? importFile.name : t("dataManagement.dragOrClick")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">JSON, CSV</p>
          </div>

          {importPreview && (
            <Card className="border-green-200 dark:border-green-800/60 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t("dataManagement.importPreview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(importPreview).map(([category, records]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-2 bg-white rounded border"
                    >
                      <span className="text-sm font-medium">{t(`dataManagement.${category}`)}</span>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        {Array.isArray(records) ? records.length : 0}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="overwrite-mode-merged"
                      checked={importOverwrite}
                      onChange={(e) => setImportOverwrite(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-800/60"
                    />
                    <Label htmlFor="overwrite-mode-merged" className="text-sm cursor-pointer">
                      {t("dataManagement.overwriteExisting")}
                    </Label>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={isImportPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isImportPending ? (
                      <>
                        <RotateCcw className="h-4 w-4 me-2 animate-spin" /> {t("dataManagement.importing")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 me-2" /> {t("dataManagement.startImport")}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {dataCategories.slice(0, 10).map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span className={category.color}>{category.icon}</span>
                  <span className="text-sm font-medium">{t(category.titleKey)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadTemplate(category.id)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={(e) => handleCategoryFileUpload(category.id, e)}
                    className="hidden"
                    id={`import-merged-${category.id}`}
                  />
                  <label htmlFor={`import-merged-${category.id}`}>
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <span>
                        <Upload className="h-3 w-3 me-1" /> {t("dataManagement.import")}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

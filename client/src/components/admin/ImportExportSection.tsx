import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Upload, Eye, Database, AlertTriangle, RotateCcw, FileSpreadsheet } from "lucide-react";
import type { DataCategory } from "@/hooks/useDataManagement";

interface ImportExportSectionProps {
  mode: "export" | "import";
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
  mode,
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
    <>
      {mode === "export" && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.exportData")}</CardTitle>
              <CardDescription>{t("dataManagement.exportDataDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataCategories.map((category) => (
              <Card key={category.id} className={`${category.borderColor} border`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${category.bgColor} rounded-lg`}>
                        <span className={category.color}>{category.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium">{t(category.titleKey)}</div>
                        <div className="text-sm text-muted-foreground">
                          {getCount(category.id)} {t("dataManagement.records")}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportCategory(category.id)}
                      disabled={isExporting}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Separator />
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-green-800">{t("dataManagement.exportAll")}</div>
                    <div className="text-sm text-green-700">{t("dataManagement.exportAllDesc")}</div>
                  </div>
                </div>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleExportAll}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {t("dataManagement.exportAll")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      )}

      {mode === "import" && (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Upload className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>{t("dataManagement.importData")}</CardTitle>
              <CardDescription>{t("dataManagement.importDataDesc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">{t("dataManagement.importWarningTitle")}</AlertTitle>
            <AlertDescription className="text-amber-700">
              {t("dataManagement.importWarningDesc")}
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Label>{t("dataManagement.selectBackupFile")}</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-green-300 transition-colors">
              <input
                type="file"
                accept=".json,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-muted-foreground">
                  {importFile ? importFile.name : t("dataManagement.clickToSelectFile")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dataManagement.jsonAndCsvFiles") ?? "JSON or CSV"}
                </p>
              </label>
            </div>
          </div>

          {importPreview && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  {t("dataManagement.importPreview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(importPreview).map(([category, records]) => (
                    <div key={category} className="flex items-center justify-between p-2 bg-white rounded border">
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
                      id="overwrite-mode"
                      checked={importOverwrite}
                      onChange={(e) => setImportOverwrite(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="overwrite-mode" className="text-sm cursor-pointer">
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
                        <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> {t("dataManagement.importing")}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> {t("dataManagement.startImport")}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              {t("dataManagement.importByCategory")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("dataManagement.importByCategoryDesc") ?? ""}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dataCategories.slice(0, 10).map((category) => (
                <Card key={category.id} className={`${category.borderColor} hover:shadow-md transition-shadow`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${category.bgColor} rounded-lg`}>
                          <span className={category.color}>{category.icon}</span>
                        </div>
                        <span className="font-medium">{t(category.titleKey)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadTemplate(category.id)}
                          title={t("dataManagement.downloadTemplate") ?? ""}
                        >
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        </Button>
                        <input
                          type="file"
                          accept=".json,.csv"
                          onChange={(e) => handleCategoryFileUpload(category.id, e)}
                          className="hidden"
                          id={`import-${category.id}`}
                        />
                        <label htmlFor={`import-${category.id}`}>
                          <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                            <span>
                              <Upload className="h-3 w-3 mr-1" /> {t("dataManagement.import")}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </>
  );
}

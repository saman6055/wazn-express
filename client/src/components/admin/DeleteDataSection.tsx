import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import type { DataCategory } from "@/hooks/useDataManagement";

interface DeleteDataSectionProps {
  dataCategories: DataCategory[];
  selectedCategory: DataCategory | null;
  setSelectedCategory: (c: DataCategory | null) => void;
  confirmationInput: string;
  setConfirmationInput: (v: string) => void;
  showResetDialog: boolean;
  setShowResetDialog: (v: boolean) => void;
  resetConfirmation: string;
  setResetConfirmation: (v: string) => void;
  isDeleting: boolean;
  deleteProgress: number;
  showOldDataDialog: boolean;
  setShowOldDataDialog: (v: boolean) => void;
  oldDataType: string;
  setOldDataType: (v: string) => void;
  oldDataDays: string;
  setOldDataDays: (v: string) => void;
  getCount: (categoryId: string) => number;
  handleDelete: () => void;
  handleDeleteOldData: () => void;
  handleResetAll: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function DeleteDataSection({
  dataCategories,
  selectedCategory,
  setSelectedCategory,
  confirmationInput,
  setConfirmationInput,
  showResetDialog,
  setShowResetDialog,
  resetConfirmation,
  setResetConfirmation,
  isDeleting,
  deleteProgress,
  showOldDataDialog,
  setShowOldDataDialog,
  oldDataType,
  setOldDataType,
  oldDataDays,
  setOldDataDays,
  getCount,
  handleDelete,
  handleDeleteOldData,
  handleResetAll,
  t,
}: DeleteDataSectionProps) {
  return (
    <>
      <div className="space-y-8">
        {/* Section 1: Delete by Category */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Trash2 className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold">{t("dataManagement.deleteByCategory")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataCategories.map((category) => (
              <Card
                key={category.id}
                className={`${category.borderColor} hover:shadow-md transition-all cursor-pointer group`}
                onClick={() => setSelectedCategory(category)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 ${category.bgColor} rounded-lg group-hover:scale-110 transition-transform`}>
                        <span className={category.color}>{category.icon}</span>
                      </div>
                      <div>
                        <div className="font-medium">{t(category.titleKey)}</div>
                        <div className="text-sm text-muted-foreground mt-1">{t(category.descKey)}</div>
                      </div>
                    </div>
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {getCount(category.id)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t("dataManagement.delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Section 2: Advanced — Old Data + Factory Reset side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-amber-800">{t("dataManagement.deleteOldData")}</CardTitle>
                <CardDescription className="text-amber-700">{t("dataManagement.deleteOldDataDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("dataManagement.dataType")}</Label>
              <Select value={oldDataType} onValueChange={setOldDataType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="packages">{t("dataManagement.deliveredPackages")}</SelectItem>
                  <SelectItem value="invoices">{t("dataManagement.paidInvoices")}</SelectItem>
                  <SelectItem value="scans">{t("dataManagement.scans")}</SelectItem>
                  <SelectItem value="auditLogs">{t("dataManagement.auditLogs")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("dataManagement.olderThan")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={oldDataDays}
                  onChange={(e) => setOldDataDays(e.target.value)}
                  min={1}
                  className="w-24"
                />
                <span className="text-muted-foreground">{t("dataManagement.days")}</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={() => setShowOldDataDialog(true)}
            >
              <Clock className="h-4 w-4 mr-2" />
              {t("dataManagement.deleteOldRecords")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-lg text-red-800">{t("dataManagement.factoryReset")}</CardTitle>
                <CardDescription className="text-red-700">{t("dataManagement.factoryResetDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-100 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                {t("dataManagement.dangerZone")}
              </div>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>{t("dataManagement.resetWarning1")}</li>
                <li>{t("dataManagement.resetWarning2")}</li>
                <li>{t("dataManagement.resetWarning3")}</li>
              </ul>
            </div>
            <Button variant="destructive" className="w-full" onClick={() => setShowResetDialog(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t("dataManagement.resetAllData")}
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Delete Category Dialog */}
      <Dialog
        open={!!selectedCategory}
        onOpenChange={() => {
          setSelectedCategory(null);
          setConfirmationInput("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("dataManagement.confirmDelete")}
            </DialogTitle>
            <DialogDescription>
              {t("dataManagement.confirmDeleteDesc", {
                type: selectedCategory ? t(selectedCategory.titleKey) : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                {t("dataManagement.warning")}
              </div>
              <p className="text-sm text-amber-700">
                {getCount(selectedCategory?.id ?? "")} {t("dataManagement.recordsWillBeDeleted")}
              </p>
            </div>
            {isDeleting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t("dataManagement.deleting")}</span>
                  <span>{deleteProgress}%</span>
                </div>
                <Progress value={deleteProgress} className="h-2" />
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {t("dataManagement.typeToConfirm")}{" "}
                <span className="font-mono font-bold text-red-600">DELETE</span>
              </Label>
              <Input
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="font-mono text-center"
                dir="ltr"
                disabled={isDeleting}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedCategory(null);
                setConfirmationInput("");
              }}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmationInput !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  {t("dataManagement.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("dataManagement.delete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Old Data Dialog */}
      <Dialog open={showOldDataDialog} onOpenChange={setShowOldDataDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="h-5 w-5" />
              {t("dataManagement.deleteOldData")}
            </DialogTitle>
            <DialogDescription>
              {t("dataManagement.deleteOldDataConfirm", { days: oldDataDays })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">{t("dataManagement.oldDataWarning")}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowOldDataDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleDeleteOldData}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t("dataManagement.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Reset Dialog */}
      <Dialog
        open={showResetDialog}
        onOpenChange={() => {
          setShowResetDialog(false);
          setResetConfirmation("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t("dataManagement.factoryReset")}
            </DialogTitle>
            <DialogDescription>{t("dataManagement.factoryResetConfirm")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                {t("dataManagement.dangerZone")}
              </div>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li>{t("dataManagement.allCustomers")}</li>
                <li>{t("dataManagement.allPackages")}</li>
                <li>{t("dataManagement.allBatches")}</li>
                <li>{t("dataManagement.allFinancial")}</li>
                <li>{t("dataManagement.allScans")}</li>
                <li>{t("dataManagement.allLogs")}</li>
              </ul>
            </div>
            {isDeleting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t("dataManagement.resetting")}</span>
                  <span>{deleteProgress}%</span>
                </div>
                <Progress value={deleteProgress} className="h-2" />
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {t("dataManagement.typeToConfirm")}{" "}
                <span className="font-mono font-bold text-red-600">RESET ALL DATA</span>
              </Label>
              <Input
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET ALL DATA"
                className="font-mono text-center"
                dir="ltr"
                disabled={isDeleting}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setResetConfirmation("");
              }}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetAll}
              disabled={resetConfirmation !== "RESET ALL DATA" || isDeleting}
            >
              {isDeleting ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                  {t("dataManagement.resetting")}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {t("dataManagement.resetAllData")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

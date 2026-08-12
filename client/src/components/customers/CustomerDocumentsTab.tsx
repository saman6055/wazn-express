import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CreditCard, FileCheck, Eye, Trash2, Upload, Loader2 } from "lucide-react";
import type { RefObject } from "react";

interface CustomerWithDocs {
  passportUrl?: string;
  nationalIdUrl?: string;
  contractUrl?: string;
}

interface CustomerDocumentsTabProps {
  customer: CustomerWithDocs;
  uploadingDoc: string | null;
  passportInputRef: RefObject<HTMLInputElement | null>;
  nationalIdInputRef: RefObject<HTMLInputElement | null>;
  contractInputRef: RefObject<HTMLInputElement | null>;
  onDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "passport" | "nationalId" | "contract") => void;
  onDocumentDelete: (type: "passport" | "nationalId" | "contract") => void;
  t: (key: string) => string;
}

export function CustomerDocumentsTab({
  customer,
  uploadingDoc,
  passportInputRef,
  nationalIdInputRef,
  contractInputRef,
  onDocumentUpload,
  onDocumentDelete,
  t,
}: CustomerDocumentsTabProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{t("customers.documents")}</CardTitle>
            <CardDescription>{t("customers.verificationDocuments")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          ref={passportInputRef}
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => onDocumentUpload(e, "passport")}
        />
        <input
          type="file"
          ref={nationalIdInputRef}
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => onDocumentUpload(e, "nationalId")}
        />
        <input
          type="file"
          ref={contractInputRef}
          className="hidden"
          accept="image/*,.pdf"
          onChange={(e) => onDocumentUpload(e, "contract")}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div
            className={`border-2 rounded-lg p-6 text-center transition-colors ${
              customer.passportUrl
                ? "border-blue-300 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20"
                : "border-dashed hover:border-primary/50"
            }`}
          >
            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium mb-1">Passport</h4>
            <p className="text-xs text-muted-foreground mb-3">{t("customers.form.passport")}</p>
            {customer.passportUrl ? (
              <div className="space-y-2">
                <Badge variant="default" className="text-xs bg-blue-600">
                  {t("common.uploaded")}
                </Badge>
                <div className="flex gap-2 justify-center mt-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(customer.passportUrl!, "_blank")}>
                    <Eye className="h-3 w-3 me-1" />
                    {t("blog.views")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDocumentDelete("passport")}
                    className="text-red-600 dark:text-red-300 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => passportInputRef.current?.click()}
                disabled={uploadingDoc === "passport"}
              >
                {uploadingDoc === "passport" ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 me-2" />
                )}
                {t("common.upload")}
              </Button>
            )}
          </div>

          <div
            className={`border-2 rounded-lg p-6 text-center transition-colors ${
              customer.nationalIdUrl
                ? "border-green-300 dark:border-green-800/60 bg-green-50 dark:bg-green-900/20"
                : "border-dashed hover:border-primary/50"
            }`}
          >
            <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-medium mb-1">National ID</h4>
            <p className="text-xs text-muted-foreground mb-3">{t("customers.nationalId")}</p>
            {customer.nationalIdUrl ? (
              <div className="space-y-2">
                <Badge variant="default" className="text-xs bg-green-600">
                  {t("common.uploaded")}
                </Badge>
                <div className="flex gap-2 justify-center mt-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(customer.nationalIdUrl!, "_blank")}>
                    <Eye className="h-3 w-3 me-1" />
                    {t("blog.views")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDocumentDelete("nationalId")}
                    className="text-red-600 dark:text-red-300 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => nationalIdInputRef.current?.click()}
                disabled={uploadingDoc === "nationalId"}
              >
                {uploadingDoc === "nationalId" ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 me-2" />
                )}
                {t("common.upload")}
              </Button>
            )}
          </div>

          <div
            className={`border-2 rounded-lg p-6 text-center transition-colors ${
              customer.contractUrl
                ? "border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20"
                : "border-dashed hover:border-primary/50"
            }`}
          >
            <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
              <FileCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h4 className="font-medium mb-1">Contract</h4>
            <p className="text-xs text-muted-foreground mb-3">{t("customers.form.contract")}</p>
            {customer.contractUrl ? (
              <div className="space-y-2">
                <Badge variant="default" className="text-xs bg-amber-600">
                  {t("common.uploaded")}
                </Badge>
                <div className="flex gap-2 justify-center mt-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(customer.contractUrl!, "_blank")}>
                    <Eye className="h-3 w-3 me-1" />
                    {t("blog.views")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDocumentDelete("contract")}
                    className="text-red-600 dark:text-red-300 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => contractInputRef.current?.click()}
                disabled={uploadingDoc === "contract"}
              >
                {uploadingDoc === "contract" ? (
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 me-2" />
                )}
                {t("common.upload")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

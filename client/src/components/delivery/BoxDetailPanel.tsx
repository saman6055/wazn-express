import { confirmAction } from "@/components/ConfirmDialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { useTranslation, createTranslator, getLanguageDirection, LANGUAGES, type Language } from "@/contexts/LanguageContext";
import { loadLocale } from "@/lib/i18nRegistry";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundManager";
import { useSystemAlert } from "@/components/SystemAlert";
import { useFailure } from "@/hooks/useFailure";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { absoluteLogoUrl } from "@/lib/absoluteLogoUrl";
import { companyContact, logoUrlOnDark } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { fmtKg, fmtNumber, fmtUsd } from "@/lib/portalFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  X,
  ScanBarcode,
  Lock,
  Truck,
  CheckCircle,
  Ban,
  Printer,
  FileText,
  FileDown,
  Trash2,
  Package,
  Loader2,
  Hash,
  Weight,
  DollarSign,
  RefreshCw,
  ChevronDown,
  Pencil,
  Wallet,
  Unlock,
  Send,
  Image as ImageIcon,
  Share2,
  Download,
} from "lucide-react";
import { EditBoxDialog } from "@/components/delivery/EditBoxDialog";
import { QuickSettleDialog } from "@/components/delivery/QuickSettleDialog";
import { OrderNote } from "@/components/scanner/OrderNote";
import { settlementTotals } from "@shared/boxSettlement";
import { receiptLanguageFor, receiptWhatsAppMessage, whatsappChatUrl, whatsappNumber, type ReceiptLanguage } from "@shared/receiptWhatsApp";
import { shareReceiptOnWhatsApp, type ReceiptShareDestination, type ReceiptShareFormat } from "@/lib/receiptShare";
import { CopyButton } from "@/components/CopyButton";
import { OrderNumbers } from "@/components/OrderNumbers";

/** Opening a finished box, and what the person is told before they do. */
const REOPEN_WORDS = {
  button: { ku: "کردنەوەی بۆکس", en: "Reopen the box", ar: "إعادة فتح الصندوق", zh: "重新打开箱子" },
  title: { ku: "کردنەوەی بۆکسی تەواوبوو", en: "Reopen a finished box", ar: "إعادة فتح صندوق منتهٍ", zh: "重新打开已完成的箱子" },
  body: {
    ku: "بۆکسەکە دەگەڕێتەوە بۆ «کراوە» و پاکەتەکانی لە «گەیەندراو» دەگەڕێنەوە بۆ «ئامادەی گەیاندن». پارە دەستی لێ نادرێت: ئەوەی دراوە هەر دراوە و وەک قەرزی پێشەکی لەسەر بۆکسەکە دەمێنێتەوە. بۆ گەڕاندنەوەی قەرز، واصڵەکە لە شاشەی پارەدانەوە هەڵبوەشێنەوە.",
    en: "The box goes back to open and its parcels from delivered to ready. The money is untouched: what was paid stays paid, as credit against this box. To put the debt back, undo the receipt on the payment screen.",
    ar: "يعود الصندوق إلى مفتوح وتعود طرودُه من مسلَّم إلى جاهز. المال لا يُمسّ: ما دُفع يبقى مدفوعاً كرصيد على هذا الصندوق. لإعادة الدين، ألغِ الإيصال من شاشة الدفع.",
    zh: "箱子回到打开状态，包裹从已送达回到待送达。款项保持不变：已付仍为已付，作为该箱子的预付。若要恢复欠款，请在付款页面撤销收据。",
  },
  reason: { ku: "هۆکار (پێویستە)", en: "Reason (required)", ar: "السبب (مطلوب)", zh: "原因（必填）" },
  confirm: { ku: "بیکەرەوە", en: "Reopen", ar: "أعد الفتح", zh: "重新打开" },
  done: { ku: "بۆکسەکە کرایەوە", en: "The box is open again", ar: "أُعيد فتح الصندوق", zh: "箱子已重新打开" },
} as const;

/** When a discount promised on a receipt could not be written down. */
const DISCOUNT_WORDS = {
  notRecorded: {
    ku: "داشکاندنەکە تۆمار نەکرا — وەسڵەکە چاپ نەکرا",
    en: "The discount was not recorded — nothing was printed",
    ar: "لم يُسجَّل الخصم — لم يُطبع شيء",
    zh: "折扣未被记录 — 未打印任何内容",
  },
} as const;

/** What the counter is told after pressing "send on WhatsApp". */
const SHARE_WORDS = {
  shared: {
    ku: "وەسڵەکە ئامادەیە — وەتسئاپ و کڕیارەکە هەڵبژێرە، تەنها Send ماوە",
    en: "The receipt is ready — pick WhatsApp and the customer, then press Send",
    ar: "الإيصال جاهز — اختر واتساب والزبون، ثم اضغط إرسال",
    zh: "收据已就绪 — 选择 WhatsApp 和客户，然后按发送",
  },
  copied: {
    ku: "وێنەی وەسڵ کۆپی کرا و چاتەکە کرایەوە — Ctrl+V بکە، دەقەکەش لەگەڵیدا دەچێت، ئینجا Enter",
    en: "The picture is on the clipboard and the chat is open — press Ctrl+V, then Enter",
    ar: "نُسخت صورة الإيصال وفُتحت المحادثة — اضغط Ctrl+V ثم Enter",
    zh: "收据图片已复制并打开聊天 — 按 Ctrl+V，然后回车",
  },
  chatOpened: {
    ku: "وەسڵەکە پاشەکەوت کرا و چاتی کڕیار کرایەوە — فایلەکە پێوە بکە و Send بکە",
    en: "The receipt was saved and the customer's chat opened — attach the file and press Send",
    ar: "حُفظ الإيصال وفُتحت محادثة الزبون — أرفق الملف ثم اضغط إرسال",
    zh: "收据已保存并打开客户聊天 — 附上文件后按发送",
  },
  noNumber: {
    ku: "وەسڵەکە پاشەکەوت کرا، بەڵام ئەم کڕیارە ژمارەی مۆبایلی نییە — چاتەکە خۆت بکەرەوە",
    en: "The receipt was saved, but this customer has no mobile number — open the chat yourself",
    ar: "حُفظ الإيصال، لكن لا يوجد رقم موبايل لهذا الزبون — افتح المحادثة بنفسك",
    zh: "收据已保存，但该客户没有手机号 — 请自行打开聊天",
  },
  saved: {
    ku: "وەسڵەکە خەزن کرا لە کۆمپیوتەر",
    en: "The receipt was saved to this computer",
    ar: "حُفظ الإيصال في هذا الحاسوب",
    zh: "收据已保存到这台电脑",
  },
  failed: {
    ku: "وێنەی وەسڵەکە دروست نەبوو — هیچ نەنێردرا. تکایە چاپی وەسڵ بەکاربهێنە",
    en: "The receipt picture could not be drawn — nothing was sent. Use print instead",
    ar: "تعذّر إنشاء صورة الإيصال — لم يُرسل شيء. استخدم الطباعة بدلاً من ذلك",
    zh: "无法生成收据图片 — 未发送任何内容。请改用打印",
  },
} as const;

// Languages offered for the printable box receipt / PDF. Staff can print
// any one regardless of the active UI language. Chinese is intentionally
// excluded — receipts are for local (KU/AR/EN) customers.
const RECEIPT_LANGUAGES: Language[] = ["ku", "ar", "en"];

// ── Continuous scanning tuning ──
// Hardware barcode scanners "type" a whole code in a rapid burst (a few ms
// per char). We auto-submit a scan WITHOUT requiring Enter when the chars
// arrive that fast, then settle on a short trailing pause. Manual typing is
// slower, so it never auto-fires — Enter still submits it explicitly.
const SCANNER_BURST_GAP_MS = 50;   // inter-key gap below this ⇒ hardware scanner
const SCAN_AUTOSUBMIT_MS = 110;    // trailing quiet time that marks "scan done"
import { printBoxLabel, printBoxReceipt, buildBoxReceiptHtml, downloadBoxReceiptPDF, normalizeCommissionDescription, receiptAmountUsd } from "@/lib/deliveryBoxPrintUtils";
import { ReceiptDinarDialog, type ReceiptDinarRequest, type ReceiptDiscount } from "@/components/delivery/ReceiptDinarDialog";
import { receiptDinar, type ReceiptDinarInput } from "@shared/receiptDinar";
import { pledgeLabel } from "@shared/pledgedDiscount";

type BoxStatus = "open" | "ready" | "in_transit" | "delivered" | "cancelled";

const STATUS_CONFIG: Record<BoxStatus, { className: string; key: string }> = {
  open: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", key: "delivery.statusOpen" },
  ready: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", key: "delivery.statusReady" },
  in_transit: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", key: "delivery.statusInTransit" },
  delivered: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", key: "delivery.statusDelivered" },
  cancelled: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", key: "delivery.statusCancelled" },
};

const METHOD_KEYS: Record<string, string> = {
  warehouse_pickup: "delivery.methodPickup",
  home_delivery: "delivery.methodHomeDelivery",
  city_transfer: "delivery.methodCityTransfer",
};

const ITEM_TYPE_STYLES: Record<string, string> = {
  regular: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  full_package: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  commission: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const ITEM_TYPE_KEYS: Record<string, string> = {
  regular: "delivery.typeRegular",
  full_package: "delivery.typeFullPackage",
  commission: "delivery.typeCommission",
};

interface Customer {
  id: number;
  fullName: string;
  customerCode: string;
  mobileNumber: string;
  address: string;
  city: string;
  [key: string]: any;
}

interface BoxDetailPanelProps {
  boxId: number;
  onClose: () => void;
  customers: Customer[];
}

export function BoxDetailPanel({ boxId, onClose, customers }: BoxDetailPanelProps) {
  const systemAlert = useSystemAlert();
  /**
   * One way to show a failure (hooks/useFailure): a refusal that carries its
   * steps opens the window where the steps are printed as steps, and
   * everything else stays the toast it was. A toast clamps to two lines, so
   * the steps arrived and were cut off below the fold.
   */
  const showFailure = useFailure();
  const company = useCompanyInfo();
  const { logoUrl } = company;
  const { t, language } = useTranslation();
  const isRtl = language === "ku" || language === "ar";
  const utils = trpc.useUtils();

  // Cancelling asks why. The box is not deleted — the mistake stays in the
  // record — so without a reason the row says only that something went wrong.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Deleting is the other case: a box that should never have existed at all,
  // rather than one that existed and was called off.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payingOpen, setPayingOpen] = useState(false);
  // Drawing the receipt takes a moment; the button says so rather than
  // looking dead while it happens.
  const [sharing, setSharing] = useState(false);
  /**
   * Opening a box that is already delivered or paid for (owner, 2026-09-22).
   *
   * Four cases he named, all the same shape: a box closed by mistake, one
   * counted as paid on a promise that was not kept, one the customer is
   * adding goods to, and one the office simply got wrong. The admin says why,
   * the box and its parcels go back a step, and the money is left exactly as
   * it is — a receipt is undone on the payment screen, which is what puts the
   * debt back.
   */
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  /**
   * Which language this receipt goes out in.
   *
   * The customer's nationality decides it, and that is right nearly always —
   * but a customer created without one falls back to Kurdish, and the owner
   * found an Arab customer being written to in Kurdish (2026-09-24). So the
   * guess is shown, and can be changed here before sending; the paper and the
   * message always follow the same choice.
   */
  const [sendLanguage, setSendLanguage] = useState<ReceiptLanguage | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenAsking, setReopenAsking] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  // Latest input value kept in a ref so submit reads the COMPLETE code even
  // when a scanner's trailing Enter fires before React re-renders (avoids the
  // classic stale-closure that drops the last char of a scan).
  const scanValueRef = useRef("");
  // Pending auto-submit timer + timestamp of the previous keystroke, used to
  // detect scanner-speed bursts (see SCANNER_BURST_GAP_MS).
  const scanDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyAtRef = useRef(0);

  // Fetch box data
  const { data: box, refetch: refetchBox } = trpc.deliveryBox.getById.useQuery(
    { id: boxId },
    { refetchInterval: 15000 }
  );

  // Read, not fetched twice: the settlement panel below runs the same query,
  // and TanStack hands both the one result. What the paper says and what the
  // screen says come from the same place.
  const { data: settlementView } = trpc.deliveryBox.settlementView.useQuery({ boxId });

  // Mutations
  const addItem = trpc.deliveryBox.addItem.useMutation({
    onSuccess: (data: any) => {
      toast.success(`${t("delivery.toastItemAdded")} ${data.item.trackingNumber}`);
      soundManager.playBeep();
      setScanInput("");
      refetchBox();
      scanInputRef.current?.focus();
    },
    onError: (err) => {
      /**
       * Two very different refusals arrive here, and they were being shown
       * the same way.
       *
       * A parcel already in a box is somebody scanning the same barcode
       * twice — the commonest thing that happens while filling one. Nothing
       * is lost, nothing is wrong, and stopping the screen dead for it, with
       * a button to find and press, is a tax on every box assembled.
       *
       * A parcel belonging to another customer is the opposite: it ends with
       * somebody's goods handed to the wrong person, and a notice that takes
       * itself away is a notice that gets missed.
       *
       * The server already tells them apart — CONFLICT for the first,
       * BAD_REQUEST or NOT_FOUND for the rest — so the code is read rather
       * than the sentence.
       */
      const routine = err.data?.code === "CONFLICT";
      systemAlert({
        kind: routine ? "warning" : "error",
        title: t("delivery.cannotAddToBox"),
        message: err.message,
        detail: scanInput,
        // Shown, said quietly, and gone. The caret stays in the scan box and
        // the gun keeps firing underneath it.
        ...(routine ? { autoDismissMs: 3500 } : {}),
      });
      setScanInput("");
      scanInputRef.current?.focus();
    },
  });

  const removeItem = trpc.deliveryBox.removeItem.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastItemRemoved"));
      refetchBox();
    },
    onError: (err) => showFailure(err),
  });

  const sealBox = trpc.deliveryBox.seal.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxSealed"));
      soundManager.playComplete();
      refetchBox();
    },
    onError: (err) => showFailure(err),
  });

  const reopenBox = trpc.deliveryBox.reopen.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxReopened"));
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => showFailure(err),
  });

  const markInTransit = trpc.deliveryBox.markInTransit.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxInTransit"));
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => showFailure(err),
  });

  const markDelivered = trpc.deliveryBox.markDelivered.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxDelivered"));
      soundManager.playComplete();
      refetchBox();
    },
    onError: (err) => showFailure(err),
  });

  const deleteBox = trpc.deliveryBox.delete.useMutation({
    onSuccess: (data: any) => {
      toast.success(t("delivery.toastBoxDeleted", { code: data?.boxCode ?? "" }));
      utils.deliveryBox.list.invalidate();
      onClose();
    },
    onError: (err) => showFailure(err),
  });

  /**
   * A discount promised on a receipt, written down before the paper prints.
   *
   * The owner, 2026-09-24: the payment screen must be in step with the
   * receipt — "you cannot lower it, only raise it." That only holds if the
   * promise outlives this screen, so it becomes a row before anything is
   * printed, and a refusal stops the printing rather than letting a promise
   * out of the building that nothing in the system knows about.
   *
   * Up here with the other mutations because every hook must run before the
   * screen's early returns, whatever the code that uses it looks like.
   */
  const pledgeDiscount = trpc.deliveryBox.pledgeDiscount.useMutation();

  const cancelBox = trpc.deliveryBox.cancel.useMutation({
    onSuccess: () => {
      toast.success(t("delivery.toastBoxCancelled"));
      onClose();
    },
    onError: (err) => showFailure(err),
  });

  // Recompute every package-linked item against current batch state. Used
  // to pull in packages added to the batch after the box was created and
  // to apply pricing/shared-tracking fixes that landed after the original
  // box build (the historical "missing sibling orders" issue).
  const recomputeItems = trpc.deliveryBox.recomputeItems.useMutation({
    onSuccess: (data: any) => {
      const parts: string[] = [];
      if (data.added > 0) parts.push(`+${data.added}`);
      if (data.updated > 0) parts.push(`✎${data.updated}`);
      if (data.removed > 0) parts.push(`−${data.removed}`);
      const summary = parts.length > 0 ? ` (${parts.join(" / ")})` : "";
      toast.success(`${t("delivery.toastBoxRefreshed")}${summary}`);
      soundManager.playSuccess();
      refetchBox();
    },
    onError: (err) => {
      showFailure(err);
      soundManager.playError();
    },
  });

  // Keep the cursor in the scan field for the whole open-box session so the
  // staff can scan one package after another without clicking back in — and so
  // no package is missed. Keyed on the item count too: every successful scan
  // triggers a box refetch that re-renders the items table, and that re-render
  // can drop the cursor. We restore it afterwards, but only when focus isn't on
  // another control (a button, a menu) — we must never steal focus the user
  // deliberately moved elsewhere.
  useEffect(() => {
    if (box?.status !== "open") return;
    const active = document.activeElement;
    const focusMovedElsewhere =
      active && active !== document.body && active !== scanInputRef.current;
    if (focusMovedElsewhere) return;
    scanInputRef.current?.focus();
  }, [box?.status, box?.items?.length]);

  const clearScanDebounce = () => {
    if (scanDebounceRef.current) {
      clearTimeout(scanDebounceRef.current);
      scanDebounceRef.current = null;
    }
  };

  // Submit whatever is currently in the input. Reads the ref (not state) so a
  // scanner's instant Enter can't fire before the last char lands. Clears the
  // field immediately so the next scan starts clean and the same code can't be
  // submitted twice from one burst (Enter + debounce both call this).
  const submitScan = () => {
    clearScanDebounce();
    const tracking = (scanValueRef.current || "").trim();
    if (!tracking) return;
    scanValueRef.current = "";
    setScanInput("");
    setIsScanning(true);
    addItem.mutate(
      { boxId, trackingNumber: tracking },
      { onSettled: () => setIsScanning(false) }
    );
  };

  const handleScanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    scanValueRef.current = val;
    setScanInput(val);

    const now = performance.now();
    const gap = now - lastKeyAtRef.current;
    lastKeyAtRef.current = now;

    clearScanDebounce();
    // Arm auto-submit ONLY for scanner-speed input. Manual typing (slow gaps)
    // never arms it, so it won't fire mid-typing — Enter handles that case.
    if (val.trim().length > 0 && gap < SCANNER_BURST_GAP_MS) {
      scanDebounceRef.current = setTimeout(submitScan, SCAN_AUTOSUBMIT_MS);
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitScan();
    }
  };

  // Cancel any pending auto-submit if the panel unmounts mid-scan.
  useEffect(() => () => clearScanDebounce(), []);

  // The receipt window's request (see askBeforePrinting). Every hook sits above
  // the early return below: under it, the render that waits for the box and the
  // render that has it call a different number of hooks, React throws, and a
  // box that is not already loaded cannot be opened.
  const [receiptRequest, setReceiptRequest] = useState<ReceiptDinarRequest | null>(null);

  if (!box) {
    return (
      <Card className="animate-pulse">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const copyLabel = pickLang(language, { ku: "کۆپی", en: "Copy", ar: "نسخ", zh: "复制" });

  const customer = customers.find((c) => c.id === box.customerId);
  const items = box.items ?? [];
  const status = box.status as BoxStatus;
  const isOpen = status === "open";
  const isReady = status === "ready";
  const isInTransit = status === "in_transit";
  // A delivered box was handed over and charged — a record, not a mistake.
  const isDelivered = status === "delivered";
  /** A box that has gone out or been handed over: only an admin comes back. */
  const canReopenFinished = isAdmin && (isInTransit || isDelivered || (isReady && !!(box as { isCharged?: boolean }).isCharged));
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;

  // Sea (دەریایی) batches are billed by CBM, not weight — the measurement
  // column/total switch to CBM to match the printed invoice.
  const isSea = (box as any).shippingType === "sea";
  const totalWeight = items.reduce((sum: number, i: any) => sum + Number(i.weightKg || 0), 0);
  const totalCbm = items.reduce((sum: number, i: any) => sum + Number(i.volumeCbm || 0), 0);
  const totalItemValue = items.reduce((sum: number, i: any) => sum + Number(i.calculatedCostUsd || 0), 0);
  const deliveryCharge = Number(box.deliveryChargeUsd || 0);
  const grandTotal = totalItemValue + deliveryCharge;
  // Advance / prepaid sum across commission and full-package items (the
  // server enriches each item with `advanceAppliedUsd`). Shown as a
  // negative chip next to the grand total + a separate "remaining due"
  // chip so the staff member knows what to actually collect.
  const advanceTotal = items.reduce((sum: number, i: any) => sum + (Number(i.advanceAppliedUsd || 0) || 0), 0);
  const hasAdvance = advanceTotal > 0;
  const remainingDue = Math.max(0, grandTotal - advanceTotal);

  const handlePrintLabel = () => {
    printBoxLabel(
      {
        boxCode: box.boxCode,
        status: box.status,
        deliveryMethod: box.deliveryMethod,
        destinationCity: box.destinationCity,
        destinationAddress: box.destinationAddress,
        recipientPhone: box.recipientPhone,
        deliveryCostUsd: box.deliveryCostUsd,
        deliveryChargeUsd: box.deliveryChargeUsd,
        totalPackages: box.totalPackages,
        totalWeightKg: box.totalWeightKg,
        totalValueUsd: box.totalValueUsd,
        shippingType: (box as any).shippingType,
        notes: box.notes,
        createdAt: box.createdAt,
      },
      items.map((i: any) => ({
        trackingNumber: i.trackingNumber,
        itemType: i.itemType,
        weightKg: i.weightKg,
        volumeCbm: i.volumeCbm,
        shippingType: i.shippingType,
        calculatedCostUsd: i.calculatedCostUsd,
        description: i.description,
        sourceInfo: i.sourceInfo,
      })),
      customer
        ? {
            fullName: customer.fullName,
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber,
            city: customer.city,
            address: customer.address,
          }
        : null,
      t,
      { logoUrl: absoluteLogoUrl(logoUrlOnDark(logoUrl)), company: companyContact(company, language) }
    );
  };

  // Receipt and PDF share the same data payload. The language is chosen at
  // print time (createTranslator + getLanguageDirection), independent of the
  // active UI language, so staff can hand each customer a receipt in ku/ar/en.
  const buildReceiptPayload = () =>
    [
      {
        boxCode: box.boxCode,
        status: box.status,
        deliveryMethod: box.deliveryMethod,
        destinationCity: box.destinationCity,
        destinationAddress: box.destinationAddress,
        recipientPhone: box.recipientPhone,
        deliveryCostUsd: box.deliveryCostUsd,
        deliveryChargeUsd: box.deliveryChargeUsd,
        totalPackages: box.totalPackages,
        totalWeightKg: box.totalWeightKg,
        totalValueUsd: box.totalValueUsd,
        shippingType: (box as any).shippingType,
        notes: box.notes,
        createdAt: box.createdAt,
      },
      items.map((i: any) => ({
        trackingNumber: i.trackingNumber,
        itemType: i.itemType,
        weightKg: i.weightKg,
        volumeCbm: i.volumeCbm,
        shippingType: i.shippingType,
        calculatedCostUsd: i.calculatedCostUsd,
        description: i.description,
        sourceInfo: i.sourceInfo,
        advanceAppliedUsd: i.advanceAppliedUsd,
      })),
      customer
        ? {
            fullName: customer.fullName,
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber,
            city: customer.city,
            address: customer.address,
          }
        : null,
    ] as const;

  /**
   * What the counter settled, for the printed sheet.
   *
   * The discount is nearly always agreed before the receipt is printed — the
   * box is nine hundred, call it eight-eighty — so the sheet has to show it
   * and total to the discounted figure. Read from the same query the
   * settlement panel uses, so the paper and the screen cannot disagree.
   *
   * Reversed receipts are skipped: their money went back.
   */
  /**
   * What is still owed on this box, for the payment button's own label.
   * Same query, same shared rule as the payment dialog — the button cannot
   * promise a figure the dialog then disagrees with.
   */
  const settlementDueUsd = settlementTotals(
    (settlementView?.parcels ?? []).filter((p) => p.outstandingUsd > 0 || p.notChargedYet),
  ).dueUsd;

  const settlementForPrint = (() => {
    const confirmed = (settlementView?.settlements ?? []).filter((s) => s.status === "confirmed");
    if (confirmed.length === 0) return undefined;
    const sum = (pick: (s: (typeof confirmed)[number]) => number) =>
      Math.round(confirmed.reduce((total, s) => total + pick(s), 0) * 100) / 100;
    return {
      discountUsd: sum((s) => Number(s.discountUsd || 0)),
      paidUsd: sum((s) => Number(s.paidUsd || 0)),
      amountIqd: sum((s) => Number(s.amountIqd || 0)),
      // The rate of the most recent one; they are all the same day in
      // practice, and a receipt showing two rates would raise more questions
      // than it answers.
      exchangeRate: Number(confirmed[0]?.exchangeRate ?? 0) || null,
      settlementNumber: confirmed[0]?.settlementNumber ?? null,
      debtUsd: sum((s) => (s.differenceKind === "debt" ? Number(s.differenceUsd || 0) : 0)),
    };
  })();

  const openPledges = settlementView?.pledges ?? [];

  /**
   * What the receipt says was taken off: the discounts already settled, plus
   * the one being given right now.
   *
   * One line on the paper, with its reason and — when it was given on one
   * parcel rather than the box — the tracking it was given on.
   */
  const receiptDiscount = (lang: Language, given: ReceiptDiscount | null) => {
    const settled = Number(settlementForPrint?.discountUsd ?? 0);
    const open = openPledges.reduce((most, p) => Math.max(most, Number(p.usd || 0)), 0);
    const now = given ? given.usd : open;
    const total = Math.round((settled + now) * 100) / 100;
    if (total <= 0) return { discountUsd: 0, discountReason: null as string | null };
    const source = given
      ? { reason: given.reason, note: given.note, trackingNumber: given.trackingNumber, lineId: given.lineId }
      : [...openPledges].sort((a, b) => b.usd - a.usd)[0] ?? null;
    const words = (lang === "ku" || lang === "en" || lang === "ar" || lang === "zh") ? lang : "ku";
    return {
      discountUsd: total,
      discountReason: source ? pledgeLabel(source, words) : null,
    };
  };

  const printReceiptNow = async (lang: Language, dinar: ReceiptDinarInput | null, given: ReceiptDiscount | null) => {
    // Locales load on demand now; fetch the chosen one before translating a
    // document that is about to be printed.
    await loadLocale(lang);
    const [b, its, c] = buildReceiptPayload();
    printBoxReceipt(b, its, c, createTranslator(lang), {
      direction: getLanguageDirection(lang),
      logoUrl: absoluteLogoUrl(logoUrlOnDark(logoUrl)),
      company: companyContact(company, lang),
      settlement: { ...settlementForPrint, ...receiptDiscount(lang, given) },
      dinar,
    });
  };

  const downloadReceiptNow = async (lang: Language, dinar: ReceiptDinarInput | null, given: ReceiptDiscount | null) => {
    await loadLocale(lang);
    const [b, its, c] = buildReceiptPayload();
    downloadBoxReceiptPDF(b, its, c, createTranslator(lang), {
      direction: getLanguageDirection(lang),
      logoUrl: absoluteLogoUrl(logoUrlOnDark(logoUrl)),
      company: companyContact(company, lang),
      settlement: { ...settlementForPrint, ...receiptDiscount(lang, given) },
      dinar,
    });
  };

  /**
   * The window before printing: the day's rate and any advance received by
   * hand (owner, 2026-09-17). A box already paid for skips it — its receipt
   * already says what was paid, in dinars and at what rate.
   */
  const askBeforePrinting = (
    lang: Language,
    output: (lang: Language, dinar: ReceiptDinarInput | null, given: ReceiptDiscount | null) => Promise<void>,
    action: "print" | "send" = "print",
  ) => {
    // Ready before the print button is pressed, so the window opens at once.
    void loadLocale(lang);
    setReceiptRequest({
      boxCode: box.boxCode,
      customerName: customer?.fullName,
      customerCode: customer?.customerCode,
      parcelCount: box.totalPackages ?? items.length,
      totalUsd: receiptAmountUsd(box, settlementForPrint),
      /**
       * A discount may be given on the whole total or on one tracking
       * (owner, 2026-09-24): "the customer said one parcel was broken, so I
       * had to give twenty dollars on it — that discount was for one
       * tracking, not for the total."
       *
       * Only offered while something is still owed on the box: a discount on
       * a box already paid in full has no money to come off, and putting the
       * field there would promise the customer something no screen could
       * then give them.
       */
      parcels: (settlementView?.parcels ?? [])
        .filter((p) => p.outstandingUsd > 0 || p.notChargedYet)
        .map((p) => ({
          lineId: p.lineId,
          trackingNumber: p.trackingNumber,
          packageCode: p.packageCode,
          chargedUsd: p.chargedUsd,
        })),
      pledges: openPledges,
      canDiscount: settlementDueUsd > 0,
      // The same window for both; its button says which one it is
      // (owner, 2026-09-21).
      action,
      // A box already paid for opens the window too, at the rate its payment
      // used, so a corrected receipt can be priced in dinars again rather
      // than going out with none (owner, 2026-09-22).
      rate: settlementForPrint?.exchangeRate ?? null,
      onConfirm: (dinar, given) => void printWithPledge(lang, dinar, given, output),
    });
  };

  /**
   * Write the promise down, then print — never the other way round.
   *
   * If recording it fails, nothing is printed. A receipt in a customer's
   * hand that the system does not know about is exactly the drift the owner
   * asked to be rid of, and a refusal here (the discount is lower than one
   * already promised, the parcel is not in this box) is something the person
   * at the counter has to read before the paper exists.
   */
  const printWithPledge = async (
    lang: Language,
    dinar: ReceiptDinarInput | null,
    given: ReceiptDiscount | null,
    output: (lang: Language, dinar: ReceiptDinarInput | null, given: ReceiptDiscount | null) => Promise<void>,
  ) => {
    if (given) {
      try {
        await pledgeDiscount.mutateAsync({
          boxId,
          lineId: given.lineId,
          discountUsd: given.usd,
          reason: given.reason,
          note: given.note ?? undefined,
        });
        await utils.deliveryBox.settlementView.invalidate({ boxId });
      } catch (err: any) {
        systemAlert({
          kind: "error",
          title: pickLang(language, DISCOUNT_WORDS.notRecorded),
          message: err?.message ?? String(err),
        });
        return;
      }
    }
    await output(lang, dinar, given);
  };
  /**
   * The receipt on the customer's WhatsApp (owner, 2026-09-21).
   *
   * Same receipt, same window before it — the day's rate and any advance —
   * and then the paper is drawn as a picture, put in a PDF, and handed to
   * the share sheet with the message. The language is the customer's own,
   * from the nationality chosen when they were created; nothing is asked,
   * because there is nothing here the counter needs to decide.
   */
  const shareReceiptNow = async (
    lang: Language,
    dinar: ReceiptDinarInput | null,
    given: ReceiptDiscount | null,
    format: ReceiptShareFormat = "image",
    destination: ReceiptShareDestination = "whatsapp",
  ) => {
    await loadLocale(lang);
    const [b, its, c] = buildReceiptPayload();
    const discounted = receiptDiscount(lang, given);
    const html = buildBoxReceiptHtml(b, its, c, createTranslator(lang), {
      direction: getLanguageDirection(lang),
      logoUrl: absoluteLogoUrl(logoUrlOnDark(logoUrl)),
      company: companyContact(company, lang),
      settlement: { ...settlementForPrint, ...discounted },
      dinar,
    });
    // The same figures the paper carries: the dinars go in the message too,
    // because that is the number the customer is actually asked for
    // (owner, 2026-09-22).
    // The message quotes what the paper says, discount and all.
    const totalUsd = receiptAmountUsd(box, discounted);
    const figures = receiptDinar(totalUsd, dinar);
    const message = receiptWhatsAppMessage(sendLanguage ?? receiptLanguageFor((customer as any)?.nationality), {
      boxCode: box.boxCode,
      parcelCount: box.totalPackages ?? items.length,
      totalUsd,
      totalIqd: figures?.totalIqd ?? null,
    });
    const number = whatsappNumber(customer?.mobileNumber);
    setSharing(true);
    try {
      const outcome = await shareReceiptOnWhatsApp({
        html,
        format,
        destination,
        fileName: box.boxCode,
        message,
        chatUrl: number ? whatsappChatUrl(number, message) : null,
      });
      if (outcome === "shared") {
        toast.success(pickLang(language, SHARE_WORDS.shared));
      } else if (outcome === "copied") {
        toast.success(pickLang(language, SHARE_WORDS.copied), { duration: 10000 });
      } else if (outcome === "chat_opened") {
        toast.info(pickLang(language, number ? SHARE_WORDS.chatOpened : SHARE_WORDS.noNumber), { duration: 10000 });
      } else if (outcome === "saved") {
        toast.success(pickLang(language, SHARE_WORDS.saved));
      } else if (outcome === "failed") {
        toast.error(pickLang(language, SHARE_WORDS.failed), { duration: 10000 });
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePrintReceipt = (lang: Language) => askBeforePrinting(lang, printReceiptNow);
  /**
   * The customer's own language, so the receipt reads as their receipt — and
   * their own choice of file: a PDF to keep, or a picture that opens in the
   * chat itself (owner, 2026-09-21, after sending the first one).
   */
  const handleSendOnWhatsApp = (format: ReceiptShareFormat, destination: ReceiptShareDestination = "whatsapp") =>
    askBeforePrinting(
      (sendLanguage ?? receiptLanguageFor((customer as any)?.nationality)) as Language,
      (lang, dinar, given) => shareReceiptNow(lang, dinar, given, format, destination),
      "send",
    );
  const handleDownloadReceiptPDF = (lang: Language) => askBeforePrinting(lang, downloadReceiptNow);

  return (
    <Card dir={isRtl ? "rtl" : "ltr"} className="border-primary/20 shadow-md">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-mono text-lg">{box.boxCode}</CardTitle>
                <CopyButton value={box.boxCode} label={copyLabel} />
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusCfg.className)}>
                  {t(statusCfg.key)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {customer?.fullName || "-"} ({customer?.customerCode || ""}) &middot;{" "}
                {t(METHOD_KEYS[box.deliveryMethod] || METHOD_KEYS.warehouse_pickup)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Scan Input (only when box is open) */}
        {isOpen && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                placeholder={t("delivery.scanPlaceholder")}
                value={scanInput}
                onChange={handleScanChange}
                onKeyDown={handleScanKeyDown}
                onBlur={() => {
                  // Keep focus on the field during a scanning session so the
                  // next scan always lands here — unless focus moved to another
                  // control (button/menu), which we must not steal.
                  if (box?.status === "open") {
                    setTimeout(() => {
                      if (!document.activeElement || document.activeElement === document.body) {
                        scanInputRef.current?.focus();
                      }
                    }, 0);
                  }
                }}
                className="ps-9 font-mono"
                dir="ltr"
                autoFocus
              />
            </div>
            <Button onClick={submitScan} disabled={isScanning || !scanInput.trim()}>
              {isScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanBarcode className="h-4 w-4 me-1" />
              )}
              {t("delivery.scan")}
            </Button>
          </div>
        )}

        {/* Items Table — Rich detail per item type */}
        {items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="w-[56px]">{t("delivery.image")}</TableHead>
                  <TableHead>{t("delivery.type")}</TableHead>
                  <TableHead>{t("delivery.tracking")}</TableHead>
                  <TableHead>{t("delivery.details")}</TableHead>
                  <TableHead>{t("delivery.source")}</TableHead>
                  <TableHead className="text-end">{isSea ? "CBM" : t("delivery.weight")}</TableHead>
                  <TableHead className="text-end">{t("delivery.price")}</TableHead>
                  {isOpen && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, idx: number) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    {/* Product photo (from the linked order / package). Click to
                        open full size in a new tab; placeholder when absent. */}
                    <TableCell>
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt=""
                          loading="lazy"
                          onClick={() => window.open(item.productImage, "_blank", "noopener,noreferrer")}
                          className="h-11 w-11 rounded-md border object-cover cursor-zoom-in transition-transform hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-muted/40">
                          <Package className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    {/* Type Badge */}
                    <TableCell>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", ITEM_TYPE_STYLES[item.itemType] || ITEM_TYPE_STYLES.regular)}>
                        {t(ITEM_TYPE_KEYS[item.itemType] || ITEM_TYPE_KEYS.regular)}
                      </span>
                    </TableCell>
                    {/* Tracking Number + copy */}
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {item.trackingNumber ? (
                        <span className="inline-flex items-center gap-1">
                          <span>{item.trackingNumber}</span>
                          <CopyButton value={item.trackingNumber} label={copyLabel} />
                        </span>
                      ) : (
                        "-"
                      )}
                      <OrderNumbers numbers={item.orderNumbers} className="flex font-sans" />
                    </TableCell>
                    {/* Details — varies by item type. Commission descriptions
                        are normalized so legacy 3-part breakdowns show in
                        the new combined shape (item+commission as a single
                        "نرخی بەرهەم"). */}
                    <TableCell className="text-xs max-w-[200px]">
                      {(() => {
                        const displayDesc = item.itemType === 'commission'
                          ? normalizeCommissionDescription(item.description)
                          : (item.description || '');
                        return displayDesc ? (
                          <p className="font-medium truncate" title={displayDesc}>{displayDesc}</p>
                        ) : null;
                      })()}
                      {item.itemType === 'commission' && item.calculatedCostUsd && (
                        <p className="text-muted-foreground">{t("delivery.totalWithCommission")}: <span className="font-mono font-semibold text-amber-600 dark:text-amber-300">{fmtUsd(Number(item.calculatedCostUsd || 0))}</span></p>
                      )}
                      {item.itemType === 'full_package' && item.calculatedCostUsd && (
                        <p className="text-muted-foreground">{t("delivery.sellingPrice")}: <span className="font-mono font-semibold text-purple-600 dark:text-purple-300">{fmtUsd(Number(item.calculatedCostUsd || 0))}</span></p>
                      )}
                      {/* Whatever was written on the order when it was taken.
                          The person packing the box is the one who needs it. */}
                      <OrderNote note={(item as any).orderNote} compact className="mt-1.5" />
                    </TableCell>
                    {/* Source (batch code / order code). sourceInfo comes as
                        "CM-A + CM-B - باچ AIR-2026-028" (or just "باچ …") —
                        split it so each order code gets its own copy button. */}
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {(() => {
                        const src = String(item.sourceInfo || "");
                        if (!src) return "-";
                        const m = src.match(/^(.+?)\s-\s(باچ\s.+)$/);
                        const orderCodes = m
                          ? m[1].split(" + ").map((s: string) => s.trim()).filter(Boolean)
                          : [];
                        const batchPart = m ? m[2] : src;
                        return (
                          <div className="space-y-0.5">
                            {orderCodes.map((code: string) => (
                              <div key={code} className="flex items-center gap-1" dir="ltr">
                                <span className="font-semibold text-foreground">{code}</span>
                                <CopyButton value={code} label={copyLabel} />
                              </div>
                            ))}
                            <div>{batchPart}</div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    {/* Weight (kg) or volume (CBM) for sea batches */}
                    <TableCell className="text-end font-mono text-xs">
                      {isSea
                        ? `${fmtNumber(Number(item.volumeCbm || 0), 3)} CBM`
                        : fmtKg(Number(item.weightKg || 0))}
                    </TableCell>
                    {/* Price */}
                    <TableCell className="text-end font-mono text-sm font-semibold">
                      {fmtUsd(Number(item.calculatedCostUsd || 0))}
                    </TableCell>
                    {isOpen && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeItem.mutate({ itemId: item.id })}
                          disabled={removeItem.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-muted-foreground">
            <Package className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">{t("delivery.noItems")}</p>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Hash className="h-3 w-3" />
              {t("delivery.packageCount")}
            </p>
            <p className="text-lg font-bold">{box.totalPackages || items.length}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Weight className="h-3 w-3" />
              {isSea ? t("delivery.totalVolume") : t("delivery.totalWeight")}
            </p>
            <p className="text-lg font-bold">{isSea ? `${fmtNumber(totalCbm, 3)} CBM` : fmtKg(totalWeight)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3" />
              {t("delivery.packageValue")}
            </p>
            <p className="text-lg font-bold">{fmtUsd(totalItemValue)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Truck className="h-3 w-3" />
              {t("delivery.deliveryCharge")}
            </p>
            <p className="text-lg font-bold text-primary">{fmtUsd(deliveryCharge)}</p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-primary font-medium">{t("delivery.grandTotal")}</p>
            <p className="text-xl font-extrabold text-primary">{fmtUsd(grandTotal)}</p>
          </div>
        </div>

        {/* Advance / prepaid summary — only rendered when at least one
            commission or full-package item in the box was prepaid. Keeps
            the staff member from collecting twice. */}
        {hasAdvance && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3 text-center">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">💰 {pickLang(language, { ku: "پارەی پێشەکی دراو", en: "Advance paid", ar: "الدفعة المقدمة المدفوعة", zh: "已付预付款" })}</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">−{fmtUsd(advanceTotal)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800/60 p-3 text-center">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">{pickLang(language, { ku: "ماوە بۆ دان", en: "Remaining due", ar: "المبلغ المتبقي", zh: "应付余额" })}</p>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{fmtUsd(remainingDue)}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {/* First in the row, and carrying the figure: with the box open in
              front of you, taking the money should not mean going back to the
              list to find the same box again. */}
          <Button
            onClick={() => setPayingOpen(true)}
            disabled={settlementDueUsd <= 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            data-testid="box-take-payment"
          >
            <Wallet className="h-4 w-4 me-1" />
            {t("delivery.takePayment")}
            {settlementDueUsd > 0
              ? ` — ${fmtUsd(settlementDueUsd)}`
              : ` · ${pickLang(language, {
                  ku: "واصڵ کراوە", en: "settled", ar: "تم الاستلام", zh: "已结清",
                })}`}
          </Button>

          {isOpen && (
            <Button
              onClick={() => sealBox.mutate({ id: boxId })}
              disabled={sealBox.isPending || items.length === 0}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {sealBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Lock className="h-4 w-4 me-1" />}
              {t("delivery.sealBox")}
            </Button>
          )}

          {isReady && (
            <Button
              onClick={() => markInTransit.mutate({ id: boxId })}
              disabled={markInTransit.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {markInTransit.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Truck className="h-4 w-4 me-1" />}
              {t("delivery.markInTransit")}
            </Button>
          )}

          {/* Reopen a sealed (but not-yet-shipped) box so staff can add/remove
              packages or fix the shipping price, then re-seal. */}
          {isReady && (
            <Button
              variant="outline"
              onClick={async () => {
                if (await confirmAction(t("delivery.confirmReopen"))) {
                  reopenBox.mutate({ id: boxId });
                }
              }}
              disabled={reopenBox.isPending}
              className="text-amber-700 dark:text-amber-300 hover:text-amber-800 hover:bg-amber-50 hover:border-amber-200"
            >
              {reopenBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Unlock className="h-4 w-4 me-1" />}
              {t("delivery.reopenBox")}
            </Button>
          )}

          {/* The admin's way back from "finished" (owner, 2026-09-22). */}
          {canReopenFinished && (
            <Button
              variant="outline"
              onClick={() => { setReopenReason(""); setReopenAsking(true); }}
              disabled={reopenBox.isPending}
              className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200"
            >
              {reopenBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Unlock className="h-4 w-4 me-1" />}
              {pickLang(language, REOPEN_WORDS.button)}
            </Button>
          )}

          {/* Edit shipping price + delivery details. Available while the box is
              still open or sealed — i.e. before it ships and the wallet is charged. */}
          {(isOpen || isReady) && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 me-1" />
              {t("delivery.editBox")}
            </Button>
          )}

          {isInTransit && (
            <Button
              onClick={() => markDelivered.mutate({ id: boxId })}
              disabled={markDelivered.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {markDelivered.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <CheckCircle className="h-4 w-4 me-1" />}
              {t("delivery.markDelivered")}
            </Button>
          )}

          {(isOpen || isReady) && (
            <Button
              variant="destructive"
              onClick={() => { setCancelReason(""); setCancelOpen(true); }}
              disabled={cancelBox.isPending}
            >
              {cancelBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Ban className="h-4 w-4 me-1" />}
              {t("delivery.cancelBox")}
            </Button>
          )}

          {!isDelivered && (
            <Button variant="outline" onClick={() => setDeleteOpen(true)} disabled={deleteBox.isPending}>
              {deleteBox.isPending ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Trash2 className="h-4 w-4 me-1 text-red-500 dark:text-red-400" />}
              {t("delivery.deleteBox")}
            </Button>
          )}

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
                  {t("delivery.deleteBox")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("delivery.deleteBoxConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteBox.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteBox.mutate({ id: boxId }, { onSuccess: () => setDeleteOpen(false) });
                  }}
                >
                  {deleteBox.isPending ? "..." : t("forms.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-500 dark:text-red-400" />
                  {t("delivery.cancelBox")}
                </AlertDialogTitle>
                <AlertDialogDescription>{t("delivery.cancelBoxWhy")}</AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("delivery.cancelReasonPlaceholder")}
                autoFocus
              />
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  // Three characters is not a reason. Better to keep the
                  // dialog open than to store "x" and call it a record.
                  disabled={cancelReason.trim().length < 3 || cancelBox.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    cancelBox.mutate(
                      { id: boxId, reason: cancelReason.trim() },
                      { onSuccess: () => setCancelOpen(false) }
                    );
                  }}
                >
                  {cancelBox.isPending ? "..." : t("delivery.cancelBox")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex-1" />

          {(isOpen || isReady) && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (await confirmAction(t("delivery.confirmRefresh"))) {
                  recomputeItems.mutate({ id: boxId });
                }
              }}
              disabled={recomputeItems.isPending}
              className="text-blue-700 dark:text-blue-300 hover:text-blue-800 hover:bg-blue-50 hover:border-blue-200"
              title={t("delivery.refreshBoxTooltip")}
            >
              {recomputeItems.isPending ? (
                <Loader2 className="h-4 w-4 me-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 me-1" />
              )}
              {t("delivery.refreshBox")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrintLabel}>
            <Printer className="h-4 w-4 me-1" />
            {t("delivery.printLabel")}
          </Button>
          {/* Print receipt — pick language (KU / AR / EN) at print time */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 me-1" />
                {t("delivery.printReceipt")}
                <ChevronDown className="h-3 w-3 ms-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("delivery.printReceipt")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RECEIPT_LANGUAGES.map((lang) => {
                const info = LANGUAGES.find((l) => l.code === lang);
                return (
                  <DropdownMenuItem key={lang} onClick={() => handlePrintReceipt(lang)}>
                    <span className="me-2">{info?.flag}</span>
                    {info?.nativeName}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Straight to the customer's WhatsApp: same receipt, their own
              language, the share sheet doing the attaching (owner, 2026-09-21). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={sharing}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300"
              >
                {sharing ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Send className="h-4 w-4 me-1" />}
                {pickLang(language, { ku: "ناردنی وەسڵ", en: "Send receipt", ar: "إرسال الإيصال", zh: "发送收据" })}
                <ChevronDown className="h-3 w-3 ms-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {pickLang(language, { ku: "ناردن بۆ وەتسئاپ", en: "Send on WhatsApp", ar: "إرسال عبر واتساب", zh: "通过 WhatsApp 发送" })}
              </DropdownMenuLabel>
              {/* The language the paper and the message will both be in. It
                  comes from the customer's nationality; a customer created
                  without one used to be written to in Kurdish with nobody the
                  wiser (owner, 2026-09-24). */}
              <div className="px-2 pb-1.5">
                <p className="mb-1 text-[11px] text-muted-foreground">
                  {pickLang(language, { ku: "زمانی وەسڵ و پەیام", en: "Receipt and message language", ar: "لغة الإيصال والرسالة", zh: "收据与消息语言" })}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {(["ku", "ar", "en"] as const).map((code) => {
                    const chosen = (sendLanguage ?? receiptLanguageFor((customer as any)?.nationality)) === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={(e) => { e.preventDefault(); setSendLanguage(code); }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          chosen
                            ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
                        )}
                        data-testid={`receipt-language-${code}`}
                      >
                        {code === "ku" ? "کوردی" : code === "ar" ? "عربي" : "English"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSendOnWhatsApp("image")}>
                <ImageIcon className="h-4 w-4 me-2 opacity-70" />
                {pickLang(language, { ku: "وەتسئاپ — وەک وێنە", en: "WhatsApp — as a picture", ar: "واتساب — كصورة", zh: "WhatsApp — 图片" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSendOnWhatsApp("pdf")}>
                <FileDown className="h-4 w-4 me-2 opacity-70" />
                {pickLang(language, { ku: "وەتسئاپ — وەک PDF", en: "WhatsApp — as a PDF", ar: "واتساب — كملف PDF", zh: "WhatsApp — PDF" })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* For whatever else comes up: any app on the machine, or just
                  the file (owner, 2026-09-21). */}
              <DropdownMenuItem onClick={() => handleSendOnWhatsApp("image", "share")}>
                <Share2 className="h-4 w-4 me-2 opacity-70" />
                {pickLang(language, { ku: "شێر بۆ بەرنامەیەکی تر", en: "Share with another app", ar: "مشاركة مع تطبيق آخر", zh: "分享到其他应用" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSendOnWhatsApp("image", "save")}>
                <Download className="h-4 w-4 me-2 opacity-70" />
                {pickLang(language, { ku: "خەزنکردن — وێنە", en: "Save the picture", ar: "حفظ الصورة", zh: "保存图片" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSendOnWhatsApp("pdf", "save")}>
                <Download className="h-4 w-4 me-2 opacity-70" />
                {pickLang(language, { ku: "خەزنکردن — PDF", en: "Save the PDF", ar: "حفظ ملف PDF", zh: "保存 PDF" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Download PDF — same language choice */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-red-700 dark:text-red-300 hover:text-red-800 hover:bg-red-50 hover:border-red-200"
              >
                <FileDown className="h-4 w-4 me-1" />
                PDF
                <ChevronDown className="h-3 w-3 ms-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>PDF</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RECEIPT_LANGUAGES.map((lang) => {
                const info = LANGUAGES.find((l) => l.code === lang);
                return (
                  <DropdownMenuItem key={lang} onClick={() => handleDownloadReceiptPDF(lang)}>
                    <span className="me-2">{info?.flag}</span>
                    {info?.nativeName}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      <AlertDialog open={reopenAsking} onOpenChange={setReopenAsking}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{pickLang(language, REOPEN_WORDS.title)}</AlertDialogTitle>
            <AlertDialogDescription>{pickLang(language, REOPEN_WORDS.body)}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="reopen-reason">
              {pickLang(language, REOPEN_WORDS.reason)}
            </label>
            <Input
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              data-testid="reopen-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={reopenReason.trim().length < 3 || reopenBox.isPending}
              onClick={(e) => {
                e.preventDefault();
                reopenBox.mutate(
                  { id: boxId, reason: reopenReason.trim() },
                  { onSuccess: () => { setReopenAsking(false); toast.success(pickLang(language, REOPEN_WORDS.done)); } },
                );
              }}
              data-testid="reopen-confirm"
            >
              {reopenBox.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {pickLang(language, REOPEN_WORDS.confirm)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickSettleDialog
        boxId={payingOpen ? boxId : null}
        onOpenChange={(o) => setPayingOpen(o)}
        onSettled={() => refetchBox()}
      />

      <EditBoxDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        box={box}
        onSaved={() => refetchBox()}
      />
      <ReceiptDinarDialog request={receiptRequest} onClose={() => setReceiptRequest(null)} />
    </Card>
  );
}

import type { CheckId, Localised } from "./auditSweep";

/**
 * How to put each audit finding right, step by step (owner, 2026-10-30: the
 * problem and its cure in one place). Kept apart from the catalogue: that file
 * says what a finding means, this one says what to do about it.
 *
 * Money that disagrees with its own history is never typed over by hand: the
 * step says to read it and send it on, because a hand correction hides the
 * fault and leaves a second one (manual adjustment, then a box receipt).
 *
 * Written for the Erbil office, so Arabic and Chinese read the English.
 */
const step = (ku: string, en: string): Localised => ({ ku, en, ar: en, zh: en });

const SEND_ON = step("بە دەست مەیگۆڕە: ژمارەکان کۆپی بکە و بیاننێرە بۆ Claude", "Do not change it by hand: copy the numbers and send them to Claude");

export const FIX_STEPS: Record<CheckId, Localised[]> = {
  staff_without_work_location: [
    step("لاپەڕەی بەڕێوەبردنی ستاف بکەرەوە", "Open staff management"),
    step("ئەو کارمەندە بدۆزەوە و شوێنی کاری دیاری بکە: چین یان عێراق", "Find the staff member and set their work place: China or Iraq"),
  ],
  invoice_total_mismatch: [
    step("پسووڵەکە بکەرەوە و ڕیزەکانی بە کۆی گشتی بەراورد بکە", "Open the invoice and compare its lines with its total"),
    SEND_ON,
  ],
  invoice_paid_but_unbalanced: [
    step("پسووڵەکە بکەرەوە و بزانە پارەکەی بەڕاستی دراوە یان نا", "Open the invoice and see whether it was really paid"),
    step("دۆخەکەی ڕاست بکەرەوە، یان ئەگەر نەتوانرا بینێرە بۆ Claude", "Put its status right, or send it to Claude if that cannot be done"),
  ],
  account_balance_drift: [
    step("حیسابی کڕیار لە بەشی دارایی بکەرەوە", "Open the customer's account under Finance"),
    SEND_ON,
  ],
  cash_account_drift: [
    step("حسابەکە بکەرەوە و دوایین جووڵەکانی بپشکنە", "Open the account and read its latest movements"),
    SEND_ON,
  ],
  partner_books_drift: [
    step("لاپەڕەی هاوبەشان بکەرەوە و جووڵەکانی ئەو هاوبەشە بپشکنە", "Open partners and read that partner's movements"),
    SEND_ON,
  ],
  ownership_not_whole: [
    step("لاپەڕەی هاوبەشان بکەرەوە", "Open partners"),
    step("ڕێژەکان ڕاست بکەرەوە تا کۆیان ببێتە 100٪", "Correct the shares until they add up to 100%"),
  ],
  orphan_package_batch: [
    step("کۆدی پاکەتەکە کۆپی بکە و لە «هەموو پاکەتەکان» بیدۆزەوە", "Copy the parcel code and find it in all parcels"),
    step("لە دەستکاری، باچێکی ڕاستی بۆ هەڵبژێرە", "In its edit window, choose a real batch for it"),
  ],
  orphan_transaction_account: [SEND_ON],
  duplicate_customer_code: [
    step("کۆدەکە لە لیستی کڕیاران بگەڕێ و هەردوو کڕیارەکە بکەرەوە", "Search the code in customers and open both"),
    step("بڕیار بدە کامیان کۆدێکی نوێی پێویستە", "Decide which of them needs a new code"),
    step("پێش گۆڕین، بزانە پاکەت و پارەی کامیان لەسەرە", "Before changing it, see which of them holds parcels and money"),
  ],
  duplicate_tracking_number: [
    step("تراکەکە لە «هەموو پاکەتەکان» بگەڕێ", "Search the tracking in all parcels"),
    step("بزانە یەک پاکەتە دوو جار تۆمار کراوە یان دوو پاکەتی جیایە", "See whether it is one parcel registered twice or two different parcels"),
    step("ئەگەر دووبارەیە، پێش سڕینەوە بزانە کامیان پارەی لەسەرە", "If it is a repeat, see which holds money before deleting"),
  ],
  negative_weight: [
    step("کۆدی پاکەتەکە لە «هەموو پاکەتەکان» بدۆزەوە", "Find the parcel code in all parcels"),
    step("بیکێشەوە و کێشی ڕاست بنووسە، Enter پاشەکەوتی دەکات", "Weigh it, write the true weight, and Enter saves it"),
  ],
  zero_price_sale: [
    step("ئۆردەرەکە لە کڕین بە تێچوو بکەرەوە", "Open the order under buy at cost"),
    step("ئەگەر بەئەنقەست نەبووە، نرخی فرۆشتن بنووسە", "If it was not on purpose, write the selling price"),
  ],
  batch_overdue: [
    step("باچەکە لە لیستی باچەکان بکەرەوە", "Open the batch in the batch list"),
    step("ئەگەر تەواو بووە دایبخە، ئەگەر نا بزانە لە چ قۆناغێک وەستاوە", "Close it if it is finished; if not, see which stage it stopped at"),
  ],
  batch_unwatched: [
    step("باچەکە بکەرەوە و ژمارەی فڕین بنووسە", "Open the batch and write its flight number"),
  ],
  package_never_batched: [
    step("کۆدی پاکەتەکە لە «هەموو پاکەتەکان» بدۆزەوە", "Find the parcel code in all parcels"),
    step("بزانە هێشتا لە کۆگایە، ئینجا بیخەرە باچێکی کراوە", "Check it is still in the depot, then put it in an open batch"),
  ],
  package_arrived_undelivered: [
    step("کڕیارەکە لە «گەیاندن بە کڕیار» بکەرەوە", "Open the customer in customer delivery"),
    step("پاکەتەکە بخەرە بۆکسەکەی و پەیوەندی بە کڕیارەوە بکە", "Put the parcel in their box and contact the customer"),
  ],
  unclaimed_no_request: [
    step("لیستی پاکەتی بێ خاوەن بکەرەوە", "Open the unclaimed parcels list"),
    step("لە وێنە و تراکەکەوە خاوەنەکەی بدۆزەوە و بۆی دابنێ", "Find the owner from its photo and tracking, and assign it"),
  ],
  debt_unreminded: [
    step("لیستی قەرزداران بکەرەوە", "Open the debtors list"),
    step("بیرخستنەوەیەک بۆ کڕیارەکە بنێرە", "Send the customer a reminder"),
  ],
  batch_cost_not_below_price: [
    step("باچەکە بکەرەوە و بچۆ «قەبارە و تێچوو»", "Open the batch and go to volume and cost"),
    step("بزانە کۆی پارەی کارگۆ لە خانەی تێچووی کیلۆ نەنووسراوە", "Check the cargo total was not written in the per-kg cost box"),
    step("ژمارەکە ڕاست بکەرەوە، یان ئەگەر زیانەکە ڕاستە وازی لێ بهێنە", "Correct the figure, or leave it if the loss is real"),
  ],
  batch_closed_without_cost: [
    step("باچەکە بکەرەوە و بچۆ «قەبارە و تێچوو»", "Open the batch and go to volume and cost"),
    step("کێش و پارەی وەسڵی کۆمپانیا بنووسە و پاشەکەوتی بکە", "Write the carrier invoice's kilos and money, and save"),
  ],
  rounding_cent_debt: [
    step("بۆکسەکە لە ژمارەی وەسڵەوە بکەرەوە", "Open the box from its receipt number"),
    step("بزانە کڕیار بەڕاستی ئەو چەند سەنتەی قەرزارە یان نا", "See whether the customer really owes those cents"),
    SEND_ON,
  ],
  payment_without_ledger: [
    step("ژمارەی پارەدان یان وەسڵەکە بکەرەوە و بزانە پارەکە وەرگیراوە", "Open the payment or receipt number and check the money was received"),
    SEND_ON,
  ],
  arrived_goods_unbilled: [
    step("بچۆ Data management ← Repairs", "Go to Data management, Repairs"),
    step("ئۆردەرەکان بخەرە سەر حیساب", "Put the orders on the account there"),
    step("دوای ئەوە بزانە ڕیزەکە لێرە لاچووە", "Then check the row has left this page"),
  ],
  commission_profit_one_unit: [
    step("ئەمە تەنها ڕاپۆرتی قازانج دەگۆڕێت، پارەی کڕیار نا", "This only changes the profit report, not the customer's money"),
    SEND_ON,
  ],
  customer_in_credit: [
    step("لە بەشی دارایی «کڕیارانی کریدیتدار» بکەرەوە", "Open customers in credit under Finance"),
    step("بزانە قەرزێک دوو جار کەم کراوەتەوە، یان کاڵایەک نەخراوەتە سەر حیساب", "See whether a debt was reduced twice, or goods were never billed"),
    step("تەنها سەرپەرشتیاری سەرەکی بڕیار دەدات کریدیتەکە بمێنێتەوە", "Only the main admin decides whether the credit stays"),
  ],
  parcel_charged_to_other: [
    step("حیسابی کڕیاری کۆن بکەرەوە و ڕیزی ئەو پاکەتە بدۆزەوە", "Open the old customer's account and find that parcel's line"),
    step("نووسینەکە لەسەر کڕیارە کۆنەکە هەڵبوەشێنەوە", "Reverse the line on the old customer"),
    step("بزانە لەسەر خاوەنە ڕاستەقینەکە نووسراوە، تا پارە و خاوەن پێکەوە بن", "Check it stands on the true owner, so owner and money stay together"),
  ],
  order_charged_to_other: [
    step("ئۆردەرەکە و پاکەتەکە بکەرەوە و خاوەنی ڕاستەقینە دیاری بکە", "Open the order and the parcel, and settle who really owns it"),
    step("بزانە کڕیارەکەی تر لە بۆکسەکەیدا پارەکەی داوە یان نا", "See whether the other customer paid for it in their box"),
    step("نووسینەکە لەسەر ئەو کەسە لابەرە کە خاوەنی نییە", "Take the line off the one who does not own it"),
  ],
};

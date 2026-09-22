import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { whatsappNumber } from "@shared/receiptWhatsApp";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  User,
  Globe,
  Briefcase,
  MapPin,
  Building,
  Calendar,
  Hash,
  MessageSquare,
} from "lucide-react";

interface CustomerRecord {
  fullName: string;
  customerCode?: string;
  fullNameArabic?: string;
  fullNameKurdish?: string;
  mobileNumber?: string;
  secondaryMobile?: string;
  email?: string;
  gender?: string;
  nationality?: string;
  businessType?: string;
  country?: string;
  city?: string;
  district?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  sequenceNumber?: number;
}

interface CustomerInfoCardProps {
  customer: CustomerRecord;
  t: (key: string) => string;
}

/**
 * A way of reaching the customer, which is also the way of reaching them.
 *
 * Owner, 2026-09-22: "if it has a relation somewhere else, clicking should
 * take me there." A mobile number opens that customer's WhatsApp — the office
 * writes from its own account — and an address like an email opens the mail
 * app. A number that is not a number stays plain text rather than opening a
 * chat with nobody.
 */
function ContactRow({
  value,
  label,
  icon,
  tone,
  href,
}: {
  value?: string | null;
  label: string;
  icon: React.ReactNode;
  tone: string;
  href?: string;
}) {
  const text = (value ?? "").trim();
  if (!text) return null;
  const number = whatsappNumber(text);
  const target = href ?? (number ? `https://wa.me/${number}` : undefined);

  const body = (
    <>
      <div className={`h-8 w-8 rounded-lg ${tone} flex items-center justify-center`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${target ? "text-sky-700 underline-offset-2 group-hover:underline dark:text-sky-300" : ""}`}>
          <bdi dir="ltr">{text}</bdi>
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </>
  );

  if (!target) return <div className="flex items-center gap-3">{body}</div>;
  return (
    <a href={target} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-lg">
      {body}
    </a>
  );
}

export function CustomerInfoCard({ customer, t }: CustomerInfoCardProps) {
  const c = customer as CustomerRecord & Record<string, unknown>;

  return (
    <Card className="lg:col-span-1 border-0 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center ring-4 ring-primary/10">
            <span className="text-2xl font-bold text-primary">
              {customer.fullName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div>
            <CardTitle className="text-lg">{customer.fullName}</CardTitle>
            <CardDescription className="font-mono">{customer.customerCode}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(c.fullNameArabic || c.fullNameKurdish) && (
          <div className="space-y-2">
            {c.fullNameArabic && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Arabic:</span>
                <span dir="rtl">{c.fullNameArabic}</span>
              </div>
            )}
            {c.fullNameKurdish && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Kurdish:</span>
                <span dir="rtl">{c.fullNameKurdish}</span>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("customers.contact")}
          </h4>
          <div className="space-y-2">
            <ContactRow
              value={customer.mobileNumber}
              label={t("customers.primaryMobile")}
              icon={<Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              tone="bg-blue-100 dark:bg-blue-900/30"
            />
            {c.secondaryMobile && (
              <ContactRow
                value={c.secondaryMobile}
                label={t("customers.secondaryMobile")}
                icon={<Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                tone="bg-blue-100 dark:bg-blue-900/30"
              />
            )}
            {customer.email && (
              <ContactRow
                value={customer.email}
                label={t("customers.email")}
                href={`mailto:${customer.email}`}
                icon={<Mail className="h-4 w-4 text-green-600 dark:text-green-400" />}
                tone="bg-green-100 dark:bg-green-900/30"
              />
            )}
          </div>
        </div>

        {(c.gender || c.nationality || c.businessType) && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t("customers.personalInfo")}
              </h4>
              <div className="space-y-2">
                {c.gender && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                      <User className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {c.gender === "male" ? t("customers.male") : t("customers.female")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("customers.gender")}</p>
                    </div>
                  </div>
                )}
                {c.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.nationality}</p>
                      <p className="text-xs text-muted-foreground">{t("customers.nationality")}</p>
                    </div>
                  </div>
                )}
                {c.businessType && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Briefcase className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{c.businessType}</p>
                      <p className="text-xs text-muted-foreground">{t("customers.businessType")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("customers.location")}
          </h4>
          <div className="space-y-2">
            {(customer.city || customer.country) && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {customer.city && customer.country
                      ? `${customer.city}, ${customer.country}`
                      : customer.city ?? customer.country}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("customers.city")}</p>
                </div>
              </div>
            )}
            {c.district && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Building className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{c.district}</p>
                  <p className="text-xs text-muted-foreground">{t("customers.district")}</p>
                </div>
              </div>
            )}
            {customer.address && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">{customer.address}</p>
                  <p className="text-xs text-muted-foreground">{t("customers.address")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Account</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{new Date(customer.createdAt).toLocaleDateString("en-GB")}</p>
                <p className="text-xs text-muted-foreground">Member Since</p>
              </div>
            </div>
            {c.sequenceNumber != null && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Hash className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium font-mono">#{c.sequenceNumber}</p>
                  <p className="text-xs text-muted-foreground">Sequence Number</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {customer.notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
              <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{customer.notes}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

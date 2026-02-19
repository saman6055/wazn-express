import { useTranslation } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import {
  Layers, DollarSign, FileText, QrCode, Wrench, TrendingUp,
  Calendar, BarChart3, ExternalLink,
} from "lucide-react";


interface QuickLink {
  route: string;
  titleKey: string;
  icon: React.ReactNode;
  iconBg: string;
  hoverBorder: string;
  hoverBg: string;
  hoverText: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    route: "/reports/batches",
    titleKey: "reports.batchFinancialReport",
    icon: <Layers className="h-5 w-5" />,
    iconBg: "from-blue-500 to-blue-600",
    hoverBorder: "hover:border-blue-300 dark:hover:border-blue-700",
    hoverBg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
    hoverText: "group-hover:text-blue-600",
  },
  {
    route: "/company/reports",
    titleKey: "reports.financialReport",
    icon: <DollarSign className="h-5 w-5" />,
    iconBg: "from-green-500 to-green-600",
    hoverBorder: "hover:border-green-300 dark:hover:border-green-700",
    hoverBg: "hover:bg-green-50/50 dark:hover:bg-green-950/30",
    hoverText: "group-hover:text-green-600",
  },
  {
    route: "/invoice-reports",
    titleKey: "reports.invoiceReport",
    icon: <FileText className="h-5 w-5" />,
    iconBg: "from-amber-500 to-amber-600",
    hoverBorder: "hover:border-amber-300 dark:hover:border-amber-700",
    hoverBg: "hover:bg-amber-50/50 dark:hover:bg-amber-950/30",
    hoverText: "group-hover:text-amber-600",
  },
  {
    route: "/scan-reports",
    titleKey: "reports.scanReport",
    icon: <QrCode className="h-5 w-5" />,
    iconBg: "from-purple-500 to-purple-600",
    hoverBorder: "hover:border-purple-300 dark:hover:border-purple-700",
    hoverBg: "hover:bg-purple-50/50 dark:hover:bg-purple-950/30",
    hoverText: "group-hover:text-purple-600",
  },
  {
    route: "/reports/services",
    titleKey: "reports.serviceProfitReport",
    icon: <Wrench className="h-5 w-5" />,
    iconBg: "from-emerald-500 to-emerald-600",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30",
    hoverText: "group-hover:text-emerald-600",
  },
  {
    route: "/profit-dashboard",
    titleKey: "reports.profitDashboard",
    icon: <TrendingUp className="h-5 w-5" />,
    iconBg: "from-indigo-500 to-indigo-600",
    hoverBorder: "hover:border-indigo-300 dark:hover:border-indigo-700",
    hoverBg: "hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30",
    hoverText: "group-hover:text-indigo-600",
  },
  {
    route: "/reports/monthly-profit",
    titleKey: "reports.monthlyProfitReport",
    icon: <Calendar className="h-5 w-5" />,
    iconBg: "from-pink-500 to-pink-600",
    hoverBorder: "hover:border-pink-300 dark:hover:border-pink-700",
    hoverBg: "hover:bg-pink-50/50 dark:hover:bg-pink-950/30",
    hoverText: "group-hover:text-pink-600",
  },
  {
    route: "/business-analytics",
    titleKey: "reports.businessAnalytics",
    icon: <BarChart3 className="h-5 w-5" />,
    iconBg: "from-cyan-500 to-cyan-600",
    hoverBorder: "hover:border-cyan-300 dark:hover:border-cyan-700",
    hoverBg: "hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30",
    hoverText: "group-hover:text-cyan-600",
  },
  {
    route: "/reports/profit-loss",
    titleKey: "profitLoss.title",
    icon: <DollarSign className="h-5 w-5" />,
    iconBg: "from-emerald-600 to-teal-600",
    hoverBorder: "hover:border-emerald-300 dark:hover:border-emerald-700",
    hoverBg: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30",
    hoverText: "group-hover:text-emerald-600",
  },
];

export function QuickLinksSection() {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {QUICK_LINKS.map((link) => (
        <Link key={link.route} href={link.route}>
          <div
            className={`group cursor-pointer rounded-xl border p-4 transition-all ${link.hoverBorder} ${link.hoverBg}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${link.iconBg}`}
                >
                  {link.icon}
                </div>
                <span className="text-sm font-medium">{t(link.titleKey)}</span>
              </div>
              <ExternalLink
                className={`h-4 w-4 text-muted-foreground transition-colors ${link.hoverText}`}
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

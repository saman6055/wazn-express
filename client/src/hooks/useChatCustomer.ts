import { trpc } from "@/lib/trpc";

/**
 * Who is asking, for the first lines of a WhatsApp message to Wazn.
 *
 * The signed-in customer's name and code, from the account query every
 * portal screen already shares — cached, so a page full of help buttons asks
 * once. Portal pages only: the public site and the store have no customer to
 * ask about.
 */
export function useChatCustomer(): { fullName: string; customerCode: string } | null {
  const { data } = trpc.customerPortal.getMyAccount.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data) return null;
  return { fullName: data.fullName ?? "", customerCode: data.customerCode ?? "" };
}

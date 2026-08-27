/**
 * Where a batch has got to, from one customer's side of it.
 *
 * A batch is a container, and a container is shared. Its status describes the
 * whole of it: `at_depot` means the goods are in Erbil, `delivered` means the
 * batch has been handed out. Neither says anything about one customer, and
 * the portal was printing it as though it did.
 *
 * So a customer who collected their box on Tuesday kept reading "لە کۆگای
 * هەولێر" for as long as anyone else in the container had not collected
 * theirs — told their goods were still on a shelf while they were sitting in
 * their shop. And the other way round is worse: a batch closed with one
 * parcel still on the shelf tells its owner "گەیشتە دەستت", and a customer
 * who believes that stops asking after it.
 *
 * The customer's own parcels are the only thing that knows the answer, and
 * they carry it already — `confirmBoxReceivedByCustomer` stamps every parcel
 * in the box `delivered`. This reads it back.
 *
 * Shared because the portal has three skins and they have drifted apart
 * before. One rule, applied once at the source, and none of them can be
 * wrong on its own.
 */

/** Only what this rule looks at; the real rows carry far more. */
export interface CustomerParcelStatus {
  status?: string | null;
}

/** A parcel is in the customer's hands, and no earlier status says so. */
const inHand = (p: CustomerParcelStatus): boolean => p.status === "delivered";

/**
 * The status to show this customer for this batch.
 *
 * `batchStatus` is the container's own. `parcels` are this customer's parcels
 * in it — and only theirs, or the answer is the container's again.
 *
 * With no parcels there is nothing to correct against, so the batch stands.
 */
export function customerBatchStatus(
  batchStatus: string,
  parcels: CustomerParcelStatus[],
): string {
  if (parcels.length === 0) return batchStatus;

  const delivered = parcels.filter(inHand).length;

  // Everything of theirs is handed over. Whatever the container is still
  // doing, this customer's part of it is finished.
  if (delivered === parcels.length) {
    return batchStatus === "closed" ? "closed" : "delivered";
  }

  // Something of theirs is still on the shelf. The container may have been
  // closed around it — a straggler, a parcel pulled aside for a damage claim
  // — and the batch must not be allowed to say it was handed over.
  if (batchStatus === "delivered" || batchStatus === "closed") {
    return "at_depot";
  }

  return batchStatus;
}

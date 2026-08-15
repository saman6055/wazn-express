import { appLogger } from "../utils/logger";
import * as db from "../db";
import { notifyStaffAlert } from "../_core/notifyStaff";
import { fetchFlightBoard, airlinePrefix } from "./flightBoard.service";
import {
  ARRIVED_TITLE,
  WATCHER_BROKEN,
  adminAlertTitle,
  arrivedMessage,
  customsShouldStart,
  findLanded,
  watchDecision,
} from "@shared/flightWatch";

/**
 * Watching for our flights to land, and telling everybody once they have.
 *
 * The office writes the flight number when the batch is made and then has to
 * remember to check the airport's website every day. Nobody remembers on the
 * right day, so the first anybody hears is a customer ringing up.
 *
 * From four days after the batch is created, this looks for that flight on the
 * arrivals board a few times a day. When it lands:
 *
 *   - the office gets an alert with the numbers on it
 *   - every customer with a parcel in that batch is told, once
 *   - the next morning the batch moves to customs, which is when the work
 *     actually starts
 *
 * The customer's message spends most of its words saying the goods are *not*
 * ready: customs takes days, then the depot, then a day to sort. Leave that
 * out and the office spends the next three days on the phone.
 *
 * One flight is looked up once. `flightArrivedAt` is written before anybody is
 * notified, so a crash halfway cannot send the same twenty-three messages
 * twice on the next run.
 */

/** The columns this service reads. A batch row has many more. */
interface WatchableRow {
  id: number;
  batchCode?: string | null;
  status?: string | null;
  shippingType?: string | null;
  flightNumber?: string | null;
  createdAt?: Date | string | null;
  flightArrivedAt?: Date | string | null;
}

/** Four times a day. The board updates every five minutes; we do not need to. */
const EVERY_MS = 6 * 60 * 60 * 1000;

/** Consecutive failed reads before the office is told the watcher is blind. */
const FAILURES_BEFORE_ALARM = 4;

let consecutiveFailures = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * One pass: look up the flights, act on any landings, then move yesterday's
 * landings into customs.
 */
export async function checkFlights(now = new Date()): Promise<void> {
  /** Every shipment, in pages — the list is small and this runs four times a day. */
  const batches: WatchableRow[] = [];
  try {
    let page = 1;
    for (;;) {
      const result = await db.getAllBatches({ page, pageSize: 100 });
      batches.push(...(result.data as unknown as WatchableRow[]));
      if (page >= (result.totalPages || 1)) break;
      page += 1;
    }
  } catch (error) {
    appLogger.error("[FlightWatch] Could not read batches", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const watching = batches.filter((batch) => watchDecision(batch, now).watch);

  if (watching.length > 0) {
    // One request per airline, not per batch: six shipments on Turkish
    // Airlines are one look at the board, not six.
    const prefixes = Array.from(
      new Set(watching.map((b) => airlinePrefix(String(b.flightNumber ?? "")))),
    ).filter(Boolean);

    let readAnything = false;
    for (const prefix of prefixes) {
      const result = await fetchFlightBoard(prefix);
      if (!result.ok) {
        appLogger.warn("[FlightWatch] Board unreadable", { prefix, error: result.error });
        continue;
      }
      readAnything = true;

      for (const batch of watching) {
        if (airlinePrefix(String(batch.flightNumber ?? "")) !== prefix) continue;
        const landed = findLanded(result.board.arrivals, batch.flightNumber);
        if (!landed) continue;
        await recordLanding(batch, landed.flight, landed.estimated || landed.scheduled || "", now);
      }
    }

    // Silence from a scraped page is a fault, not an answer. Counted across
    // runs so one slow night does not raise an alarm, and a real change does.
    if (readAnything) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures += 1;
      if (consecutiveFailures === FAILURES_BEFORE_ALARM) {
        await notifyStaffAlert({
          action: "flight_watch_broken",
          category: "batches",
          severity: "critical",
          title: "⚠️ چاودێری فڕۆکەکان کار ناکات",
          content: WATCHER_BROKEN.ku,
        }).catch(() => undefined);
      }
    }
  }

  await moveLandedBatchesToCustoms(batches, now);
}

/** A landing: written down first, announced second. */
async function recordLanding(
  batch: { id: number; batchCode?: string | null; flightNumber?: string | null },
  flight: string,
  time: string,
  now: Date,
): Promise<void> {
  const code = batch.batchCode || `#${batch.id}`;

  try {
    // Written before anything is sent. If the process dies on the next line,
    // the worst case is an alert nobody received — not the same message sent
    // to every customer twice.
    await db.recordBatchFlightArrival(batch.id, now, "Arrived");
  } catch (error) {
    appLogger.error("[FlightWatch] Could not record the landing", {
      batchId: batch.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const packages = await db.getPackagesByBatch(batch.id).catch(() => []);
  const byCustomer = new Map<number, number>();
  for (const pkg of packages) {
    if (!pkg.customerId || pkg.isUnclaimed) continue;
    byCustomer.set(pkg.customerId, (byCustomer.get(pkg.customerId) ?? 0) + 1);
  }

  await notifyStaffAlert({
    action: "flight_arrived",
    category: "batches",
    severity: "info",
    title: adminAlertTitle(code, flight).ku,
    content: [
      `فڕۆکە: ${flight}${time ? ` · ${time}` : ""}`,
      `پاکێت: ${packages.length}`,
      `کڕیار: ${byCustomer.size}`,
      "گومرگ بەیانی دەستپێدەکات — دۆخی بارەکە خۆی دەگۆڕێت.",
    ].join("\n"),
  }).catch(() => undefined);

  // One message per customer, however many parcels they have in the batch.
  for (const [customerId, count] of Array.from(byCustomer.entries())) {
    const message = arrivedMessage(code, count);
    await db
      .createCustomerNotification({
        customerId,
        type: "package",
        relatedType: "batch",
        relatedId: batch.id,
        actionUrl: "/portal/shipments",
        title: ARRIVED_TITLE.en,
        titleKu: ARRIVED_TITLE.ku,
        titleAr: ARRIVED_TITLE.ar,
        message: message.en,
        messageKu: message.ku,
        messageAr: message.ar,
      })
      .catch((error) =>
        appLogger.error("[FlightWatch] Could not notify a customer", {
          customerId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  appLogger.info("[FlightWatch] Landing recorded and announced", {
    batchCode: code,
    flight,
    customers: byCustomer.size,
    packages: packages.length,
  });
}

/**
 * The morning after a landing, the shipment is in customs.
 *
 * Separate from the landing itself because the two happen on different days:
 * a plane that lands at eleven at night is not in customs twenty minutes
 * later. Only a batch that is still earlier in its journey is moved — one
 * already at the depot or delivered is left exactly where it is.
 */
async function moveLandedBatchesToCustoms(batches: WatchableRow[], now: Date): Promise<void> {
  const BEFORE_CUSTOMS = ["preparing", "in_transit", "arrived"];

  for (const batch of batches) {
    if (!batch.flightArrivedAt) continue;
    if (!BEFORE_CUSTOMS.includes(String(batch.status))) continue;
    if (!customsShouldStart(batch.flightArrivedAt, now)) continue;

    try {
      await db.updateBatch(batch.id, { status: "customs" });
      appLogger.info("[FlightWatch] Moved to customs", { batchCode: batch.batchCode || batch.id });
    } catch (error) {
      appLogger.error("[FlightWatch] Could not move the batch to customs", {
        batchId: batch.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function startFlightWatch(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  timer = setInterval(() => {
    void checkFlights().catch((error) =>
      appLogger.error("[FlightWatch] Scheduled pass failed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }, EVERY_MS);

  await checkFlights().catch((error) =>
    appLogger.error("[FlightWatch] First pass failed", {
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

export function stopFlightWatch(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

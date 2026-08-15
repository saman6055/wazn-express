import { appLogger } from "../utils/logger";
import { parseFlightBoard, type FlightBoard } from "@shared/flightBoard";

/**
 * Fetching the arrivals board from Erbil airport.
 *
 * There is no API. The page loads its flights over a POST to
 * `/Flights/GetFlights`, and that POST only answers if it is asked the way the
 * page asks it: with the cookies from a prior page load, a Referer, and
 * `lang=1` for English. Without those it returns a 478-byte error page, which
 * is how this was worked out.
 *
 * Read-only, a handful of times a day, with the company named in the
 * User-Agent so anyone reading their logs can see who we are and why. If the
 * airport would rather we did not, that is a conversation we can have — and a
 * User-Agent that hides would make it a conversation nobody could start.
 */

const ORIGIN = "https://www.eia.krd";
const PAGE = `${ORIGIN}/english/flight-information`;
const ENDPOINT = `${ORIGIN}/Flights/GetFlights`;

/** English. The page reads this from a hidden input; it is not a language code. */
const LANG_ENGLISH = "1";

const USER_AGENT =
  "Mozilla/5.0 (compatible; WaznExpress/1.0; +https://waznexpress.com) flight-arrival-watcher";

/** Long enough for a slow page, short enough not to hold a background job. */
const TIMEOUT_MS = 20_000;

export interface BoardResult {
  board: FlightBoard;
  /** False when the request or the parse failed — never "no flights today". */
  ok: boolean;
  error?: string;
}

/**
 * The board for one search term, usually an airline prefix such as "tk".
 *
 * Searching by prefix rather than fetching everything keeps the response small
 * and matches what the page itself does when a person types in the box.
 */
export async function fetchFlightBoard(searchTxt: string, date = ""): Promise<BoardResult> {
  const empty: FlightBoard = { arrivals: [], departures: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const pageUrl = `${PAGE}?pickadate=${encodeURIComponent(date)}&searchTxt=${encodeURIComponent(searchTxt)}`;

    // First request is only for the session cookies the POST insists on.
    const page = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!page.ok) {
      return { board: empty, ok: false, error: `page returned ${page.status}` };
    }
    await page.text();
    const cookies = (page.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(";")[0])
      .join("; ");

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Referer: pageUrl,
        Accept: "text/html, */*; q=0.01",
        ...(cookies ? { Cookie: cookies } : {}),
      },
      body: new URLSearchParams({
        pickadate: date,
        searchTxt,
        Arrivalpager: "1",
        DeparturePager: "1",
        lang: LANG_ENGLISH,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { board: empty, ok: false, error: `flights returned ${response.status}` };
    }

    const html = await response.text();
    const board = parseFlightBoard(html);

    /**
     * Nothing at all, from a request that succeeded, means the shape changed.
     *
     * Reported as a failure rather than as an empty board, because the two
     * are indistinguishable to the caller and only one of them is safe to act
     * on. An airport with genuinely no flights for an airline prefix all day
     * is possible but rare, and being told about it costs one alert; being
     * silently blind costs a shipment.
     */
    if (board.arrivals.length === 0 && board.departures.length === 0) {
      return { board, ok: false, error: "no rows parsed — the page may have changed" };
    }

    return { board, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appLogger.error("[FlightBoard] Could not read the airport board", { searchTxt, error: message });
    return { board: empty, ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** The airline prefix of a flight number: "TK 6894" → "tk". */
export function airlinePrefix(flightNumber: string): string {
  const match = String(flightNumber ?? "").trim().match(/^([A-Za-z]{2,3})/);
  return match ? match[1].toLowerCase() : "";
}

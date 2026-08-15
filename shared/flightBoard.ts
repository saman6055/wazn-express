/**
 * Reading the arrivals board at Erbil airport.
 *
 * The airport has no API. The page loads its flights over a POST to
 * `/Flights/GetFlights` which answers with an HTML fragment, and this turns
 * that fragment into rows. Kept separate from the fetching so it can be
 * tested against a saved copy of the real thing — a parser written against a
 * guess is a parser that works until the first time it matters.
 *
 * Two things it must get right:
 *
 *  - Arrivals and departures come back in one response. A departing TK 6895
 *    must never be read as an arrival; they are separated before anything
 *    else happens.
 *  - The status is a word inside a span whose class repeats it — "Arrived",
 *    "Departed", "Scheduled". The page prints it in capitals with CSS, so the
 *    text in the HTML is not what a person sees on screen. Compared without
 *    case, or nothing would ever match.
 *
 * Nothing here decides anything. It reads.
 */

export interface BoardRow {
  flight: string;
  status: string;
  scheduled: string;
  estimated: string;
  from: string;
  airline: string;
}

export interface FlightBoard {
  arrivals: BoardRow[];
  departures: BoardRow[];
}

/** `<span class="value">10:30</span>` → `10:30`, and entities decoded. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstGroup(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? textOf(match[1]) : "";
}

/**
 * One flight, or null when the block is the header row.
 *
 * The first `listingItemLI` in each section is the column headings — the
 * words "Scheduled", "Estimated", "Flight". It has no `<span class="title">`,
 * which is what tells it apart; matching on the words would break the day the
 * airport translates them.
 */
function parseRow(block: string): BoardRow | null {
  const flight = firstGroup(block, /<span class="title">([\s\S]*?)<\/span>/i);
  if (!flight) return null;

  return {
    flight,
    // The status word sits inside a span whose class names it again.
    status: firstGroup(block, /<div class="status"[\s\S]*?<span class="value">([\s\S]*?)<\/span>\s*<\/div>/i),
    scheduled: firstGroup(block, /<div class="listingTime[^"]*"[^>]*>\s*<span class="value">([\s\S]*?)<\/span>/i),
    estimated: firstGroup(block, /<div class="listingEstimated[^"]*"[^>]*>\s*<span class="value">([\s\S]*?)<\/span>/i),
    from: firstGroup(block, /<div class="from"[^>]*>\s*<span class="value">([\s\S]*?)<\/span>/i),
    airline: firstGroup(block, /<div class="airline"[^>]*>\s*<span class="value">([\s\S]*?)<\/span>/i),
  };
}

function rowsIn(section: string): BoardRow[] {
  const blocks = section.split(/<li class="listingItemLI">/i).slice(1);
  return blocks.map(parseRow).filter((row): row is BoardRow => row !== null);
}

/**
 * Split the response into its two halves, then read each.
 *
 * Returns empty lists rather than throwing when the shape is unrecognised —
 * but an empty list from a page that answered 200 is a fault, and the caller
 * is expected to treat it as one rather than as "no flights today".
 */
export function parseFlightBoard(html: string): FlightBoard {
  const source = String(html ?? "");
  const arrivalsAt = source.search(/tabContent\s+Arrivals/i);
  const departuresAt = source.search(/tabContent\s+Departures/i);

  if (arrivalsAt === -1 && departuresAt === -1) return { arrivals: [], departures: [] };

  // Whichever section comes first ends where the other begins.
  const arrivalsHtml =
    arrivalsAt === -1
      ? ""
      : source.slice(arrivalsAt, departuresAt > arrivalsAt ? departuresAt : undefined);
  const departuresHtml =
    departuresAt === -1
      ? ""
      : source.slice(departuresAt, arrivalsAt > departuresAt ? arrivalsAt : undefined);

  return { arrivals: rowsIn(arrivalsHtml), departures: rowsIn(departuresHtml) };
}

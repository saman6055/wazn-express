# Portal audit — 13 August 2026

A check across the customer portal: what is solid, and where the gaps are.
Nothing was changed. This is the assessment you asked for.

---

## What is already solid

Worth saying first, because it is most of it.

**Data isolation.** All 48 customer procedures scope their work to the
session's customer rather than an id from the request, and none of them accept
a customer id as input. Only three endpoints are readable without logging in,
and they are the right three. Tested.

**What a customer is shown of their own order.** The sanitiser strips our
purchase price and profit, the supplier's phone and WeChat, and the customer's
own password hash and ID-document URLs. The list form also drops the photo
gallery — one photo is 200–330 KB base64 and five screens load that list.
Tested field by field.

**Login throttling.** 20 failed attempts per 15 minutes, and successful logins
are not counted against the limit, so a busy household is not punished for
signing in.

**Consistency across skins.** Only five screens have per-skin designs; the
rest share a layout that adapts. A guard test stops a new page importing the
classic layout directly, which is how a customer used to walk from one shape
of portal into another.

**Push notifications** are properly wired — the prompt is mounted in the
portal layout, not left as an unused hook.

**Errors, empty states, right-to-left, language, money formatting, timeline
and forms** each have their own test file. Thirteen in total.

---

## Gaps, most serious first

### 1. A customer cannot recover their own password

There is no forgotten-password flow at all. `changePassword` requires already
being signed in. The only route back in is to telephone the office, where
staff reset it to a shared default.

Two consequences:

- **Every reset costs two people their time**, at a moment when the customer
  is already frustrated. The phone-matching code has a comment describing
  exactly this loop.
- **The default is `123456`, and nothing forces a change afterwards.** A
  customer who is let back in and never changes it keeps a password everyone
  in the office knows. There is no `mustChangePassword` flag anywhere.

The customer's mobile number is already the login, already verified in
practice, and the system already sends notifications. A code by SMS or
WhatsApp would close this.

### 2. Login throttling is per IP, with no per-account limit

`authLimiter` keys on the IP address. That stops one machine hammering
passwords, but not the two cases that matter here:

- **Many customers behind one address.** Mobile carriers in Iraq NAT large
  numbers of subscribers behind shared addresses. Twenty mistyped passwords
  from that pool locks out everyone else on it for fifteen minutes.
- **One account, many addresses.** Anybody rotating mobile data or using a
  handful of proxies can attempt a single customer's password indefinitely,
  because no counter is kept against the account.

A per-account attempt counter with a short lockout closes the second and makes
the first less likely to bite.

### 3. Sessions last a year

The portal cookie is set with a one-year `maxAge`. On a shared or family phone
— common for this customer base — that is a long time to stay signed in, and
there is no way for a customer to see or end other sessions.

A shorter window with a "keep me signed in" choice, or a visible way to sign
out everywhere, would be proportionate. This is a judgement call about your
customers, not a defect.

### 4. No way to report a problem with a specific parcel

A customer can message the office, and can claim an unmarked parcel. But
there is no "something is wrong with this one" against a parcel they already
own — damaged, short, wrong contents. Today that arrives as a WhatsApp
message with a photo and no link to the record, so somebody has to find the
parcel by hand before they can act.

The claim-request table already has the shape this needs: a status, a reason,
and proof images.

---

## Not gaps, though they look like them

- **Only four pages per alternate skin.** By design — the other pages share a
  layout that follows the skin. Already tested.
- **Eight queries on the portal home.** They are batched into one HTTP
  request by tRPC. The server-side work is what costs, and the composite
  index added earlier is the main win there.

---

## Suggested order

1. Password recovery by SMS or WhatsApp code — removes a daily phone call and
   the shared default password with it.
2. Per-account login attempts — small, and closes the hole IP limiting leaves.
3. Report a problem on a parcel — reuses a table that already exists.
4. Session length — a decision rather than a fix.

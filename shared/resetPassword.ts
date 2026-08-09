/**
 * What a customer password reset is set to unless staff type something else.
 *
 * The office's call, and the reasoning holds: a reset gets read down the
 * phone to somebody already frustrated at not being able to sign in. "One
 * two three four five six" gets them in. "kR7mQx4p" gets a second call, then
 * a third when they mistype it.
 *
 * Six digits is also the shortest the server will accept, so this cannot be
 * made simpler without changing the rule underneath it.
 *
 * Lives here rather than in either screen because there are two places staff
 * can reset a password — the portal centre and the customers list — and the
 * one thing worse than a weak default is two different weak defaults, with
 * staff reading out whichever one they last saw.
 *
 * Both screens still offer a generated password one tap away, for an account
 * that warrants one.
 */
export const DEFAULT_RESET_PASSWORD = "123456";

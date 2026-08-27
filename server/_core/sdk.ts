import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { appLogger } from "../utils/logger";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    if (ENV.oAuthServerUrl) {
      appLogger.info("[OAuth] Initialized with baseURL", { baseURL: ENV.oAuthServerUrl });
    } else {
      appLogger.warn("[OAuth] OAUTH_SERVER_URL is not set; OAuth/Forge login will be disabled.");
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(
      EXCHANGE_TOKEN_PATH,
      payload
    );

    return data;
  }

  async getUserInfoByToken(
    token: ExchangeTokenResponse
  ): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken,
      }
    );

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(
      platforms.filter((p): p is string => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (
      set.has("REGISTERED_PLATFORM_MICROSOFT") ||
      set.has("REGISTERED_PLATFORM_AZURE")
    )
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; userId?: number; role?: string; customerCode?: string; customerId?: number; isCustomer?: boolean; isStaff?: boolean } | null> {
    if (!cookieValue) {
      appLogger.warn("[Auth] Missing session token");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, userId, role, customerCode, customerId, isCustomer, isStaff } = payload as Record<string, unknown>;

      // For customer tokens from customers table
      if (customerId && isCustomer) {
        return {
          openId: openId as string || `customer_${customerId}`,
          appId: ENV.appId,
          name: name as string || "",
          customerId: customerId as number,
          role: "customer",
          customerCode: customerCode as string,
          isCustomer: true,
        };
      }

      // For staff login tokens (admin, employee, accountant)
      if (userId && role && role !== "customer") {
        return {
          openId: openId as string || `staff_${userId}`,
          appId: ENV.appId,
          name: name as string || "",
          userId: userId as number,
          role: role as string,
        };
      }

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        appLogger.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      appLogger.warn("[Auth] Session verification failed", { error: String(error) });
      return null;
    }
  }

  async getUserInfoWithJwt(
    jwtToken: string
  ): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  /**
   * The session token, from wherever this client can carry one.
   *
   * A browser carries it in an HttpOnly cookie, which is right: script on the
   * page cannot read it, so an injected script cannot steal it. A native app
   * has no such cookie jar to lean on and carries it in a header instead,
   * which is the same token verified the same way — the transport differs,
   * the trust does not.
   *
   * Cookie first, deliberately. A browser that somehow sends both is a
   * browser, and its cookie is the one the server set.
   */
  private sessionTokenFrom(req: Request): string | undefined {
    const fromCookie = this.parseCookies(req.headers.cookie).get(COOKIE_NAME);
    if (fromCookie) return fromCookie;

    const header = (req.headers as Record<string, unknown>)["authorization"];
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== "string") return undefined;
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    return match?.[1]?.trim() || undefined;
  }

  async authenticateRequest(req: Request): Promise<any> {
    // Regular authentication flow
    const sessionToken = this.sessionTokenFrom(req);
    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session");
    }

    const signedInAt = new Date();
    
    // Handle customer sessions (they have customerId from customers table)
    if (session.customerId && session.isCustomer) {
      const customer = await db.getCustomerById(session.customerId);
      if (!customer) {
        throw ForbiddenError("Customer not found");
      }
      // Deactivating an account has to mean something before the cookie
      // expires. The login refused an inactive customer and nothing after it
      // ever asked again, so switching somebody off left them with seven more
      // days of full access — their parcels, their money, their documents —
      // and the office had no way to end it.
      //
      // Read from the row, not the token: the session was minted before the
      // decision to switch them off, so it cannot be asked about it.
      if (!customer.isActive) {
        throw ForbiddenError("Customer account is not active");
      }
      // Return customer data with isCustomer flag for type checking
      return {
        ...customer,
        role: "customer" as const,
        isCustomer: true,
        // Add name alias for compatibility with staff user type
        name: customer.fullName,
      };
    }

    // Handle staff login sessions (admin, employee, accountant)
    if (session.userId && session.role && session.role !== "customer") {
      const user = await db.getUserById(session.userId);
      if (!user) {
        throw ForbiddenError("Staff user not found");
      }
      // Same rule, and it matters more here: a staff account is switched off
      // on the day somebody leaves, and until now that took a week to take
      // effect on a session already open.
      if (!user.isActive) {
        throw ForbiddenError("Staff account is not active");
      }
      return {
        ...user,
        isCustomer: false,
      };
    }

    // Regular OAuth user flow
    const sessionUserId = session.openId;
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        appLogger.error("[Auth] Failed to sync user from OAuth", { error: error instanceof Error ? error.message : String(error) });
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return {
      ...user,
      isCustomer: false,
    };
  }
}

export const sdk = new SDKServer();

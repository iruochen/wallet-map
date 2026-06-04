import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyMessage } from "viem";
import type { Address } from "viem";

export interface WalletSession {
  address: string;
  subjectId: string;
}

const sessionCookieName = "wallet-map-session";
const anonymousCookieName = "wallet-map-anon";
const challengeCookieName = "wallet-map-challenge";
const challengeTtlSeconds = 5 * 60;
const sessionTtlSeconds = 60 * 60 * 24 * 30;
const anonymousTtlSeconds = 60 * 60 * 24 * 30;
const authDomain = "Wallet Map";

export async function createWalletChallenge(): Promise<{ address: string; message: string }> {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const message = [
    `${authDomain} wants you to sign in with your wallet.`,
    "",
    "This signature proves wallet ownership for Wallet Map history.",
    "It is not tied to any analysis chain and does not authorize a transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
  const jar = await cookies();

  jar.set(challengeCookieName, signValue(JSON.stringify({ nonce, issuedAt, message })), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: challengeTtlSeconds,
    path: "/",
  });

  return { address: "", message };
}

export async function verifyWalletSession(input: {
  address: string;
  message: string;
  signature: string;
}): Promise<WalletSession> {
  const address = normalizeEvmAddress(input.address);
  const jar = await cookies();
  const challenge = readSignedCookie<{ message: string; issuedAt: string }>(
    jar.get(challengeCookieName)?.value,
  );

  if (!challenge || challenge.message !== input.message) {
    throw new Error("Login challenge expired. Please try again.");
  }

  const issuedAt = new Date(challenge.issuedAt).getTime();
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > challengeTtlSeconds * 1000) {
    throw new Error("Login challenge expired. Please try again.");
  }

  const valid = await verifyMessage({
    address: address as Address,
    message: input.message,
    signature: input.signature as `0x${string}`,
  });

  if (!valid) {
    throw new Error("Wallet signature does not match the selected address.");
  }

  const session: WalletSession = {
    address,
    subjectId: buildWalletSubjectId(address),
  };

  jar.set(sessionCookieName, signValue(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtlSeconds,
    path: "/",
  });
  jar.delete(challengeCookieName);

  return session;
}

export async function clearWalletSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(sessionCookieName);
}

export async function readWalletSession(): Promise<WalletSession | undefined> {
  const jar = await cookies();
  const session = readSignedCookie<WalletSession>(jar.get(sessionCookieName)?.value);

  if (!session?.address || !session.subjectId) {
    return undefined;
  }

  return session;
}

export async function getCurrentHistorySubject(): Promise<{
  subjectId: string;
  session?: WalletSession;
  mode: "wallet" | "session";
}> {
  const session = await readWalletSession();
  if (session) {
    return {
      subjectId: session.subjectId,
      session,
      mode: "wallet",
    };
  }

  const jar = await cookies();
  const existing = readSignedCookie<{ id: string }>(jar.get(anonymousCookieName)?.value);
  const id = existing?.id ?? randomBytes(16).toString("hex");

  if (!existing?.id) {
    jar.set(anonymousCookieName, signValue(JSON.stringify({ id })), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: anonymousTtlSeconds,
      path: "/",
    });
  }

  return {
    subjectId: `session:${id}`,
    mode: "session",
  };
}

export function buildWalletSubjectId(address: string): string {
  return `wallet:${normalizeEvmAddress(address)}`;
}

function normalizeEvmAddress(address: string): string {
  const normalized = address.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error("A valid EVM wallet address is required.");
  }

  return normalized;
}

function signValue(value: string): string {
  const signature = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
  return `${Buffer.from(value, "utf8").toString("base64url")}.${signature}`;
}

function readSignedCookie<T>(raw: string | undefined): T | undefined {
  if (!raw) {
    return undefined;
  }

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) {
    return undefined;
  }

  const value = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", getSessionSecret()).update(value).digest("base64url");

  if (!safeEqual(signature, expected)) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSessionSecret(): string {
  return process.env.WALLET_MAP_SESSION_SECRET?.trim() || "wallet-map-local-development-session-secret";
}

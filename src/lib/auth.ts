import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-browser';
import type { LinkedAccount, Settings } from '../types';

/** Read-only access to the user's calendars. */
export const SCOPES = ['User.Read', 'Calendars.Read'];

const AFTER_LOGIN_KEY = 'fc.afterLogin';

let pca: PublicClientApplication | null = null;

export class AuthRequiredError extends Error {
  constructor(msg = 'Anmeldung erforderlich') {
    super(msg);
    this.name = 'AuthRequiredError';
  }
}

/** The app's own URL without query/hash/index.html – must be registered in Azure as SPA redirect URI. */
export function redirectUri(): string {
  const path = window.location.pathname.replace(/index\.html$/, '');
  return window.location.origin + path;
}

export function isAuthConfigured(): boolean {
  return pca !== null;
}

export interface AuthInitResult {
  /** member id + account, when we just came back from a login redirect */
  linked?: { memberId: string; account: LinkedAccount };
  error?: string;
}

export async function initAuth(settings: Settings): Promise<AuthInitResult> {
  if (!settings.clientId.trim()) return {};
  try {
    pca = new PublicClientApplication({
      auth: {
        clientId: settings.clientId.trim(),
        authority: `https://login.microsoftonline.com/${settings.authority}`,
        redirectUri: redirectUri(),
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    const result = await pca.handleRedirectPromise();
    if (result) return { linked: linkFromResult(result) };
    return {};
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function toLinked(a: AccountInfo): LinkedAccount {
  return { homeAccountId: a.homeAccountId, username: a.username, name: a.name };
}

function linkFromResult(result: AuthenticationResult): AuthInitResult['linked'] {
  const memberId = result.state || sessionStorage.getItem(AFTER_LOGIN_KEY) || '';
  if (!memberId || !result.account) return undefined;
  return { memberId, account: toLinked(result.account) };
}

/** Pops the member id whose editor should be reopened after a redirect login. */
export function takeAfterLoginMember(): string | null {
  const v = sessionStorage.getItem(AFTER_LOGIN_KEY);
  sessionStorage.removeItem(AFTER_LOGIN_KEY);
  return v;
}

function requirePca(): PublicClientApplication {
  if (!pca) throw new Error('Outlook ist noch nicht eingerichtet (Client-ID in den Einstellungen fehlt).');
  return pca;
}

/**
 * Starts the login for a family member. In redirect mode the page navigates away and the
 * result is handled in initAuth() after returning; in popup mode the account is returned.
 */
export async function loginMember(
  memberId: string,
  mode: Settings['loginMode'],
  loginHint?: string,
): Promise<LinkedAccount | null> {
  const app = requirePca();
  const request = {
    scopes: SCOPES,
    prompt: loginHint ? undefined : 'select_account',
    loginHint,
    state: memberId,
  };
  if (mode === 'popup') {
    const res = await app.loginPopup(request);
    return toLinked(res.account);
  }
  sessionStorage.setItem(AFTER_LOGIN_KEY, memberId);
  await app.loginRedirect(request);
  return null;
}

function findAccount(homeAccountId: string): AccountInfo | undefined {
  return pca?.getAllAccounts().find((a) => a.homeAccountId === homeAccountId);
}

export function hasAccount(homeAccountId: string): boolean {
  return !!findAccount(homeAccountId);
}

export async function getToken(account: LinkedAccount): Promise<string> {
  const app = requirePca();
  const acc = findAccount(account.homeAccountId);
  if (!acc) throw new AuthRequiredError('Auf diesem Gerät nicht angemeldet');
  try {
    const res = await app.acquireTokenSilent({ scopes: SCOPES, account: acc });
    return res.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) throw new AuthRequiredError('Anmeldung abgelaufen');
    throw e;
  }
}

export async function forgetAccount(account: LinkedAccount): Promise<void> {
  const acc = findAccount(account.homeAccountId);
  if (!pca || !acc) return;
  try {
    await pca.clearCache({ account: acc });
  } catch (e) {
    console.warn('Konto konnte nicht aus dem Cache entfernt werden', e);
  }
}

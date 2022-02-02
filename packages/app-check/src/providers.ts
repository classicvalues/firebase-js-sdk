/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FirebaseApp, _getProvider } from '@firebase/app';
import { Provider } from '@firebase/component';
import { issuedAtTime } from '@firebase/util';
import {
  exchangeToken,
  getExchangeRecaptchaEnterpriseTokenRequest,
  getExchangeRecaptchaV3TokenRequest
} from './client';
import { AppCheckError, ERROR_FACTORY } from './errors';
import { CustomProviderOptions } from './public-types';
import {
  getToken as getReCAPTCHAToken,
  initializeV3 as initializeRecaptchaV3,
  initializeEnterprise as initializeRecaptchaEnterprise
} from './recaptcha';
import { AppCheckProvider, AppCheckTokenInternal } from './types';

/**
 * App Check provider that can obtain a reCAPTCHA V3 token and exchange it
 * for an App Check token.
 *
 * @public
 */
export class ReCaptchaV3Provider implements AppCheckProvider {
  private _app?: FirebaseApp;
  private _heartbeatServiceProvider?: Provider<'heartbeat'>;
  /**
   * Create a ReCaptchaV3Provider instance.
   * @param siteKey - ReCAPTCHA V3 siteKey.
   */
  constructor(private _siteKey: string) {}

  /**
   * Returns an App Check token.
   * @internal
   */
  async getToken(): Promise<AppCheckTokenInternal> {
    // Top-level `getToken()` has already checked that App Check is initialized
    // and therefore this._app and this._heartbeatServiceProvider are available.
    const attestedClaimsToken = await getReCAPTCHAToken(this._app!).catch(
      _e => {
        // reCaptcha.execute() throws null which is not very descriptive.
        throw ERROR_FACTORY.create(AppCheckError.RECAPTCHA_ERROR);
      }
    );
    return exchangeToken(
      getExchangeRecaptchaV3TokenRequest(this._app!, attestedClaimsToken),
      this._heartbeatServiceProvider!
    );
  }

  /**
   * @internal
   */
  initialize(app: FirebaseApp): void {
    this._app = app;
    this._heartbeatServiceProvider = _getProvider(app, 'heartbeat');
    initializeRecaptchaV3(app, this._siteKey).catch(() => {
      /* we don't care about the initialization result */
    });
  }

  /**
   * @internal
   */
  isEqual(otherProvider: unknown): boolean {
    if (otherProvider instanceof ReCaptchaV3Provider) {
      return this._siteKey === otherProvider._siteKey;
    } else {
      return false;
    }
  }
}

/**
 * App Check provider that can obtain a reCAPTCHA Enterprise token and exchange it
 * for an App Check token.
 *
 * @public
 */
export class ReCaptchaEnterpriseProvider implements AppCheckProvider {
  private _app?: FirebaseApp;
  private _heartbeatServiceProvider?: Provider<'heartbeat'>;
  /**
   * Create a ReCaptchaEnterpriseProvider instance.
   * @param siteKey - reCAPTCHA Enterprise score-based site key.
   */
  constructor(private _siteKey: string) {}

  /**
   * Returns an App Check token.
   * @internal
   */
  async getToken(): Promise<AppCheckTokenInternal> {
    // Top-level `getToken()` has already checked that App Check is initialized
    // and therefore this._app and this._heartbeatServiceProvider are available.
    const attestedClaimsToken = await getReCAPTCHAToken(this._app!).catch(
      _e => {
        // reCaptcha.execute() throws null which is not very descriptive.
        throw ERROR_FACTORY.create(AppCheckError.RECAPTCHA_ERROR);
      }
    );
    return exchangeToken(
      getExchangeRecaptchaEnterpriseTokenRequest(
        this._app!,
        attestedClaimsToken
      ),
      this._heartbeatServiceProvider!
    );
  }

  /**
   * @internal
   */
  initialize(app: FirebaseApp): void {
    this._app = app;
    this._heartbeatServiceProvider = _getProvider(app, 'heartbeat');
    initializeRecaptchaEnterprise(app, this._siteKey).catch(() => {
      /* we don't care about the initialization result */
    });
  }

  /**
   * @internal
   */
  isEqual(otherProvider: unknown): boolean {
    if (otherProvider instanceof ReCaptchaEnterpriseProvider) {
      return this._siteKey === otherProvider._siteKey;
    } else {
      return false;
    }
  }
}

/**
 * Custom provider class.
 * @public
 */
export class CustomProvider implements AppCheckProvider {
  private _app?: FirebaseApp;

  constructor(private _customProviderOptions: CustomProviderOptions) {}

  /**
   * @internal
   */
  async getToken(): Promise<AppCheckTokenInternal> {
    // custom provider
    const customToken = await this._customProviderOptions.getToken();
    // Try to extract IAT from custom token, in case this token is not
    // being newly issued. JWT timestamps are in seconds since epoch.
    const issuedAtTimeSeconds = issuedAtTime(customToken.token);
    // Very basic validation, use current timestamp as IAT if JWT
    // has no `iat` field or value is out of bounds.
    const issuedAtTimeMillis =
      issuedAtTimeSeconds !== null &&
      issuedAtTimeSeconds < Date.now() &&
      issuedAtTimeSeconds > 0
        ? issuedAtTimeSeconds * 1000
        : Date.now();

    return { ...customToken, issuedAtTimeMillis };
  }

  /**
   * @internal
   */
  initialize(app: FirebaseApp): void {
    this._app = app;
  }

  /**
   * @internal
   */
  isEqual(otherProvider: unknown): boolean {
    if (otherProvider instanceof CustomProvider) {
      return (
        this._customProviderOptions.getToken.toString() ===
        otherProvider._customProviderOptions.getToken.toString()
      );
    } else {
      return false;
    }
  }
}

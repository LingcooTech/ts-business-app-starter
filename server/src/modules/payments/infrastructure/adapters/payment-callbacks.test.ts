import { createSign, generateKeyPairSync } from 'node:crypto';

import { Aes, Rsa } from 'wechatpay-axios-plugin';
import { describe, expect, it } from 'vitest';

import { AlipayPaymentAdapter } from './alipay-payment.adapter';
import { WechatPaymentAdapter } from './wechat-payment.adapter';

function rsaKeys() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
}

describe('payment provider callbacks', () => {
  it('verifies a real RSA2 Alipay callback and checks the configured app ID', async () => {
    const keys = rsaKeys();
    const settings = {
      alipayConfig: async () => ({
        appId: '2026000000000001',
        privateKey: keys.privateKey,
        alipayPublicKey: keys.publicKey,
        gateway: 'https://openapi.alipay.com/gateway.do',
        returnUrl: 'https://merchant.example.com/return',
        notifyUrl: 'https://merchant.example.com/api/payments/callbacks/alipay',
      }),
    };
    const adapter = new AlipayPaymentAdapter(settings as never);
    const payload: Record<string, string> = {
      app_id: '2026000000000001',
      notify_id: 'notify-1',
      out_trade_no: 'order-1',
      trade_no: 'trade-1',
      trade_status: 'TRADE_SUCCESS',
      total_amount: '128.00',
      sign_type: 'RSA2',
    };
    const signContent = Object.keys(payload)
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join('&');
    payload.sign = createSign('RSA-SHA256')
      .update(signContent, 'utf8')
      .sign(keys.privateKey, 'base64');

    await expect(adapter.verifyCallback({ parsedBody: payload })).resolves.toMatchObject({
      eventId: 'notify-1',
      merchantOrderId: 'order-1',
      providerTransactionId: 'trade-1',
      status: 'succeeded',
      amountMinor: 12_800,
    });

    const wrongApp: Record<string, string> = { ...payload, app_id: 'other-app' };
    const wrongSignContent = Object.keys(wrongApp)
      .filter((key) => key !== 'sign')
      .sort()
      .map((key) => `${key}=${wrongApp[key]}`)
      .join('&');
    wrongApp.sign = createSign('RSA-SHA256')
      .update(wrongSignContent, 'utf8')
      .sign(keys.privateKey, 'base64');
    await expect(adapter.verifyCallback({ parsedBody: wrongApp })).rejects.toThrow(
      'app ID does not match',
    );
  });

  it('verifies and decrypts a real WeChat Pay API v3 callback', async () => {
    const keys = rsaKeys();
    const apiV3Key = '0123456789abcdef0123456789abcdef';
    const settings = {
      callbackToleranceSeconds: () => 300,
      wechatConfig: async () => ({
        mchid: '1900000109',
        appid: 'wx0000000000000001',
        serial: 'merchant-serial',
        privateKey: keys.privateKey,
        certificates: { 'platform-serial': keys.publicKey },
        apiV3Key,
        notifyUrl: 'https://merchant.example.com/api/payments/callbacks/wechat',
      }),
    };
    const adapter = new WechatPaymentAdapter(settings as never);
    const resourceNonce = '0123456789ab';
    const associatedData = 'transaction';
    const resource = JSON.stringify({
      mchid: '1900000109',
      appid: 'wx0000000000000001',
      out_trade_no: 'order-2',
      transaction_id: 'wechat-trade-1',
      trade_state: 'SUCCESS',
      success_time: '2026-08-25T10:00:00+08:00',
      amount: { total: 8_800, currency: 'CNY' },
    });
    const notification = {
      id: 'wechat-event-1',
      event_type: 'TRANSACTION.SUCCESS',
      resource: {
        ciphertext: Aes.AesGcm.encrypt(resource, apiV3Key, resourceNonce, associatedData),
        nonce: resourceNonce,
        associated_data: associatedData,
      },
    };
    const rawBody = JSON.stringify(notification);
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const nonce = 'callback-nonce';
    const signature = Rsa.sign(
      `${timestamp}\n${nonce}\n${rawBody}\n`,
      Rsa.from(keys.privateKey, Rsa.KEY_TYPE_PRIVATE),
    );

    await expect(
      adapter.verifyCallback({
        parsedBody: notification,
        rawBody,
        headers: {
          'wechatpay-timestamp': timestamp,
          'wechatpay-nonce': nonce,
          'wechatpay-signature': signature,
          'wechatpay-serial': 'platform-serial',
        },
      }),
    ).resolves.toMatchObject({
      eventId: 'wechat-event-1',
      merchantOrderId: 'order-2',
      providerTransactionId: 'wechat-trade-1',
      status: 'succeeded',
      amountMinor: 8_800,
    });
  });
});

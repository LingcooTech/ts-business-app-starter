import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { SettingsRegistry, SettingsService } from '../../settings/public';

const providerSchema = z.enum(['mock', 'alipay', 'wechat']);
const platformCertificatesSchema = z.record(z.string().min(1), z.string().min(1));

@Injectable()
export class PaymentSettingsService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly registry: SettingsRegistry,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      key: 'payment.provider',
      group: 'payment',
      label: '默认支付 Provider',
      description: 'mock 仅用于非生产环境；生产环境应配置支付宝或微信支付。',
      schema: providerSchema,
      environment: 'PAYMENT_PROVIDER',
      defaultValue: 'mock',
    });
    this.registry.register({
      key: 'payment.notify-base-url',
      group: 'payment',
      label: '支付回调根地址',
      description: 'Provider 可访问的 API 根地址，不含 /api/payments/callbacks。',
      schema: z.string().trim().url().max(1000),
      environment: 'PAYMENT_NOTIFY_BASE_URL',
      defaultValue: 'http://localhost:8090',
    });
    this.registry.register({
      key: 'payment.alipay-app-id',
      group: 'payment',
      label: '支付宝 App ID',
      description: '支付宝开放平台应用 ID。',
      schema: z.string().trim().min(1).max(64),
      environment: 'PAYMENT_ALIPAY_APP_ID',
    });
    this.registry.register({
      key: 'payment.alipay-private-key',
      group: 'payment',
      label: '支付宝应用私钥',
      description: '应用 RSA2 私钥，保存后仅显示脱敏状态。',
      schema: z.string().min(100).max(20_000),
      sensitive: true,
      environment: 'PAYMENT_ALIPAY_PRIVATE_KEY',
    });
    this.registry.register({
      key: 'payment.alipay-public-key',
      group: 'payment',
      label: '支付宝公钥',
      description: '用于响应和异步通知验签。',
      schema: z.string().min(100).max(20_000),
      sensitive: true,
      environment: 'PAYMENT_ALIPAY_PUBLIC_KEY',
    });
    this.registry.register({
      key: 'payment.alipay-gateway',
      group: 'payment',
      label: '支付宝网关',
      description: '生产或沙箱网关地址。',
      schema: z.string().trim().url().max(1000),
      environment: 'PAYMENT_ALIPAY_GATEWAY',
      defaultValue: 'https://openapi.alipay.com/gateway.do',
    });
    this.registry.register({
      key: 'payment.alipay-return-url',
      group: 'payment',
      label: '支付宝返回地址',
      description: '用户完成收银台操作后的浏览器返回地址。',
      schema: z.string().trim().url().max(1000),
      environment: 'PAYMENT_ALIPAY_RETURN_URL',
    });
    this.registry.register({
      key: 'payment.wechat-mch-id',
      group: 'payment',
      label: '微信支付商户号',
      description: '微信支付 API v3 商户号。',
      schema: z.string().trim().min(1).max(64),
      environment: 'PAYMENT_WECHAT_MCH_ID',
    });
    this.registry.register({
      key: 'payment.wechat-app-id',
      group: 'payment',
      label: '微信 App ID',
      description: '与商户号绑定的应用 ID。',
      schema: z.string().trim().min(1).max(64),
      environment: 'PAYMENT_WECHAT_APP_ID',
    });
    this.registry.register({
      key: 'payment.wechat-merchant-serial',
      group: 'payment',
      label: '微信商户证书序列号',
      description: 'API v3 请求签名使用的商户证书序列号。',
      schema: z.string().trim().min(1).max(128),
      environment: 'PAYMENT_WECHAT_MERCHANT_SERIAL',
    });
    this.registry.register({
      key: 'payment.wechat-private-key',
      group: 'payment',
      label: '微信商户私钥',
      description: 'API v3 商户 RSA 私钥。',
      schema: z.string().min(100).max(20_000),
      sensitive: true,
      environment: 'PAYMENT_WECHAT_PRIVATE_KEY',
    });
    this.registry.register({
      key: 'payment.wechat-platform-certificates',
      group: 'payment',
      label: '微信平台证书/公钥',
      description: 'JSON 对象，键为平台序列号，值为 PEM 公钥或证书。',
      schema: z.string().min(2).max(100_000),
      sensitive: true,
      environment: 'PAYMENT_WECHAT_PLATFORM_CERTIFICATES',
    });
    this.registry.register({
      key: 'payment.wechat-api-v3-key',
      group: 'payment',
      label: '微信 API v3 Key',
      description: '32 字节 API v3 对称密钥，用于通知资源解密。',
      schema: z.string().length(32),
      sensitive: true,
      environment: 'PAYMENT_WECHAT_API_V3_KEY',
    });
  }

  async provider() {
    const provider =
      (await this.settings.getValue<z.infer<typeof providerSchema>>('payment.provider')) ?? 'mock';
    this.ensureProviderAllowed(provider);
    return provider;
  }

  ensureProviderAllowed(provider: 'mock' | 'alipay' | 'wechat'): void {
    if (provider === 'mock' && this.config.getOrThrow<string>('NODE_ENV') === 'production') {
      throw new Error('Mock payment provider is disabled in production');
    }
  }

  callbackToleranceSeconds(): number {
    return this.config.getOrThrow<number>('PAYMENT_CALLBACK_TOLERANCE_SECONDS');
  }

  async alipayConfig() {
    const [appId, privateKey, alipayPublicKey, gateway, returnUrl, notifyBaseUrl] =
      await Promise.all([
        this.settings.getValue<string>('payment.alipay-app-id'),
        this.settings.getValue<string>('payment.alipay-private-key'),
        this.settings.getValue<string>('payment.alipay-public-key'),
        this.settings.getValue<string>('payment.alipay-gateway'),
        this.settings.getValue<string>('payment.alipay-return-url'),
        this.settings.getValue<string>('payment.notify-base-url'),
      ]);
    if (!appId || !privateKey || !alipayPublicKey || !gateway || !notifyBaseUrl) {
      throw new Error('Alipay app ID, keys, gateway, and notify base URL must be configured');
    }
    return {
      appId,
      privateKey,
      alipayPublicKey,
      gateway,
      returnUrl,
      notifyUrl: this.callbackUrl(notifyBaseUrl, 'alipay'),
    };
  }

  async wechatConfig() {
    const [mchid, appid, serial, privateKey, certificatesJson, apiV3Key, notifyBaseUrl] =
      await Promise.all([
        this.settings.getValue<string>('payment.wechat-mch-id'),
        this.settings.getValue<string>('payment.wechat-app-id'),
        this.settings.getValue<string>('payment.wechat-merchant-serial'),
        this.settings.getValue<string>('payment.wechat-private-key'),
        this.settings.getValue<string>('payment.wechat-platform-certificates'),
        this.settings.getValue<string>('payment.wechat-api-v3-key'),
        this.settings.getValue<string>('payment.notify-base-url'),
      ]);
    if (
      !mchid ||
      !appid ||
      !serial ||
      !privateKey ||
      !certificatesJson ||
      !apiV3Key ||
      !notifyBaseUrl
    ) {
      throw new Error(
        'WeChat Pay merchant, key, certificate, API v3, and notify settings are required',
      );
    }
    let certificates: Record<string, string>;
    try {
      certificates = platformCertificatesSchema.parse(JSON.parse(certificatesJson));
    } catch {
      throw new Error('WeChat Pay platform certificates must be a JSON serial-to-PEM object');
    }
    return {
      mchid,
      appid,
      serial,
      privateKey,
      certificates,
      apiV3Key,
      notifyUrl: this.callbackUrl(notifyBaseUrl, 'wechat'),
    };
  }

  private callbackUrl(baseUrl: string, provider: 'alipay' | 'wechat') {
    return `${baseUrl.replace(/\/$/, '')}/api/payments/callbacks/${provider}`;
  }
}

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type ProxyAwareRequest = { ip?: string; ips?: string[] };

@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: ProxyAwareRequest): Promise<string> {
    return Promise.resolve(request.ips?.[0] ?? request.ip ?? 'unknown');
  }
}

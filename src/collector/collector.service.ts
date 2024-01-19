import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { DigService } from 'src/dig/dig.service';
import { randomBytes } from 'crypto';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    private readonly digService: DigService,
    private readonly configService: ConfigService,
    @InjectMetric('dns_latency_histo') private dnsLatencyHisto: Histogram,
    @InjectMetric('dns_latency') private dnsLatency: Gauge,
    @InjectMetric('dns_packet_loss') private dnsPacketLoss: Counter,
  ) {}

  @Cron('30 * * * * *')
  async run() {
    this.logger.log('Collection cycle started.');
    const servers = this.configService.get<string[]>('dnsservers');
    const domains = this.configService.get<string[]>('domains');

    for (const server of servers) {
      const domainsToProcess = this.getRandomElementsFromArray(domains, 5);
      for (const domain of domainsToProcess) {
        await this.collectLatency(server, domain);
      }
    }

    this.logger.log('Collection cycle done.');
  }

  getRandomElementsFromArray(arr: string[], count: number): string[] {
    const shuffledArray = arr.slice().sort(() => {
      const randomBytess = randomBytes(4);
      const randomValue = randomBytess.readUInt32LE(0) / 0xffffffff;
      return randomValue;
    });
    return shuffledArray.slice(0, count);
  }

  async collectLatency(server: string, domain: string) {
    try {
      const result = await this.digService.dig(server, domain);
      this.dnsLatencyHisto.observe(
        {
          dnsServer: result.dnsServer,
          digVersion: result.digVersion,
          domain: result.domain,
        },
        result.time,
      );
      this.dnsLatency.set(
        {
          dnsServer: result.dnsServer,
          digVersion: result.digVersion,
          domain: result.domain,
        },
        result.time,
      );
    } catch (err) {
      this.dnsPacketLoss.inc({
        dnsServer: server,
        domain: domain,
      });
    }
  }
}

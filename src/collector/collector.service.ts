import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { DigService } from 'src/dig/dig.service';

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
      const domainsToProcess = this.getRandomElements(domains, 5);
      this.logger.debug(domainsToProcess);
      for (const domain of domainsToProcess) {
        await this.collectLatency(server, domain);
      }
    }

    this.logger.log('Collection cycle done.');
  }

  getRandomElements(arr: string[], count: number): string[] {
    if (count >= arr.length) {
      return arr.slice(); // Return a copy of the whole array if count is greater than or equal to the array length
    }

    const shuffled = arr.slice(); // Create a copy of the array
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements randomly
    }

    return shuffled.slice(0, count); // Return the first 'count' elements from the shuffled array
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

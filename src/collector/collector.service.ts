import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge, Histogram } from 'prom-client';
import { DigService } from 'src/dig/dig.service';

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    private readonly digService: DigService,
    private readonly configService: ConfigService,
    @InjectMetric('dns_latency_histo') private dnsLatencyHisto: Histogram,
    @InjectMetric('dns_latency') private dnsLatency: Gauge,
  ) {}

  @Cron('30 * * * * *')
  async run() {
    const servers = this.configService.get<string[]>('dnsservers');
    const domains = this.configService.get<string[]>('domains');

    domains.forEach((domain) => {
      servers.forEach((server) => this.collectLatency(server, domain));
    });
  }

  async collectLatency(server: string, domain: string) {
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
  }
}

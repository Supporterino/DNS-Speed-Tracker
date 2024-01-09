import { Module } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { DigModule } from 'src/dig/dig.module';
import {
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';

@Module({
  imports: [DigModule],
  providers: [
    CollectorService,
    makeHistogramProvider({
      name: 'dns_latency_histo',
      help: 'latency of am individual dns to a defined domain as histogram data',
      labelNames: ['dnsServer', 'domain', 'digVersion'],
      buckets: [0, 1, 5, 10, 25, 50, 75, 100, 150],
    }),
    makeGaugeProvider({
      name: 'dns_latency',
      help: 'latency of am individual dns to a defined domain',
      labelNames: ['dnsServer', 'domain', 'digVersion'],
    }),
  ],
})
export class CollectorModule {}

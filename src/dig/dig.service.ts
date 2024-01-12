import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { DigResultDto } from './dto/dig-result.dto';
@Injectable()
export class DigService {
  private readonly logger = new Logger(DigService.name);

  parse(input: string) {
    this.logger.verbose(`Received input ${JSON.stringify(input)}`);
    const lines = input.split('\n');
    if (lines.length < 6) throw new Error('DNS lookup failed.');
    const result: DigResultDto = {};

    lines.forEach((line) => {
      if (line.startsWith('; <<>>')) {
        this.logger.debug('Found header line with basic information');
        const parts = line
          .split(/(\s+)/)
          .filter((item) => item.trim().length > 0);
        this.logger.verbose(
          `Extracted basic informations: ${JSON.stringify(parts)}`,
        );
        result.digVersion = parts[3];
        result.dnsServer = parts[5].substring(1);
        result.domain = parts[6];
      }
      if (line.startsWith(';; Query time')) {
        this.logger.debug('Extracting query time');
        const parts = line
          .split(/(\s+)/)
          .filter((item) => item.trim().length > 0);
        this.logger.verbose(`Extracted time: ${JSON.stringify(parts)}`);
        result.time = Number(parts[3]);
      }
    });

    return result;
  }

  dig(dnsServer: string, target: string): Promise<DigResultDto> {
    return new Promise((resolve, reject) => {
      const process = spawn('dig', [`@${dnsServer}`, target, '+time=1']);
      let output = '';

      process.on('error', (error) => {
        reject(error);
      });

      process.stdout.on('data', (chunk) => {
        output += chunk;
      });

      process.stdout.on('error', (error) => {
        reject(error);
      });

      process.stdout.on('end', () => {
        try {
          const result = this.parse(output);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

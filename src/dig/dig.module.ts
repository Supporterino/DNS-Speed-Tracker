import { Module } from '@nestjs/common';
import { DigService } from './dig.service';

@Module({
  providers: [DigService],
  exports: [DigService],
})
export class DigModule {}

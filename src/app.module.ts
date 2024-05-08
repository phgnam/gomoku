import { Module } from '@nestjs/common';
import { GomokuGameService } from './app.service';
import { EventGateway } from './app.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [GomokuGameService, EventGateway],
})
export class AppModule {}

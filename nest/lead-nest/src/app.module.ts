import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseClientModule } from './supabase-client/supabase-client.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SupabaseClientModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

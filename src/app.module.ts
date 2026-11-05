import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

import { CityModule } from './modules/city/city.module';
import { RegionModule } from './modules/region/region.module';
import { TemplateModule } from './modules/template/template.module';
import { RoadsignModule } from './modules/roadsign/roadsign.module';
import { PrintingsModule } from './modules/printings/printings.module';
import { PageContentModule } from './modules/page-content/page-content.module';
import { NewsModule } from './modules/news/news.module';
import { BookingModule } from './modules/booking/booking.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { PrismaModule } from './database/prisma.module';
import { jwtConstants } from './modules/auth/constants';
import { JwtModule } from '@nestjs/jwt';
import { PaymentController } from './modules/payment/payment.controller';
import { PaymentService } from './modules/payment/payment.service';
import { PaymentModule } from './modules/payment/payment.module';
import { SeoModule } from './modules/seo/seo.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    CityModule,
    RegionModule,
    TemplateModule,
    RoadsignModule,
    PrintingsModule,
    PageContentModule,
    NewsModule,
    BookingModule,
    PaymentModule,
    AuthModule,
    AdminModule,
    ChatModule,
    SeoModule,
    UploadModule,
    AiModule,
    PrismaModule,
    ConfigModule.forRoot(),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
    PaymentModule,
    SeoModule,
  ],
  controllers: [AppController],
  providers: [AppService, PaymentService],
})
export class AppModule { }

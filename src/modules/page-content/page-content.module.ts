import { Module } from '@nestjs/common';
import { PageContentController } from './page-content.controller';
import { PageContentService } from './page-content.service';

@Module({
  controllers: [PageContentController],
  providers: [PageContentService],
  exports: [PageContentService],
})
export class PageContentModule {}
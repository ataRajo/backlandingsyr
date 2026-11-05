import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { TemplateModule } from '../template/template.module';
import { AdminGuard } from 'src/guards/admin.guard';
import { SuperAdminGuard } from 'src/guards/superadmin.guard';

@Module({
    imports: [TemplateModule],
    controllers: [AdminController],
    providers: [AdminService, AdminGuard, SuperAdminGuard],
})
export class AdminModule { }
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from 'src/guards/admin.guard';
import { SuperAdminGuard } from 'src/guards/superadmin.guard';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('api/admin')

export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Get('customers')
    @UseGuards(AdminGuard)
    getCustomers() {
        return this.adminService.getCustomers();
    }

    @Post('customers')
    @UseGuards(AdminGuard)
    createCustomer(@Body() body: CreateCustomerDto) {
        return this.adminService.createCustomer(body);
    }

    @Patch('customers/:id')
    @UseGuards(AdminGuard)
    updateCustomer(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
        return this.adminService.updateCustomer(BigInt(id), body);
    }

    @Get('customers/best')
    getBestCustomers() {
        return this.adminService.getBestCustomers();
    }

    @Patch('customers/:id/best')
    updateBestCustomer(
        @Param('id') id: string,
        @Body() body: { is_best_customer?: boolean; best_customer_order?: number },
    ) {
        return this.adminService.updateBestCustomer(BigInt(id), body);
    }

    @Get('templates')
    listTemplates() {
        return this.adminService.listLandingTemplates();
    }

    @Patch('templates/:id/landing-price')
    updateTemplateLandingPrice(
        @Param('id') id: string,
        @Body() body: { landing_price?: number | string | null },
    ) {
        return this.adminService.updateLandingTemplatePrice(BigInt(id), body.landing_price);
    }

    @Get('admins')
    @UseGuards(SuperAdminGuard)
    getAdmins() {
        return this.adminService.getAdmins();
    }

    @Get('admins/:id')
    @UseGuards(SuperAdminGuard)
    getAdminById(@Param('id') id: string) {
        return this.adminService.getAdminById(BigInt(id));
    }

    @Post('admins')
    @UseGuards(SuperAdminGuard)
    createAdmin(@Body() body: CreateAdminDto) {
        return this.adminService.createAdmin(body);
    }

    @Patch('admins/:id')
    @UseGuards(SuperAdminGuard)
    updateAdmin(@Param('id') id: string, @Body() body: UpdateAdminDto) {
        return this.adminService.updateAdmin(BigInt(id), body);
    }

    @Delete('admins/:id')
    @UseGuards(SuperAdminGuard)
    deleteAdmin(@Param('id') id: string) {
        return this.adminService.deleteAdmin(BigInt(id));
    }
}
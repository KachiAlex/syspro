import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../../entities/user.entity';

@ApiTags('Billing Plans')
@ApiBearerAuth()
@Controller('billing/plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all plans' })
  async findAll() {
    return this.planRepository.find({
      where: { isActive: true },
      order: { priceCents: 'ASC' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  async findOne(@Param('id') id: string) {
    return this.planRepository.findOne({ where: { id } });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new plan' })
  async create(@Body() planData: any) {
    const plan = this.planRepository.create(planData);
    return this.planRepository.save(plan);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan' })
  async update(@Param('id') id: string, @Body() planData: any) {
    await this.planRepository.update(id, planData);
    return this.planRepository.findOne({ where: { id } });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete plan' })
  async remove(@Param('id') id: string) {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (plan?.isSystemPlan) {
      throw new Error('Cannot delete system plan');
    }
    await this.planRepository.remove(plan!);
    return { message: 'Plan deleted successfully' };
  }
}


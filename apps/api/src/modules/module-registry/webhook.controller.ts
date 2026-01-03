import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { CurrentTenant } from '../../modules/auth/decorators/current-tenant.decorator';
import { WebhookService, WebhookEvent, WebhookDelivery } from './webhook.service';

@Controller('api/v1/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  /**
   * Register a webhook for a tenant
   * POST /api/v1/webhooks/register
   */
  @Post('register')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.CREATED)
  async registerWebhook(
    @Body() body: {
      url: string;
      events: string[];
    },
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Registering webhook for tenant ${tenantId}: ${body.url}`);

    if (!body.url || !body.events || !Array.isArray(body.events)) {
      throw new BadRequestException('url and events array are required');
    }

    try {
      const webhook = await this.webhookService.registerWebhook(
        tenantId,
        body.url,
        body.events,
      );

      return {
        success: true,
        data: webhook,
      };
    } catch (error) {
      this.logger.error(`Failed to register webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister a webhook
   * DELETE /api/v1/webhooks/:webhookId
   */
  @Delete(':webhookId')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async unregisterWebhook(
    @Param('webhookId') webhookId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Unregistering webhook ${webhookId} for tenant ${tenantId}`);

    try {
      await this.webhookService.unregisterWebhook(tenantId, webhookId);

      return {
        success: true,
        message: 'Webhook unregistered successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to unregister webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get webhook delivery status
   * GET /api/v1/webhooks/deliveries/:deliveryId
   */
  @Get('deliveries/:deliveryId')
  @Roles('admin', 'tenant_admin')
  async getDeliveryStatus(
    @Param('deliveryId') deliveryId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Fetching delivery status for ${deliveryId}`);

    try {
      const delivery = await this.webhookService.getDeliveryStatus(deliveryId);

      if (!delivery) {
        throw new NotFoundException(`Delivery not found: ${deliveryId}`);
      }

      return {
        success: true,
        data: delivery,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch delivery status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all deliveries for a webhook URL
   * GET /api/v1/webhooks/deliveries
   */
  @Get('deliveries')
  @Roles('admin', 'tenant_admin')
  async getWebhookDeliveries(
    @Query('url') webhookUrl: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Fetching deliveries for webhook URL: ${webhookUrl}`);

    if (!webhookUrl) {
      throw new BadRequestException('url query parameter is required');
    }

    try {
      const deliveries = await this.webhookService.getWebhookDeliveries(webhookUrl);

      return {
        success: true,
        data: {
          url: webhookUrl,
          count: deliveries.length,
          deliveries,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch webhook deliveries: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry a failed webhook delivery
   * POST /api/v1/webhooks/deliveries/:deliveryId/retry
   */
  @Post('deliveries/:deliveryId/retry')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Retrying delivery ${deliveryId}`);

    try {
      const delivery = await this.webhookService.retryDelivery(deliveryId);

      return {
        success: true,
        message: 'Webhook delivery retry initiated',
        data: delivery,
      };
    } catch (error) {
      this.logger.error(`Failed to retry delivery: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emit a test webhook event
   * POST /api/v1/webhooks/test
   */
  @Post('test')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async testWebhook(
    @Body() body: {
      url: string;
      eventType: string;
      data?: Record<string, any>;
    },
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Testing webhook for tenant ${tenantId}: ${body.url}`);

    if (!body.url || !body.eventType) {
      throw new BadRequestException('url and eventType are required');
    }

    try {
      const testEvent: WebhookEvent = {
        id: `test_${Date.now()}`,
        type: body.eventType,
        timestamp: new Date(),
        tenantId,
        data: body.data || { test: true },
        source: 'webhook-test',
      };

      const delivery = await this.webhookService.deliverWebhookEvent(body.url, testEvent);

      return {
        success: delivery.status === 'delivered',
        message: `Test webhook ${delivery.status}`,
        data: delivery,
      };
    } catch (error) {
      this.logger.error(`Failed to test webhook: ${error.message}`);
      throw error;
    }
  }
}

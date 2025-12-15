import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';

@ApiTags('Billing Webhooks')
@Controller('billing/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleStripeWebhook(
    @Body() payload: any,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('Received Stripe webhook');
    return this.webhookService.handleStripeWebhook(payload, signature);
  }

  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flutterwave webhook endpoint' })
  async handleFlutterwaveWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    this.logger.log('Received Flutterwave webhook');
    return this.webhookService.handleFlutterwaveWebhook(payload, signature);
  }

  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook endpoint' })
  async handlePaystackWebhook(
    @Body() payload: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    this.logger.log('Received Paystack webhook');
    return this.webhookService.handlePaystackWebhook(payload, signature);
  }

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generic webhook endpoint' })
  async handleGenericWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
  ) {
    this.logger.log(`Received webhook from ${provider}`);
    return this.webhookService.handleGenericWebhook(provider, payload, headers);
  }
}


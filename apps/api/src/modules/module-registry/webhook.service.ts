import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { timeout, retry } from 'rxjs/operators';

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  tenantId: string;
  data: Record<string, any>;
  source: string;
}

export interface WebhookDelivery {
  id: string;
  webhookUrl: string;
  event: WebhookEvent;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  error?: string;
  response?: {
    statusCode: number;
    body: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds
  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 seconds
  private readonly webhookDeliveries: Map<string, WebhookDelivery> = new Map();

  constructor(
    private httpService: HttpService,
    private eventEmitter: EventEmitter2,
  ) {
    this.startRetryProcessor();
  }

  /**
   * Register a webhook URL for a tenant
   */
  async registerWebhook(
    tenantId: string,
    webhookUrl: string,
    events: string[],
  ): Promise<{ webhookId: string; url: string; events: string[] }> {
    this.logger.log(`Registering webhook for tenant ${tenantId}: ${webhookUrl}`);

    // Validate webhook URL
    try {
      new URL(webhookUrl);
    } catch (error) {
      throw new Error(`Invalid webhook URL: ${webhookUrl}`);
    }

    // In a real implementation, this would be stored in a database
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      webhookId,
      url: webhookUrl,
      events,
    };
  }

  /**
   * Unregister a webhook
   */
  async unregisterWebhook(tenantId: string, webhookId: string): Promise<void> {
    this.logger.log(`Unregistering webhook ${webhookId} for tenant ${tenantId}`);
    // In a real implementation, this would delete from database
  }

  /**
   * Emit a standardized webhook event
   */
  async emitWebhookEvent(
    tenantId: string,
    eventType: string,
    data: Record<string, any>,
    source: string = 'module-registry',
  ): Promise<void> {
    const event: WebhookEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: new Date(),
      tenantId,
      data,
      source,
    };

    this.logger.log(`Emitting webhook event: ${eventType} for tenant ${tenantId}`);

    // In a real implementation, this would query registered webhooks from database
    // For now, we'll emit an internal event that can be handled by listeners
    this.eventEmitter.emit('webhook.event', event);
  }

  /**
   * Handle module enabled event and emit webhook
   */
  @OnEvent('module.enabled')
  async handleModuleEnabledWebhook(event: any): Promise<void> {
    await this.emitWebhookEvent(
      event.tenantId,
      'module.enabled',
      {
        moduleName: event.moduleName,
        moduleId: event.moduleId,
        userId: event.userId,
        timestamp: event.timestamp,
      },
      'module-registry',
    );
  }

  /**
   * Handle module disabled event and emit webhook
   */
  @OnEvent('module.disabled')
  async handleModuleDisabledWebhook(event: any): Promise<void> {
    await this.emitWebhookEvent(
      event.tenantId,
      'module.disabled',
      {
        moduleName: event.moduleName,
        moduleId: event.moduleId,
        userId: event.userId,
        timestamp: event.timestamp,
      },
      'module-registry',
    );
  }

  /**
   * Handle module configuration updated event and emit webhook
   */
  @OnEvent('module.configuration.updated')
  async handleModuleConfigurationUpdatedWebhook(event: any): Promise<void> {
    await this.emitWebhookEvent(
      event.tenantId,
      'module.configuration.updated',
      {
        moduleName: event.moduleName,
        configuration: event.configuration,
        userId: event.userId,
        timestamp: event.timestamp,
      },
      'module-registry',
    );
  }

  /**
   * Handle module feature toggled event and emit webhook
   */
  @OnEvent('module.feature.toggled')
  async handleModuleFeatureToggledWebhook(event: any): Promise<void> {
    await this.emitWebhookEvent(
      event.tenantId,
      'module.feature.toggled',
      {
        moduleName: event.moduleName,
        featureName: event.featureName,
        enabled: event.enabled,
        userId: event.userId,
        timestamp: event.timestamp,
      },
      'module-registry',
    );
  }

  /**
   * Handle billing event and emit webhook
   */
  @OnEvent('billing.line_item.created')
  async handleBillingLineItemCreatedWebhook(event: any): Promise<void> {
    await this.emitWebhookEvent(
      event.event.tenantId,
      'billing.line_item.created',
      {
        lineItem: event.lineItem,
        moduleName: event.event.moduleName,
        timestamp: new Date(),
      },
      'billing-integration',
    );
  }

  /**
   * Deliver webhook event to registered endpoints
   */
  async deliverWebhookEvent(
    webhookUrl: string,
    event: WebhookEvent,
  ): Promise<WebhookDelivery> {
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookUrl,
      event,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhookDeliveries.set(deliveryId, delivery);

    try {
      await this.attemptDelivery(delivery);
    } catch (error) {
      this.logger.error(`Failed to deliver webhook: ${error.message}`);
      delivery.status = 'failed';
      delivery.error = error.message;
      delivery.updatedAt = new Date();
    }

    return delivery;
  }

  /**
   * Attempt to deliver webhook with retry logic
   */
  private async attemptDelivery(delivery: WebhookDelivery): Promise<void> {
    delivery.attempts++;
    delivery.lastAttemptAt = new Date();

    try {
      const response = await firstValueFrom(
        this.httpService.post(delivery.webhookUrl, delivery.event).pipe(
          timeout(this.REQUEST_TIMEOUT_MS),
          retry({
            count: 0, // No automatic retries here, we handle it manually
            delay: this.RETRY_DELAY_MS,
          }),
        ),
      );

      delivery.status = 'delivered';
      delivery.response = {
        statusCode: response.status,
        body: JSON.stringify(response.data),
      };
      delivery.updatedAt = new Date();

      this.logger.log(`Webhook delivered successfully: ${delivery.id}`);
    } catch (error) {
      this.logger.error(`Webhook delivery failed (attempt ${delivery.attempts}): ${error.message}`);

      if (delivery.attempts < this.MAX_RETRIES) {
        // Schedule retry
        delivery.nextRetryAt = new Date(Date.now() + this.RETRY_DELAY_MS * delivery.attempts);
        delivery.status = 'pending';
      } else {
        delivery.status = 'failed';
        delivery.error = `Max retries (${this.MAX_RETRIES}) exceeded`;
      }

      delivery.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Start background processor for webhook retries
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetries();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Process pending webhook deliveries for retry
   */
  private async processRetries(): Promise<void> {
    const now = new Date();

    for (const [deliveryId, delivery] of this.webhookDeliveries.entries()) {
      if (
        delivery.status === 'pending' &&
        delivery.nextRetryAt &&
        delivery.nextRetryAt <= now &&
        delivery.attempts < this.MAX_RETRIES
      ) {
        try {
          await this.attemptDelivery(delivery);
        } catch (error) {
          this.logger.error(`Retry failed for delivery ${deliveryId}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get webhook delivery status
   */
  async getDeliveryStatus(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.webhookDeliveries.get(deliveryId) || null;
  }

  /**
   * Get all deliveries for a webhook
   */
  async getWebhookDeliveries(webhookUrl: string): Promise<WebhookDelivery[]> {
    const deliveries: WebhookDelivery[] = [];

    for (const delivery of this.webhookDeliveries.values()) {
      if (delivery.webhookUrl === webhookUrl) {
        deliveries.push(delivery);
      }
    }

    return deliveries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = this.webhookDeliveries.get(deliveryId);

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    if (delivery.status === 'delivered') {
      throw new Error(`Cannot retry a successfully delivered webhook`);
    }

    // Reset attempts for manual retry
    delivery.attempts = 0;
    delivery.status = 'pending';
    delivery.nextRetryAt = new Date();

    try {
      await this.attemptDelivery(delivery);
    } catch (error) {
      this.logger.error(`Manual retry failed for delivery ${deliveryId}: ${error.message}`);
    }

    return delivery;
  }
}

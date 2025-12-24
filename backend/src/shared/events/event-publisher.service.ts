import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class EventPublisherService implements OnModuleInit {
  private readonly logger = new Logger(EventPublisherService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly exchangeName = 'syspro_events';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      const rabbitmqUrl =
        this.configService.get<string>('RABBITMQ_URL') ||
        'amqp://localhost:5672';

      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Declare exchange
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true,
      });

      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      const shouldRequireRabbit =
        this.configService.get<string>('NODE_ENV') === 'production' &&
        this.configService.get<string>('REQUIRE_RABBITMQ') === 'true';

      this.logger.error('Failed to connect to RabbitMQ', error);
      if (shouldRequireRabbit) {
        throw error;
      }
    }
  }

  async publish(eventType: string, data: any, routingKey?: string): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ not connected, event not published');
      return;
    }

    try {
      const message = JSON.stringify({
        eventType,
        data,
        timestamp: new Date().toISOString(),
      });

      const key = routingKey || eventType.toLowerCase().replace('.', '_');

      this.channel.publish(this.exchangeName, key, Buffer.from(message), {
        persistent: true,
      });

      this.logger.debug(`Published event: ${eventType}`);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${eventType}`, error);
    }
  }

  async subscribe(
    routingKey: string,
    callback: (message: any) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ not connected, subscription not created');
      return;
    }

    try {
      const queue = await this.channel.assertQueue('', { exclusive: true });
      await this.channel.bindQueue(queue.queue, this.exchangeName, routingKey);

      await this.channel.consume(queue.queue, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await callback(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error('Error processing message', error);
            this.channel.nack(msg, false, false);
          }
        }
      });

      this.logger.log(`Subscribed to: ${routingKey}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to: ${routingKey}`, error);
    }
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}


import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/webhook-event.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async isProcessed(provider: string, eventId: string): Promise<boolean> {
    const existing = await this.eventRepository.findOne({
      where: { provider, providerEventId: eventId },
    });

    return !!existing;
  }

  async markProcessed(
    provider: string,
    eventId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const event = this.eventRepository.create({
      provider,
      providerEventId: eventId,
      eventType,
      payload,
      processedAt: new Date(),
    });

    await this.eventRepository.save(event);
  }
}


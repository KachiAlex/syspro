import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantInterceptor } from '../../common/interceptors/tenant.interceptor';

@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class MultiTenantModule {}


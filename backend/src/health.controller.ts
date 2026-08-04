import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Kiểm tra backend đang chạy' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

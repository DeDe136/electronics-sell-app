import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description: 'Tạo tài khoản người dùng mới với role mặc định là `customer`. Email phải là duy nhất trong hệ thống.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Đăng ký thành công, trả về JWT token và thông tin user',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Email đã tồn tại trong hệ thống' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ (email sai định dạng, password < 8 ký tự, ...)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập, nhận JWT token',
    description: 'Xác thực thông tin đăng nhập và trả về JWT access token. Token có giá trị trong 7 ngày.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Đăng nhập thành công, trả về JWT token và thông tin user',
    type: AuthResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Sai email hoặc mật khẩu' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
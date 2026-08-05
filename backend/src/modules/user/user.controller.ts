import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IMAGE_UPLOAD_MAX_SIZE_BYTES,
  IMAGE_UPLOAD_ALLOWED_MIMETYPE_REGEX,
} from '../../common/constants/upload.constants';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiConsumes,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UserService, UpdateUserDto } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';

class UserProfileResponse {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string;
  address: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@ApiTags('User')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
@ApiUnauthorizedResponse({
  description: 'Chưa đăng nhập hoặc token không hợp lệ',
})
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ===========================
  //  Người dùng tự quản lý bản thân
  // ===========================

  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin cá nhân',
    description: 'Trả về thông tin đầy đủ của người dùng đang đăng nhập.',
  })
  @ApiOkResponse({
    description: 'Thông tin người dùng',
    type: UserProfileResponse,
  })
  getProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Cập nhật thông tin cá nhân',
    description:
      'Cập nhật họ tên, số điện thoại hoặc địa chỉ. Chỉ truyền các trường cần thay đổi.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({
    description: 'Thông tin đã được cập nhật',
    type: UserProfileResponse,
  })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.userService.updateProfile(user.id, dto);
  }

  @Patch('me/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({
    summary: 'Cập nhật ảnh đại diện',
    description:
      'Upload ảnh đại diện mới (multipart/form-data). Ảnh cũ sẽ bị xóa khỏi storage. Định dạng hỗ trợ: JPG, PNG, WebP. Kích thước tối đa: 5MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File ảnh đại diện',
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh (JPG, PNG, WebP — tối đa 5MB)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Avatar đã được cập nhật thành công',
    type: UserProfileResponse,
  })
  @ApiBadRequestResponse({
    description:
      'File không hợp lệ (sai định dạng, không phải JPG/PNG/WebP) hoặc vượt quá 5MB',
  })
  updateAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: IMAGE_UPLOAD_MAX_SIZE_BYTES }),
          new FileTypeValidator({
            fileType: IMAGE_UPLOAD_ALLOWED_MIMETYPE_REGEX,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.userService.updateAvatar(user.id, file);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa tài khoản của tôi',
    description:
      'Người dùng tự xóa tài khoản của mình. **Không thể khôi phục.** Tất cả dữ liệu cá nhân sẽ bị xóa. Đơn hàng đã hoàn thành sẽ được giữ lại cho mục đích kế toán nhưng sẽ không còn liên kết với tài khoản.',
  })
  @ApiNoContentResponse({ description: 'Tài khoản đã bị xóa thành công' })
  @ApiBadRequestResponse({
    description: 'Không thể xóa tài khoản đang có đơn hàng chưa hoàn thành',
  })
  deleteMyAccount(@CurrentUser() user: User) {
    return this.userService.deleteUser(user.id);
  }

  // ===========================
  //  Admin — Quản lý users
  // ===========================

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Lấy danh sách tất cả người dùng',
    description:
      'Admin xem danh sách toàn bộ người dùng trong hệ thống. Mật khẩu không được trả về. Yêu cầu role **admin**.',
  })
  @ApiOkResponse({
    description: 'Danh sách người dùng',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', example: 'user@example.com' },
          fullName: { type: 'string', example: 'Nguyen Van A' },
          phone: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['customer', 'admin'] },
          isActive: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Lấy chi tiết người dùng',
    description:
      'Admin xem đầy đủ thông tin của một người dùng theo UUID. Yêu cầu role **admin**.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của người dùng',
    format: 'uuid',
    example: 'uuid-...',
  })
  @ApiOkResponse({
    description: 'Chi tiết người dùng',
    type: UserProfileResponse,
  })
  @ApiNotFoundResponse({ description: 'Người dùng không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getProfile(id);
  }

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Cập nhật thông tin người dùng',
    description:
      'Admin cập nhật thông tin của bất kỳ người dùng nào, bao gồm đổi role hoặc khoá/mở khoá tài khoản. Yêu cầu role **admin**.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của người dùng',
    format: 'uuid',
    example: 'uuid-...',
  })
  @ApiBody({
    description: 'Các trường cần cập nhật (đều là optional)',
    schema: {
      type: 'object',
      properties: {
        fullName: {
          type: 'string',
          example: 'Nguyen Van B',
          description: 'Họ tên mới',
        },
        phone: {
          type: 'string',
          example: '0909999888',
          description: 'Số điện thoại mới',
        },
        address: { type: 'string', description: 'Địa chỉ mới' },
        role: {
          type: 'string',
          enum: ['customer', 'admin'],
          example: 'admin',
          description: 'Phân quyền người dùng',
        },
        isActive: {
          type: 'boolean',
          example: false,
          description: 'Khoá (false) hoặc mở khoá (true) tài khoản',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Thông tin người dùng đã được cập nhật',
    type: UserProfileResponse,
  })
  @ApiNotFoundResponse({ description: 'Người dùng không tồn tại' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  updateUserByAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      fullName?: string;
      phone?: string;
      address?: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ) {
    return this.userService.updateUserByAdmin(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa người dùng',
    description:
      'Admin xóa vĩnh viễn một người dùng khỏi hệ thống. **Không thể khôi phục.** Không thể xóa người dùng đang có đơn hàng chưa hoàn thành. Yêu cầu role **admin**.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của người dùng',
    format: 'uuid',
    example: 'uuid-...',
  })
  @ApiNoContentResponse({ description: 'Người dùng đã bị xóa thành công' })
  @ApiBadRequestResponse({
    description: 'Không thể xóa người dùng đang có đơn hàng chưa hoàn thành',
  })
  @ApiNotFoundResponse({ description: 'Người dùng không tồn tại' })
  @ApiForbiddenResponse({ description: 'Không có quyền admin' })
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteUser(id);
  }
}

import {
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
  Req,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  search(@Query('q') query: string) {
    return this.usersService.searchUsers(query);
  }

  @Patch('profile')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads', 'avatars'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
          cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updateProfile(
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = (req as any).user.id;
    const avatar = file ? `/uploads/avatars/${file.filename}` : undefined;
    return this.usersService.updateProfile(userId, { avatar });
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @Get()
  getActive() {
    return this.storiesService.getActiveStories();
  }

  @Get('mine')
  getMine(@Req() req: Request) {
    return this.storiesService.getUserStories((req as any).user.id);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads', 'stories'),
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, 'story-' + uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async create(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = `/uploads/stories/${file.filename}`;
    return this.storiesService.create((req as any).user.id, url);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.storiesService.delete(+id, (req as any).user.id);
  }
}

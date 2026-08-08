import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MangasService } from './mangas.service';

@Controller('mangas')
export class MangasController {
  constructor(private readonly mangasService: MangasService) {}

  @Post()
  create(@Body() createMangaDto: any) {
    return this.mangasService.create(createMangaDto);
  }

  @Get()
  findAll() {
    return this.mangasService.findAll();
  }

  // ParseUUIDPipe valide automatiquement que le paramètre "id" est un vrai UUID v4
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.mangasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateMangaDto: any,
  ) {
    return this.mangasService.update(id, updateMangaDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.mangasService.remove(id);
  }
}

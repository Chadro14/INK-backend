import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Controller('manga-image')
export class ImagesController {
  @Get()
  async getImage(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      throw new HttpException('URL manquante', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://mangadex.org/',
        },
        timeout: 10000,
      });

      // ✅ Correction : vérifier que contentType est une string
      const contentType = response.headers['content-type'];
      if (contentType && typeof contentType === 'string') {
        res.set('Content-Type', contentType);
      } else {
        res.set('Content-Type', 'image/jpeg');
      }
      
      res.set('Cache-Control', 'public, max-age=86400');
      res.send(response.data);
    } catch (error) {
      console.error('Erreur proxy image:', error.message);
      res.status(HttpStatus.NOT_FOUND).send('Image non trouvée');
    }
  }
}
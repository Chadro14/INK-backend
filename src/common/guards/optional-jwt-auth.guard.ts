import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT optionnel.
 * 
 * - Si un token valide est fourni → req.user est rempli
 * - Si aucun token → req.user est null (pas d'erreur)
 * 
 * Utile pour les endpoints publics qui personnalisent la réponse
 * si l'utilisateur est connecté (ex: isLiked, isBookmarked).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Ne jamais lancer d'erreur — retourner null si pas de user
    return user || null;
  }
}

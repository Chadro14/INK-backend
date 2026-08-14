// src/modules/auth/dto/auth.dto.ts
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  IsOptional, 
  IsEnum, 
  IsDateString,
  IsNotEmpty,
  Matches
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export class RegisterDto {
  // ✅ PRÉNOM
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est requis' })
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  firstName: string;

  // ✅ NOM
  @IsString()
  @IsNotEmpty({ message: 'Le nom est requis' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  lastName: string;

  // ✅ NOM D'UTILISATEUR
  @IsString()
  @IsNotEmpty({ message: "Le nom d'utilisateur est requis" })
  @MinLength(3, { message: "Le nom d'utilisateur doit contenir au moins 3 caractères" })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores" 
  })
  username: string;

  // ✅ EMAIL
  @IsEmail({}, { message: 'Veuillez entrer un email valide' })
  email: string;

  // ✅ DATE DE NAISSANCE
  @IsDateString({}, { message: 'Veuillez entrer une date de naissance valide' })
  birthDate: string;

  // ✅ GENRE
  @IsEnum(Gender, { message: 'Veuillez sélectionner un genre valide' })
  gender: Gender;

  // ✅ MOT DE PASSE
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password: string;

  // ✅ CONFIRMER LE MOT DE PASSE
  @IsString()
  @IsNotEmpty({ message: 'Veuillez confirmer votre mot de passe' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  confirmPassword: string;

  // ✅ NUMÉRO DE TÉLÉPHONE (optionnel)
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]+$/, {
    message: 'Veuillez entrer un numéro de téléphone valide',
  })
  mobileNumber?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Veuillez entrer un email valide' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}

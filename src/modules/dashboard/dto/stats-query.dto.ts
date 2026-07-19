import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum StatsPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class StatsQueryDto {
  @IsOptional()
  @IsEnum(StatsPeriod)
  period?: StatsPeriod = StatsPeriod.MONTH;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
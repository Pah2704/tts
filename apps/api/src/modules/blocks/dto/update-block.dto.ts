import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateBlockDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsIn(['mono','dialog']) kind?: 'mono'|'dialog';
}

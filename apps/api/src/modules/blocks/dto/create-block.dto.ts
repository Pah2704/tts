import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateBlockDto {
  @IsString() projectId!: string;
  @IsIn(['mono','dialog']) kind!: 'mono' | 'dialog';
  @IsString() @MinLength(1) text!: string;
}

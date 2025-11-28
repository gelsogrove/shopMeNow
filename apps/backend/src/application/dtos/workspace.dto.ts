import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';
import { BaseDTO } from './base.dto';

/**
 * WorkspaceContactDTO - Contact information for workspace
 */
export class WorkspaceContactDTO {
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

/**
 * WorkspaceSocialDTO - Social media links for workspace
 */
export class WorkspaceSocialDTO {
  @IsUrl()
  @IsOptional()
  website?: string;

  @IsUrl()
  @IsOptional()
  facebook?: string;

  @IsUrl()
  @IsOptional()
  instagram?: string;

  @IsUrl()
  @IsOptional()
  twitter?: string;

  @IsUrl()
  @IsOptional()
  linkedIn?: string;
}

/**
 * WorkspaceSettingsDTO - Settings for workspace
 */
export class WorkspaceSettingsDTO {
  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsBoolean()
  @IsOptional()
  enableNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  enableAgentTyping?: boolean;
}

/**
 * WorkspaceDTO - Main workspace data transfer object 
 */
export class WorkspaceDTO extends BaseDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  ownerId?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumber?: string;

  @IsString()
  @IsOptional()
  whatsappApiToken?: string;

  @IsString()
  @IsOptional()
  whatsappWebhookUrl?: string;

  @IsString()
  @IsOptional()
  url?: string;

  @ValidateNested()
  @Type(() => WorkspaceContactDTO)
  @IsOptional()
  contact?: WorkspaceContactDTO;

  @ValidateNested()
  @Type(() => WorkspaceSocialDTO)
  @IsOptional()
  social?: WorkspaceSocialDTO;

  @ValidateNested()
  @Type(() => WorkspaceSettingsDTO)
  @IsOptional()
  settings?: WorkspaceSettingsDTO;

  @IsArray()
  @IsOptional()
  memberIds?: string[];
}

/**
 * CreateWorkspaceDTO - DTO for creating a new workspace
 */
export class CreateWorkspaceDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumber?: string;

  @IsString()
  @IsOptional()
  whatsappApiToken?: string;

  @IsString()
  @IsOptional()
  whatsappWebhookUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  url?: string;
}

/**
 * UpdateWorkspaceDTO - DTO for updating a workspace
 */
export class UpdateWorkspaceDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  whatsappPhoneNumber?: string;

  @IsString()
  @IsOptional()
  whatsappApiToken?: string;

  @IsString()
  @IsOptional()
  whatsappWebhookUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  url?: string;

  @ValidateNested()
  @Type(() => WorkspaceContactDTO)
  @IsOptional()
  contact?: WorkspaceContactDTO;

  @ValidateNested()
  @Type(() => WorkspaceSocialDTO)
  @IsOptional()
  social?: WorkspaceSocialDTO;

  @ValidateNested()
  @Type(() => WorkspaceSettingsDTO)
  @IsOptional()
  settings?: WorkspaceSettingsDTO;
}

export interface WorkspaceResponseDTO {
  id: string
  name: string
  slug: string
  description: string | null
  whatsappPhoneNumber: string | null
  whatsappApiToken: string | null
  whatsappWebhookUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  url?: string | null
}

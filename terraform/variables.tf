variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "ssh_public_key" {
  description = "SSH public key for EC2 access"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "shopme"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "shopme_user"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name"
  type        = string
  default     = "echatbot.ai"
}
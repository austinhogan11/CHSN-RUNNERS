variable "aws_region" {
  description = "AWS region used for CHSN-RUNNERS resources."
  type        = string
  default     = "us-east-1"
}

variable "clerk_issuer" {
  description = "Clerk Frontend API issuer used to verify session tokens."
  type        = string
  default     = ""
}

variable "clerk_authorized_parties" {
  description = "Comma-separated frontend origins allowed by Clerk token azp claims."
  type        = string
  default     = ""
}

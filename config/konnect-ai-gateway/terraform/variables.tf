variable "konnect_server_url" {
  description = "Konnect API base URL for the selected region. Keep kongctl --region aligned with this value."
  type        = string
  default     = "https://us.api.konghq.com"
}

variable "ai_gateway_name" {
  description = "Immutable AI Gateway name. Import an existing matching gateway before applying."
  type        = string
  default     = "insurance-demo"
}

variable "ai_gateway_display_name" {
  description = "Human-readable display name for the AI Gateway."
  type        = string
  default     = "Insurance Demo AI Gateway"
}

variable "data_plane_certificates" {
  description = "Version-keyed public data plane certificates. Keep old entries until every data plane has rotated."
  type = map(object({
    title            = string
    certificate_path = string
    description      = optional(string)
  }))

  validation {
    condition     = length(var.data_plane_certificates) > 0
    error_message = "Declare at least one public data plane certificate."
  }
}

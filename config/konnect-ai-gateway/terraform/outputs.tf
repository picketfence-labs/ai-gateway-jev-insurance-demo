output "ai_gateway_id" {
  description = "Konnect AI Gateway instance ID."
  value       = konnect_ai_gateway.insurance.id
}

output "configuration_endpoint" {
  description = "Configuration endpoint used by the hybrid data plane."
  value       = konnect_ai_gateway.insurance.endpoints.configuration
}

output "telemetry_endpoint" {
  description = "Telemetry endpoint used by the hybrid data plane."
  value       = konnect_ai_gateway.insurance.endpoints.telemetry
}

output "proxy_urls" {
  description = "AI Gateway proxy URLs reported by Konnect."
  value       = konnect_ai_gateway.insurance.proxy_urls
}

output "data_plane_certificate_ids" {
  description = "Konnect certificate IDs keyed by the local version key."
  value       = { for key, cert in konnect_ai_gateway_data_plane_certificate.dp : key => cert.id }
}

output "data_plane_certificate_expiry_unix" {
  description = "Certificate expiry timestamps keyed by the local version key."
  value       = { for key, cert in konnect_ai_gateway_data_plane_certificate.dp : key => cert.metadata.expiry }
}

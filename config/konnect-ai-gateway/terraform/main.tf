resource "konnect_ai_gateway" "insurance" {
  provider             = konnect
  name                 = var.ai_gateway_name
  display_name         = var.ai_gateway_display_name
  deployment_type      = "hybrid"
  min_runtime_version  = "2.2"
  runtime_auto_upgrade = false
  description          = "AI Gateway for the insurance demo"
}

resource "konnect_ai_gateway_data_plane_certificate" "dp" {
  provider = konnect
  for_each = var.data_plane_certificates

  gateway_id  = konnect_ai_gateway.insurance.id
  title       = each.value.title
  description = each.value.description
  cert        = file(each.value.certificate_path)

  # Adding a versioned certificate first keeps the current certificate present
  # until the data plane has been reconfigured and the old map key is removed.
  lifecycle {
    create_before_destroy = true
  }
}

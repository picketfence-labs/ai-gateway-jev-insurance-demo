terraform {
  required_version = ">= 1.5.0"

  required_providers {
    konnect = {
      source  = "kong/konnect"
      version = "= 3.25.0"
    }
  }
}

provider "konnect" {
  server_url = var.konnect_server_url
}

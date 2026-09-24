resource "aws_acm_certificate" "runner_custom_domain" {
  domain_name = "chosenrunning.com"

  subject_alternative_names = [
    "www.chosenrunning.com",
  ]

  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

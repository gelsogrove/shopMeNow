output "server_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.shopme_server.public_ip
}

output "server_public_dns" {
  description = "Public DNS of the EC2 instance"
  value       = aws_instance.shopme_server.public_dns
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.shopme_db.endpoint
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/shopme-key ec2-user@${aws_instance.shopme_server.public_ip}"
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "http://${aws_instance.shopme_server.public_ip}:3000"
}

output "backend_url" {
  description = "Backend URL"
  value       = "http://${aws_instance.shopme_server.public_ip}:3001"
}

output "domain_nameservers" {
  description = "Route 53 nameservers - Configure these in GoDaddy"
  value       = aws_route53_zone.main.name_servers
}

output "domain_url" {
  description = "Domain URL (after DNS propagation)"
  value       = "https://${var.domain_name}"
}

output "s3_uploads_bucket" {
  description = "S3 bucket for uploads (images, invoices)"
  value       = aws_s3_bucket.uploads.bucket
}

output "s3_backups_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.bucket
}